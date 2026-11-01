/**
 * PipelineShield CI Run Reconciliation & Retry Engine.
 *
 * Provides resilient, retry-safe discovery of completed GitHub Actions runs
 * to reconcile any events missed during local tunnel disconnects or webhook outages.
 *
 * Guarantees:
 * - Idempotent: strictly skips already-ingested runs without redundant downloads.
 * - Retry-safe: exponential backoff on transient network or 5xx upstream errors.
 * - Non-authoritative: only ingests verified artifacts produced by the CI workflow.
 * - Safe error recording: logs clean, actionable messages without exposing tokens.
 */

import {
  fetchGitHubRunReport,
  getGitHubHeaders,
  DEFAULT_REPO,
  TARGET_WORKFLOW_FILE,
  TARGET_WORKFLOW_NAME,
  type FetchReportOptions,
  type GitHubWorkflowRun,
} from "./github-ingestion.ts";
import {
  getRunById,
  recordIngestionError,
  getStoreDiagnostics,
  getAllRuns,
  type StoredRun,
} from "./run-store.ts";

export interface ReconciliationResult {
  success: boolean;
  totalDiscovered: number;
  reconciledCount: number;
  skippedCount: number;
  reconciledRunIds: number[];
  errors: string[];
  lastSync: string;
  dataFreshness: string;
  storedRuns: StoredRun[];
}

export interface RetryOptions {
  maxRetries?: number;
  initialBackoffMs?: number;
  backoffMultiplier?: number;
  timeoutMs?: number;
}

/**
 * Execute a fetch operation with exponential backoff on transient errors (timeouts, 5xx).
 * Immediately fails fast on non-transient client errors (401, 403, 404).
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: RetryOptions = {},
  customFetch: typeof fetch = globalThis.fetch
): Promise<Response> {
  const maxRetries = options.maxRetries ?? 3;
  const initialBackoff = options.initialBackoffMs ?? 300;
  const multiplier = options.backoffMultiplier ?? 2;
  const timeoutMs = options.timeoutMs ?? 10000;

  let lastError: unknown;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const response = await customFetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });

      // Transient upstream errors worth retrying
      if (
        (response.status === 500 ||
          response.status === 502 ||
          response.status === 503 ||
          response.status === 504) &&
        attempt < maxRetries
      ) {
        attempt++;
        const backoff = initialBackoff * Math.pow(multiplier, attempt - 1) + Math.random() * 100;
        await new Promise((res) => setTimeout(res, backoff));
        continue;
      }

      return response;
    } catch (err) {
      lastError = err;
      attempt++;

      if (attempt <= maxRetries) {
        const backoff = initialBackoff * Math.pow(multiplier, attempt - 1) + Math.random() * 100;
        await new Promise((res) => setTimeout(res, backoff));
      } else {
        break;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Fetch failed after ${maxRetries} retries: ${String(lastError)}`);
}

/**
 * Format timestamp into human-readable data freshness.
 */
export function formatDataFreshness(timestamp: string | null): string {
  if (!timestamp) return "Never synced";
  const diffMs = Date.now() - new Date(timestamp).getTime();
  if (isNaN(diffMs) || diffMs < 0) return "Just now";

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 30) return "Just now";
  if (diffSec < 60) return `${diffSec} seconds ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

/**
 * Discovers recent completed workflow runs from GitHub Actions and reconciles any
 * runs not yet present in the durable store.
 */
export async function reconcileRecentRuns(
  options: FetchReportOptions & { limit?: number } = {}
): Promise<ReconciliationResult> {
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const repo = options.repo ?? process.env.GITHUB_REPOSITORY ?? DEFAULT_REPO;
  const customFetch = options.fetchFn ?? globalThis.fetch;
  const limit = options.limit ?? 10;
  const now = new Date().toISOString();

  const errors: string[] = [];
  const reconciledRunIds: number[] = [];
  let totalDiscovered = 0;
  let skippedCount = 0;

  if (!token || !token.trim()) {
    const errMsg = "Missing GITHUB_TOKEN for GitHub reconciliation.";
    recordIngestionError(errMsg);
    return {
      success: false,
      totalDiscovered: 0,
      reconciledCount: 0,
      skippedCount: 0,
      reconciledRunIds: [],
      errors: [errMsg],
      lastSync: now,
      dataFreshness: formatDataFreshness(now),
      storedRuns: getAllRuns(),
    };
  }

  // 1. Fetch completed runs for target workflow
  let candidateRuns: GitHubWorkflowRun[] = [];
  try {
    const workflowUrl = `https://api.github.com/repos/${repo}/actions/workflows/${TARGET_WORKFLOW_FILE}/runs?status=completed&per_page=${limit}`;
    const res = await fetchWithRetry(
      workflowUrl,
      {
        headers: getGitHubHeaders(token),
        cache: "no-store",
      },
      { maxRetries: 2, timeoutMs: options.timeoutMs },
      customFetch
    );

    if (res.ok) {
      const data = await res.json();
      candidateRuns = Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
    } else if (res.status === 404) {
      // Fallback: fetch all repository workflow runs and filter by workflow name
      const fallbackUrl = `https://api.github.com/repos/${repo}/actions/runs?status=completed&per_page=${limit * 2}`;
      const fallbackRes = await fetchWithRetry(
        fallbackUrl,
        {
          headers: getGitHubHeaders(token),
          cache: "no-store",
        },
        { maxRetries: 2, timeoutMs: options.timeoutMs },
        customFetch
      );

      if (fallbackRes.ok) {
        const data = await fallbackRes.json();
        const allRuns: GitHubWorkflowRun[] = Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
        candidateRuns = allRuns.filter(
          (r) =>
            r.name === TARGET_WORKFLOW_NAME ||
            r.name?.toLowerCase() === TARGET_WORKFLOW_NAME.toLowerCase() ||
            r.path?.endsWith(TARGET_WORKFLOW_FILE)
        );
      } else {
        const err = `Failed to list workflow runs for reconciliation (HTTP ${fallbackRes.status}).`;
        errors.push(err);
        recordIngestionError(err);
      }
    } else {
      const err = `Failed to list runs for ${TARGET_WORKFLOW_FILE} (HTTP ${res.status}).`;
      errors.push(err);
      recordIngestionError(err);
    }
  } catch (err) {
    const errText = `Network error during run reconciliation: ${
      err instanceof Error ? err.message : String(err)
    }`;
    errors.push(errText);
    recordIngestionError(errText);
  }

  totalDiscovered = candidateRuns.length;

  // 2. Iterate and reconcile missing runs (oldest first, so newest becomes latest)
  const runsToProcess = [...candidateRuns].reverse();

  for (const run of runsToProcess) {
    // Deduplication check: skip if already present in durable store
    const existing = getRunById(run.id);
    if (existing) {
      skippedCount++;
      continue;
    }

    try {
      const ingestion = await fetchGitHubRunReport(run.id, {
        ...options,
        token,
        repo,
      });

      if (ingestion.status === 200 && ingestion.body.success) {
        reconciledRunIds.push(run.id);
      } else {
        const msg = `Run #${run.id} reconciliation failed: ${ingestion.body.error || "Artifact missing"}`;
        errors.push(msg);
        recordIngestionError(msg, run.id);
      }
    } catch (ingestErr) {
      const msg = `Run #${run.id} reconciliation error: ${
        ingestErr instanceof Error ? ingestErr.message : String(ingestErr)
      }`;
      errors.push(msg);
      recordIngestionError(msg, run.id);
    }
  }

  const diagnostics = getStoreDiagnostics();

  return {
    success: errors.length === 0,
    totalDiscovered,
    reconciledCount: reconciledRunIds.length,
    skippedCount,
    reconciledRunIds,
    errors,
    lastSync: diagnostics.lastSuccessfulSync || now,
    dataFreshness: formatDataFreshness(diagnostics.lastSuccessfulSync),
    storedRuns: getAllRuns(),
  };
}

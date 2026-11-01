/**
 * PipelineShield Live GitHub Actions Report Ingestion Core.
 *
 * Encapsulates GitHub API querying, deterministic run selection, artifact download,
 * in-memory ZIP extraction, and contract schema validation.
 *
 * Hard security boundaries:
 * - Server-side only: GITHUB_TOKEN is read exclusively on the server and never sent to clients.
 * - Zero disk I/O: Pure in-memory ZIP processing prevents filesystem vulnerabilities.
 * - Strict deterministic targeting: Fetches solely from 'security-gate.yml' in 'YogamruthReddy/PipelineShield'.
 * - No silent fallbacks: Never falls back to unrelated workflows, unverified runs, or synthetic samples.
 */

import { extractFileFromZip } from "./zip-extractor.ts";
import { validateReportSchema } from "./report-validator.ts";
import { recordRun } from "./run-store.ts";
import type { EvaluationResult } from "../types/dashboard.ts";

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  head_sha: string;
  head_branch: string;
  event: string;
  created_at: string;
  updated_at: string;
  path?: string;
  run_number?: number;
  workflow_id?: number;
}

export interface GitHubArtifact {
  id: number;
  node_id: string;
  name: string;
  size_in_bytes: number;
  url: string;
  archive_download_url: string;
  expired: boolean;
  created_at: string;
  updated_at: string;
}

export interface FetchReportOptions {
  token?: string;
  repo?: string;
  runId?: number;
  isRefresh?: boolean;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  maxArchiveSizeBytes?: number;
  targetWorkflowFile?: string;
  targetWorkflowName?: string;
  targetWorkflowId?: number;
}

export interface IngestionResult {
  status: number;
  headers?: Record<string, string>;
  body: {
    success: boolean;
    error?: string;
    report?: unknown;
    run?: {
      id: number;
      name: string;
      status: string;
      conclusion: string | null;
      html_url: string;
      head_sha: string;
      head_branch: string;
      event: string;
      created_at: string;
      updated_at: string;
    };
    artifact?: {
      id?: number;
      name: string;
      size_in_bytes?: number;
      expired: boolean;
      created_at?: string;
    };
    fetched_at?: string;
  };
}

export const DEFAULT_REPO = "YogamruthReddy/PipelineShield";
export const TARGET_WORKFLOW_FILE = "security-gate.yml";
export const TARGET_WORKFLOW_NAME = "CI Security Gate";
export const REPORT_ARTIFACT_NAME = "security-summary-reports";
export const TARGET_REPORT_FILE = "security-summary.json";
export const ALTERNATE_REPORT_FILE = "security_summary_report.json";
export const DEFAULT_FETCH_TIMEOUT_MS = 10000;
export const DEFAULT_MAX_ARCHIVE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function getGitHubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "PipelineShield-LiveIngestion/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  return headers;
}

export async function fetchLatestGitHubReport(
  options: FetchReportOptions = {}
): Promise<IngestionResult> {
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const repo = options.repo ?? process.env.GITHUB_REPOSITORY ?? DEFAULT_REPO;
  const isRefresh = options.isRefresh ?? false;
  const customFetch = options.fetchFn ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const maxArchiveSize = options.maxArchiveSizeBytes ?? DEFAULT_MAX_ARCHIVE_SIZE_BYTES;

  if (!token || !token.trim()) {
    return {
      status: 401,
      body: {
        success: false,
        error:
          "GITHUB_TOKEN environment variable is not configured. Live ingestion requires a valid token with Actions and Metadata read permissions.",
      },
    };
  }

  try {
    // ------------------------------------------------------------------
    // Step 1: Query GitHub Actions for workflow runs (or specific run)
    // ------------------------------------------------------------------
    const targetWorkflowFile = options.targetWorkflowFile ?? TARGET_WORKFLOW_FILE;
    const targetWorkflowName = options.targetWorkflowName ?? TARGET_WORKFLOW_NAME;
    const targetWorkflowId = options.targetWorkflowId;

    let latestRun: GitHubWorkflowRun;

    if (options.runId !== undefined) {
      const singleRunApiUrl = `https://api.github.com/repos/${repo}/actions/runs/${options.runId}`;
      const singleRunRes = await customFetch(singleRunApiUrl, {
        headers: getGitHubHeaders(token),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });

      if (!singleRunRes.ok) {
        if (singleRunRes.status === 404) {
          return {
            status: 404,
            body: {
              success: false,
              error: `Workflow run #${options.runId} not found in repository '${repo}'.`,
            },
          };
        }
        return {
          status: singleRunRes.status >= 500 ? 502 : singleRunRes.status,
          body: {
            success: false,
            error: `GitHub API returned status ${singleRunRes.status} when querying run #${options.runId}.`,
          },
        };
      }

      latestRun = (await singleRunRes.json()) as GitHubWorkflowRun;
      if (latestRun.status !== "completed") {
        return {
          status: 409,
          body: {
            success: false,
            error: `Workflow run #${options.runId} is not completed (status: '${latestRun.status}').`,
          },
        };
      }
    } else {
      const runsApiUrl = `https://api.github.com/repos/${repo}/actions/runs?per_page=30`;

      const runsResponse = await customFetch(runsApiUrl, {
        headers: getGitHubHeaders(token),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });

      if (!runsResponse.ok) {
        if (runsResponse.status === 401) {
          return {
            status: 401,
            body: {
              success: false,
              error:
                "GitHub authentication failed (401). Verify that GITHUB_TOKEN is valid and has not expired or been revoked.",
            },
          };
        }
        if (runsResponse.status === 403) {
          const rateRemaining = runsResponse.headers.get("x-ratelimit-remaining");
          const rateReset = runsResponse.headers.get("x-ratelimit-reset");
          if (rateRemaining === "0") {
            const resetDate = rateReset ? new Date(Number(rateReset) * 1000).toISOString() : "soon";
            return {
              status: 429,
              body: {
                success: false,
                error: `GitHub API rate limit exceeded. Limit resets at ${resetDate}.`,
              },
            };
          }
          return {
            status: 403,
            body: {
              success: false,
              error: `GitHub API access forbidden (403) for repository '${repo}'. Verify token permissions (Actions: Read, Metadata: Read).`,
            },
          };
        }
        if (runsResponse.status === 404) {
          return {
            status: 404,
            body: {
              success: false,
              error: `Repository '${repo}' not found on GitHub (404). Check GITHUB_REPOSITORY configuration.`,
            },
          };
        }
        return {
          status: 502,
          body: {
            success: false,
            error: `GitHub API returned upstream error ${runsResponse.status}: ${runsResponse.statusText}`,
          },
        };
      }

      const runsData = (await runsResponse.json()) as { workflow_runs?: GitHubWorkflowRun[] };
      const allRuns = runsData.workflow_runs || [];

      // Filter strictly for completed security gate runs
      // Hard deterministic targeting:
      // 1. Matches workflow ID if explicitly specified or present
      // 2. Matches exact workflow file path (e.g. .github/workflows/security-gate.yml)
      // 3. Or matches exact canonical workflow title ("CI Security Gate", "Security Gate", "DevSecOps Policy Enforcement Gate")
      // Include all completed conclusions (success, failure) because policy BLOCK or ERROR gates fail closed with reports
      const targetWorkflowPath = `.github/workflows/${targetWorkflowFile}`;
      const eligibleRuns = allRuns.filter((r) => {
        const isCompleted = r.status === "completed";
        if (!isCompleted) return false;

        if (targetWorkflowId !== undefined && r.workflow_id !== undefined) {
          return r.workflow_id === targetWorkflowId;
        }

        const name = (r.name || "").trim();
        const path = (r.path || "").trim();

        const matchesPath =
          Boolean(path) &&
          (path === targetWorkflowPath ||
            path.endsWith(`/${targetWorkflowFile}`) ||
            path === targetWorkflowFile);

        const matchesName =
          name === targetWorkflowName ||
          name.toLowerCase() === targetWorkflowName.toLowerCase() ||
          name === "DevSecOps Policy Enforcement Gate" ||
          name.toLowerCase() === "devsecops policy enforcement gate" ||
          name === "Security Gate" ||
          name.toLowerCase() === "security gate";

        return matchesPath || matchesName;
      });

      // Hard boundary: Strictly DO NOT fall back to arbitrary unrelated workflows
      if (eligibleRuns.length === 0) {
        return {
          status: 404,
          body: {
            success: false,
            error: `No completed security-gate workflow runs found for repository '${repo}'.`,
          },
        };
      }

      // Explicitly and deterministically order eligible runs:
      // 1. Highest run_number first (most recent sequential CI run)
      // 2. Newest created_at timestamp tie-breaker
      eligibleRuns.sort((a, b) => {
        const numA = typeof a.run_number === "number" ? a.run_number : a.id;
        const numB = typeof b.run_number === "number" ? b.run_number : b.id;
        if (numB !== numA) {
          return numB - numA;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      latestRun = eligibleRuns[0];
    }

    // ------------------------------------------------------------------
    // Step 2: Query artifacts for the selected completed run
    // ------------------------------------------------------------------
    const artifactsApiUrl = `https://api.github.com/repos/${repo}/actions/runs/${latestRun.id}/artifacts`;
    const artifactsResponse = await customFetch(artifactsApiUrl, {
      headers: getGitHubHeaders(token),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });

    if (!artifactsResponse.ok) {
      return {
        status: 502,
        body: {
          success: false,
          error: `Failed to retrieve artifacts for run #${latestRun.id} (HTTP ${artifactsResponse.status}).`,
          run: {
            id: latestRun.id,
            name: latestRun.name,
            status: latestRun.status,
            conclusion: latestRun.conclusion,
            html_url: latestRun.html_url,
            head_sha: latestRun.head_sha,
            head_branch: latestRun.head_branch,
            event: latestRun.event,
            created_at: latestRun.created_at,
            updated_at: latestRun.updated_at,
          },
        },
      };
    }

    const artifactsData = (await artifactsResponse.json()) as { artifacts?: GitHubArtifact[] };
    const artifacts = artifactsData.artifacts || [];

    const targetArtifact = artifacts.find((a) => a.name === REPORT_ARTIFACT_NAME);

    if (!targetArtifact) {
      return {
        status: 404,
        body: {
          success: false,
          error: `Run #${latestRun.id} (${latestRun.conclusion || "unknown"}) does not contain artifact '${REPORT_ARTIFACT_NAME}'.`,
          run: {
            id: latestRun.id,
            name: latestRun.name,
            status: latestRun.status,
            conclusion: latestRun.conclusion,
            html_url: latestRun.html_url,
            head_sha: latestRun.head_sha,
            head_branch: latestRun.head_branch,
            event: latestRun.event,
            created_at: latestRun.created_at,
            updated_at: latestRun.updated_at,
          },
        },
      };
    }

    if (targetArtifact.expired) {
      return {
        status: 410,
        body: {
          success: false,
          error: `Artifact '${REPORT_ARTIFACT_NAME}' from run #${latestRun.id} has expired on GitHub. Please re-run the CI workflow.`,
          run: {
            id: latestRun.id,
            name: latestRun.name,
            status: latestRun.status,
            conclusion: latestRun.conclusion,
            html_url: latestRun.html_url,
            head_sha: latestRun.head_sha,
            head_branch: latestRun.head_branch,
            event: latestRun.event,
            created_at: latestRun.created_at,
            updated_at: latestRun.updated_at,
          },
          artifact: {
            id: targetArtifact.id,
            name: targetArtifact.name,
            size_in_bytes: targetArtifact.size_in_bytes,
            expired: true,
            created_at: targetArtifact.created_at,
          },
        },
      };
    }

    // ------------------------------------------------------------------
    // Step 3: Download artifact ZIP archive
    // ------------------------------------------------------------------
    const downloadUrl = `https://api.github.com/repos/${repo}/actions/artifacts/${targetArtifact.id}/zip`;
    const downloadResponse = await customFetch(downloadUrl, {
      headers: getGitHubHeaders(token),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });

    if (!downloadResponse.ok) {
      return {
        status: 502,
        body: {
          success: false,
          error: `Failed to download artifact archive #${targetArtifact.id} (HTTP ${downloadResponse.status}).`,
          run: {
            id: latestRun.id,
            name: latestRun.name,
            status: latestRun.status,
            conclusion: latestRun.conclusion,
            html_url: latestRun.html_url,
            head_sha: latestRun.head_sha,
            head_branch: latestRun.head_branch,
            event: latestRun.event,
            created_at: latestRun.created_at,
            updated_at: latestRun.updated_at,
          },
        },
      };
    }

    const arrayBuffer = await downloadResponse.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuffer);

    if (zipBuffer.length > maxArchiveSize) {
      return {
        status: 413,
        body: {
          success: false,
          error: `Downloaded archive size (${zipBuffer.length} bytes) exceeds safety limit of ${maxArchiveSize} bytes.`,
        },
      };
    }

    // ------------------------------------------------------------------
    // Step 4: Extract report JSON in memory (supports primary and alternate names)
    // ------------------------------------------------------------------
    let extracted;
    try {
      try {
        extracted = extractFileFromZip(zipBuffer, TARGET_REPORT_FILE);
      } catch (firstErr) {
        try {
          extracted = extractFileFromZip(zipBuffer, ALTERNATE_REPORT_FILE);
        } catch {
          throw firstErr;
        }
      }
    } catch (extractErr) {
      return {
        status: 502,
        body: {
          success: false,
          error: `Failed to extract '${TARGET_REPORT_FILE}' from artifact: ${
            extractErr instanceof Error ? extractErr.message : String(extractErr)
          }`,
          run: {
            id: latestRun.id,
            name: latestRun.name,
            status: latestRun.status,
            conclusion: latestRun.conclusion,
            html_url: latestRun.html_url,
            head_sha: latestRun.head_sha,
            head_branch: latestRun.head_branch,
            event: latestRun.event,
            created_at: latestRun.created_at,
            updated_at: latestRun.updated_at,
          },
        },
      };
    }

    // ------------------------------------------------------------------
    // Step 5: Parse and validate report against authoritative contract schema
    // ------------------------------------------------------------------
    let reportObj: unknown;
    try {
      reportObj = JSON.parse(extracted.content);
    } catch (parseErr) {
      return {
        status: 502,
        body: {
          success: false,
          error: `Extracted '${extracted.fileName}' contains invalid JSON: ${
            parseErr instanceof Error ? parseErr.message : String(parseErr)
          }`,
        },
      };
    }

    const validation = validateReportSchema(reportObj);
    if (!validation.valid) {
      return {
        status: 502,
        body: {
          success: false,
          error: `Report schema validation failed: ${validation.error}`,
        },
      };
    }

    // ------------------------------------------------------------------
    // Step 6: Return authoritative live report payload & record in RunStore
    // ------------------------------------------------------------------
    const rawReport = reportObj as EvaluationResult;
    const enrichedReport: EvaluationResult = {
      ...rawReport,
      branch: rawReport.branch || latestRun.head_branch,
      commit_sha: rawReport.commit_sha || latestRun.head_sha,
    };

    try {
      recordRun(
        {
          id: latestRun.id,
          name: latestRun.name,
          status: latestRun.status,
          conclusion: latestRun.conclusion,
          html_url: latestRun.html_url,
          head_sha: latestRun.head_sha,
          head_branch: latestRun.head_branch,
          event: latestRun.event,
          created_at: latestRun.created_at,
          updated_at: latestRun.updated_at,
          run_number: latestRun.run_number,
        },
        enrichedReport,
        {
          id: targetArtifact.id,
          name: targetArtifact.name,
          size_in_bytes: targetArtifact.size_in_bytes,
          expired: targetArtifact.expired,
          created_at: targetArtifact.created_at,
        }
      );
    } catch {
      // In-memory run recording is non-blocking
    }

    const responsePayload = {
      success: true,
      report: enrichedReport,
      run: {
        id: latestRun.id,
        name: latestRun.name,
        status: latestRun.status,
        conclusion: latestRun.conclusion,
        html_url: latestRun.html_url,
        head_sha: latestRun.head_sha,
        head_branch: latestRun.head_branch,
        event: latestRun.event,
        created_at: latestRun.created_at,
        updated_at: latestRun.updated_at,
      },
      artifact: {
        id: targetArtifact.id,
        name: targetArtifact.name,
        size_in_bytes: targetArtifact.size_in_bytes,
        expired: targetArtifact.expired,
        created_at: targetArtifact.created_at,
      },
      fetched_at: new Date().toISOString(),
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (isRefresh) {
      headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
    } else {
      headers["Cache-Control"] = "public, s-maxage=15, stale-while-revalidate=30";
    }

    return {
      status: 200,
      headers,
      body: responsePayload,
    };
  } catch (err: unknown) {
    const isTimeout =
      err instanceof Error &&
      (err.name === "TimeoutError" || err.message.toLowerCase().includes("timeout"));
    const statusCode = isTimeout ? 504 : 500;
    const errorMsg = isTimeout
      ? "GitHub API request timed out after 10 seconds."
      : `Internal error while retrieving latest report: ${
          err instanceof Error ? err.message : String(err)
        }`;

    return {
      status: statusCode,
      body: {
        success: false,
        error: errorMsg,
      },
    };
  }
}

/**
 * Fetch authoritative report artifact for a specific completed GitHub Actions run.
 */
export async function fetchGitHubRunReport(
  runId: number,
  options: FetchReportOptions = {}
): Promise<IngestionResult> {
  return fetchLatestGitHubReport({
    ...options,
    runId,
  });
}

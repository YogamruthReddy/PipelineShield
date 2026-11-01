/**
 * PipelineShield Read-Only GitHub Workspace Service Library
 *
 * Provides account-wide repository discovery, repository security overview,
 * pull request inspection, changed-file diff retrieval, and security posture auditing.
 *
 * Hard security boundaries:
 * - Read-only operations only: Zero mutation/write API calls (no POST/PUT/PATCH/DELETE).
 * - Server-side only: GITHUB_TOKEN is read strictly on the server and never returned to clients.
 * - Rate-limit aware: Tracks and propagates rate-limit remaining and reset headers.
 * - Permission transparent: Clearly distinguishes "disabled", "not accessible", "not configured", and "no findings".
 *   Never assumes missing permissions mean a clean security posture.
 */

import { dryRunApplyPatch } from "./patch-validator.ts";
import type {
  GitHubTreeItem,
  GitHubBranchSummary,
  GitHubPermissionScope,
} from "../types/dashboard.ts";

export interface GitHubRepositorySummary {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  updatedAt: string;
  pushedAt: string;
  openIssuesCount: number;
  visibility: "public" | "private" | "internal";
  archived: boolean;
}

export interface GitHubPullRequestSummary {
  number: number;
  title: string;
  state: "open" | "closed";
  draft: boolean;
  htmlUrl: string;
  user: {
    login: string;
    avatarUrl?: string;
  };
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  labels: string[];
}

export interface GitHubChangedFile {
  filename: string;
  status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";
  additions: number;
  deletions: number;
  changes: number;
  rawUrl?: string;
  patch?: string; // Unified diff hunk string
}

export interface GitHubCheckRunSummary {
  id: number;
  name: string;
  headSha: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: "success" | "failure" | "neutral" | "cancelled" | "timed_out" | "action_required" | "skipped" | null;
  htmlUrl: string;
  startedAt?: string;
  completedAt?: string;
}

export type SecurityFeatureStatus =
  | "configured"
  | "not_configured"
  | "disabled"
  | "not_accessible"
  | "no_findings"
  | "findings_present"
  | "unavailable";

export interface GitHubSecurityPosture {
  branchProtection: {
    enabled: boolean;
    status: SecurityFeatureStatus;
    requiredStatusChecks: string[];
    enforceAdmins: boolean;
    requiredApprovingReviewsCount: number;
    details?: string;
  };
  dependabot: {
    status: SecurityFeatureStatus;
    openAlertsCount?: number;
    details?: string;
  };
  codeScanning: {
    status: SecurityFeatureStatus;
    openAlertsCount?: number;
    details?: string;
  };
  secretScanning: {
    status: SecurityFeatureStatus;
    openAlertsCount?: number;
    details?: string;
  };
}

export interface RepositoryOverviewResult {
  repository: GitHubRepositorySummary;
  recentRuns: Array<{
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    htmlUrl: string;
    headBranch: string;
    headSha: string;
    event: string;
    createdAt: string;
  }>;
  recentPullRequests: GitHubPullRequestSummary[];
  securityPosture: GitHubSecurityPosture;
  lastSyncedAt: string;
  rateLimit: {
    remaining: number;
    limit: number;
    reset: number;
  };
}

export interface GitHubServiceOptions {
  token?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10000;

export function getGitHubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "PipelineShield-SecurityWorkspace/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  return headers;
}

function parseRateLimit(headers: Headers): { remaining: number; limit: number; reset: number } {
  return {
    remaining: parseInt(headers.get("x-ratelimit-remaining") || "60", 10),
    limit: parseInt(headers.get("x-ratelimit-limit") || "60", 10),
    reset: parseInt(headers.get("x-ratelimit-reset") || "0", 10),
  };
}

/**
 * Account-Wide Repository Discovery
 * Lists repositories the authenticated token can access, supporting search, visibility filtering, and pagination.
 */
export async function listAccountRepositories(
  options: GitHubServiceOptions & {
    page?: number;
    perPage?: number;
    search?: string;
    visibility?: "all" | "public" | "private";
  } = {}
): Promise<{
  success: boolean;
  repositories: GitHubRepositorySummary[];
  totalEstimate?: number;
  page: number;
  rateLimit?: { remaining: number; limit: number; reset: number };
  error?: string;
  statusCode: number;
}> {
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const customFetch = options.fetchFn ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.min(100, Math.max(1, options.perPage ?? 30));

  if (!token || !token.trim()) {
    return {
      success: false,
      repositories: [],
      page,
      statusCode: 401,
      error: "GITHUB_TOKEN is not configured on the server. Account-wide repository discovery requires a valid token with repo/read permissions.",
    };
  }

  try {
    const visibilityParam = options.visibility && options.visibility !== "all" ? `&visibility=${options.visibility}` : "";
    const url = `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated${visibilityParam}`;

    const res = await customFetch(url, {
      headers: getGitHubHeaders(token),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });

    const rateLimit = parseRateLimit(res.headers);

    if (!res.ok) {
      if (res.status === 401) {
        return {
          success: false,
          repositories: [],
          page,
          rateLimit,
          statusCode: 401,
          error: "GitHub token authentication failed (HTTP 401). Please verify token validity.",
        };
      }
      if (res.status === 403) {
        return {
          success: false,
          repositories: [],
          page,
          rateLimit,
          statusCode: 403,
          error: "Access forbidden or GitHub API rate limit reached (HTTP 403).",
        };
      }
      return {
        success: false,
        repositories: [],
        page,
        rateLimit,
        statusCode: res.status,
        error: `GitHub API error (HTTP ${res.status}).`,
      };
    }

    const rawRepos = (await res.json()) as Array<Record<string, unknown>>;
    let repos: GitHubRepositorySummary[] = rawRepos.map((r) => ({
      id: Number(r.id),
      name: String(r.name || ""),
      fullName: String(r.full_name || ""),
      owner: (r.owner as Record<string, unknown>)?.login ? String((r.owner as Record<string, unknown>).login) : "",
      description: r.description ? String(r.description) : null,
      private: Boolean(r.private),
      defaultBranch: String(r.default_branch || "main"),
      htmlUrl: String(r.html_url || ""),
      updatedAt: String(r.updated_at || ""),
      pushedAt: String(r.pushed_at || ""),
      openIssuesCount: Number(r.open_issues_count || 0),
      visibility: (r.visibility as "public" | "private" | "internal") || (r.private ? "private" : "public"),
      archived: Boolean(r.archived),
    }));

    // Client-side search filtering if search term provided
    if (options.search && options.search.trim()) {
      const q = options.search.trim().toLowerCase();
      repos = repos.filter(
        (r) => r.fullName.toLowerCase().includes(q) || (r.description && r.description.toLowerCase().includes(q))
      );
    }

    return {
      success: true,
      repositories: repos,
      page,
      rateLimit,
      statusCode: 200,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      repositories: [],
      page,
      statusCode: 502,
      error: `Failed to discover GitHub repositories: ${msg}`,
    };
  }
}

/**
 * Repository Security Overview & Posture
 * Gathers repo details, recent workflow runs, recent PRs, and audits branch protection,
 * Dependabot, code scanning, and secret scanning status.
 */
export async function getRepositoryOverview(
  repoFullName: string,
  options: GitHubServiceOptions = {}
): Promise<{
  success: boolean;
  overview?: RepositoryOverviewResult;
  error?: string;
  statusCode: number;
}> {
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const customFetch = options.fetchFn ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!token || !token.trim()) {
    return {
      success: false,
      statusCode: 401,
      error: "GITHUB_TOKEN is required for repository overview inspection.",
    };
  }

  try {
    // 1. Fetch Repository Metadata
    const repoRes = await customFetch(`https://api.github.com/repos/${repoFullName}`, {
      headers: getGitHubHeaders(token),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });

    if (!repoRes.ok) {
      return {
        success: false,
        statusCode: repoRes.status,
        error: `Could not access repository '${repoFullName}' (HTTP ${repoRes.status}). Verify permissions.`,
      };
    }

    const rateLimit = parseRateLimit(repoRes.headers);
    const r = (await repoRes.json()) as Record<string, unknown>;
    const defaultBranch = String(r.default_branch || "main");

    const repoSummary: GitHubRepositorySummary = {
      id: Number(r.id),
      name: String(r.name || ""),
      fullName: String(r.full_name || repoFullName),
      owner: (r.owner as Record<string, unknown>)?.login ? String((r.owner as Record<string, unknown>).login) : "",
      description: r.description ? String(r.description) : null,
      private: Boolean(r.private),
      defaultBranch,
      htmlUrl: String(r.html_url || ""),
      updatedAt: String(r.updated_at || ""),
      pushedAt: String(r.pushed_at || ""),
      openIssuesCount: Number(r.open_issues_count || 0),
      visibility: (r.visibility as "public" | "private" | "internal") || (r.private ? "private" : "public"),
      archived: Boolean(r.archived),
    };

    // 2. Fetch Recent Workflow Runs (up to 10)
    let recentRuns: RepositoryOverviewResult["recentRuns"] = [];
    try {
      const runsRes = await customFetch(
        `https://api.github.com/repos/${repoFullName}/actions/runs?per_page=10`,
        {
          headers: getGitHubHeaders(token),
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        }
      );
      if (runsRes.ok) {
        const runsData = (await runsRes.json()) as { workflow_runs?: Array<Record<string, unknown>> };
        if (Array.isArray(runsData.workflow_runs)) {
          recentRuns = runsData.workflow_runs.map((run) => ({
            id: Number(run.id),
            name: String(run.name || "CI Workflow"),
            status: String(run.status || ""),
            conclusion: run.conclusion ? String(run.conclusion) : null,
            htmlUrl: String(run.html_url || ""),
            headBranch: String(run.head_branch || ""),
            headSha: String(run.head_sha || "").slice(0, 7),
            event: String(run.event || ""),
            createdAt: String(run.created_at || ""),
          }));
        }
      }
    } catch {
      // Non-blocking if actions is disabled
    }

    // 3. Fetch Recent Pull Requests (up to 10)
    let recentPullRequests: GitHubPullRequestSummary[] = [];
    try {
      const pullsRes = await customFetch(
        `https://api.github.com/repos/${repoFullName}/pulls?state=all&per_page=10&sort=updated&direction=desc`,
        {
          headers: getGitHubHeaders(token),
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        }
      );
      if (pullsRes.ok) {
        const rawPulls = (await pullsRes.json()) as Array<Record<string, unknown>>;
        recentPullRequests = rawPulls.map((pr) => ({
          number: Number(pr.number),
          title: String(pr.title || ""),
          state: (pr.state as "open" | "closed") || "open",
          draft: Boolean(pr.draft),
          htmlUrl: String(pr.html_url || ""),
          user: {
            login: String((pr.user as Record<string, unknown>)?.login || "unknown"),
            avatarUrl: (pr.user as Record<string, unknown>)?.avatar_url
              ? String((pr.user as Record<string, unknown>).avatar_url)
              : undefined,
          },
          head: {
            ref: String((pr.head as Record<string, unknown>)?.ref || ""),
            sha: String((pr.head as Record<string, unknown>)?.sha || ""),
          },
          base: {
            ref: String((pr.base as Record<string, unknown>)?.ref || ""),
            sha: String((pr.base as Record<string, unknown>)?.sha || ""),
          },
          createdAt: String(pr.created_at || ""),
          updatedAt: String(pr.updated_at || ""),
          mergedAt: pr.merged_at ? String(pr.merged_at) : null,
          labels: Array.isArray(pr.labels)
            ? (pr.labels as Array<{ name?: string }>).map((l) => String(l.name || "")).filter(Boolean)
            : [],
        }));
      }
    } catch {
      // Non-blocking
    }

    // 4. Inspect Security Posture Indicators
    const securityPosture: GitHubSecurityPosture = {
      branchProtection: {
        enabled: false,
        status: "not_configured",
        requiredStatusChecks: [],
        enforceAdmins: false,
        requiredApprovingReviewsCount: 0,
      },
      dependabot: {
        status: "not_configured",
      },
      codeScanning: {
        status: "not_configured",
      },
      secretScanning: {
        status: "not_configured",
      },
    };

    // 4a. Branch Protection
    try {
      const bpRes = await customFetch(
        `https://api.github.com/repos/${repoFullName}/branches/${defaultBranch}/protection`,
        {
          headers: getGitHubHeaders(token),
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        }
      );
      if (bpRes.ok) {
        const bp = (await bpRes.json()) as Record<string, unknown>;
        securityPosture.branchProtection = {
          enabled: true,
          status: "configured",
          requiredStatusChecks: Array.isArray((bp.required_status_checks as Record<string, unknown>)?.contexts)
            ? ((bp.required_status_checks as Record<string, unknown>).contexts as string[])
            : [],
          enforceAdmins: Boolean((bp.enforce_admins as Record<string, unknown>)?.enabled),
          requiredApprovingReviewsCount: Number(
            (bp.required_pull_request_reviews as Record<string, unknown>)?.required_approving_review_count || 0
          ),
          details: `Branch '${defaultBranch}' has active protection rules.`,
        };
      } else if (bpRes.status === 404) {
        securityPosture.branchProtection = {
          enabled: false,
          status: "not_configured",
          requiredStatusChecks: [],
          enforceAdmins: false,
          requiredApprovingReviewsCount: 0,
          details: `Default branch '${defaultBranch}' has no protection rules enforced.`,
        };
      } else if (bpRes.status === 403) {
        securityPosture.branchProtection = {
          enabled: false,
          status: "not_accessible",
          requiredStatusChecks: [],
          enforceAdmins: false,
          requiredApprovingReviewsCount: 0,
          details: "Insufficient token permissions to inspect branch protection settings (requires admin:read).",
        };
      }
    } catch {
      securityPosture.branchProtection.status = "unavailable";
    }

    // 4b. Dependabot Alerts
    try {
      const depRes = await customFetch(
        `https://api.github.com/repos/${repoFullName}/dependabot/alerts?state=open&per_page=1`,
        {
          headers: getGitHubHeaders(token),
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        }
      );
      if (depRes.ok) {
        const depAlerts = (await depRes.json()) as unknown[];
        securityPosture.dependabot = {
          status: depAlerts.length > 0 ? "findings_present" : "no_findings",
          openAlertsCount: depAlerts.length,
          details: depAlerts.length > 0 ? "Open Dependabot vulnerability alerts detected." : "No open Dependabot alerts.",
        };
      } else if (depRes.status === 403 || depRes.status === 404) {
        securityPosture.dependabot = {
          status: "not_accessible",
          details: "Dependabot alerts API not accessible or feature disabled for this repository.",
        };
      }
    } catch {
      securityPosture.dependabot.status = "unavailable";
    }

    // 4c. Code Scanning Alerts
    try {
      const csRes = await customFetch(
        `https://api.github.com/repos/${repoFullName}/code-scanning/alerts?state=open&per_page=1`,
        {
          headers: getGitHubHeaders(token),
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        }
      );
      if (csRes.ok) {
        const csAlerts = (await csRes.json()) as unknown[];
        securityPosture.codeScanning = {
          status: csAlerts.length > 0 ? "findings_present" : "no_findings",
          openAlertsCount: csAlerts.length,
          details: csAlerts.length > 0 ? "Open code scanning alerts detected." : "No open code scanning alerts.",
        };
      } else if (csRes.status === 404 || csRes.status === 403) {
        securityPosture.codeScanning = {
          status: csRes.status === 403 ? "not_accessible" : "not_configured",
          details: "Code scanning (SARIF) not configured or requires security_events permission.",
        };
      }
    } catch {
      securityPosture.codeScanning.status = "unavailable";
    }

    // 4d. Secret Scanning Alerts
    try {
      const ssRes = await customFetch(
        `https://api.github.com/repos/${repoFullName}/secret-scanning/alerts?state=open&per_page=1`,
        {
          headers: getGitHubHeaders(token),
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        }
      );
      if (ssRes.ok) {
        const ssAlerts = (await ssRes.json()) as unknown[];
        securityPosture.secretScanning = {
          status: ssAlerts.length > 0 ? "findings_present" : "no_findings",
          openAlertsCount: ssAlerts.length,
          details: ssAlerts.length > 0 ? "Open secret scanning alerts detected." : "No leaked secrets detected.",
        };
      } else if (ssRes.status === 404 || ssRes.status === 403) {
        securityPosture.secretScanning = {
          status: ssRes.status === 403 ? "not_accessible" : "not_configured",
          details: "Secret scanning not configured or token lacks secret_scanning permission.",
        };
      }
    } catch {
      securityPosture.secretScanning.status = "unavailable";
    }

    return {
      success: true,
      statusCode: 200,
      overview: {
        repository: repoSummary,
        recentRuns,
        recentPullRequests,
        securityPosture,
        lastSyncedAt: new Date().toISOString(),
        rateLimit,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      statusCode: 502,
      error: `Failed to retrieve repository overview: ${msg}`,
    };
  }
}

/**
 * Fetch Pull Request Details & Changed Files
 * Retrieves changed files with unified diff hunks, status, additions, and deletions.
 */
export async function getPullRequestDetails(
  repoFullName: string,
  pullNumber: number,
  options: GitHubServiceOptions = {}
): Promise<{
  success: boolean;
  pullRequest?: GitHubPullRequestSummary;
  files?: GitHubChangedFile[];
  checkRuns?: GitHubCheckRunSummary[];
  error?: string;
  statusCode: number;
}> {
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const customFetch = options.fetchFn ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!token || !token.trim()) {
    return {
      success: false,
      statusCode: 401,
      error: "GITHUB_TOKEN is required to inspect pull requests.",
    };
  }

  try {
    // 1. Fetch Pull Request metadata
    const prRes = await customFetch(
      `https://api.github.com/repos/${repoFullName}/pulls/${pullNumber}`,
      {
        headers: getGitHubHeaders(token),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      }
    );

    if (!prRes.ok) {
      return {
        success: false,
        statusCode: prRes.status,
        error: `Could not fetch PR #${pullNumber} in '${repoFullName}' (HTTP ${prRes.status}).`,
      };
    }

    const pr = (await prRes.json()) as Record<string, unknown>;
    const pullRequest: GitHubPullRequestSummary = {
      number: Number(pr.number),
      title: String(pr.title || ""),
      state: (pr.state as "open" | "closed") || "open",
      draft: Boolean(pr.draft),
      htmlUrl: String(pr.html_url || ""),
      user: {
        login: String((pr.user as Record<string, unknown>)?.login || "unknown"),
        avatarUrl: (pr.user as Record<string, unknown>)?.avatar_url
          ? String((pr.user as Record<string, unknown>).avatar_url)
          : undefined,
      },
      head: {
        ref: String((pr.head as Record<string, unknown>)?.ref || ""),
        sha: String((pr.head as Record<string, unknown>)?.sha || ""),
      },
      base: {
        ref: String((pr.base as Record<string, unknown>)?.ref || ""),
        sha: String((pr.base as Record<string, unknown>)?.sha || ""),
      },
      createdAt: String(pr.created_at || ""),
      updatedAt: String(pr.updated_at || ""),
      mergedAt: pr.merged_at ? String(pr.merged_at) : null,
      labels: Array.isArray(pr.labels)
        ? (pr.labels as Array<{ name?: string }>).map((l) => String(l.name || "")).filter(Boolean)
        : [],
    };

    // 2. Fetch Changed Files (up to 50 files)
    let files: GitHubChangedFile[] = [];
    const filesRes = await customFetch(
      `https://api.github.com/repos/${repoFullName}/pulls/${pullNumber}/files?per_page=50`,
      {
        headers: getGitHubHeaders(token),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      }
    );
    if (filesRes.ok) {
      const rawFiles = (await filesRes.json()) as Array<Record<string, unknown>>;
      files = rawFiles.map((f) => ({
        filename: String(f.filename || ""),
        status: (f.status as GitHubChangedFile["status"]) || "modified",
        additions: Number(f.additions || 0),
        deletions: Number(f.deletions || 0),
        changes: Number(f.changes || 0),
        rawUrl: f.raw_url ? String(f.raw_url) : undefined,
        patch: f.patch ? String(f.patch) : undefined,
      }));
    }

    // 3. Fetch Commit Check Runs for the head SHA
    let checkRuns: GitHubCheckRunSummary[] = [];
    if (pullRequest.head.sha) {
      try {
        const checksRes = await customFetch(
          `https://api.github.com/repos/${repoFullName}/commits/${pullRequest.head.sha}/check-runs?per_page=20`,
          {
            headers: getGitHubHeaders(token),
            signal: AbortSignal.timeout(timeoutMs),
            cache: "no-store",
          }
        );
        if (checksRes.ok) {
          const checkData = (await checksRes.json()) as { check_runs?: Array<Record<string, unknown>> };
          if (Array.isArray(checkData.check_runs)) {
            checkRuns = checkData.check_runs.map((cr) => ({
              id: Number(cr.id),
              name: String(cr.name || ""),
              headSha: String(cr.head_sha || ""),
              status: (cr.status as GitHubCheckRunSummary["status"]) || "completed",
              conclusion: (cr.conclusion as GitHubCheckRunSummary["conclusion"]) || null,
              htmlUrl: String(cr.html_url || ""),
              startedAt: cr.started_at ? String(cr.started_at) : undefined,
              completedAt: cr.completed_at ? String(cr.completed_at) : undefined,
            }));
          }
        }
      } catch {
        // Non-blocking
      }
    }

    return {
      success: true,
      pullRequest,
      files,
      checkRuns,
      statusCode: 200,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      statusCode: 502,
      error: `Failed to inspect pull request #${pullNumber}: ${msg}`,
    };
  }
}

/**
 * Fetch File Content at specific Git reference (Read-Only)
 * Used to dry-run patch verification against the base branch or revision.
 */
export async function getFileContentAtRef(
  repoFullName: string,
  filePath: string,
  ref: string,
  options: GitHubServiceOptions = {}
): Promise<{
  success: boolean;
  content?: string;
  error?: string;
  statusCode: number;
}> {
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const customFetch = options.fetchFn ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!token || !token.trim()) {
    return {
      success: false,
      statusCode: 401,
      error: "GITHUB_TOKEN required to fetch file content.",
    };
  }

  try {
    const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
    const url = `https://api.github.com/repos/${repoFullName}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`;

    const res = await customFetch(url, {
      headers: getGitHubHeaders(token),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        success: false,
        statusCode: res.status,
        error: `Could not retrieve '${filePath}' at ${ref} (HTTP ${res.status}).`,
      };
    }

    const data = (await res.json()) as Record<string, unknown>;
    if (data.content && typeof data.content === "string") {
      const decoded = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
      return {
        success: true,
        content: decoded,
        statusCode: 200,
      };
    }

    return {
      success: false,
      statusCode: 422,
      error: "File content was not returned in standard base64 format.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      statusCode: 502,
      error: `Failed to fetch file content: ${msg}`,
    };
  }
}

/**
 * Get Repository Branches
 * Lists branches for a repository, including commit SHAs and protection flags.
 */
export async function getRepositoryBranches(
  repoFullName: string,
  options: GitHubServiceOptions = {}
): Promise<{
  success: boolean;
  branches: GitHubBranchSummary[];
  rateLimit?: { remaining: number; limit: number; reset: number };
  error?: string;
  statusCode: number;
}> {
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const customFetch = options.fetchFn ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!token || !token.trim()) {
    return {
      success: false,
      branches: [],
      statusCode: 401,
      error: "GITHUB_TOKEN required to list repository branches.",
    };
  }

  try {
    const url = `https://api.github.com/repos/${repoFullName}/branches?per_page=100`;
    const res = await customFetch(url, {
      headers: getGitHubHeaders(token),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });

    const rateLimit = parseRateLimit(res.headers);

    if (!res.ok) {
      return {
        success: false,
        branches: [],
        rateLimit,
        statusCode: res.status,
        error: `GitHub API error listing branches (HTTP ${res.status}): ${res.statusText}`,
      };
    }

    const data = (await res.json()) as Array<{
      name: string;
      commit?: { sha?: string };
      protected?: boolean;
    }>;

    const branches: GitHubBranchSummary[] = Array.isArray(data)
      ? data.map((b) => ({
          name: String(b.name || ""),
          commitSha: String(b.commit?.sha || ""),
          protected: Boolean(b.protected),
        }))
      : [];

    return {
      success: true,
      branches,
      rateLimit,
      statusCode: 200,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      branches: [],
      statusCode: 502,
      error: `Failed to fetch branches: ${msg}`,
    };
  }
}

/**
 * Get Repository Directory Contents (On-Demand / Paginated)
 * Loads directory nodes path-by-path rather than dumping entire repos into memory.
 */
export async function getRepositoryDirectoryContents(
  repoFullName: string,
  dirPath: string = "",
  ref: string = "main",
  options: GitHubServiceOptions = {}
): Promise<{
  success: boolean;
  items: GitHubTreeItem[];
  rateLimit?: { remaining: number; limit: number; reset: number };
  error?: string;
  statusCode: number;
}> {
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const customFetch = options.fetchFn ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!token || !token.trim()) {
    return {
      success: false,
      items: [],
      statusCode: 401,
      error: "GITHUB_TOKEN required to fetch directory contents.",
    };
  }

  try {
    const cleanPath = dirPath.replace(/^\/+|\/+$/g, "");
    const encodedPath = cleanPath ? cleanPath.split("/").map(encodeURIComponent).join("/") : "";
    const url = encodedPath
      ? `https://api.github.com/repos/${repoFullName}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`
      : `https://api.github.com/repos/${repoFullName}/contents?ref=${encodeURIComponent(ref)}`;

    const res = await customFetch(url, {
      headers: getGitHubHeaders(token),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });

    const rateLimit = parseRateLimit(res.headers);

    if (!res.ok) {
      return {
        success: false,
        items: [],
        rateLimit,
        statusCode: res.status,
        error: `Could not retrieve directory '${dirPath || "/"}' at ${ref} (HTTP ${res.status}).`,
      };
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      const singleItem: GitHubTreeItem = {
        path: String((data as Record<string, unknown>).path || cleanPath),
        name: String((data as Record<string, unknown>).name || ""),
        type: "file",
        size: typeof (data as Record<string, unknown>).size === "number" ? Number((data as Record<string, unknown>).size) : undefined,
        sha: String((data as Record<string, unknown>).sha || ""),
        htmlUrl: (data as Record<string, unknown>).html_url ? String((data as Record<string, unknown>).html_url) : undefined,
      };
      return {
        success: true,
        items: [singleItem],
        rateLimit,
        statusCode: 200,
      };
    }

    const items: GitHubTreeItem[] = data.map((it: Record<string, unknown>) => ({
      path: String(it.path || ""),
      name: String(it.name || ""),
      type: it.type === "dir" ? "dir" : "file",
      size: typeof it.size === "number" ? it.size : undefined,
      sha: String(it.sha || ""),
      htmlUrl: it.html_url ? String(it.html_url) : undefined,
    }));

    items.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "dir" ? -1 : 1;
    });

    return {
      success: true,
      items,
      rateLimit,
      statusCode: 200,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      items: [],
      statusCode: 502,
      error: `Failed to fetch directory contents: ${msg}`,
    };
  }
}

/**
 * Check GitHub Token Scopes
 * Detects whether the active token has write permissions or is read-only.
 * Uses x-oauth-scopes header from GitHub API response.
 */
export async function checkTokenScopes(
  options: GitHubServiceOptions = {}
): Promise<GitHubPermissionScope> {
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const customFetch = options.fetchFn ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!token || !token.trim()) {
    return {
      hasWritePermission: false,
      grantedScopes: [],
      missingScopes: ["repo", "contents:write"],
      reason: "No GITHUB_TOKEN configured. System is operating in read-only / unauthenticated mode.",
    };
  }

  try {
    const res = await customFetch("https://api.github.com/rate_limit", {
      headers: getGitHubHeaders(token),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });

    const rawScopes = res.headers.get("x-oauth-scopes");
    const grantedScopes = rawScopes
      ? rawScopes
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : [];

    const hasWrite =
      grantedScopes.includes("repo") ||
      grantedScopes.includes("public_repo") ||
      grantedScopes.includes("contents:write");

    const missingScopes = hasWrite ? [] : ["repo", "contents:write"];
    const reason = hasWrite
      ? "Token has authorized repository write scopes."
      : grantedScopes.length > 0
      ? `Token granted scopes [${grantedScopes.join(", ")}] are read-only. Missing 'repo' or 'contents:write' scope.`
      : "Fine-grained or scope-restricted token. Write permissions not detected. Patch creation disabled.";

    return {
      hasWritePermission: hasWrite,
      grantedScopes,
      missingScopes,
      reason,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      hasWritePermission: false,
      grantedScopes: [],
      missingScopes: ["repo", "contents:write"],
      reason: `Could not determine token scopes: ${msg}`,
    };
  }
}

/**
 * Check if the token has write/push permissions for the specific repository.
 * Queries GET /repos/{owner}/{repo} and checks repository permissions object.
 * Fails closed if permissions cannot be positively verified.
 */
export async function checkRepositoryWritePermission(
  repoFullName: string,
  options: GitHubServiceOptions = {}
): Promise<{
  canPush: boolean;
  reason: string;
}> {
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const customFetch = options.fetchFn ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!token || !token.trim()) {
    return {
      canPush: false,
      reason: "No GITHUB_TOKEN configured (read-only mode).",
    };
  }

  try {
    const res = await customFetch(`https://api.github.com/repos/${repoFullName}`, {
      headers: getGitHubHeaders(token),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        canPush: false,
        reason: `Could not verify repository access for '${repoFullName}' (HTTP ${res.status}). Failing closed.`,
      };
    }

    const data = (await res.json()) as {
      permissions?: {
        push?: boolean;
        admin?: boolean;
        maintain?: boolean;
      };
    };

    if (!data.permissions) {
      return {
        canPush: false,
        reason: "Repository permissions metadata not returned by GitHub. Failing closed to prevent unauthorized writes.",
      };
    }

    const canPush = Boolean(data.permissions.push || data.permissions.admin || data.permissions.maintain);
    if (!canPush) {
      return {
        canPush: false,
        reason: `Current account has read-only access to repository '${repoFullName}' (push permission false).`,
      };
    }

    return {
      canPush: true,
      reason: "Push permissions confirmed for repository.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      canPush: false,
      reason: `Error verifying repository permissions: ${msg}. Failing closed.`,
    };
  }
}

export interface CreatePatchBranchParams {
  repoFullName: string;
  baseBranch: string;
  expectedBaseSha: string;
  targetFilePath: string;
  unifiedDiff?: string;
  patchedContent?: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
  userConfirmedApproval: boolean;
  options?: GitHubServiceOptions;
}

/**
 * Guarded Patch Branch and Pull Request Creation
 *
 * Strict invariants:
 * 1. Requires explicit user approval flag.
 * 2. Checks token write scopes AND repository push permissions (fails closed if permission status is unclear).
 * 3. Disarms stale patches: verifies baseBranch HEAD sha still matches expectedBaseSha.
 * 4. Strict server-side path traversal prevention.
 * 5. Server-side in-memory dry-run validation and tamper verification.
 * 6. Creates isolated branch: patch/pipelineshield-<timestamp> (never pushes to protected base branch).
 * 7. Creates a pull request for human and CI security gate review.
 */
export async function createPatchBranchAndPullRequest(
  params: CreatePatchBranchParams
): Promise<{
  success: boolean;
  prUrl?: string;
  prNumber?: number;
  branchName?: string;
  error?: string;
  statusCode: number;
}> {
  const options = params.options || {};
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const customFetch = options.fetchFn ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // 1. Invariant: User confirmed approval required
  if (!params.userConfirmedApproval) {
    return {
      success: false,
      statusCode: 403,
      error: "Explicit user approval required. Apply and push actions are gated and disabled by default.",
    };
  }

  if (!token || !token.trim()) {
    return {
      success: false,
      statusCode: 401,
      error: "GITHUB_TOKEN required to create patch branches and pull requests.",
    };
  }

  // 2. Strict Path Traversal Check
  const cleanPath = params.targetFilePath.replace(/^\/+|\/+$/g, "");
  if (
    cleanPath.includes("..") ||
    cleanPath.includes("\\") ||
    cleanPath.includes("\0") ||
    params.targetFilePath.startsWith("/")
  ) {
    return {
      success: false,
      statusCode: 400,
      error: "Path traversal or illegal character detected in targetFilePath.",
    };
  }

  // 3. Invariant: Token scope check
  const scopeCheck = await checkTokenScopes(options);
  if (!scopeCheck.hasWritePermission) {
    return {
      success: false,
      statusCode: 403,
      error: `Action blocked: ${scopeCheck.reason}`,
    };
  }

  // 4. Invariant: Repository-level push permission check (Fail Closed)
  const repoPermCheck = await checkRepositoryWritePermission(params.repoFullName, options);
  if (!repoPermCheck.canPush) {
    return {
      success: false,
      statusCode: 403,
      error: `Write permission check failed for repository '${params.repoFullName}': ${repoPermCheck.reason}`,
    };
  }

  try {
    // 5. Invariant: Stale base commit check
    const refUrl = `https://api.github.com/repos/${params.repoFullName}/git/ref/heads/${encodeURIComponent(params.baseBranch)}`;
    const refRes = await customFetch(refUrl, {
      headers: getGitHubHeaders(token),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });

    if (!refRes.ok) {
      return {
        success: false,
        statusCode: refRes.status,
        error: `Could not verify base branch '${params.baseBranch}' (HTTP ${refRes.status}).`,
      };
    }

    const refData = (await refRes.json()) as { object?: { sha?: string } };
    const currentBaseSha = refData.object?.sha;

    if (!currentBaseSha) {
      return {
        success: false,
        statusCode: 502,
        error: "Unable to retrieve current commit SHA for base branch.",
      };
    }

    if (params.expectedBaseSha && currentBaseSha !== params.expectedBaseSha) {
      return {
        success: false,
        statusCode: 409,
        error: `Stale base commit detected. Base branch '${params.baseBranch}' has advanced from ${params.expectedBaseSha.slice(0, 7)} to ${currentBaseSha.slice(0, 7)}. Please re-verify the patch against the latest revision.`,
      };
    }

    // 6. Invariant: Server-Side Patch Dry-Run & Tamper Verification
    let finalContent = params.patchedContent;
    if (params.unifiedDiff && params.unifiedDiff.trim()) {
      const baseFileResult = await getFileContentAtRef(
        params.repoFullName,
        cleanPath,
        currentBaseSha,
        options
      );

      if (!baseFileResult.success || baseFileResult.content === undefined) {
        return {
          success: false,
          statusCode: baseFileResult.statusCode || 502,
          error: `Failed to retrieve base file '${cleanPath}' at ${currentBaseSha.slice(0, 7)} for server-side dry-run validation: ${baseFileResult.error}`,
        };
      }

      const dryRun = dryRunApplyPatch(baseFileResult.content, params.unifiedDiff);
      if (!dryRun.valid || !dryRun.appliesCleanly || !dryRun.transformedContent) {
        return {
          success: false,
          statusCode: 422,
          error: `Server-side dry-run validation failed: ${dryRun.failureReason || "Unified diff does not apply cleanly to current base file."}`,
        };
      }

      if (params.patchedContent && params.patchedContent !== dryRun.transformedContent) {
        return {
          success: false,
          statusCode: 422,
          error: "Patch integrity violation: submitted patchedContent does not match server-side unified diff application result.",
        };
      }

      finalContent = dryRun.transformedContent;
    }

    if (typeof finalContent !== "string") {
      return {
        success: false,
        statusCode: 400,
        error: "No valid patch or patchedContent provided.",
      };
    }

    // 7. Create new patch branch (isolated naming convention)
    const branchName = `patch/pipelineshield-${Date.now()}`;
    const createRefRes = await customFetch(`https://api.github.com/repos/${params.repoFullName}/git/refs`, {
      method: "POST",
      headers: getGitHubHeaders(token),
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: currentBaseSha,
      }),
    });

    if (!createRefRes.ok) {
      const errText = await createRefRes.text();
      return {
        success: false,
        statusCode: createRefRes.status,
        error: `Failed to create patch branch '${branchName}': ${errText}`,
      };
    }

    // 8. Fetch existing file SHA on base branch if modifying an existing file
    let existingFileSha: string | undefined;
    const encodedPath = cleanPath.split("/").map(encodeURIComponent).join("/");
    const existingFileRes = await customFetch(
      `https://api.github.com/repos/${params.repoFullName}/contents/${encodedPath}?ref=${encodeURIComponent(branchName)}`,
      {
        headers: getGitHubHeaders(token),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      }
    );
    if (existingFileRes.ok) {
      const existingData = (await existingFileRes.json()) as { sha?: string };
      existingFileSha = existingData.sha;
    }

    // 9. Commit patched file to the newly created branch
    const putContentRes = await customFetch(
      `https://api.github.com/repos/${params.repoFullName}/contents/${encodedPath}`,
      {
        method: "PUT",
        headers: getGitHubHeaders(token),
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          message: params.commitMessage || `fix(security): apply remediation patch to ${cleanPath}`,
          content: Buffer.from(finalContent, "utf8").toString("base64"),
          branch: branchName,
          ...(existingFileSha ? { sha: existingFileSha } : {}),
        }),
      }
    );

    if (!putContentRes.ok) {
      const errText = await putContentRes.text();
      return {
        success: false,
        statusCode: putContentRes.status,
        error: `Failed to write patched file to '${branchName}': ${errText}`,
      };
    }

    // 10. Open Pull Request to base branch
    const prRes = await customFetch(`https://api.github.com/repos/${params.repoFullName}/pulls`, {
      method: "POST",
      headers: getGitHubHeaders(token),
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        title: params.prTitle || `[Security Patch] Fix in ${cleanPath}`,
        head: branchName,
        base: params.baseBranch,
        body:
          (params.prBody || "") +
          "\n\n---\n*Proposed by PipelineShield Security Workspace. Reviewed by human operator. CI Security Gate authority applies.*",
      }),
    });

    if (!prRes.ok) {
      const errText = await prRes.text();
      return {
        success: false,
        statusCode: prRes.status,
        branchName,
        error: `Patch committed to branch '${branchName}', but failed to open PR: ${errText}`,
      };
    }

    const prData = (await prRes.json()) as { html_url?: string; number?: number };
    return {
      success: true,
      prUrl: prData.html_url,
      prNumber: prData.number,
      branchName,
      statusCode: 201,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      statusCode: 502,
      error: `Patch workflow encountered an unexpected error: ${msg}`,
    };
  }
}


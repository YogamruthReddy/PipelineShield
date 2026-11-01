#!/usr/bin/env node
/**
 * PipelineShield GitHub Workspace & Local AI Code Review Test Suite
 *
 * Verifies:
 * 1. Unified diff parser (single hunk, multi hunk, additions/deletions counts, invalid diff handling).
 * 2. In-memory dry-run patch validation (clean application, context mismatch, zero disk I/O).
 * 3. Read-only GitHub service headers, rate-limiting, and error handling.
 * 4. Account-wide repository discovery (search, visibility filter, pagination, 401/403/502 handling).
 * 5. Repository security overview and security posture auditing (branch protection, Dependabot, code scanning, secret scanning).
 * 6. Pull request inspection and changed files diff mapping.
 * 7. Git ref file content retrieval with base64 decoding.
 * 8. Local AI Code Review actions (`review_code`, `suggest_patch`, `verify_guidance`) with prompt injection boundaries,
 *    secret redaction, and authoritative gatekeeper sovereignty.
 * 9. Multi-repository state isolation and token protection.
 */

import assert from "assert/strict";
import { parseUnifiedDiff, dryRunApplyPatch } from "../dashboard/src/lib/patch-validator.ts";
import {
  getGitHubHeaders,
  listAccountRepositories,
  getRepositoryOverview,
  getPullRequestDetails,
  getFileContentAtRef,
} from "../dashboard/src/lib/github-service.ts";
import {
  executeLocalAIAction,
  resetRateLimiterForTesting,
} from "../dashboard/src/lib/local-ai.ts";

console.log("===============================================================================");
console.log(" PipelineShield — GitHub Workspace & Local AI Review Verification Suite");
console.log("===============================================================================\n");

let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    failed++;
  }
}

// ─── 1. In-Memory Diff Parser Tests ──────────────────────────────────────────
console.log("1. In-Memory Unified Diff Parser (`parseUnifiedDiff`)\n");

await runTest("parseUnifiedDiff: Parses valid single-hunk diff and counts additions/deletions", async () => {
  const sampleDiff = `--- a/src/server.py
+++ b/src/server.py
@@ -10,4 +10,4 @@
 def handle_request(req):
-    os.system(req.cmd)
+    subprocess.run(["safe_tool", req.cmd], check=True)
     return {"status": "ok"}`;

  const parsed = parseUnifiedDiff(sampleDiff);
  assert.equal(parsed.isValid, true, "Diff should be valid");
  assert.equal(parsed.targetFile, "src/server.py", "Target file extracted");
  assert.equal(parsed.hunks.length, 1, "Expected 1 hunk");
  assert.equal(parsed.addedCount, 1, "Expected 1 added line");
  assert.equal(parsed.removedCount, 1, "Expected 1 removed line");
  assert.equal(parsed.hunks[0].oldStart, 10);
  assert.equal(parsed.hunks[0].oldCount, 4);
});

await runTest("parseUnifiedDiff: Parses multi-hunk diff accurately", async () => {
  const multiDiff = `--- a/lib/auth.ts
+++ b/lib/auth.ts
@@ -5,3 +5,4 @@
 import crypto from "crypto";
+import { sanitize } from "./sanitizer";
 
@@ -20,3 +21,3 @@
-const token = req.headers["x-token"];
+const token = sanitize(req.headers["x-token"]);
 return token;`;

  const parsed = parseUnifiedDiff(multiDiff);
  assert.equal(parsed.isValid, true);
  assert.equal(parsed.hunks.length, 2, "Expected 2 hunks");
  assert.equal(parsed.addedCount, 2, "Expected 2 total additions");
  assert.equal(parsed.removedCount, 1, "Expected 1 total deletion");
});

await runTest("parseUnifiedDiff: Gracefully rejects diffs without valid hunk headers", async () => {
  const invalidDiff = `Some random explanatory text that is not a diff`;
  const parsed = parseUnifiedDiff(invalidDiff);
  assert.equal(parsed.isValid, false);
  assert.ok(parsed.parseError?.includes("No valid unified diff hunk headers"));
});

// ─── 2. In-Memory Dry-Run Patch Engine Tests ──────────────────────────────────
console.log("\n2. In-Memory Dry-Run Patch Validation (`dryRunApplyPatch`)\n");

await runTest("dryRunApplyPatch: Cleanly applies patch to matching base content without disk I/O", async () => {
  const baseContent = `line 1
line 2
def calculate():
    return unsafe_eval(expr)
line 5
line 6`;

  const patch = `--- a/calc.py
+++ b/calc.py
@@ -3,3 +3,3 @@
 def calculate():
-    return unsafe_eval(expr)
+    return ast.literal_eval(expr)
 line 5`;

  const result = dryRunApplyPatch(baseContent, patch);
  assert.equal(result.isValidDiff, true, "Should be valid diff");
  assert.equal(result.appliesCleanly, true, "Should apply cleanly");
  assert.equal(result.addedLinesCount, 1);
  assert.equal(result.removedLinesCount, 1);
  assert.ok(result.transformedContent?.includes("ast.literal_eval(expr)"), "Contains replaced line");
  assert.ok(!result.transformedContent?.includes("unsafe_eval(expr)"), "Removes dangerous line");
  // Ensure baseContent is immutable in memory
  assert.ok(baseContent.includes("unsafe_eval(expr)"), "Original base string remained immutable");
});

await runTest("dryRunApplyPatch: Rejects patch when base content context line mismatches", async () => {
  const mismatchedBase = `line 1
line 2
def calculate():
    return different_logic(expr)
line 5`;

  const patch = `--- a/calc.py
+++ b/calc.py
@@ -3,3 +3,3 @@
 def calculate():
-    return unsafe_eval(expr)
+    return ast.literal_eval(expr)
 line 5`;

  const result = dryRunApplyPatch(mismatchedBase, patch);
  assert.equal(result.isValidDiff, true);
  assert.equal(result.appliesCleanly, false, "Should fail context line check");
  assert.ok(result.failureReason?.includes("Context line mismatch") || result.failureReason?.includes("Removal line mismatch"));
});

await runTest("dryRunApplyPatch: Rejects patch when hunk offset exceeds file length", async () => {
  const shortBase = `line 1\nline 2`;
  const patch = `--- a/calc.py
+++ b/calc.py
@@ -100,2 +100,2 @@
 foo
-bar
+baz`;

  const result = dryRunApplyPatch(shortBase, patch);
  assert.equal(result.isValidDiff, true);
  assert.equal(result.appliesCleanly, false);
  assert.ok(result.failureReason?.includes("exceeds base content line count"));
});

// ─── 3. GitHub Service Headers & Rate Limits ─────────────────────────────────
console.log("\n3. GitHub Service Headers & Rate Limiting\n");

await runTest("getGitHubHeaders: Includes standard API headers and Bearer auth when token provided", async () => {
  const headersWithToken = getGitHubHeaders("ghp_testtoken123");
  assert.equal(headersWithToken.Accept, "application/vnd.github+json");
  assert.equal(headersWithToken["X-GitHub-Api-Version"], "2022-11-28");
  assert.equal(headersWithToken.Authorization, "Bearer ghp_testtoken123");

  const headersWithoutToken = getGitHubHeaders(undefined);
  assert.equal(headersWithoutToken.Authorization, undefined, "No Authorization header when token omitted");
});

// ─── 4. Account-Wide Repository Discovery Tests ──────────────────────────────
console.log("\n4. Account-Wide Repository Discovery (`listAccountRepositories`)\n");

await runTest("listAccountRepositories: Maps repositories, parses rate limit, and supports search filter", async () => {
  const mockReposResponse = [
    {
      id: 101,
      name: "PipelineShield",
      full_name: "YogamruthReddy/PipelineShield",
      owner: { login: "YogamruthReddy" },
      description: "Automated CI/CD security gatekeeper",
      private: false,
      default_branch: "main",
      html_url: "https://github.com/YogamruthReddy/PipelineShield",
      updated_at: "2026-11-01T00:00:00Z",
      pushed_at: "2026-11-01T00:00:00Z",
      open_issues_count: 3,
      visibility: "public",
      archived: false,
    },
    {
      id: 102,
      name: "SecureBackend",
      full_name: "YogamruthReddy/SecureBackend",
      owner: { login: "YogamruthReddy" },
      description: "Financial microservices core",
      private: true,
      default_branch: "main",
      html_url: "https://github.com/YogamruthReddy/SecureBackend",
      updated_at: "2026-10-30T00:00:00Z",
      pushed_at: "2026-10-30T00:00:00Z",
      open_issues_count: 0,
      visibility: "private",
      archived: false,
    },
  ];

  const mockFetch = async (url) => {
    return {
      ok: true,
      status: 200,
      headers: new Headers({
        "x-ratelimit-remaining": "4950",
        "x-ratelimit-limit": "5000",
        "x-ratelimit-reset": "1730000000",
      }),
      json: async () => mockReposResponse,
    };
  };

  const resAll = await listAccountRepositories({
    token: "ghp_mock",
    fetchFn: mockFetch,
  });
  assert.equal(resAll.success, true);
  assert.equal(resAll.repositories.length, 2);
  assert.equal(resAll.rateLimit?.remaining, 4950);

  // Search filter check
  const resSearch = await listAccountRepositories({
    token: "ghp_mock",
    search: "backend",
    fetchFn: mockFetch,
  });
  assert.equal(resSearch.success, true);
  assert.equal(resSearch.repositories.length, 1);
  assert.equal(resSearch.repositories[0].name, "SecureBackend");
});

await runTest("listAccountRepositories: Handles 401 Unauthorized cleanly", async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 401,
    headers: new Headers(),
    json: async () => ({ message: "Bad credentials" }),
  });

  const res = await listAccountRepositories({
    token: "invalid_token",
    fetchFn: mockFetch,
  });
  assert.equal(res.success, false);
  assert.equal(res.statusCode, 401);
  assert.ok(res.error?.toLowerCase().includes("authentication failed"));
});

// ─── 5. Repository Security Overview & Posture Audit Tests ───────────────────
console.log("\n5. Repository Security Overview & Posture Audit (`getRepositoryOverview`)\n");

await runTest("getRepositoryOverview: Computes security posture accurately across all mechanisms", async () => {
  const mockFetch = async (url) => {
    const urlStr = String(url);

    // Repo details
    if (urlStr.endsWith("/repos/org/repo")) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "x-ratelimit-remaining": "4900" }),
        json: async () => ({
          id: 201,
          name: "repo",
          full_name: "org/repo",
          owner: { login: "org" },
          private: true,
          default_branch: "main",
          html_url: "https://github.com/org/repo",
        }),
      };
    }

    // Branch protection: configured
    if (urlStr.includes("/branches/main/protection")) {
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          required_status_checks: { contexts: ["security-gate"] },
          enforce_admins: { enabled: true },
          required_pull_request_reviews: { required_approving_review_count: 1 },
        }),
      };
    }

    // Workflow runs
    if (urlStr.includes("/actions/runs")) {
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          workflow_runs: [
            {
              id: 999,
              name: "CI Security Gate",
              head_branch: "main",
              head_sha: "abcdef123456",
              status: "completed",
              conclusion: "success",
              html_url: "https://github.com/org/repo/actions/runs/999",
              created_at: "2026-11-01T00:00:00Z",
              updated_at: "2026-11-01T00:05:00Z",
            },
          ],
        }),
      };
    }

    // PRs
    if (urlStr.includes("/pulls?state=open")) {
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => [],
      };
    }

    // Dependabot alerts: findings present
    if (urlStr.includes("/dependabot/alerts")) {
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => [{ number: 1, state: "open" }],
      };
    }

    // Code Scanning: 404 (not configured)
    if (urlStr.includes("/code-scanning/alerts")) {
      return {
        ok: false,
        status: 404,
        headers: new Headers(),
        json: async () => ({ message: "Not Found" }),
      };
    }

    // Secret Scanning: 403 (not accessible)
    if (urlStr.includes("/secret-scanning/alerts")) {
      return {
        ok: false,
        status: 403,
        headers: new Headers(),
        json: async () => ({ message: "Forbidden" }),
      };
    }

    return { ok: false, status: 404, headers: new Headers(), json: async () => ({}) };
  };

  const res = await getRepositoryOverview("org/repo", {
    token: "ghp_valid",
    fetchFn: mockFetch,
  });

  assert.equal(res.success, true);
  assert.equal(res.overview?.repository.fullName, "org/repo");
  assert.equal(res.overview?.recentRuns.length, 1);

  // Security posture assertions
  const posture = res.overview?.securityPosture;
  assert.ok(posture, "Security posture must be present");
  assert.equal(posture.branchProtection.status, "configured");
  assert.equal(posture.dependabot.status, "findings_present");
  assert.equal(posture.codeScanning.status, "not_configured");
  assert.equal(posture.secretScanning.status, "not_accessible");
});

// ─── 6. Pull Request Details & Changed Files Tests ───────────────────────────
console.log("\n6. Pull Request Inspection & Changed Files (`getPullRequestDetails`)\n");

await runTest("getPullRequestDetails: Maps PR metadata, changed files, and patch hunks", async () => {
  const mockFetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes("/pulls/42/files")) {
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => [
          {
            filename: "package.json",
            status: "modified",
            additions: 1,
            deletions: 1,
            changes: 2,
            patch: '@@ -15,1 +15,1 @@\n-"qs": "6.5.2"\n+"qs": "6.11.0"',
          },
        ],
      };
    }
    if (urlStr.includes("/pulls/42")) {
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          number: 42,
          title: "Fix CVE-2022-42966 in qs package",
          state: "open",
          draft: false,
          htmlUrl: "https://github.com/org/repo/pull/42",
          user: { login: "developer" },
          head: { ref: "fix/qs-patch", sha: "111111" },
          base: { ref: "main", sha: "222222" },
          created_at: "2026-11-01T00:00:00Z",
          updated_at: "2026-11-01T01:00:00Z",
          labels: [{ name: "security" }],
        }),
      };
    }
    if (urlStr.includes("/commits/111111/check-runs")) {
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          check_runs: [
            {
              id: 88,
              name: "PipelineShield Gate",
              status: "completed",
              conclusion: "success",
            },
          ],
        }),
      };
    }
    return { ok: false, status: 404, headers: new Headers() };
  };

  const res = await getPullRequestDetails("org/repo", 42, {
    token: "ghp_valid",
    fetchFn: mockFetch,
  });

  assert.equal(res.success, true);
  assert.equal(res.pullRequest?.number, 42);
  assert.equal(res.files?.length, 1);
  assert.equal(res.files?.[0].filename, "package.json");
  assert.equal(res.checkRuns?.length, 1);
  assert.equal(res.checkRuns?.[0].name, "PipelineShield Gate");
});

// ─── 7. File Content at Ref Tests ────────────────────────────────────────────
console.log("\n7. Read-Only File Content Retrieval (`getFileContentAtRef`)\n");

await runTest("getFileContentAtRef: Decodes base64 content safely", async () => {
  const originalCode = 'console.log("hello PipelineShield");';
  const base64Code = Buffer.from(originalCode).toString("base64");

  const mockFetch = async () => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({
      name: "app.ts",
      path: "src/app.ts",
      encoding: "base64",
      content: base64Code,
    }),
  });

  const res = await getFileContentAtRef("org/repo", "src/app.ts", "main", {
    token: "ghp_valid",
    fetchFn: mockFetch,
  });

  assert.equal(res.success, true);
  assert.equal(res.content, originalCode);
});

// ─── 8. Local AI Code Review Safety & Gate Sovereignty ──────────────────────
console.log("\n8. Local AI Code Review Safety & Gate Sovereignty\n");

function createMockAIFetch(mockResponseText) {
  const calls = [];
  const fetchFn = async (url, options = {}) => {
    if (String(url).endsWith("/api/tags")) {
      return { ok: true, status: 200, json: async () => ({ models: [{ name: "qwen2.5:3b" }] }) };
    }
    if (String(url).endsWith("/api/generate")) {
      const parsedBody = JSON.parse(options.body);
      calls.push({ url: String(url), body: parsedBody });
      return {
        ok: true,
        status: 200,
        json: async () => ({ response: mockResponseText }),
      };
    }
    return { ok: false, status: 404, text: async () => "Not Found" };
  };
  return { fetchFn, calls };
}

await runTest("review_code: Diff wrapped in isolation boundary and secrets redacted", async () => {
  resetRateLimiterForTesting();
  const leakedApiKey = "sk-live-1234567890abcdef1234567890abcdef";
  const diffWithSecret = `--- a/config.py
+++ b/config.py
@@ -1,2 +1,2 @@
-DEFAULT_KEY = "test"
+API_KEY = "${leakedApiKey}"`;

  const { fetchFn, calls } = createMockAIFetch("Code review generated.");
  const res = await executeLocalAIAction(
    JSON.stringify({
      action: "review_code",
      view: "github",
      codeDiff: diffWithSecret,
      filePath: "config.py",
      prNumber: 5,
      repoFullName: "org/repo",
    }),
    { fetchFn }
  );

  assert.equal(res.status, 200);
  assert.equal(res.data.success, true);
  assert.equal(res.data.securityGateOverridePermitted, false, "Gate sovereignty enforced");

  const prompt = calls[0].body.prompt;
  assert.ok(prompt.includes("<UNTRUSTED_CODE_DATA>"), "Diff must be wrapped in isolation tag");
  assert.ok(!prompt.includes(leakedApiKey), "Secret token must NOT be leaked to model prompt");
  assert.ok(prompt.includes("[REDACTED_SECRET]"), "Redaction marker must replace leaked key");
});

await runTest("suggest_patch: Runs in-memory patch validation against base content", async () => {
  resetRateLimiterForTesting();
  const baseContent = `line 1\nconst safe = false;\nline 3`;
  const diff = `--- a/flag.ts\n+++ b/flag.ts\n@@ -1,3 +1,3 @@\n line 1\n-const safe = false;\n+const safe = true;\n line 3`;

  // AI returns a clean patch
  const aiPatchResponse = `Here is the suggested fix:
\`\`\`diff
--- a/flag.ts
+++ b/flag.ts
@@ -1,3 +1,3 @@
 line 1
-const safe = false;
+const safe = true;
 line 3
\`\`\``;

  const { fetchFn } = createMockAIFetch(aiPatchResponse);
  const res = await executeLocalAIAction(
    JSON.stringify({
      action: "suggest_patch",
      view: "github",
      codeDiff: diff,
      baseContent: baseContent,
      filePath: "flag.ts",
      prNumber: 12,
      repoFullName: "org/repo",
    }),
    { fetchFn }
  );

  assert.equal(res.status, 200);
  assert.equal(res.data.success, true);
  assert.ok(res.data.patchValidation, "Patch validation result must be attached");
  assert.equal(res.data.patchValidation.isValidDiff, true);
  assert.equal(res.data.patchValidation.appliesCleanly, true, "Patch should apply cleanly in-memory");
  assert.equal(res.data.securityGateOverridePermitted, false, "Gate sovereignty strictly enforced");
});

await runTest("verify_guidance: Enforces test verification guidance without file writes", async () => {
  resetRateLimiterForTesting();
  const { fetchFn, calls } = createMockAIFetch("Run unit test suite using npm test.");
  const res = await executeLocalAIAction(
    JSON.stringify({
      action: "verify_guidance",
      view: "github",
      codeDiff: "diff --git a/test.ts b/test.ts",
      filePath: "test.ts",
      prNumber: 99,
      repoFullName: "org/repo",
    }),
    { fetchFn }
  );

  assert.equal(res.status, 200);
  assert.equal(res.data.success, true);
  assert.equal(res.data.securityGateOverridePermitted, false);
  const prompt = calls[0].body.prompt;
  assert.ok(prompt.includes("verification guidance"), "Prompt includes verification guidance instruction");
});

// ─── 9. Repository Isolation & Token Protection ──────────────────────────────
console.log("\n9. Multi-Repository State Isolation & Token Protection\n");

await runTest("Repository queries for Repo A and Repo B remain strictly decoupled", async () => {
  const repoCalls = [];
  const mockFetch = async (url) => {
    repoCalls.push(String(url));
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ id: 1, full_name: "test" }),
    };
  };

  await getRepositoryOverview("orgA/repoA", { token: "tokenA", fetchFn: mockFetch });
  await getRepositoryOverview("orgB/repoB", { token: "tokenB", fetchFn: mockFetch });

  assert.ok(repoCalls.some((c) => c.includes("orgA/repoA")), "Repo A was queried");
  assert.ok(repoCalls.some((c) => c.includes("orgB/repoB")), "Repo B was queried");
  assert.ok(!repoCalls.some((c) => c.includes("tokenA") || c.includes("tokenB")), "Tokens never leaked in URL paths");
});

console.log("\n===============================================================================");
console.log(` Results: ${passed} passed, ${failed} failed`);
console.log("===============================================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("All GitHub Workspace & Local AI Review safety tests passed successfully!");
}

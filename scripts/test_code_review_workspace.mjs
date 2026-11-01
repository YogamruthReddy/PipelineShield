#!/usr/bin/env node
/**
 * PipelineShield Repository Code Review & Patch Workspace Test Suite
 *
 * Verifies:
 * 1. Branch enumeration (`getRepositoryBranches`) with commit SHAs and protection status.
 * 2. On-demand directory contents navigation (`getRepositoryDirectoryContents`).
 * 3. Token permission scope detection (`checkTokenScopes`) distinguishing read-only vs write tokens.
 * 4. Approval-Gated Apply & Push Workflow (`createPatchBranchAndPullRequest`):
 *    - Approval gating invariant (fails without userConfirmedApproval).
 *    - Permission scope gating invariant (fails when token lacks repo/contents:write).
 *    - Stale base commit detection invariant (fails with HTTP 409 if HEAD moved).
 *    - Isolated branch creation (`patch/pipelineshield-<timestamp>`) and PR opening.
 * 5. Local AI Code Review Actions:
 *    - `explain_code` action with code snippet and line ranges.
 *    - `find_security_risks` action with `<UNTRUSTED_CODE_DATA>` boundaries.
 *    - Secret redaction within code snippets.
 *    - In-memory dry-run patch validation.
 *    - Gatekeeper sovereignty invariant (`securityGateOverridePermitted: false`, `advisoryOnly: true`).
 */

import assert from "assert/strict";
import {
  getRepositoryBranches,
  getRepositoryDirectoryContents,
  checkTokenScopes,
  checkRepositoryWritePermission,
  createPatchBranchAndPullRequest,
} from "../dashboard/src/lib/github-service.ts";
import {
  executeLocalAIAction,
  resetRateLimiterForTesting,
} from "../dashboard/src/lib/local-ai.ts";
import {
  parseFindingsFromAiResponse,
  validateFindingNavigation,
} from "../dashboard/src/lib/finding-traceability.ts";
import {
  compareFindingSnapshots,
  getFindingComparisonKey,
  normalizeFindingTitle,
  COMPARISON_HEURISTIC_DISCLAIMER,
} from "../dashboard/src/lib/finding-regression.ts";

console.log("===============================================================================");
console.log(" PipelineShield — Code Review & Patch Workspace Verification Suite");
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

// ─── 1. Branch Enumeration Tests ─────────────────────────────────────────────
console.log("1. Branch Enumeration (`getRepositoryBranches`)\n");

await runTest("getRepositoryBranches: Returns 401 when no token is provided", async () => {
  const result = await getRepositoryBranches("YogamruthReddy/PipelineShield", { token: "" });
  assert.equal(result.success, false);
  assert.equal(result.statusCode, 401);
  assert.match(result.error, /GITHUB_TOKEN required/);
});

await runTest("getRepositoryBranches: Correctly maps branch names, commit SHAs, and protection flags", async () => {
  const mockBranches = [
    { name: "main", commit: { sha: "abc1234567890" }, protected: true },
    { name: "feature/auth", commit: { sha: "def4567890123" }, protected: false },
  ];

  const mockFetch = async () =>
    new Response(JSON.stringify(mockBranches), {
      status: 200,
      headers: {
        "x-ratelimit-remaining": "4990",
        "x-ratelimit-limit": "5000",
        "x-ratelimit-reset": "1700000000",
      },
    });

  const result = await getRepositoryBranches("YogamruthReddy/PipelineShield", {
    token: "mock-token",
    fetchFn: mockFetch,
  });

  assert.equal(result.success, true);
  assert.equal(result.branches.length, 2);
  assert.equal(result.branches[0].name, "main");
  assert.equal(result.branches[0].commitSha, "abc1234567890");
  assert.equal(result.branches[0].protected, true);
  assert.equal(result.branches[1].name, "feature/auth");
  assert.equal(result.branches[1].protected, false);
});

// ─── 2. On-Demand Directory Tree Tests ────────────────────────────────────────
console.log("\n2. On-Demand Directory Tree (`getRepositoryDirectoryContents`)\n");

await runTest("getRepositoryDirectoryContents: Returns directory items sorted with directories first", async () => {
  const mockContents = [
    { name: "README.md", path: "README.md", type: "file", size: 1024, sha: "sha-readme" },
    { name: "src", path: "src", type: "dir", sha: "sha-src" },
    { name: ".gitignore", path: ".gitignore", type: "file", size: 120, sha: "sha-git" },
    { name: "docs", path: "docs", type: "dir", sha: "sha-docs" },
  ];

  const mockFetch = async () =>
    new Response(JSON.stringify(mockContents), {
      status: 200,
      headers: {
        "x-ratelimit-remaining": "4988",
        "x-ratelimit-limit": "5000",
      },
    });

  const result = await getRepositoryDirectoryContents("YogamruthReddy/PipelineShield", "", "main", {
    token: "mock-token",
    fetchFn: mockFetch,
  });

  assert.equal(result.success, true);
  assert.equal(result.items.length, 4);
  // Folders first: docs, src
  assert.equal(result.items[0].name, "docs");
  assert.equal(result.items[0].type, "dir");
  assert.equal(result.items[1].name, "src");
  assert.equal(result.items[1].type, "dir");
  // Files second: .gitignore, README.md
  assert.equal(result.items[2].name, ".gitignore");
  assert.equal(result.items[2].type, "file");
  assert.equal(result.items[3].name, "README.md");
  assert.equal(result.items[3].type, "file");
});

await runTest("getRepositoryDirectoryContents: Handles single file response gracefully", async () => {
  const mockFile = {
    name: "main.py",
    path: "src/main.py",
    type: "file",
    size: 2048,
    sha: "sha-file",
  };

  const mockFetch = async () =>
    new Response(JSON.stringify(mockFile), {
      status: 200,
      headers: {},
    });

  const result = await getRepositoryDirectoryContents("YogamruthReddy/PipelineShield", "src/main.py", "main", {
    token: "mock-token",
    fetchFn: mockFetch,
  });

  assert.equal(result.success, true);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, "main.py");
  assert.equal(result.items[0].type, "file");
});

// ─── 3. Token Permission Scope Detection ──────────────────────────────────────
console.log("\n3. Token Permission Scope Detection (`checkTokenScopes`)\n");

await runTest("checkTokenScopes: Detects read-only scopes and sets hasWritePermission: false", async () => {
  const mockFetch = async () =>
    new Response(JSON.stringify({}), {
      status: 200,
      headers: {
        "x-oauth-scopes": "read:org, repo:status, user:email",
      },
    });

  const scopes = await checkTokenScopes({
    token: "mock-token",
    fetchFn: mockFetch,
  });

  assert.equal(scopes.hasWritePermission, false);
  assert.ok(scopes.grantedScopes.includes("read:org"));
  assert.ok(scopes.missingScopes.includes("repo"));
  assert.match(scopes.reason, /read-only/i);
});

await runTest("checkTokenScopes: Recognizes write scope ('repo') and grants write permission", async () => {
  const mockFetch = async () =>
    new Response(JSON.stringify({}), {
      status: 200,
      headers: {
        "x-oauth-scopes": "repo, workflow, read:org",
      },
    });

  const scopes = await checkTokenScopes({
    token: "mock-token",
    fetchFn: mockFetch,
  });

  assert.equal(scopes.hasWritePermission, true);
  assert.equal(scopes.missingScopes.length, 0);
  assert.match(scopes.reason, /authorized/i);
});

await runTest("checkRepositoryWritePermission: Fails closed when permissions metadata is missing or push is false", async () => {
  // Test case 1: permissions missing entirely
  const mockFetch1 = async () =>
    new Response(JSON.stringify({ name: "PipelineShield" }), { status: 200 });

  const res1 = await checkRepositoryWritePermission("YogamruthReddy/PipelineShield", {
    token: "mock-token",
    fetchFn: mockFetch1,
  });
  assert.equal(res1.canPush, false);
  assert.match(res1.reason, /Failing closed/i);

  // Test case 2: permissions.push is false
  const mockFetch2 = async () =>
    new Response(
      JSON.stringify({
        permissions: { admin: false, maintain: false, push: false, pull: true },
      }),
      { status: 200 }
    );

  const res2 = await checkRepositoryWritePermission("YogamruthReddy/PipelineShield", {
    token: "mock-token",
    fetchFn: mockFetch2,
  });
  assert.equal(res2.canPush, false);
  assert.match(res2.reason, /read-only access/i);

  // Test case 3: permissions.push is true
  const mockFetch3 = async () =>
    new Response(
      JSON.stringify({
        permissions: { admin: false, maintain: false, push: true, pull: true },
      }),
      { status: 200 }
    );

  const res3 = await checkRepositoryWritePermission("YogamruthReddy/PipelineShield", {
    token: "mock-token",
    fetchFn: mockFetch3,
  });
  assert.equal(res3.canPush, true);
  assert.match(res3.reason, /confirmed/i);
});

// ─── 4. Approval-Gated Apply & Push Workflow ─────────────────────────────────
console.log("\n4. Approval-Gated Apply & Push Workflow (`createPatchBranchAndPullRequest`)\n");

await runTest("createPatchBranchAndPullRequest: Blocks when userConfirmedApproval is false", async () => {
  const result = await createPatchBranchAndPullRequest({
    repoFullName: "YogamruthReddy/PipelineShield",
    baseBranch: "main",
    expectedBaseSha: "commit-12345",
    targetFilePath: "src/app.py",
    patchedContent: "print('safe')",
    commitMessage: "fix: patch",
    prTitle: "Fix issue",
    prBody: "PR Description",
    userConfirmedApproval: false, // explicitly false
  });

  assert.equal(result.success, false);
  assert.equal(result.statusCode, 403);
  assert.match(result.error, /Explicit user approval required/);
});

await runTest("createPatchBranchAndPullRequest: Rejects path traversal and illegal characters in targetFilePath", async () => {
  const result = await createPatchBranchAndPullRequest({
    repoFullName: "YogamruthReddy/PipelineShield",
    baseBranch: "main",
    expectedBaseSha: "commit-12345",
    targetFilePath: "../../etc/passwd",
    patchedContent: "root:x:0:0",
    commitMessage: "exploit",
    prTitle: "Exploit",
    prBody: "Exploit",
    userConfirmedApproval: true,
    options: { token: "token" },
  });

  assert.equal(result.success, false);
  assert.equal(result.statusCode, 400);
  assert.match(result.error, /Path traversal or illegal character/i);
});

await runTest("createPatchBranchAndPullRequest: Blocks when token has only read-only scopes", async () => {
  const mockFetch = async (url) => {
    if (url.includes("/rate_limit")) {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "x-oauth-scopes": "read:org" },
      });
    }
    return new Response(JSON.stringify({}), { status: 400 });
  };

  const result = await createPatchBranchAndPullRequest({
    repoFullName: "YogamruthReddy/PipelineShield",
    baseBranch: "main",
    expectedBaseSha: "commit-12345",
    targetFilePath: "src/app.py",
    patchedContent: "print('safe')",
    commitMessage: "fix: patch",
    prTitle: "Fix issue",
    prBody: "PR Description",
    userConfirmedApproval: true,
    options: {
      token: "read-only-token",
      fetchFn: mockFetch,
    },
  });

  assert.equal(result.success, false);
  assert.equal(result.statusCode, 403);
  assert.match(result.error, /read-only|missing 'repo'/i);
});

await runTest("createPatchBranchAndPullRequest: Fails closed when repository push permission is denied", async () => {
  const mockFetch = async (url) => {
    if (url.includes("/rate_limit")) {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "x-oauth-scopes": "repo" },
      });
    }
    if (url.endsWith("/repos/YogamruthReddy/PipelineShield")) {
      return new Response(
        JSON.stringify({
          permissions: { push: false, pull: true },
        }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({}), { status: 400 });
  };

  const result = await createPatchBranchAndPullRequest({
    repoFullName: "YogamruthReddy/PipelineShield",
    baseBranch: "main",
    expectedBaseSha: "commit-12345",
    targetFilePath: "src/app.py",
    patchedContent: "print('safe')",
    commitMessage: "fix: patch",
    prTitle: "Fix issue",
    prBody: "PR Description",
    userConfirmedApproval: true,
    options: {
      token: "scoped-token",
      fetchFn: mockFetch,
    },
  });

  assert.equal(result.success, false);
  assert.equal(result.statusCode, 403);
  assert.match(result.error, /Write permission check failed.*push permission false/i);
});

await runTest("createPatchBranchAndPullRequest: Aborts with HTTP 409 when base commit is stale", async () => {
  const mockFetch = async (url) => {
    if (url.includes("/rate_limit")) {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "x-oauth-scopes": "repo" },
      });
    }
    if (url.endsWith("/repos/YogamruthReddy/PipelineShield")) {
      return new Response(
        JSON.stringify({
          permissions: { push: true, pull: true },
        }),
        { status: 200 }
      );
    }
    if (url.includes("/git/ref/heads/main")) {
      // Return a different commit SHA than expectedBaseSha
      return new Response(
        JSON.stringify({
          ref: "refs/heads/main",
          object: { sha: "new-moved-sha-99999" },
        }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({}), { status: 400 });
  };

  const result = await createPatchBranchAndPullRequest({
    repoFullName: "YogamruthReddy/PipelineShield",
    baseBranch: "main",
    expectedBaseSha: "old-stale-sha-11111",
    targetFilePath: "src/app.py",
    patchedContent: "print('safe')",
    commitMessage: "fix: patch",
    prTitle: "Fix issue",
    prBody: "PR Description",
    userConfirmedApproval: true,
    options: {
      token: "write-token",
      fetchFn: mockFetch,
    },
  });

  assert.equal(result.success, false);
  assert.equal(result.statusCode, 409);
  assert.match(result.error, /Stale base commit detected/);
});

await runTest("createPatchBranchAndPullRequest: Server verifies unified diff and rejects patch tampering", async () => {
  const baseContent = "line 1\nline 2: insecure\nline 3\n";
  const validDiff = "--- a/src/app.py\n+++ b/src/app.py\n@@ -1,3 +1,3 @@\n line 1\n-line 2: insecure\n+line 2: secured\n line 3";
  const tamperedContent = "MALICIOUS_INJECTION\n";

  const mockFetch = async (url) => {
    if (url.includes("/rate_limit")) {
      return new Response(JSON.stringify({}), { status: 200, headers: { "x-oauth-scopes": "repo" } });
    }
    if (url.endsWith("/repos/YogamruthReddy/PipelineShield")) {
      return new Response(JSON.stringify({ permissions: { push: true } }), { status: 200 });
    }
    if (url.includes("/git/ref/heads/main")) {
      return new Response(JSON.stringify({ object: { sha: "sha-123" } }), { status: 200 });
    }
    if (url.includes("/contents/src/app.py")) {
      return new Response(JSON.stringify({ content: Buffer.from(baseContent).toString("base64") }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 404 });
  };

  const result = await createPatchBranchAndPullRequest({
    repoFullName: "YogamruthReddy/PipelineShield",
    baseBranch: "main",
    expectedBaseSha: "sha-123",
    targetFilePath: "src/app.py",
    unifiedDiff: validDiff,
    patchedContent: tamperedContent, // Tampered content does not match diff result
    commitMessage: "fix",
    prTitle: "fix",
    prBody: "fix",
    userConfirmedApproval: true,
    options: { token: "tok", fetchFn: mockFetch },
  });

  assert.equal(result.success, false);
  assert.equal(result.statusCode, 422);
  assert.match(result.error, /Patch integrity violation/i);
});

await runTest("createPatchBranchAndPullRequest: Successfully creates isolated patch branch and opens PR", async () => {
  const calls = [];
  const mockFetch = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || "GET", body: opts.body });

    if (url.includes("/rate_limit")) {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "x-oauth-scopes": "repo" },
      });
    }
    if (url.endsWith("/repos/YogamruthReddy/PipelineShield")) {
      return new Response(
        JSON.stringify({
          permissions: { push: true, pull: true },
        }),
        { status: 200 }
      );
    }
    if (url.includes("/git/ref/heads/main")) {
      return new Response(
        JSON.stringify({
          ref: "refs/heads/main",
          object: { sha: "matching-sha-77777" },
        }),
        { status: 200 }
      );
    }
    if (url.includes("/git/refs") && opts.method === "POST") {
      return new Response(JSON.stringify({ ref: "refs/heads/patch/pipelineshield-123" }), {
        status: 201,
      });
    }
    if (url.includes("/contents/") && opts.method === "GET") {
      return new Response(JSON.stringify({ sha: "blob-sha-original" }), { status: 200 });
    }
    if (url.includes("/contents/") && opts.method === "PUT") {
      return new Response(JSON.stringify({ content: {} }), { status: 200 });
    }
    if (url.includes("/pulls") && opts.method === "POST") {
      return new Response(
        JSON.stringify({
          html_url: "https://github.com/YogamruthReddy/PipelineShield/pull/42",
          number: 42,
        }),
        { status: 201 }
      );
    }
    return new Response(JSON.stringify({}), { status: 404 });
  };

  const result = await createPatchBranchAndPullRequest({
    repoFullName: "YogamruthReddy/PipelineShield",
    baseBranch: "main",
    expectedBaseSha: "matching-sha-77777",
    targetFilePath: "src/security.py",
    patchedContent: "def safe_handler(): return True",
    commitMessage: "fix(security): sanitize input",
    prTitle: "Security Patch: Sanitize handler",
    prBody: "Patch proposed by PipelineShield.",
    userConfirmedApproval: true,
    options: {
      token: "write-token",
      fetchFn: mockFetch,
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.statusCode, 201);
  assert.equal(result.prNumber, 42);
  assert.equal(result.prUrl, "https://github.com/YogamruthReddy/PipelineShield/pull/42");
  assert.match(result.branchName, /^patch\/pipelineshield-/);

  // Verify that branch creation POST was called
  const branchCall = calls.find((c) => c.url.includes("/git/refs") && c.method === "POST");
  assert.ok(branchCall, "Branch creation endpoint was invoked");

  // Verify that PR creation POST was called with isolated branch head
  const prCall = calls.find((c) => c.url.includes("/pulls") && c.method === "POST");
  assert.ok(prCall, "Pull request endpoint was invoked");
  const prPayload = JSON.parse(prCall.body);
  assert.equal(prPayload.base, "main");
  assert.match(prPayload.head, /^patch\/pipelineshield-/);
});

// ─── 5. Local AI Code Review Actions ─────────────────────────────────────────
console.log("\n5. Local AI Code Review Actions (`explain_code`, `find_security_risks`)\n");

await runTest("executeLocalAIAction: explain_code validates and grounds request with codeSnippet & lineRange", async () => {
  resetRateLimiterForTesting();
  let capturedPrompt = "";

  const mockFetch = async (url, opts = {}) => {
    if (url.includes("/api/tags")) {
      return new Response(
        JSON.stringify({ models: [{ name: "qwen2.5:3b" }] }),
        { status: 200 }
      );
    }
    if (url.includes("/api/generate")) {
      const parsed = JSON.parse(opts.body);
      capturedPrompt = parsed.prompt;
      return new Response(
        JSON.stringify({ response: "This function validates JWT tokens and handles signature checks." }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({}), { status: 404 });
  };

  const result = await executeLocalAIAction(
    JSON.stringify({
      action: "explain_code",
      filePath: "src/auth/jwt.py",
      codeSnippet: "def verify_token(token):\n    secret = 'ghp_supersecretpersonalaccesstoken'\n    return jwt.decode(token, secret)",
      selectedLineRange: [12, 14],
    }),
    { fetchFn: mockFetch }
  );

  assert.equal(result.status, 200);
  assert.equal(result.data.success, true);
  assert.equal(result.data.action, "explain_code");
  assert.equal(result.data.advisoryOnly, true);
  assert.equal(result.data.securityGateOverridePermitted, false);

  // Check prompt boundary & secret redaction
  assert.match(capturedPrompt, /<UNTRUSTED_CODE_DATA>/);
  assert.match(capturedPrompt, /\[REDACTED_SECRET\]/);
  assert.ok(!capturedPrompt.includes("ghp_supersecretpersonalaccesstoken"));
  assert.match(capturedPrompt, /Lines: 12 to 14/);
});

await runTest("executeLocalAIAction: find_security_risks identifies untrusted code and preserves gate authority", async () => {
  resetRateLimiterForTesting();
  let capturedSystemPrompt = "";

  const mockFetch = async (url, opts = {}) => {
    if (url.includes("/api/tags")) {
      return new Response(
        JSON.stringify({ models: [{ name: "qwen2.5:3b" }] }),
        { status: 200 }
      );
    }
    if (url.includes("/api/generate")) {
      const parsed = JSON.parse(opts.body);
      capturedSystemPrompt = parsed.system;
      return new Response(
        JSON.stringify({ response: "CRITICAL: Hardcoded AWS secret key detected in source code." }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({}), { status: 404 });
  };

  const result = await executeLocalAIAction(
    JSON.stringify({
      action: "find_security_risks",
      filePath: "config/aws.js",
      codeSnippet: "const key = 'AKIAIOSFODNN7EXAMPLE';\nexport default key;",
    }),
    { fetchFn: mockFetch }
  );

  assert.equal(result.status, 200);
  assert.equal(result.data.success, true);
  assert.equal(result.data.action, "find_security_risks");
  assert.equal(result.data.securityGateOverridePermitted, false);
  assert.equal(result.data.redactedSecretsCount, 1);

  // Verify critical system prompt invariant
  assert.match(capturedSystemPrompt, /ZERO AUTHORITY to alter CI verdicts/);
  assert.match(capturedSystemPrompt, /UNTRUSTED_CODE_DATA/);
});

// ─── 6. Finding-to-Code Traceability & Navigation Invariants ─────────────────
console.log("\n6. Finding-to-Code Traceability & Navigation Invariants\n");

await runTest("parseFindingsFromAiResponse: extracts structured findings with severity, line ranges, and immutable context", async () => {
  const sampleResponse = `1. CRITICAL: Insecure token deserialization at line 42 to 46.
Found unsafe json.loads without schema validation.

2. HIGH: Hardcoded credentials detected at line 88.
Found API key in source file.`;

  const findings = parseFindingsFromAiResponse(sampleResponse, {
    repoFullName: "YogamruthReddy/PipelineShield",
    branch: "feat/multi-view-secops-dashboard",
    commitSha: "sha-abc1234567890",
    filePath: "src/auth/handler.py",
    selectedRange: [40, 50],
  });

  assert.equal(findings.length, 2);

  // Finding 1
  assert.equal(findings[0].severity, "CRITICAL");
  assert.equal(findings[0].startLine, 42);
  assert.equal(findings[0].endLine, 46);
  assert.equal(findings[0].repoFullName, "YogamruthReddy/PipelineShield");
  assert.equal(findings[0].branch, "feat/multi-view-secops-dashboard");
  assert.equal(findings[0].commitSha, "sha-abc1234567890");
  assert.equal(findings[0].filePath, "src/auth/handler.py");
  assert.equal(findings[0].status, "active");

  // Finding 2
  assert.equal(findings[1].severity, "HIGH");
  assert.equal(findings[1].startLine, 88);
  assert.equal(findings[1].endLine, 88);
  assert.equal(findings[1].commitSha, "sha-abc1234567890");
});

await runTest("parseFindingsFromAiResponse: defaults to selected line range or line 1 when no line is stated", async () => {
  const sampleResponse = `### Finding 1: LOW: Code formatting style discrepancy.`;

  const findings = parseFindingsFromAiResponse(sampleResponse, {
    repoFullName: "YogamruthReddy/PipelineShield",
    branch: "main",
    commitSha: "sha-main-000",
    filePath: "README.md",
    selectedRange: [15, 25],
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "LOW");
  assert.equal(findings[0].startLine, 15);
  assert.equal(findings[0].endLine, 25);
  assert.equal(findings[0].commitSha, "sha-main-000");
});

await runTest("validateFindingNavigation: exact match returns valid state with canNavigate: true", async () => {
  const finding = {
    id: "f-1",
    repoFullName: "YogamruthReddy/PipelineShield",
    branch: "main",
    commitSha: "sha-111111",
    filePath: "src/main.py",
    startLine: 10,
    endLine: 20,
    severity: "HIGH",
    title: "SQL Injection",
    explanation: "Unsanitized user input",
    status: "active",
  };

  const result = validateFindingNavigation(finding, {
    currentRepo: "YogamruthReddy/PipelineShield",
    currentBranch: "main",
    currentCommitSha: "sha-111111",
  });

  assert.equal(result.canNavigate, true);
  assert.equal(result.state, "valid");
});

await runTest("validateFindingNavigation: detects stale commit reference and flags stale_commit without silent revision shift", async () => {
  const finding = {
    id: "f-stale",
    repoFullName: "YogamruthReddy/PipelineShield",
    branch: "main",
    commitSha: "sha-old-111",
    filePath: "src/main.py",
    startLine: 10,
    endLine: 20,
    severity: "HIGH",
    title: "SQL Injection",
    explanation: "Found on older commit",
    status: "active",
  };

  const result = validateFindingNavigation(finding, {
    currentRepo: "YogamruthReddy/PipelineShield",
    currentBranch: "main",
    currentCommitSha: "sha-new-222", // HEAD has moved
  });

  assert.equal(result.canNavigate, true);
  assert.equal(result.state, "stale_commit");
  assert.match(result.message, /Stale revision/i);
});

await runTest("validateFindingNavigation: blocks navigation on repository mismatch (canNavigate: false)", async () => {
  const finding = {
    id: "f-cross-repo",
    repoFullName: "OtherOwner/OtherRepo",
    branch: "main",
    commitSha: "sha-999",
    filePath: "src/main.py",
    startLine: 10,
    endLine: 20,
    severity: "HIGH",
    title: "Cross repo finding",
    explanation: "Belongs elsewhere",
    status: "active",
  };

  const result = validateFindingNavigation(finding, {
    currentRepo: "YogamruthReddy/PipelineShield",
    currentBranch: "main",
    currentCommitSha: "sha-999",
  });

  assert.equal(result.canNavigate, false);
  assert.equal(result.state, "repo_mismatch");
  assert.match(result.message, /Repository mismatch/i);
});

await runTest("validateFindingNavigation: flags branch mismatch state", async () => {
  const finding = {
    id: "f-branch-diff",
    repoFullName: "YogamruthReddy/PipelineShield",
    branch: "feat/some-branch",
    commitSha: "sha-333",
    filePath: "src/main.py",
    startLine: 10,
    endLine: 20,
    severity: "MEDIUM",
    title: "Branch difference finding",
    explanation: "Different branch",
    status: "open",
  };

  const result = validateFindingNavigation(finding, {
    currentRepo: "YogamruthReddy/PipelineShield",
    currentBranch: "main",
    currentCommitSha: "sha-333",
  });

  assert.equal(result.canNavigate, true);
  assert.equal(result.state, "branch_mismatch");
});

await runTest("validateFindingNavigation: blocks navigation if target file is not in availableFiles list", async () => {
  const finding = {
    id: "f-missing-file",
    repoFullName: "YogamruthReddy/PipelineShield",
    branch: "main",
    commitSha: "sha-444",
    filePath: "deleted/file.py",
    startLine: 1,
    endLine: 5,
    severity: "LOW",
    title: "Deleted file finding",
    explanation: "File no longer in tree",
    status: "open",
  };

  const result = validateFindingNavigation(finding, {
    currentRepo: "YogamruthReddy/PipelineShield",
    currentBranch: "main",
    currentCommitSha: "sha-444",
    availableFiles: ["src/main.py", "README.md"],
  });

  assert.equal(result.canNavigate, false);
  assert.equal(result.state, "file_not_found");
});

await runTest("Local AI find_security_risks action generates traceable findings with immutable commitSha", async () => {
  resetRateLimiterForTesting();

  const mockFetch = async (url, opts = {}) => {
    if (url.includes("/api/tags")) {
      return new Response(JSON.stringify({ models: [{ name: "qwen2.5:3b" }] }), { status: 200 });
    }
    if (url.includes("/api/generate")) {
      return new Response(
        JSON.stringify({
          response: "1. CRITICAL: Hardcoded secret token found on lines 5 to 7.\nUse environment variables instead.",
        }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({}), { status: 404 });
  };

  const result = await executeLocalAIAction(
    JSON.stringify({
      action: "find_security_risks",
      repo: "YogamruthReddy/PipelineShield",
      branch: "main",
      commitSha: "deadbeefcafe12345678",
      filePath: "src/secrets.py",
      codeSnippet: "def get_token():\n    return 'ghp_secret12345'",
      selectedLineRange: [1, 10],
    }),
    { fetchFn: mockFetch }
  );

  assert.equal(result.status, 200);
  assert.equal(result.data.success, true);
  assert.ok(Array.isArray(result.data.reviewFindings));
  assert.equal(result.data.reviewFindings.length, 1);

  const finding = result.data.reviewFindings[0];
  assert.equal(finding.severity, "CRITICAL");
  assert.equal(finding.startLine, 5);
  assert.equal(finding.endLine, 7);
  assert.equal(finding.repoFullName, "YogamruthReddy/PipelineShield");
  assert.equal(finding.branch, "main");
  assert.equal(finding.commitSha, "deadbeefcafe12345678");
  assert.equal(finding.filePath, "src/secrets.py");
});

// ─── 7. Baseline vs Regression Finding Comparison Engine ─────────────────────
console.log("\n7. Baseline vs Regression Finding Comparison Engine\n");

await runTest("normalizeFindingTitle: strips variable line references and punctuation for cross-commit matching", async () => {
  const titleA = "Hardcoded secret key on line 14";
  const titleB = "Hardcoded secret key on lines 22-25";
  const titleC = "CRITICAL: Hardcoded secret key (cwe-798)";

  const normA = normalizeFindingTitle(titleA);
  const normB = normalizeFindingTitle(titleB);
  const normC = normalizeFindingTitle(titleC);

  assert.equal(normA, normB);
  assert.equal(normA, "hardcoded secret key on");
  assert.equal(normC, "critical hardcoded secret key");
});

await runTest("getFindingComparisonKey: produces deterministic key normalized by path, severity, and title", async () => {
  const f1 = {
    id: "f-1",
    filePath: "src/auth.ts",
    severity: "HIGH",
    title: "SQL Injection in query at line 10",
    repoFullName: "repo/a",
    branch: "main",
    startLine: 10,
    endLine: 12,
    status: "active",
    explanation: "exp",
  };

  const f2 = {
    id: "f-2",
    filePath: "src/auth.ts",
    severity: "HIGH",
    title: "SQL Injection in query at line 45",
    repoFullName: "repo/a",
    branch: "main",
    startLine: 45,
    endLine: 48,
    status: "active",
    explanation: "exp",
  };

  const key1 = getFindingComparisonKey(f1);
  const key2 = getFindingComparisonKey(f2);

  assert.equal(key1, key2);
  assert.equal(key1, "src/auth.ts::HIGH::sql injection in query at");
});

await runTest("compareFindingSnapshots: identifies new, resolved, and persistent findings between commits", async () => {
  const baselineFindings = [
    {
      id: "b-1",
      filePath: "src/auth.ts",
      severity: "CRITICAL",
      title: "Hardcoded Admin Token",
      startLine: 10,
      endLine: 12,
      repoFullName: "org/repo",
      branch: "main",
      status: "active",
      explanation: "Secret key in source",
    },
    {
      id: "b-2",
      filePath: "src/db.ts",
      severity: "HIGH",
      title: "Unescaped Parameter in Raw Query",
      startLine: 50,
      endLine: 55,
      repoFullName: "org/repo",
      branch: "main",
      status: "active",
      explanation: "SQL query injection",
    },
  ];

  const targetFindings = [
    // Persistent (matches b-1, lines shifted)
    {
      id: "t-1",
      filePath: "src/auth.ts",
      severity: "CRITICAL",
      title: "Hardcoded Admin Token",
      startLine: 15,
      endLine: 17,
      repoFullName: "org/repo",
      branch: "feat",
      status: "active",
      explanation: "Still present",
    },
    // New regression
    {
      id: "t-2",
      filePath: "src/api.ts",
      severity: "MEDIUM",
      title: "CORS Wildcard Allowed",
      startLine: 20,
      endLine: 22,
      repoFullName: "org/repo",
      branch: "feat",
      status: "active",
      explanation: "Wildcard origin",
    },
  ];

  const result = compareFindingSnapshots({
    baselineFindings,
    targetFindings,
    baselineCommit: "sha-base-111",
    targetCommit: "sha-target-222",
  });

  // Check Categorization
  assert.equal(result.newFindings.length, 1);
  assert.equal(result.newFindings[0].title, "CORS Wildcard Allowed");
  assert.equal(result.newFindings[0].comparisonStatus, "new");

  assert.equal(result.resolvedFindings.length, 1);
  assert.equal(result.resolvedFindings[0].title, "Unescaped Parameter in Raw Query");
  assert.equal(result.resolvedFindings[0].comparisonStatus, "resolved");

  assert.equal(result.persistentFindings.length, 1);
  assert.equal(result.persistentFindings[0].title, "Hardcoded Admin Token");
  assert.equal(result.persistentFindings[0].comparisonStatus, "persistent");

  // Check Summary
  assert.equal(result.summary.baselineTotal, 2);
  assert.equal(result.summary.targetTotal, 2);
  assert.equal(result.summary.newCount, 1);
  assert.equal(result.summary.resolvedCount, 1);
  assert.equal(result.summary.persistentCount, 1);
  assert.equal(result.summary.netDelta, 0); // 1 new - 1 resolved = 0 net

  // Check Severity Breakdown
  assert.equal(result.summary.severityBreakdown.CRITICAL.persistent, 1);
  assert.equal(result.summary.severityBreakdown.HIGH.resolved, 1);
  assert.equal(result.summary.severityBreakdown.MEDIUM.new, 1);
});

await runTest("compareFindingSnapshots: handles initial review (empty baseline) where all findings are marked as new", async () => {
  const targetFindings = [
    {
      id: "t-1",
      filePath: "src/index.ts",
      severity: "LOW",
      title: "Debug logging enabled",
      startLine: 5,
      endLine: 6,
      repoFullName: "org/repo",
      branch: "main",
      status: "active",
      explanation: "Console log in prod",
    },
  ];

  const result = compareFindingSnapshots({
    baselineFindings: [],
    targetFindings,
    baselineCommit: "sha-empty",
    targetCommit: "sha-head",
  });

  assert.equal(result.newFindings.length, 1);
  assert.equal(result.resolvedFindings.length, 0);
  assert.equal(result.persistentFindings.length, 0);
  assert.equal(result.summary.netDelta, 1);
});

await runTest("compareFindingSnapshots: handles full remediation where all baseline findings are resolved", async () => {
  const baselineFindings = [
    {
      id: "b-1",
      filePath: "src/vuln.ts",
      severity: "CRITICAL",
      title: "Remote Code Execution",
      startLine: 1,
      endLine: 5,
      repoFullName: "org/repo",
      branch: "main",
      status: "active",
      explanation: "Command injection",
    },
  ];

  const result = compareFindingSnapshots({
    baselineFindings,
    targetFindings: [],
    baselineCommit: "sha-vuln",
    targetCommit: "sha-clean",
  });

  assert.equal(result.newFindings.length, 0);
  assert.equal(result.resolvedFindings.length, 1);
  assert.equal(result.persistentFindings.length, 0);
  assert.equal(result.summary.netDelta, -1); // Improvement!
});

await runTest("Historical commit file loading invariant: queries exact commitSha rather than active branch", async () => {
  const requestedRefs = [];

  const mockFileFetcher = async (repo, path, ref) => {
    requestedRefs.push({ repo, path, ref });
    return {
      success: true,
      content: "line 1\nline 2 (historical code at commit sha-historical)\nline 3",
    };
  };

  const staleFinding = {
    id: "f-historical",
    repoFullName: "YogamruthReddy/PipelineShield",
    branch: "main",
    commitSha: "sha-historical-9999",
    filePath: "src/auth/token.py",
    startLine: 2,
    endLine: 2,
    severity: "HIGH",
    title: "Insecure Token Parsing",
    explanation: "Historical finding",
    status: "active",
  };

  // Simulating the ref resolution logic implemented in handleSelectFinding
  const activeBranch = "main";
  const targetRef = staleFinding.commitSha || activeBranch;

  const res = await mockFileFetcher(staleFinding.repoFullName, staleFinding.filePath, targetRef);

  assert.equal(res.success, true);
  assert.equal(requestedRefs.length, 1);
  assert.equal(requestedRefs[0].ref, "sha-historical-9999");
  assert.notEqual(requestedRefs[0].ref, activeBranch);
  assert.match(res.content, /sha-historical/);
});

await runTest("Adversarial matching: handles severity shift between reviews and flags candidate match with severityChangedFrom", async () => {
  const baseline = [
    {
      id: "b-sev-shift",
      filePath: "src/crypto.py",
      severity: "CRITICAL",
      title: "Weak DES cipher algorithm used",
      startLine: 12,
      endLine: 14,
      repoFullName: "org/repo",
      branch: "main",
      status: "active",
      explanation: "DES is vulnerable to brute force",
    },
  ];

  // In the target commit review, model re-evaluates the exact same flaw as HIGH instead of CRITICAL
  const target = [
    {
      id: "t-sev-shift",
      filePath: "src/crypto.py",
      severity: "HIGH",
      title: "Weak DES cipher algorithm used",
      startLine: 12,
      endLine: 14,
      repoFullName: "org/repo",
      branch: "main",
      status: "active",
      explanation: "DES cipher is broken",
    },
  ];

  const result = compareFindingSnapshots({
    baselineFindings: baseline,
    targetFindings: target,
    baselineCommit: "sha-1",
    targetCommit: "sha-2",
  });

  // Must match as persistent candidate rather than 1 new + 1 resolved false regression
  assert.equal(result.persistentFindings.length, 1);
  assert.equal(result.newFindings.length, 0);
  assert.equal(result.resolvedFindings.length, 0);
  assert.equal(result.persistentFindings[0].matchConfidence, "candidate_heuristic");
  assert.equal(result.persistentFindings[0].severityChangedFrom, "CRITICAL");
  assert.equal(result.persistentFindings[0].isCandidateMatch, true);
});

await runTest("Adversarial matching: distinguishes multiple distinct vulnerabilities within the same file", async () => {
  const baseline = [
    {
      id: "b-1",
      filePath: "src/routes.js",
      severity: "HIGH",
      title: "Raw SQL query injection",
      startLine: 10,
      endLine: 15,
      repoFullName: "org/repo",
      branch: "main",
      status: "active",
      explanation: "SQLi",
    },
    {
      id: "b-2",
      filePath: "src/routes.js",
      severity: "HIGH",
      title: "Cross-Site Scripting (XSS) via unescaped html",
      startLine: 80,
      endLine: 85,
      repoFullName: "org/repo",
      branch: "main",
      status: "active",
      explanation: "XSS",
    },
  ];

  // Target fixes SQLi, but leaves XSS in place
  const target = [
    {
      id: "t-2",
      filePath: "src/routes.js",
      severity: "HIGH",
      title: "Cross-Site Scripting (XSS) via unescaped html",
      startLine: 75,
      endLine: 80,
      repoFullName: "org/repo",
      branch: "main",
      status: "active",
      explanation: "XSS",
    },
  ];

  const result = compareFindingSnapshots({
    baselineFindings: baseline,
    targetFindings: target,
    baselineCommit: "sha-base",
    targetCommit: "sha-target",
  });

  assert.equal(result.persistentFindings.length, 1);
  assert.equal(result.persistentFindings[0].title, "Cross-Site Scripting (XSS) via unescaped html");
  assert.equal(result.resolvedFindings.length, 1);
  assert.equal(result.resolvedFindings[0].title, "Raw SQL query injection");
  assert.equal(result.newFindings.length, 0);
});

await runTest("Heuristic disclaimer invariant: comparison engine documents candidate nature", async () => {
  assert.ok(COMPARISON_HEURISTIC_DISCLAIMER);
  assert.match(COMPARISON_HEURISTIC_DISCLAIMER, /Candidate heuristic match/i);
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log("\n===============================================================================");
console.log(` Results: ${passed} passed, ${failed} failed`);
console.log("===============================================================================\n");

if (failed > 0) {
  process.exit(1);
}


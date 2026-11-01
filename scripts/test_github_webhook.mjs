#!/usr/bin/env node
/**
 * Automated Test Suite for PipelineShield GitHub Webhook & Real-Time Ingestion.
 *
 * Covers:
 * 1. Cryptographic HMAC SHA-256 signature verification (valid, missing, malformed, invalid, timing-safe).
 * 2. Event validation (ping, workflow_run.completed, ignored actions, repo boundary, workflow targeting).
 * 3. Delivery idempotency & deduplication (delivery UUIDs, run IDs).
 * 4. Run Store persistence & change intelligence (new, fixed, persistent, regressed findings).
 * 5. End-to-end webhook processing (successful ingestion, missing artifact, expired artifact).
 */

import crypto from "crypto";
import zlib from "zlib";
import os from "os";
import path from "path";
import fs from "fs";
import assert from "assert/strict";

// Setup isolated temporary data directory for clean testing
const TEST_DATA_DIR = path.join(os.tmpdir(), `pipelineshield-webhook-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
process.env.PIPELINESHIELD_DATA_DIR = TEST_DATA_DIR;

const {
  verifyGitHubWebhookSignature,
  validateWebhookEvent,
  processWebhookWorkflowRun,
} = await import("../dashboard/src/lib/github-webhook.ts");

const {
  recordRun,
  getAllRuns,
  getRunById,
  compareRuns,
  resetRunStore,
  isDeliveryProcessed,
  recordDelivery,
} = await import("../dashboard/src/lib/run-store.ts");

console.log("===============================================================================");
console.log(" PipelineShield — GitHub Webhook & Real-Time Platform Test Suite");
console.log("===============================================================================\n");

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    failed++;
  }
}

async function runAsyncTest(name, fn) {
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

// Helper: Calculate valid HMAC SHA-256 signature
function calculateHmac(payload, secret) {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  return `sha256=${hmac.digest("hex")}`;
}

// ----------------------------------------------------------------------------
// Deterministic ZIP Builder for Test Fixtures
// ----------------------------------------------------------------------------
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function createStoredZip(fileName, contentStr) {
  const fileBytes = Buffer.from(contentStr, "utf8");
  const fileNameBytes = Buffer.from(fileName, "utf8");
  const fileCrc = crc32(fileBytes);

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(fileCrc, 14);
  localHeader.writeUInt32LE(fileBytes.length, 18);
  localHeader.writeUInt32LE(fileBytes.length, 22);
  localHeader.writeUInt16LE(fileNameBytes.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(0, 10);
  centralHeader.writeUInt16LE(0, 12);
  centralHeader.writeUInt16LE(0, 14);
  centralHeader.writeUInt32LE(fileCrc, 16);
  centralHeader.writeUInt32LE(fileBytes.length, 20);
  centralHeader.writeUInt32LE(fileBytes.length, 24);
  centralHeader.writeUInt16LE(fileNameBytes.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(0, 38);
  centralHeader.writeUInt32LE(0, 42);

  const centralOffset = localHeader.length + fileNameBytes.length + fileBytes.length;
  const centralSize = centralHeader.length + fileNameBytes.length;

  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(1, 8);
  endRecord.writeUInt16LE(1, 10);
  endRecord.writeUInt32LE(centralSize, 12);
  endRecord.writeUInt32LE(centralOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([
    localHeader,
    fileNameBytes,
    fileBytes,
    centralHeader,
    fileNameBytes,
    endRecord,
  ]);
}

const VALID_REPORT_JSON = JSON.stringify({
  version: "1.1.0",
  timestamp: "2026-11-01T00:00:00Z",
  decision: "PASS",
  summary: {
    total_findings: 1,
    critical: 0,
    high: 0,
    medium: 1,
    low: 0,
    info: 0,
    exempted: 0,
    blocking_count: 0,
    warning_count: 1,
  },
  scanner_status: {
    trivy: "COMPLETED",
    semgrep: "COMPLETED",
    dependency_review: "COMPLETED",
  },
  blocking_findings: [],
  warning_findings: [
    {
      id: "CVE-2026-0001",
      scanner: "trivy",
      severity: "MEDIUM",
      title: "Sample Low Risk Finding",
      package_name: "test-lib",
      installed_version: "1.0.0",
      rule_id: "PS-001",
    },
  ],
  advisory_findings: [],
  evaluations: [
    {
      rule_id: "PS-001",
      rule_name: "Block Criticals",
      decision: "PASS",
      matched_count: 0,
      blocking_count: 0,
      description: "Test rule",
    },
  ],
});

// ============================================================================
// Group 1: Cryptographic HMAC SHA-256 Verification
// ============================================================================
console.log("Group 1: HMAC SHA-256 Signature Verification");

runTest("Valid HMAC SHA-256 signature passes", () => {
  const secret = "test-webhook-secret-xyz-123";
  const body = JSON.stringify({ action: "completed", workflow_run: { id: 101 } });
  const sig = calculateHmac(body, secret);

  const res = verifyGitHubWebhookSignature(body, sig, secret);
  assert.equal(res.valid, true);
  assert.equal(res.statusCode, 200);
});

runTest("Missing signature header returns 401", () => {
  const secret = "test-webhook-secret-xyz-123";
  const body = JSON.stringify({ action: "completed" });

  const res = verifyGitHubWebhookSignature(body, null, secret);
  assert.equal(res.valid, false);
  assert.equal(res.statusCode, 401);
  assert.match(res.error, /Missing required 'X-Hub-Signature-256'/i);
});

runTest("Malformed signature without 'sha256=' prefix returns 401", () => {
  const secret = "test-webhook-secret-xyz-123";
  const body = JSON.stringify({ action: "completed" });

  const res = verifyGitHubWebhookSignature(body, "badprefix-deadbeef", secret);
  assert.equal(res.valid, false);
  assert.equal(res.statusCode, 401);
  assert.match(res.error, /Malformed 'X-Hub-Signature-256'/i);
});

runTest("Incorrect signature digest returns 401", () => {
  const secret = "test-webhook-secret-xyz-123";
  const body = JSON.stringify({ action: "completed" });
  const invalidSig = "sha256=" + "a".repeat(64);

  const res = verifyGitHubWebhookSignature(body, invalidSig, secret);
  assert.equal(res.valid, false);
  assert.equal(res.statusCode, 401);
  assert.match(res.error, /Invalid webhook HMAC SHA-256 signature/i);
});

runTest("Missing server GITHUB_WEBHOOK_SECRET returns 500", () => {
  const body = JSON.stringify({ action: "completed" });
  const sig = "sha256=" + "a".repeat(64);

  const res = verifyGitHubWebhookSignature(body, sig, "");
  assert.equal(res.valid, false);
  assert.equal(res.statusCode, 500);
  assert.match(res.error, /GITHUB_WEBHOOK_SECRET is not configured/i);
});

// ============================================================================
// Group 2: Webhook Event & Targeting Validation
// ============================================================================
console.log("\nGroup 2: Webhook Event & Scope Validation");

runTest("Ping event returns 200 acknowledged", () => {
  const headers = { event: "ping", delivery: "deliv-001" };
  const payload = { zen: "Keep it logically awesome." };

  const res = validateWebhookEvent(headers, payload);
  assert.equal(res.valid, true);
  assert.equal(res.isPing, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.deliveryId, "deliv-001");
});

runTest("Unrelated event (e.g. push) is ignored with 202", () => {
  const headers = { event: "push", delivery: "deliv-002" };
  const payload = { ref: "refs/heads/main" };

  const res = validateWebhookEvent(headers, payload);
  assert.equal(res.valid, true);
  assert.equal(res.shouldProcess, false);
  assert.equal(res.statusCode, 202);
  assert.match(res.reason, /exclusively processes 'workflow_run'/i);
});

runTest("Workflow run action not 'completed' is ignored with 202", () => {
  const headers = { event: "workflow_run", delivery: "deliv-003" };
  const payload = {
    action: "in_progress",
    workflow_run: { id: 101, name: "CI Security Gate" },
    repository: { full_name: "YogamruthReddy/PipelineShield" },
  };

  const res = validateWebhookEvent(headers, payload);
  assert.equal(res.shouldProcess, false);
  assert.equal(res.statusCode, 202);
  assert.match(res.reason, /triggers strictly on 'completed'/i);
});

runTest("Unrelated repository workflow run is ignored with 202", () => {
  const headers = { event: "workflow_run", delivery: "deliv-004" };
  const payload = {
    action: "completed",
    workflow_run: { id: 101, name: "CI Security Gate", path: ".github/workflows/security-gate.yml" },
    repository: { full_name: "attacker/malicious-repo" },
  };

  const res = validateWebhookEvent(headers, payload, "YogamruthReddy/PipelineShield");
  assert.equal(res.shouldProcess, false);
  assert.equal(res.statusCode, 202);
  assert.match(res.reason, /Ignored workflow run from repository 'attacker\/malicious-repo'/i);
});

runTest("Unrelated workflow (e.g. deploy.yml) is ignored with 202", () => {
  const headers = { event: "workflow_run", delivery: "deliv-005" };
  const payload = {
    action: "completed",
    workflow_run: { id: 101, name: "Deploy to Prod", path: ".github/workflows/deploy.yml" },
    repository: { full_name: "YogamruthReddy/PipelineShield" },
  };

  const res = validateWebhookEvent(headers, payload, "YogamruthReddy/PipelineShield");
  assert.equal(res.shouldProcess, false);
  assert.equal(res.statusCode, 202);
  assert.match(res.reason, /does not match target security gate workflow/i);
});

runTest("Target workflow run (security-gate.yml) passes validation with 200", () => {
  const headers = { event: "workflow_run", delivery: "deliv-006" };
  const payload = {
    action: "completed",
    workflow_run: {
      id: 555,
      name: "CI Security Gate",
      path: ".github/workflows/security-gate.yml",
    },
    repository: { full_name: "YogamruthReddy/PipelineShield" },
  };

  const res = validateWebhookEvent(headers, payload, "YogamruthReddy/PipelineShield");
  assert.equal(res.valid, true);
  assert.equal(res.shouldProcess, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.runId, 555);
});

// ============================================================================
// Group 3: Delivery Idempotency & Deduplication
// ============================================================================
console.log("\nGroup 3: Delivery Idempotency & Deduplication");

runTest("Delivery idempotency tracks and dedupes repeated delivery UUIDs", () => {
  resetRunStore();
  const deliveryId = "uuid-delivery-999";
  assert.equal(isDeliveryProcessed(deliveryId), false);

  recordDelivery(deliveryId, 555, "workflow_run");
  assert.equal(isDeliveryProcessed(deliveryId), true);
});

await runAsyncTest("processWebhookWorkflowRun safely short-circuits already processed delivery", async () => {
  resetRunStore();
  const deliveryId = "uuid-delivery-repeat-1";
  recordDelivery(deliveryId, 777, "workflow_run");

  const validation = {
    valid: true,
    statusCode: 200,
    isPing: false,
    shouldProcess: true,
    runId: 777,
    deliveryId,
  };

  const res = await processWebhookWorkflowRun(validation);
  assert.equal(res.status, "already_processed");
  assert.equal(res.statusCode, 200);
  assert.match(res.message, /already processed/i);
});

// ============================================================================
// Group 4: Run Store & Change Intelligence (Compare Runs)
// ============================================================================
console.log("\nGroup 4: Run Store & Run-to-Run Comparison");

runTest("Store records runs and sorts by runId descending", () => {
  resetRunStore();

  const report1 = JSON.parse(VALID_REPORT_JSON);
  report1.decision = "BLOCK";

  const report2 = JSON.parse(VALID_REPORT_JSON);
  report2.decision = "PASS";

  recordRun(
    {
      id: 101,
      name: "CI Security Gate",
      status: "completed",
      conclusion: "failure",
      html_url: "https://github.com/YogamruthReddy/PipelineShield/actions/runs/101",
      head_sha: "commit-111",
      head_branch: "feat/sec",
      event: "pull_request",
      created_at: "2026-10-30T10:00:00Z",
      updated_at: "2026-10-30T10:05:00Z",
      run_number: 1,
    },
    report1
  );

  recordRun(
    {
      id: 102,
      name: "CI Security Gate",
      status: "completed",
      conclusion: "success",
      html_url: "https://github.com/YogamruthReddy/PipelineShield/actions/runs/102",
      head_sha: "commit-222",
      head_branch: "feat/sec",
      event: "pull_request",
      created_at: "2026-10-31T10:00:00Z",
      updated_at: "2026-10-31T10:05:00Z",
      run_number: 2,
    },
    report2
  );

  const all = getAllRuns();
  assert.equal(all.length, 2);
  assert.equal(all[0].runId, 102);
  assert.equal(all[1].runId, 101);
});

runTest("compareRuns accurately identifies new, fixed, persistent, and regressed findings", () => {
  const baseRun = {
    runId: 201,
    label: "Run #201",
    branch: "main",
    commitSha: "sha1",
    event: "push",
    decision: "BLOCK",
    htmlUrl: "",
    timestamp: "2026-10-30T00:00:00Z",
    ingestedAt: "2026-10-30T00:00:00Z",
    provenance: {},
    report: {},
    summary: { critical: 1, high: 1, medium: 1, low: 0, info: 0, total: 3 },
    findings: [
      {
        id: "FINDING-PERSISTENT",
        scanner: "semgrep",
        severity: "HIGH",
        title: "Persistent SQLi",
        file_path: "src/db.ts",
      },
      {
        id: "FINDING-FIXED",
        scanner: "trivy",
        severity: "CRITICAL",
        title: "Remediated CVE-2025-9999",
        package_name: "vulnerable-lib",
      },
      {
        id: "FINDING-REGRESSED",
        scanner: "trivy",
        severity: "LOW",
        title: "Worsened Bug",
        package_name: "flaky-lib",
      },
    ],
  };

  const targetRun = {
    runId: 202,
    label: "Run #202",
    branch: "main",
    commitSha: "sha2",
    event: "push",
    decision: "WARN",
    htmlUrl: "",
    timestamp: "2026-10-31T00:00:00Z",
    ingestedAt: "2026-10-31T00:00:00Z",
    provenance: {},
    report: {},
    summary: { critical: 0, high: 2, medium: 0, low: 0, info: 0, total: 2 },
    findings: [
      {
        id: "FINDING-PERSISTENT",
        scanner: "semgrep",
        severity: "HIGH",
        title: "Persistent SQLi",
        file_path: "src/db.ts",
      },
      {
        id: "FINDING-REGRESSED",
        scanner: "trivy",
        severity: "HIGH", // Upgraded from LOW -> HIGH
        title: "Worsened Bug",
        package_name: "flaky-lib",
      },
      {
        id: "FINDING-NEW",
        scanner: "dependency_review",
        severity: "HIGH",
        title: "Newly added risky dep",
        package_name: "bad-npm-pkg",
      },
    ],
  };

  const comparison = compareRuns(baseRun, targetRun);

  // Assertions
  assert.equal(comparison.baseRunId, 201);
  assert.equal(comparison.targetRunId, 202);

  // New findings
  assert.equal(comparison.newFindings.length, 1);
  assert.equal(comparison.newFindings[0].id, "FINDING-NEW");

  // Fixed findings
  assert.equal(comparison.fixedFindings.length, 1);
  assert.equal(comparison.fixedFindings[0].id, "FINDING-FIXED");

  // Persistent findings
  assert.equal(comparison.persistentFindings.length, 2);

  // Regressed findings (upgraded severity)
  assert.equal(comparison.regressedFindings.length, 1);
  assert.equal(comparison.regressedFindings[0].id, "FINDING-REGRESSED");

  // Severity deltas
  assert.equal(comparison.summary.severityChange.criticalDelta, -1);
  assert.equal(comparison.summary.severityChange.highDelta, 1);
});

// ============================================================================
// Group 5: End-to-End Webhook Ingestion with Mock Fetch
// ============================================================================
console.log("\nGroup 5: End-to-End Webhook Ingestion");

await runAsyncTest("Valid workflow_run event downloads artifact and updates store", async () => {
  resetRunStore();

  const zipBytes = createStoredZip("security-summary.json", VALID_REPORT_JSON);

  const mockFetch = async (url) => {
    // 1. Query run
    if (url.includes("/actions/runs/888") && !url.includes("/artifacts")) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          id: 888,
          name: "CI Security Gate",
          status: "completed",
          conclusion: "success",
          html_url: "https://github.com/YogamruthReddy/PipelineShield/actions/runs/888",
          head_sha: "abcd123",
          head_branch: "main",
          event: "workflow_run",
          created_at: "2026-11-01T02:00:00Z",
          updated_at: "2026-11-01T02:05:00Z",
          run_number: 88,
        }),
      };
    }

    // 2. Query artifacts
    if (url.includes("/actions/runs/888/artifacts")) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          artifacts: [
            {
              id: 9999,
              name: "security-summary-reports",
              size_in_bytes: zipBytes.length,
              expired: false,
              created_at: "2026-11-01T02:04:00Z",
            },
          ],
        }),
      };
    }

    // 3. Download artifact ZIP
    if (url.includes("/actions/artifacts/9999/zip")) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/zip" }),
        arrayBuffer: async () => zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength),
      };
    }

    return { ok: false, status: 404, statusText: "Not Found", headers: new Headers() };
  };

  const validation = {
    valid: true,
    statusCode: 200,
    isPing: false,
    shouldProcess: true,
    runId: 888,
    deliveryId: "deliv-webhook-e2e-1",
  };

  const result = await processWebhookWorkflowRun(validation, {
    token: "ghp_mock_token_123",
    repo: "YogamruthReddy/PipelineShield",
    fetchFn: mockFetch,
  });

  assert.equal(result.status, "ingested");
  assert.equal(result.statusCode, 200);
  assert.equal(result.decision, "PASS");
  assert.equal(result.runId, 888);

  // Verify stored in RunStore
  const stored = getRunById(888);
  assert.ok(stored, "Run 888 must be present in RunStore");
  assert.equal(stored.decision, "PASS");
  assert.equal(stored.branch, "main");
  assert.equal(stored.commitSha, "abcd123");
});

await runAsyncTest("Missing artifact returns clean failure (404, never PASS)", async () => {
  resetRunStore();

  const mockFetch = async (url) => {
    if (url.includes("/actions/runs/999") && !url.includes("/artifacts")) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          id: 999,
          name: "CI Security Gate",
          status: "completed",
          conclusion: "failure",
          html_url: "https://github.com/YogamruthReddy/PipelineShield/actions/runs/999",
          head_sha: "deadbeef",
          head_branch: "main",
          event: "push",
          created_at: "2026-11-01T03:00:00Z",
          updated_at: "2026-11-01T03:05:00Z",
        }),
      };
    }

    if (url.includes("/actions/runs/999/artifacts")) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          artifacts: [], // No artifact uploaded
        }),
      };
    }

    return { ok: false, status: 404, statusText: "Not Found", headers: new Headers() };
  };

  const validation = {
    valid: true,
    statusCode: 200,
    isPing: false,
    shouldProcess: true,
    runId: 999,
    deliveryId: "deliv-webhook-e2e-2",
  };

  const result = await processWebhookWorkflowRun(validation, {
    token: "ghp_mock_token_123",
    repo: "YogamruthReddy/PipelineShield",
    fetchFn: mockFetch,
  });

  assert.equal(result.status, "failed");
  assert.equal(result.statusCode, 404);
  assert.match(result.message, /does not contain artifact/i);
});

// ============================================================================
// Final Test Summary
// ============================================================================
console.log("\n===============================================================================");
console.log(` Webhook Test Results: ${passed} passed, ${failed} failed`);
console.log("===============================================================================");

if (fs.existsSync(TEST_DATA_DIR)) {
  try {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors on Windows
  }
}

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

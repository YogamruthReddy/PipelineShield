#!/usr/bin/env node
/**
 * Real Multi-Process Restart Durability Test.
 *
 * Simulates a server shutdown and restart across distinct OS processes:
 * Phase A (Process 1): Writes a real run and webhook delivery UUID to the real storage directory, then exits.
 * Phase B (Process 2): Spawned in a completely fresh Node.js process, loads store from disk, and asserts survival.
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import assert from "assert/strict";

const STORAGE_DIR = path.resolve("dashboard", "data", "storage");
const RUN_STORE_URL = pathToFileURL(path.resolve("dashboard", "src", "lib", "run-store.ts")).href;
const TEST_RUN_ID = 777001;
const TEST_DELIVERY_ID = `delivery-restart-${Date.now()}`;

console.log("===============================================================================");
console.log(" Real Multi-Process Restart Durability Verification");
console.log(` Target Storage Backend: Atomic Filesystem Document Store`);
console.log(` Disk Path: ${STORAGE_DIR}`);
console.log("===============================================================================");

// 1. Run Process 1: Write run and delivery, then terminate
console.log("\n[Step 1] Spawning Process 1 (Writer)...");
const writeScript = `
  import path from "path";
  process.env.PIPELINESHIELD_DATA_DIR = ${JSON.stringify(STORAGE_DIR)};
  
  import(${JSON.stringify(RUN_STORE_URL)}).then(({ recordRun, recordDelivery }) => {
    const runProvenance = {
      id: ${TEST_RUN_ID},
      run_number: 99,
      name: "CI Security Gate",
      path: ".github/workflows/security-gate.yml",
      head_sha: "777aaa1234567890abcdef1234567890abcdef12",
      head_branch: "feat/restart-test",
      event: "workflow_run",
      conclusion: "failure",
      html_url: "https://github.com/YogamruthReddy/PipelineShield/actions/runs/${TEST_RUN_ID}",
      created_at: new Date().toISOString(),
    };

    const evaluationResult = {
      decision: "BLOCK",
      evaluated_at: new Date().toISOString(),
      reasons: ["BLOCK: Critical vulnerability detected in python-cryptography"],
      summary: {
        total_findings: 1,
        critical: 1,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
        exempted: 0,
        blocking_count: 1,
        warning_count: 0,
      },
      scanner_status: { trivy: "COMPLETED", semgrep: "COMPLETED", dependency_review: "COMPLETED" },
      findings: [
        {
          id: "CVE-2022-42966",
          scanner: "trivy",
          title: "ReDoS vulnerability in python-cryptography",
          severity: "CRITICAL",
          file_path: "engine/requirements.txt",
          package_name: "cryptography",
          installed_version: "3.4.8",
          fixed_version: "38.0.3",
        }
      ],
    };

    const artifact = {
      id: 88801,
      name: "security-summary-reports",
      sizeInBytes: 4096,
      url: "https://api.github.com/repos/YogamruthReddy/PipelineShield/actions/artifacts/88801/zip",
      archiveFormat: "zip",
      fileCount: 3,
    };

    recordRun(runProvenance, evaluationResult, artifact, ${JSON.stringify(TEST_DELIVERY_ID)}, "webhook");
    recordDelivery(${JSON.stringify(TEST_DELIVERY_ID)}, ${TEST_RUN_ID}, "completed", "processed");
    console.log("WRITER_SUCCESS");
    process.exit(0);
  });
`;

const proc1 = spawnSync(process.execPath, ["--input-type=module", "-e", writeScript], {
  encoding: "utf8",
  env: { ...process.env, PIPELINESHIELD_DATA_DIR: STORAGE_DIR },
});

if (proc1.status !== 0 || !proc1.stdout.includes("WRITER_SUCCESS")) {
  console.error("Process 1 (Writer) failed:", proc1.stderr || proc1.stdout);
  process.exit(1);
}
console.log("✓ Process 1 wrote record to disk and terminated cleanly (PID exited).");

// 2. Direct filesystem inspection
console.log("\n[Step 2] Direct Physical File Inspection on Disk...");
const runFile = path.join(STORAGE_DIR, "runs", `${TEST_RUN_ID}.json`);
const deliveriesFile = path.join(STORAGE_DIR, "deliveries.json");
const metaFile = path.join(STORAGE_DIR, "meta.json");

assert.ok(fs.existsSync(runFile), `Physical run file must exist on disk: ${runFile}`);
assert.ok(fs.existsSync(deliveriesFile), `Physical deliveries file must exist: ${deliveriesFile}`);
assert.ok(fs.existsSync(metaFile), `Physical meta file must exist: ${metaFile}`);

const rawRun = JSON.parse(fs.readFileSync(runFile, "utf8"));
assert.strictEqual(rawRun.runId, TEST_RUN_ID);
assert.strictEqual(rawRun.decision, "BLOCK");
assert.strictEqual(rawRun.findings.length, 1);
assert.strictEqual(rawRun.findings[0].id, "CVE-2022-42966");
console.log(`✓ Verified physical file on disk: ${runFile} (${fs.statSync(runFile).size} bytes)`);

// 3. Spawning Process 2: Fresh process simulating server startup
console.log("\n[Step 3] Spawning Process 2 (Fresh Server Process after restart)...");
const readerScript = `
  process.env.PIPELINESHIELD_DATA_DIR = ${JSON.stringify(STORAGE_DIR)};
  
  import(${JSON.stringify(RUN_STORE_URL)}).then(({ getRunById, isDeliveryProcessed, getStoreDiagnostics }) => {
    const run = getRunById(${TEST_RUN_ID});
    if (!run) {
      console.error("FAIL: Run not found in fresh process");
      process.exit(1);
    }
    
    if (run.decision !== "BLOCK" || run.findings[0]?.id !== "CVE-2022-42966") {
      console.error("FAIL: Run content corrupted across restart");
      process.exit(2);
    }

    const deliveryProcessed = isDeliveryProcessed(${JSON.stringify(TEST_DELIVERY_ID)});
    if (!deliveryProcessed) {
      console.error("FAIL: Webhook delivery deduplication lost across restart");
      process.exit(3);
    }

    const diag = getStoreDiagnostics();
    console.log("READER_SUCCESS:" + JSON.stringify({
      runId: run.runId,
      decision: run.decision,
      findingsCount: run.findings.length,
      findingId: run.findings[0].id,
      deliveryDeduplicated: deliveryProcessed,
      totalRunsOnDisk: diag.runsCount,
      storageType: diag.storageType,
    }));
    process.exit(0);
  });
`;

const proc2 = spawnSync(process.execPath, ["--input-type=module", "-e", readerScript], {
  encoding: "utf8",
  env: { ...process.env, PIPELINESHIELD_DATA_DIR: STORAGE_DIR },
});

if (proc2.status !== 0 || !proc2.stdout.includes("READER_SUCCESS")) {
  console.error("Process 2 (Reader) failed:", proc2.stderr || proc2.stdout);
  process.exit(1);
}

const readerOutputMatch = proc2.stdout.match(/READER_SUCCESS:(.*)/);
const verifiedData = JSON.parse(readerOutputMatch[1]);
console.log("✓ Process 2 initialized fresh memory from disk and successfully verified:");
console.log(`   • Run ID: #${verifiedData.runId}`);
console.log(`   • Decision: ${verifiedData.decision}`);
console.log(`   • Finding ID: ${verifiedData.findingId}`);
console.log(`   • Delivery Deduplicated: ${verifiedData.deliveryDeduplicated}`);
console.log(`   • Total Runs in Store: ${verifiedData.totalRunsOnDisk}`);
console.log(`   • Storage Backend: ${verifiedData.storageType}`);

// Cleanup test file
try {
  fs.unlinkSync(runFile);
  console.log(`\n✓ Cleaned up test run file ${runFile}.`);
} catch {
  // Ignore cleanup
}

console.log("\n===============================================================================");
console.log(" Durability & Process Restart Verification: 100% SUCCESS");
console.log("===============================================================================");

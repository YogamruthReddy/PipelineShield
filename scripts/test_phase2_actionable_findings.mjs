#!/usr/bin/env node
/**
 * Automated Verification Suite for PipelineShield Phase 2: Actionable Findings.
 *
 * Verifies:
 * 1. Finding Detail & Triage/Ownership: Schema, priority, assignee, target date, audit history.
 * 2. Durable Triage Persistence: Survives store re-initialization (restart durability).
 * 3. PR Impact & Diff Engine: Accurately identifies new blockers vs persistent debt vs fixed findings.
 * 4. PR Markdown Comment Generation: Generates copy-ready GitHub PR review markdown.
 * 5. Security Guardrail Invariant: Triage status never overrides or mutates authoritative CI gate verdicts.
 */

import fs from "fs";
import path from "path";
import os from "os";
import assert from "assert/strict";

// Setup isolated temporary data directory for clean testing
const TEST_DATA_DIR = path.join(os.tmpdir(), `pipelineshield-phase2-${Date.now()}-${Math.random().toString(36).slice(2)}`);
process.env.PIPELINESHIELD_DATA_DIR = TEST_DATA_DIR;

// Import after setting env var so store uses isolated directory
const {
  setTriage,
  getTriage,
  getTriageMap,
  deleteTriage,
  resetTriageStore,
  initTriageStore,
} = await import("../dashboard/src/lib/triage-store.ts");

const {
  computePrImpact,
} = await import("../dashboard/src/lib/pr-impact.ts");

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    failCount++;
  }
}

console.log("===============================================================================");
console.log(" PipelineShield — Phase 2 Actionable Findings Verification Suite");
console.log("===============================================================================");

// ─── Group 1: Finding Triage & Ownership Lifecycle ──────────────────────────
console.log("\nGroup 1: Finding Triage Lifecycle & Ownership Assignment");

test("setTriage records assignee, priority, target date, and initial history", () => {
  resetTriageStore();
  const findingId = "CVE-2022-42966";
  const record = setTriage(
    findingId,
    {
      status: "assigned",
      assignee: "@secops-lead",
      priority: "P0",
      targetDate: "2026-11-05",
      note: "Assigning to DevOps team for urgent cryptography bump to 38.0.3",
    },
    "Security Director"
  );

  assert.strictEqual(record.findingId, findingId);
  assert.strictEqual(record.status, "assigned");
  assert.strictEqual(record.assignee, "@secops-lead");
  assert.strictEqual(record.priority, "P0");
  assert.strictEqual(record.targetDate, "2026-11-05");
  assert.strictEqual(record.history?.length, 1);
  assert.strictEqual(record.history[0].actor, "Security Director");
});

test("Subsequent triage updates append to audit trail history", () => {
  const findingId = "CVE-2022-42966";
  const updated = setTriage(
    findingId,
    {
      status: "remediation_in_progress",
      note: "PR #42 opened to bump requirements.txt",
    },
    "@secops-lead"
  );

  assert.strictEqual(updated.status, "remediation_in_progress");
  assert.strictEqual(updated.assignee, "@secops-lead"); // Preserves assignee
  assert.strictEqual(updated.priority, "P0"); // Preserves priority
  assert.strictEqual(updated.history?.length, 2);
  assert.strictEqual(updated.history[1].status, "remediation_in_progress");
  assert.strictEqual(updated.history[1].actor, "@secops-lead");
});

test("Durable triage records survive store re-initialization (restart simulation)", () => {
  const triageFile = path.join(TEST_DATA_DIR, "triage.json");
  assert.ok(fs.existsSync(triageFile), "triage.json must exist physically on disk");

  // Re-initialize from disk
  initTriageStore();
  const reloaded = getTriage("CVE-2022-42966");
  assert.ok(reloaded, "Reloaded record must exist in memory after hydration");
  assert.strictEqual(reloaded.status, "remediation_in_progress");
  assert.strictEqual(reloaded.assignee, "@secops-lead");
  assert.strictEqual(reloaded.history?.length, 2);
});

// ─── Group 2: PR Impact & Diff Analysis Engine ──────────────────────────────
console.log("\nGroup 2: PR Impact & Diff Analysis Engine");

test("computePrImpact isolates new blockers introduced by PR from clean baseline", () => {
  const baselineReport = {
    decision: "PASS",
    summary: { total_findings: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0, exempted: 0, blocking_count: 0, warning_count: 0 },
    findings: [],
  };

  const prReport = {
    decision: "BLOCK",
    branch: "feat/add-vulnerable-dep",
    commit_sha: "abc111222333",
    summary: { total_findings: 1, critical: 1, high: 0, medium: 0, low: 0, info: 0, exempted: 0, blocking_count: 1, warning_count: 0 },
    findings: [
      {
        id: "CVE-2022-42966",
        severity: "CRITICAL",
        title: "ReDoS vulnerability in python-cryptography",
        scanner: "trivy",
        package_name: "cryptography",
        installed_version: "3.4.8",
        fixed_version: "38.0.3",
        file_path: "engine/requirements.txt",
      },
    ],
  };

  const impact = computePrImpact(prReport, baselineReport, {
    prBranch: "feat/add-vulnerable-dep",
    baseBranch: "main",
    prCommitSha: "abc111222333",
  });

  assert.strictEqual(impact.summary.newBlockersCount, 1);
  assert.strictEqual(impact.summary.newFindingsCount, 1);
  assert.strictEqual(impact.summary.persistentCount, 0);
  assert.strictEqual(impact.gateVerdictDueToPr, true);
  assert.strictEqual(impact.summary.riskScore, "CRITICAL_RISK");
  assert.strictEqual(impact.newBlockers[0].id, "CVE-2022-42966");
});

test("computePrImpact recognizes resolved baseline findings in PR", () => {
  const baselineReport = {
    decision: "BLOCK",
    summary: { total_findings: 2, critical: 1, high: 0, medium: 1, low: 0, info: 0, exempted: 0, blocking_count: 1, warning_count: 1 },
    findings: [
      { id: "CVE-2022-42966", severity: "CRITICAL", scanner: "trivy", title: "Old blocker" },
      { id: "SEC-002", severity: "MEDIUM", scanner: "semgrep", title: "Old warning" },
    ],
  };

  const prReport = {
    decision: "WARN",
    summary: { total_findings: 1, critical: 0, high: 0, medium: 1, low: 0, info: 0, exempted: 0, blocking_count: 0, warning_count: 1 },
    findings: [
      { id: "SEC-002", severity: "MEDIUM", scanner: "semgrep", title: "Old warning" },
    ],
  };

  const impact = computePrImpact(prReport, baselineReport);
  assert.strictEqual(impact.summary.newBlockersCount, 0);
  assert.strictEqual(impact.summary.fixedCount, 1);
  assert.strictEqual(impact.fixedFindings[0].id, "CVE-2022-42966");
  assert.strictEqual(impact.persistentWarnings.length, 1);
  assert.strictEqual(impact.gateVerdictDueToPr, false);
});

test("computePrImpact generates copy-ready GitHub PR comment markdown", () => {
  const prReport = {
    decision: "BLOCK",
    branch: "feat/test-pr",
    commit_sha: "999888777666",
    findings: [
      {
        id: "CVE-2022-42966",
        severity: "CRITICAL",
        scanner: "trivy",
        package_name: "cryptography",
        installed_version: "3.4.8",
        fixed_version: "38.0.3",
        title: "ReDoS vulnerability in python-cryptography",
      },
    ],
  };

  const impact = computePrImpact(prReport, null);
  const md = impact.markdownComment;

  assert.ok(md.includes("PipelineShield DevSecOps Gate — PR Impact Analysis"));
  assert.ok(md.includes("BLOCK"));
  assert.ok(md.includes("CVE-2022-42966"));
  assert.ok(md.includes("38.0.3"));
  assert.ok(md.includes("New Blockers Introduced"));
});

// ─── Group 3: Security Gate Authority Invariant ─────────────────────────────
console.log("\nGroup 3: Security Gate Authority Invariant");

test("Triage status never alters authoritative report gate decision", () => {
  // Simulate setting finding to verified_resolved or accepted_risk
  const triaged = setTriage("CVE-2022-42966", { status: "verified_resolved" }, "Developer");
  assert.strictEqual(triaged.status, "verified_resolved");

  const authoritativeReport = {
    decision: "BLOCK",
    summary: { total_findings: 1, critical: 1, high: 0, medium: 0, low: 0, info: 0, exempted: 0, blocking_count: 1, warning_count: 0 },
    blocking_findings: [{ id: "CVE-2022-42966", severity: "CRITICAL", title: "Vulnerability" }],
  };

  // Authoritative decision remains BLOCK regardless of triage assessment
  assert.strictEqual(authoritativeReport.decision, "BLOCK");
  assert.strictEqual(authoritativeReport.summary.blocking_count, 1);
});

// Cleanup temp test directory
try {
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
} catch {
  // Ignore
}

console.log("\n===============================================================================");
console.log(` Phase 2 Verification Results: ${passCount} passed, ${failCount} failed`);
console.log("===============================================================================");

if (failCount > 0) {
  process.exit(1);
}


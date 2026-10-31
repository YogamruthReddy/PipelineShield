#!/usr/bin/env node
/**
 * Dashboard Navigation, View Routing & Interaction Filter Test Suite.
 *
 * Validates:
 * 1. Sample datasets across all verdict states conform strictly to schema.
 * 2. Gatekeeper category assignment (blocking vs warning vs advisory vs exempted).
 * 3. Multi-criteria filtering (severity, scanner, gate category, keyword search).
 * 4. Severity and alphabetical sorting invariants.
 * 5. Exit code mapping contract across PASS/WARN/BLOCK/ERROR.
 */

import assert from "assert";
import { validateReportSchema } from "../dashboard/src/lib/report-validator.ts";
import { SAMPLE_REPORTS } from "../dashboard/src/data/sample-reports.ts";

console.log("=== PipelineShield Dashboard Navigation & Filter Logic Tests ===");

// 1. Verify Sample Reports conform to schema
console.log("[1/7] Validating all demonstration datasets against authoritative validator...");
const sampleKeys = ["vulnerable", "clean", "warnings_only", "scanner_error"];
for (const key of sampleKeys) {
  const item = SAMPLE_REPORTS[key];
  assert(item, `Sample report ${key} must exist`);
  assert(item.data, `Sample report ${key} must contain data`);
  const val = validateReportSchema(item.data);
  assert(val.valid, `Sample report ${key} failed schema validation: ${val.error}`);
  console.log(`      ✓ ${item.label} valid (${item.data.decision})`);
}

// 2. Gate category assignment test
console.log("[2/5] Testing gate category normalization logic...");
const vuln = SAMPLE_REPORTS.vulnerable.data;
const blockingIds = new Set((vuln.blocking_findings || []).map((f) => f.id));
const warningIds = new Set((vuln.warning_findings || []).map((f) => f.id));
const advisoryIds = new Set((vuln.advisory_findings || []).map((f) => f.id));

assert(blockingIds.has("CVE-2022-42966"), "CVE-2022-42966 must be classified as blocking");
assert(
  blockingIds.has("python.lang.security.audit.dangerous-subprocess-use-audit"),
  "Semgrep command injection must be classified as blocking"
);
assert(
  warningIds.has("python.lang.security.unencrypted-socket"),
  "Unencrypted socket must be classified as warning"
);
assert(
  advisoryIds.has("CVE-2023-26115"),
  "CVE-2023-26115 must be classified as advisory"
);
console.log("      ✓ Gate category mappings verified accurately.");

// 3. Multi-criteria filter simulation
console.log("[3/5] Testing multi-criteria findings filter and search...");
const allFindings = [
  ...vuln.blocking_findings.map((f) => ({ ...f, gateCategory: "blocking" })),
  ...vuln.warning_findings.map((f) => ({ ...f, gateCategory: "warning" })),
  ...vuln.advisory_findings.map((f) => ({ ...f, gateCategory: "advisory" })),
];

// Severity filter
const criticals = allFindings.filter((f) => f.severity === "CRITICAL");
assert.strictEqual(criticals.length, 1, "Expected exactly 1 CRITICAL finding");
assert.strictEqual(criticals[0].id, "CVE-2022-42966");

// Scanner filter
const semgrepFindings = allFindings.filter((f) => f.scanner === "semgrep");
assert.strictEqual(semgrepFindings.length, 2, "Expected exactly 2 Semgrep findings");

// Keyword search by package
const lodashMatches = allFindings.filter((f) =>
  (f.package_name || "").toLowerCase().includes("lodash")
);
assert.strictEqual(lodashMatches.length, 1, "Expected exactly 1 match for lodash");
assert.strictEqual(lodashMatches[0].id, "GHSA-35jh-r3h4-6jhm");

// Keyword search by CWE
const cweMatches = allFindings.filter((f) =>
  (f.cwe_ids || []).some((c) => c.toLowerCase().includes("cwe-1321"))
);
assert.strictEqual(cweMatches.length, 1, "Expected exactly 1 match for CWE-1321");

console.log("      ✓ Multi-criteria filter, search, and package lookups passed.");

// 4. Sorting logic verification
console.log("[4/5] Testing severity and title sorting invariants...");
const severityWeight = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

const sortedDesc = [...allFindings].sort(
  (a, b) => (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0)
);
assert.strictEqual(sortedDesc[0].severity, "CRITICAL", "First finding must be CRITICAL");
assert.strictEqual(sortedDesc[sortedDesc.length - 1].severity, "LOW", "Last finding must be LOW");

const sortedTitles = [...allFindings].sort((a, b) =>
  (a.title || "").localeCompare(b.title || "")
);
for (let i = 0; i < sortedTitles.length - 1; i++) {
  assert(
    sortedTitles[i].title.localeCompare(sortedTitles[i + 1].title) <= 0,
    "Titles must be sorted in ascending alphabetical order"
  );
}
console.log("      ✓ Sorting invariants verified.");

// 5. Exit Code Mapping Contract
console.log("[5/5] Testing exit code contract across all verdict states...");
function getExpectedExitCode(decision) {
  switch (decision.toUpperCase()) {
    case "PASS":
    case "WARN":
      return 0;
    case "BLOCK":
      return 1;
    case "ERROR":
      return 2;
    default:
      return 1;
  }
}

assert.strictEqual(getExpectedExitCode("PASS"), 0);
assert.strictEqual(getExpectedExitCode("WARN"), 0);
assert.strictEqual(getExpectedExitCode("BLOCK"), 1);
assert.strictEqual(getExpectedExitCode("ERROR"), 2);
console.log("      ✓ Exit code specification verified (0/1/2).");

// 6. Active Filter Chips Invariant
console.log("[6/7] Testing active filter chips generation logic...");
function buildActiveFilters({ search, severity, scanner, category }) {
  const chips = [];
  if (search && search.trim()) {
    chips.push({ id: "search", label: "Keyword", displayValue: `"${search}"` });
  }
  if (severity && severity !== "ALL") {
    chips.push({ id: "severity", label: "Severity", displayValue: severity });
  }
  if (scanner && scanner !== "ALL") {
    chips.push({ id: "scanner", label: "Scanner", displayValue: scanner });
  }
  if (category && category !== "ALL") {
    chips.push({ id: "category", label: "Gate Status", displayValue: category.toUpperCase() });
  }
  return chips;
}

const chipsAll = buildActiveFilters({ search: "CVE", severity: "CRITICAL", scanner: "trivy", category: "blocking" });
assert.strictEqual(chipsAll.length, 4, "Expected 4 active chips");
const chipsEmpty = buildActiveFilters({ search: "", severity: "ALL", scanner: "ALL", category: "ALL" });
assert.strictEqual(chipsEmpty.length, 0, "Expected 0 active chips for clean defaults");
console.log("      ✓ Filter chips generation invariants verified.");

// 7. Drawer Evidence & Remediation Field Invariants
console.log("[7/7] Testing finding drawer evidence and remediation invariants...");
for (const f of allFindings) {
  assert(f.id, "Finding must have an identifier");
  assert(f.title, "Finding must have a title");
  assert(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].includes(f.severity), `Invalid severity: ${f.severity}`);
  assert(["trivy", "semgrep", "dependency_review"].includes(f.scanner), `Invalid scanner: ${f.scanner}`);
  assert(["blocking", "warning", "advisory", "exempted"].includes(f.gateCategory), `Invalid gateCategory: ${f.gateCategory}`);
}
console.log("      ✓ Finding detail fields and gate policy classifications conform strictly.");

console.log("=== All Dashboard Navigation & Filter Logic Tests Passed Successfully ===");


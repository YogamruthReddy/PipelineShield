import type { Finding } from "../types/dashboard.ts";

/**
 * Generate a stable, deterministic identity key for a finding across runs.
 * Pure utility function safe for both client and server runtime environments.
 */
export function getFindingIdentityKey(finding: Finding): string {
  if (finding.id && finding.id.trim()) {
    return finding.id.trim().toLowerCase();
  }

  const raw = finding as unknown as Record<string, unknown>;
  const scanner = (finding.scanner || "unknown").trim().toLowerCase();
  const ruleId = typeof raw.rule_id === "string" ? raw.rule_id.trim().toLowerCase() : "";
  const target = (
    finding.package_name ||
    finding.file_path ||
    (typeof raw.component === "string" ? raw.component : "") ||
    ""
  )
    .trim()
    .toLowerCase();
  const title = (finding.title || "").trim().toLowerCase();

  return `${scanner}:${target}:${ruleId || title}`;
}


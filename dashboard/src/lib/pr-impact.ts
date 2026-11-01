import type { Finding, EvaluationResult } from "../types/dashboard.ts";
import { getFindingIdentityKey } from "./finding-identity.ts";

export interface PrImpactFinding extends Finding {
  gateCategory?: "blocking" | "warning" | "advisory" | "exempted";
  impactCategory: "new_blocker" | "new_warning" | "new_advisory" | "persistent_blocker" | "persistent_warning" | "fixed" | "regressed";
}

export interface PrImpactAnalysis {
  prBranch: string;
  baseBranch: string;
  prCommitSha: string;
  baseCommitSha?: string;
  evaluatedAt: string;
  prGateDecision: "PASS" | "WARN" | "BLOCK" | "ERROR";
  gateVerdictDueToPr: boolean;
  
  newBlockers: Finding[];
  newWarnings: Finding[];
  newAdvisory: Finding[];
  persistentBlockers: Finding[];
  persistentWarnings: Finding[];
  fixedFindings: Finding[];
  regressedFindings: Finding[];

  summary: {
    totalPrFindings: number;
    newFindingsCount: number;
    newBlockersCount: number;
    newWarningsCount: number;
    persistentCount: number;
    fixedCount: number;
    regressedCount: number;
    riskScore: "CLEAN" | "LOW_RISK" | "MODERATE_RISK" | "HIGH_RISK" | "CRITICAL_RISK";
  };

  markdownComment: string;
}

/**
 * Compute PR Impact analysis comparing a PR report against a baseline report.
 */
export function computePrImpact(
  prReport: EvaluationResult,
  baselineReport?: EvaluationResult | null,
  options: {
    prBranch?: string;
    baseBranch?: string;
    prCommitSha?: string;
    baseCommitSha?: string;
  } = {}
): PrImpactAnalysis {
  const prBranch = options.prBranch || prReport.branch || "pr-branch";
  const baseBranch = options.baseBranch || baselineReport?.branch || "main";
  const prCommitSha = options.prCommitSha || prReport.commit_sha || "HEAD";
  const baseCommitSha = options.baseCommitSha || baselineReport?.commit_sha || "baseline";
  const now = new Date().toISOString();

  const prFindings: Finding[] = [
    ...(prReport.findings || []),
    ...(prReport.blocking_findings || []),
    ...(prReport.warning_findings || []),
  ];

  // Deduplicate PR findings by identity key
  const prMap = new Map<string, Finding>();
  prFindings.forEach((f) => {
    const key = getFindingIdentityKey(f);
    if (!prMap.has(key)) {
      prMap.set(key, f);
    }
  });

  const baseFindings: Finding[] = baselineReport
    ? [
        ...(baselineReport.findings || []),
        ...(baselineReport.blocking_findings || []),
        ...(baselineReport.warning_findings || []),
      ]
    : [];

  const baseMap = new Map<string, Finding>();
  baseFindings.forEach((f) => {
    const key = getFindingIdentityKey(f);
    if (!baseMap.has(key)) {
      baseMap.set(key, f);
    }
  });

  const newBlockers: Finding[] = [];
  const newWarnings: Finding[] = [];
  const newAdvisory: Finding[] = [];
  const persistentBlockers: Finding[] = [];
  const persistentWarnings: Finding[] = [];
  const fixedFindings: Finding[] = [];
  const regressedFindings: Finding[] = [];

  // Analyze PR findings against baseline
  prMap.forEach((finding, key) => {
    const inBase = baseMap.has(key);
    const isBlocking = finding.severity === "CRITICAL" || finding.severity === "HIGH";
    const isWarning = finding.severity === "MEDIUM";

    if (!inBase) {
      // Introduced by this PR
      if (isBlocking) {
        newBlockers.push(finding);
      } else if (isWarning) {
        newWarnings.push(finding);
      } else {
        newAdvisory.push(finding);
      }
    } else {
      // Pre-existing from baseline
      if (isBlocking) {
        persistentBlockers.push(finding);
      } else {
        persistentWarnings.push(finding);
      }
    }
  });

  // Analyze fixed findings (in baseline, but resolved in PR)
  baseMap.forEach((finding, key) => {
    if (!prMap.has(key)) {
      fixedFindings.push(finding);
    }
  });

  const totalPrFindings = prMap.size;
  const newBlockersCount = newBlockers.length;
  const newWarningsCount = newWarnings.length;
  const newFindingsCount = newBlockersCount + newWarningsCount + newAdvisory.length;
  const persistentCount = persistentBlockers.length + persistentWarnings.length;
  const fixedCount = fixedFindings.length;
  const regressedCount = regressedFindings.length;

  const gateVerdictDueToPr = newBlockersCount > 0;

  // Determine composite PR risk level
  let riskScore: PrImpactAnalysis["summary"]["riskScore"] = "CLEAN";
  if (newBlockersCount > 0) {
    riskScore = "CRITICAL_RISK";
  } else if (newWarningsCount > 2) {
    riskScore = "HIGH_RISK";
  } else if (newWarningsCount > 0) {
    riskScore = "MODERATE_RISK";
  } else if (newAdvisory.length > 0) {
    riskScore = "LOW_RISK";
  }

  // Generate GitHub PR Markdown Comment
  const prGateDecision = prReport.decision || (newBlockersCount > 0 ? "BLOCK" : "PASS");
  const verdictEmoji = prGateDecision === "PASS" ? "✅" : prGateDecision === "WARN" ? "⚠️" : "🛑";

  let md = `## 🛡️ PipelineShield DevSecOps Gate — PR Impact Analysis\n\n`;
  md += `**Gate Verdict**: ${verdictEmoji} **${prGateDecision}**\n`;
  md += `**PR Branch**: \`${prBranch}\` (\`${prCommitSha.slice(0, 7)}\`) → **Base**: \`${baseBranch}\`\n\n`;

  md += `### 📊 PR Security Impact Summary\n\n`;
  md += `| Category | Count | Status |\n`;
  md += `|---|---|---|\n`;
  md += `| 🚨 **New Blockers Introduced** | **${newBlockersCount}** | ${newBlockersCount > 0 ? "❌ Fails Gate" : "✓ Clean"} |\n`;
  md += `| ⚠️ **New Advisory Warnings** | ${newWarningsCount} | ${newWarningsCount > 0 ? "Review Recommended" : "✓ None"} |\n`;
  md += `| 🔄 **Pre-existing Baseline Findings** | ${persistentCount} | Tracked on \`${baseBranch}\` |\n`;
  md += `| ✅ **Findings Fixed in this PR** | **${fixedCount}** | ${fixedCount > 0 ? "🎉 Remediated" : "—"} |\n\n`;

  if (newBlockers.length > 0) {
    md += `### 🚨 New Blockers Introduced by this PR (Must Fix to Merge):\n\n`;
    md += `| Severity | Finding ID | Target Package / File | Scanner | Remediation |\n`;
    md += `|---|---|---|---|---|\n`;
    newBlockers.forEach((b) => {
      const target = b.package_name ? `${b.package_name} (${b.installed_version || "installed"})` : (b.file_path || "source");
      const fix = b.fixed_version ? `Bump to \`${b.fixed_version}\`` : (b.remediation || "See advisory");
      md += `| **${b.severity}** | \`${b.id}\` | \`${target}\` | \`${b.scanner}\` | ${fix} |\n`;
    });
    md += `\n`;
  }

  if (fixedFindings.length > 0) {
    md += `### ✅ Findings Resolved by this PR:\n\n`;
    fixedFindings.forEach((f) => {
      md += `- **[${f.severity}]** \`${f.id}\`: ${f.title} (${f.scanner})\n`;
    });
    md += `\n`;
  }

  md += `> ℹ️ *Evaluated by PipelineShield Gatekeeper. Gate verdicts are authoritative and enforced via GitHub Actions.*`;

  return {
    prBranch,
    baseBranch,
    prCommitSha,
    baseCommitSha,
    evaluatedAt: now,
    prGateDecision,
    gateVerdictDueToPr,
    newBlockers,
    newWarnings,
    newAdvisory,
    persistentBlockers,
    persistentWarnings,
    fixedFindings,
    regressedFindings,
    summary: {
      totalPrFindings,
      newFindingsCount,
      newBlockersCount,
      newWarningsCount,
      persistentCount,
      fixedCount,
      regressedCount,
      riskScore,
    },
    markdownComment: md,
  };
}


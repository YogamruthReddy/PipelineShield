import type { CodeReviewFinding } from "../types/dashboard.ts";

export type FindingComparisonStatus = "new" | "resolved" | "persistent";

/**
 * LIMITATION & HEURISTIC NATURE NOTICE:
 * Code review findings comparison is a candidate matching heuristic based on normalized file paths,
 * severities, and extracted titles. AI-generated findings may vary in title wording, line ranges,
 * or severity assessments across review passes.
 *
 * Categorizations ("new", "resolved", "persistent") should be treated as candidate signals
 * for security analysts to verify, NOT definitive vulnerability regressions or fixes.
 */
export const COMPARISON_HEURISTIC_DISCLAIMER =
  "Candidate heuristic match: AI-generated code review titles and severities may fluctuate between reviews. Treat 'new' and 'resolved' as candidate signals, not definitive gate verdicts.";

export interface ComparedCodeReviewFinding extends CodeReviewFinding {
  comparisonStatus: FindingComparisonStatus;
  baselineCommit?: string;
  targetCommit?: string;
  isCandidateMatch?: boolean;
  matchConfidence?: "exact_key" | "candidate_heuristic";
  severityChangedFrom?: string;
}

export interface SeverityComparisonCount {
  new: number;
  resolved: number;
  persistent: number;
}

export interface FindingComparisonSummary {
  baselineCommit: string;
  targetCommit: string;
  baselineTotal: number;
  targetTotal: number;
  newCount: number;
  resolvedCount: number;
  persistentCount: number;
  netDelta: number; // newCount - resolvedCount
  severityBreakdown: {
    CRITICAL: SeverityComparisonCount;
    HIGH: SeverityComparisonCount;
    MEDIUM: SeverityComparisonCount;
    LOW: SeverityComparisonCount;
    INFO: SeverityComparisonCount;
  };
}

export interface FindingComparisonResult {
  summary: FindingComparisonSummary;
  newFindings: ComparedCodeReviewFinding[];
  resolvedFindings: ComparedCodeReviewFinding[];
  persistentFindings: ComparedCodeReviewFinding[];
}

/**
 * Normalizes finding titles to match semantically equivalent findings
 * even if line numbers or formatting vary slightly across commits.
 */
export function normalizeFindingTitle(title: string): string {
  return (title || "")
    .toLowerCase()
    .replace(/\b(?:lines?|l\.)\s*\d+(?:\s*(?:-|to)\s*\d+)?\b/gi, "")
    .replace(/\b(?:cve-\d{4}-\d+|cwe-\d+)\b/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Stable key for identifying a code review finding across commit revisions.
 */
export function getFindingComparisonKey(finding: CodeReviewFinding): string {
  const normPath = (finding.filePath || "unknown").trim().toLowerCase();
  const normTitle = normalizeFindingTitle(finding.title);
  const severity = (finding.severity || "INFO").toUpperCase();
  return `${normPath}::${severity}::${normTitle}`;
}

/**
 * Compare code review findings between a baseline commit and a target commit.
 *
 * Strictly read-only and deterministic:
 * - New findings: present in target commit but absent in baseline commit.
 * - Resolved findings: present in baseline commit but absent in target commit.
 * - Persistent findings: present in both commits.
 *
 * Does not alter CI gate authority or execute external processes.
 */
export function compareFindingSnapshots(options: {
  baselineFindings: CodeReviewFinding[];
  targetFindings: CodeReviewFinding[];
  baselineCommit: string;
  targetCommit: string;
}): FindingComparisonResult {
  const { baselineFindings, targetFindings, baselineCommit, targetCommit } = options;

  const baselineMap = new Map<string, CodeReviewFinding>();
  const baselineByPathTitle = new Map<string, CodeReviewFinding>();

  for (const bf of baselineFindings) {
    const key = getFindingComparisonKey(bf);
    if (!baselineMap.has(key)) {
      baselineMap.set(key, bf);
    }
    const pathTitleKey = `${(bf.filePath || "unknown").trim().toLowerCase()}::${normalizeFindingTitle(bf.title)}`;
    if (!baselineByPathTitle.has(pathTitleKey)) {
      baselineByPathTitle.set(pathTitleKey, bf);
    }
  }

  const newFindings: ComparedCodeReviewFinding[] = [];
  const persistentFindings: ComparedCodeReviewFinding[] = [];
  const matchedBaselineKeys = new Set<string>();

  for (const tf of targetFindings) {
    const exactKey = getFindingComparisonKey(tf);
    const pathTitleKey = `${(tf.filePath || "unknown").trim().toLowerCase()}::${normalizeFindingTitle(tf.title)}`;

    if (baselineMap.has(exactKey)) {
      matchedBaselineKeys.add(exactKey);
      persistentFindings.push({
        ...tf,
        comparisonStatus: "persistent",
        baselineCommit,
        targetCommit,
        isCandidateMatch: true,
        matchConfidence: "exact_key",
      });
    } else if (baselineByPathTitle.has(pathTitleKey) && !matchedBaselineKeys.has(getFindingComparisonKey(baselineByPathTitle.get(pathTitleKey)!))) {
      // Secondary heuristic candidate match: same file and normalized title, but severity or formatting shifted
      const matchedBf = baselineByPathTitle.get(pathTitleKey)!;
      matchedBaselineKeys.add(getFindingComparisonKey(matchedBf));
      persistentFindings.push({
        ...tf,
        comparisonStatus: "persistent",
        baselineCommit,
        targetCommit,
        isCandidateMatch: true,
        matchConfidence: "candidate_heuristic",
        severityChangedFrom: matchedBf.severity,
      });
    } else {
      newFindings.push({
        ...tf,
        comparisonStatus: "new",
        baselineCommit,
        targetCommit,
        isCandidateMatch: true,
        matchConfidence: "candidate_heuristic",
      });
    }
  }

  const resolvedFindings: ComparedCodeReviewFinding[] = [];
  for (const [key, bf] of baselineMap.entries()) {
    if (!matchedBaselineKeys.has(key)) {
      resolvedFindings.push({
        ...bf,
        comparisonStatus: "resolved",
        baselineCommit,
        targetCommit,
        isCandidateMatch: true,
        matchConfidence: "candidate_heuristic",
      });
    }
  }

  const severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;
  const severityBreakdown: FindingComparisonSummary["severityBreakdown"] = {
    CRITICAL: { new: 0, resolved: 0, persistent: 0 },
    HIGH: { new: 0, resolved: 0, persistent: 0 },
    MEDIUM: { new: 0, resolved: 0, persistent: 0 },
    LOW: { new: 0, resolved: 0, persistent: 0 },
    INFO: { new: 0, resolved: 0, persistent: 0 },
  };

  for (const f of newFindings) {
    const sev = severities.includes(f.severity as typeof severities[number])
      ? (f.severity as typeof severities[number])
      : "INFO";
    severityBreakdown[sev].new++;
  }

  for (const f of resolvedFindings) {
    const sev = severities.includes(f.severity as typeof severities[number])
      ? (f.severity as typeof severities[number])
      : "INFO";
    severityBreakdown[sev].resolved++;
  }

  for (const f of persistentFindings) {
    const sev = severities.includes(f.severity as typeof severities[number])
      ? (f.severity as typeof severities[number])
      : "INFO";
    severityBreakdown[sev].persistent++;
  }

  const summary: FindingComparisonSummary = {
    baselineCommit,
    targetCommit,
    baselineTotal: baselineFindings.length,
    targetTotal: targetFindings.length,
    newCount: newFindings.length,
    resolvedCount: resolvedFindings.length,
    persistentCount: persistentFindings.length,
    netDelta: newFindings.length - resolvedFindings.length,
    severityBreakdown,
  };

  return {
    summary,
    newFindings,
    resolvedFindings,
    persistentFindings,
  };
}


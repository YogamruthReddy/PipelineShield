/**
 * PipelineShield Finding-to-Code Traceability Library
 *
 * Links security and code quality review findings directly to source repository,
 * branch, exact commit SHA, file path, line range, and evidence.
 *
 * Strict invariants:
 * - Preserves exact reviewed commit SHA throughout navigation and display.
 * - Detects stale commit references when branch HEAD moves beyond the reviewed revision.
 * - Prevents silent cross-repository or cross-branch navigation.
 * - Handles missing files, deleted files, and missing line ranges cleanly.
 * - All AI review findings remain strictly advisory and never mutate CI verdicts.
 */

import type { CodeReviewFinding } from "../types/dashboard.ts";

export interface TraceableFindingContext {
  repoFullName: string;
  branch: string;
  commitSha: string;
  filePath: string;
  selectedRange?: [number, number];
  snippet?: string;
}

export interface FindingNavigationValidation {
  canNavigate: boolean;
  state: "valid" | "stale_commit" | "repo_mismatch" | "branch_mismatch" | "file_not_found";
  message: string;
  targetRepo: string;
  targetBranch: string;
  targetCommitSha: string;
  targetFilePath: string;
  targetLineRange: [number, number];
}

/**
 * Parses structured CodeReviewFinding objects from local AI text responses.
 * Extracts severity, line ranges, title, explanation, and evidence while
 * binding immutable source context (repo, branch, commit SHA).
 */
export function parseFindingsFromAiResponse(
  responseText: string,
  context: TraceableFindingContext
): CodeReviewFinding[] {
  const findings: CodeReviewFinding[] = [];

  const defaultStartLine = context.selectedRange ? context.selectedRange[0] : 1;
  const defaultEndLine = context.selectedRange ? context.selectedRange[1] : 1;

  // Regex patterns for severity and line detection
  const severityPattern = /\b(CRITICAL|HIGH|MEDIUM|LOW|INFO)\b/i;
  const linePattern = /\b(?:lines?|l\.)\s*(\d+)(?:\s*(?:-|to)\s*(\d+))?\b/i;

  // Split response by numbered items (e.g. "1.", "2.", "Finding 1:", "- Finding:")
  const rawSections = responseText.split(/\n(?=(?:\d+\.|\bFinding\s+\d+:|###\s+Finding))/g);

  for (let idx = 0; idx < rawSections.length; idx++) {
    const section = rawSections[idx].trim();
    if (!section || section.length < 15) continue;

    // Detect severity
    const sevMatch = section.match(severityPattern);
    const severity: CodeReviewFinding["severity"] = sevMatch
      ? (sevMatch[1].toUpperCase() as CodeReviewFinding["severity"])
      : "INFO";

    // Detect line range
    let startLine = defaultStartLine;
    let endLine = defaultEndLine;
    const lineMatch = section.match(linePattern);
    if (lineMatch) {
      const parsedStart = parseInt(lineMatch[1], 10);
      const parsedEnd = lineMatch[2] ? parseInt(lineMatch[2], 10) : parsedStart;
      if (!isNaN(parsedStart) && parsedStart > 0) {
        startLine = parsedStart;
        endLine = Math.max(parsedStart, isNaN(parsedEnd) ? parsedStart : parsedEnd);
      }
    }

    // Extract title (first line of section)
    const firstLine = section.split("\n")[0].replace(/^[\d#.\s:-]+/, "").trim();
    const title = firstLine.length > 5 ? firstLine.slice(0, 120) : `Security Observation in ${context.filePath}`;

    // Extract explanation & evidence
    const explanation = section;
    const evidenceSnippet = context.snippet
      ? context.snippet.slice(0, 300)
      : `File: ${context.filePath} (lines ${startLine}-${endLine})`;

    findings.push({
      id: `cr-finding-${Date.now()}-${idx + 1}`,
      repoFullName: context.repoFullName,
      branch: context.branch,
      commitSha: context.commitSha,
      filePath: context.filePath,
      startLine,
      endLine,
      severity,
      title,
      explanation,
      rationale: `Advisory finding identified by local AI during code review of ${context.filePath} at revision ${context.commitSha.slice(0, 7)}.`,
      evidence: evidenceSnippet,
      confidence: severity === "CRITICAL" || severity === "HIGH" ? "HIGH" : "MEDIUM",
      status: "active",
    });
  }

  // Fallback: If no structured sections were separated, create a single comprehensive finding
  if (findings.length === 0 && responseText.trim().length > 0) {
    const sevMatch = responseText.match(severityPattern);
    const severity: CodeReviewFinding["severity"] = sevMatch
      ? (sevMatch[1].toUpperCase() as CodeReviewFinding["severity"])
      : "INFO";

    findings.push({
      id: `cr-finding-${Date.now()}-1`,
      repoFullName: context.repoFullName,
      branch: context.branch,
      commitSha: context.commitSha,
      filePath: context.filePath,
      startLine: defaultStartLine,
      endLine: defaultEndLine,
      severity,
      title: `Code Review Findings in ${context.filePath}`,
      explanation: responseText,
      rationale: `Advisory analysis from local AI model for ${context.filePath}.`,
      evidence: context.snippet || `File: ${context.filePath}`,
      confidence: "MEDIUM",
      status: "active",
    });
  }

  return findings;
}

/**
 * Validates navigation to a finding's source code location.
 * Enforces repository matching, branch matching, and stale-commit detection.
 * Never silently navigates across revisions or repositories.
 */
export function validateFindingNavigation(
  finding: CodeReviewFinding,
  activeContext: {
    currentRepo: string;
    currentBranch: string;
    currentCommitSha: string;
    availableFiles?: string[];
  }
): FindingNavigationValidation {
  const targetRange: [number, number] = [
    Math.max(1, finding.startLine || 1),
    Math.max(1, finding.endLine || finding.startLine || 1),
  ];

  // 1. Repository Mismatch Check
  if (finding.repoFullName && finding.repoFullName !== activeContext.currentRepo) {
    return {
      canNavigate: false,
      state: "repo_mismatch",
      message: `Repository mismatch: Finding was identified in '${finding.repoFullName}', but active workspace is '${activeContext.currentRepo}'. Switch repositories to inspect.`,
      targetRepo: finding.repoFullName,
      targetBranch: finding.branch,
      targetCommitSha: finding.commitSha,
      targetFilePath: finding.filePath,
      targetLineRange: targetRange,
    };
  }

  // 2. File Missing Check
  if (
    activeContext.availableFiles &&
    activeContext.availableFiles.length > 0 &&
    !activeContext.availableFiles.includes(finding.filePath)
  ) {
    return {
      canNavigate: false,
      state: "file_not_found",
      message: `File missing: '${finding.filePath}' does not exist in revision ${finding.commitSha ? finding.commitSha.slice(0, 7) : "HEAD"}.`,
      targetRepo: finding.repoFullName,
      targetBranch: finding.branch,
      targetCommitSha: finding.commitSha,
      targetFilePath: finding.filePath,
      targetLineRange: targetRange,
    };
  }

  // 3. Stale Commit Revision Check
  if (
    finding.commitSha &&
    activeContext.currentCommitSha &&
    finding.commitSha !== activeContext.currentCommitSha
  ) {
    return {
      canNavigate: true,
      state: "stale_commit",
      message: `Stale revision: Finding was reviewed at commit ${finding.commitSha.slice(0, 7)}, but current branch '${activeContext.currentBranch}' HEAD is at ${activeContext.currentCommitSha.slice(0, 7)}. Line numbers may have shifted.`,
      targetRepo: finding.repoFullName,
      targetBranch: finding.branch,
      targetCommitSha: finding.commitSha,
      targetFilePath: finding.filePath,
      targetLineRange: targetRange,
    };
  }

  // 4. Branch Mismatch Check
  if (finding.branch && finding.branch !== activeContext.currentBranch) {
    return {
      canNavigate: true,
      state: "branch_mismatch",
      message: `Branch mismatch: Finding originated from branch '${finding.branch}', while current branch is '${activeContext.currentBranch}'.`,
      targetRepo: finding.repoFullName,
      targetBranch: finding.branch,
      targetCommitSha: finding.commitSha,
      targetFilePath: finding.filePath,
      targetLineRange: targetRange,
    };
  }

  // 5. Valid Navigation
  return {
    canNavigate: true,
    state: "valid",
    message: `Navigating to ${finding.filePath} lines ${targetRange[0]}-${targetRange[1]} at commit ${finding.commitSha.slice(0, 7)}.`,
    targetRepo: finding.repoFullName,
    targetBranch: finding.branch,
    targetCommitSha: finding.commitSha,
    targetFilePath: finding.filePath,
    targetLineRange: targetRange,
  };
}

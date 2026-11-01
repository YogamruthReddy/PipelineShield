"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ViewHeader } from "../common/ViewHeader";
import type { GitHubRepositorySummary } from "@/lib/github-service";
import type { PatchValidationResult } from "@/lib/patch-validator";
import type {
  GitHubBranchSummary,
  GitHubTreeItem,
  GitHubPermissionScope,
  CodeReviewFinding,
  CodeReviewSessionItem,
  LocalAIAction,
  LocalAIResponse,
} from "@/types/dashboard";
import { validateFindingNavigation } from "@/lib/finding-traceability";
import {
  compareFindingSnapshots,
  type FindingComparisonResult,
  type ComparedCodeReviewFinding,
} from "@/lib/finding-regression";
import {
  FileCode2,
  GitBranch,
  ShieldAlert,
  ShieldCheck,
  Search,
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Sparkles,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Lock,
  GitPullRequest,
  Download,
  X,
  Play,
  ArrowRight,
  Target,
  History,
  AlertCircle,
  Clock,
  GitCompare,
} from "lucide-react";

interface CodeReviewWorkspaceViewProps {
  initialRepo?: string;
}

export function CodeReviewWorkspaceView({
  initialRepo = "YogamruthReddy/PipelineShield",
}: CodeReviewWorkspaceViewProps) {
  // Repository & Branch Selection
  const [selectedRepo, setSelectedRepo] = useState<string>(initialRepo);
  const [repoList, setRepoList] = useState<GitHubRepositorySummary[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState<boolean>(true);
  const [repoSearch, setRepoSearch] = useState<string>("");
  const [isRepoPickerOpen, setIsRepoPickerOpen] = useState<boolean>(false);

  const [branches, setBranches] = useState<GitHubBranchSummary[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("main");
  const [isLoadingBranches, setIsLoadingBranches] = useState<boolean>(false);
  const [branchError, setBranchError] = useState<string | null>(null);

  // Derived commit SHA for selected branch
  const selectedCommitSha = useMemo(
    () => branches.find((br) => br.name === selectedBranch)?.commitSha || "",
    [branches, selectedBranch]
  );

  // Token scopes & rate limits
  const [scopes, setScopes] = useState<GitHubPermissionScope | null>(null);
  const [rateLimit, setRateLimit] = useState<{ remaining: number; limit: number; reset: number } | null>(null);

  // File tree state (on-demand loading)
  const [treeCache, setTreeCache] = useState<Record<string, GitHubTreeItem[]>>({});
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set([""]));
  const [isLoadingTree, setIsLoadingTree] = useState<boolean>(false);
  const [treeSearch, setTreeSearch] = useState<string>("");

  // File viewer state
  const [selectedFilePath, setSelectedFilePath] = useState<string>("");
  const [fileContent, setFileContent] = useState<string>("");
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Line selection state
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);

  // AI Review & Execution state
  const [activeAiAction, setActiveAiAction] = useState<LocalAIAction | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [currentAiResponse, setCurrentAiResponse] = useState<LocalAIResponse | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("qwen2.5:3b");
  const [sessionHistory, setSessionHistory] = useState<CodeReviewSessionItem[]>([]);

  // Traceability & Findings state
  const [workspaceTab, setWorkspaceTab] = useState<"analysis" | "findings" | "comparison" | "history">("analysis");
  const [findings, setFindings] = useState<CodeReviewFinding[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<CodeReviewFinding | null>(null);
  const [loadedFileRevision, setLoadedFileRevision] = useState<string>("");
  const [navigationAlert, setNavigationAlert] = useState<{
    type: "stale_commit" | "repo_mismatch" | "branch_mismatch" | "file_not_found";
    message: string;
    finding: CodeReviewFinding;
  } | null>(null);

  // Baseline / Regression Comparison state
  const [baselineSessionId, setBaselineSessionId] = useState<string>("");
  const [targetSessionId, setTargetSessionId] = useState<string>("current");
  const [comparisonFilter, setComparisonFilter] = useState<"all" | "new" | "resolved" | "persistent">("all");

  // Approval-Gated Apply & Push Modal
  const [isApplyModalOpen, setIsApplyModalOpen] = useState<boolean>(false);
  const [userConfirmedApproval, setUserConfirmedApproval] = useState<boolean>(false);
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [prTitle, setPrTitle] = useState<string>("");
  const [prBody, setPrBody] = useState<string>("");
  const [isApplyingPatch, setIsApplyingPatch] = useState<boolean>(false);
  const [applyResult, setApplyResult] = useState<{
    success: boolean;
    prUrl?: string;
    prNumber?: number;
    branchName?: string;
    error?: string;
  } | null>(null);

  // 1. Fetch available repositories
  useEffect(() => {
    let isMounted = true;
    fetch("/api/github/repos?per_page=50")
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && Array.isArray(data.repositories)) {
          setRepoList(data.repositories);
          if (data.rateLimit) setRateLimit(data.rateLimit);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoadingRepos(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch branches and root tree when selected repo changes
  useEffect(() => {
    let isMounted = true;
    const fetchBranchesAndTree = async () => {
      setIsLoadingBranches(true);
      setBranchError(null);
      setTreeCache({});
      setExpandedFolders(new Set([""]));
      setSelectedFilePath("");
      setFileContent("");

      try {
        const res = await fetch(`/api/github/branches?repo=${encodeURIComponent(selectedRepo)}`);
        const data = await res.json();
        if (!isMounted) return;

        if (data.success && Array.isArray(data.branches)) {
          setBranches(data.branches);
          if (data.scopes) setScopes(data.scopes);
          if (data.rateLimit) setRateLimit(data.rateLimit);

          const defaultBranch =
            data.branches.find((b: GitHubBranchSummary) => b.name === "main" || b.name === "master") ||
            data.branches[0];
          const branchName = defaultBranch ? defaultBranch.name : "main";
          setSelectedBranch(branchName);

          // Fetch root tree for default branch
          const treeRes = await fetch(
            `/api/github/tree?repo=${encodeURIComponent(selectedRepo)}&ref=${encodeURIComponent(branchName)}&path=`
          );
          const treeData = await treeRes.json();
          if (isMounted && treeData.success && Array.isArray(treeData.items)) {
            setTreeCache({ "": treeData.items });
          }
        } else {
          setBranchError(data.error || "Could not fetch branches.");
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setBranchError(err instanceof Error ? err.message : "Network error fetching branches.");
      } finally {
        if (isMounted) setIsLoadingBranches(false);
      }
    };

    fetchBranchesAndTree();

    return () => {
      isMounted = false;
    };
  }, [selectedRepo]);

  // 3. Load directory contents on-demand
  const loadDirectory = useCallback(
    async (dirPath: string = "", branch: string = selectedBranch) => {
      setIsLoadingTree(true);
      try {
        const url = `/api/github/tree?repo=${encodeURIComponent(selectedRepo)}&ref=${encodeURIComponent(
          branch
        )}&path=${encodeURIComponent(dirPath)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          setTreeCache((prev) => ({ ...prev, [dirPath]: data.items }));
          if (data.rateLimit) setRateLimit(data.rateLimit);
        }
      } catch {
        // non-blocking
      } finally {
        setIsLoadingTree(false);
      }
    },
    [selectedRepo, selectedBranch]
  );

  // Toggle directory expansion
  const toggleFolder = (dirPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
        loadDirectory(dirPath);
      }
      return next;
    });
  };

  // 4. Select and load file content
  const handleSelectFile = async (item: GitHubTreeItem) => {
    if (item.type === "dir") {
      toggleFolder(item.path);
      return;
    }

    setSelectedFilePath(item.path);
    setLoadedFileRevision(selectedBranch);
    setSelectedFinding(null);
    setNavigationAlert(null);
    setIsLoadingFile(true);
    setFileError(null);
    setSelectionStart(null);
    setSelectionEnd(null);
    setCurrentAiResponse(null);
    setAiError(null);

    try {
      const res = await fetch(
        `/api/github/file?repo=${encodeURIComponent(selectedRepo)}&path=${encodeURIComponent(
          item.path
        )}&ref=${encodeURIComponent(selectedBranch)}`
      );
      const data = await res.json();
      if (data.success && typeof data.content === "string") {
        setFileContent(data.content);
      } else {
        setFileError(data.error || "Failed to load file contents.");
      }
    } catch (err: unknown) {
      setFileError(err instanceof Error ? err.message : "Error reading file.");
    } finally {
      setIsLoadingFile(false);
    }
  };

  // Line selection logic
  const handleLineClick = (lineNum: number) => {
    if (selectionStart === null) {
      setSelectionStart(lineNum);
      setSelectionEnd(lineNum);
    } else if (selectionStart !== null && selectionEnd === selectionStart && lineNum !== selectionStart) {
      const start = Math.min(selectionStart, lineNum);
      const end = Math.max(selectionStart, lineNum);
      setSelectionStart(start);
      setSelectionEnd(end);
    } else {
      setSelectionStart(lineNum);
      setSelectionEnd(lineNum);
    }
  };

  const clearSelection = () => {
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  // Calculate selected text
  const fileLines = useMemo(() => fileContent.split("\n"), [fileContent]);

  const selectedSnippet = useMemo(() => {
    if (selectionStart === null || selectionEnd === null) return fileContent;
    const startIdx = Math.max(0, selectionStart - 1);
    const endIdx = Math.min(fileLines.length, selectionEnd);
    return fileLines.slice(startIdx, endIdx).join("\n");
  }, [fileLines, selectionStart, selectionEnd, fileContent]);

  // 5. Run Local AI Action
  const runAiAction = async (action: LocalAIAction) => {
    if (!fileContent.trim()) return;

    setActiveAiAction(action);
    setIsAiLoading(true);
    setAiError(null);
    setCurrentAiResponse(null);

    const isSelectionActive = selectionStart !== null && selectionEnd !== null;
    const payload: Record<string, unknown> = {
      action,
      model: selectedModel,
      repoFullName: selectedRepo,
      branch: selectedBranch,
      commitSha: selectedCommitSha,
      filePath: selectedFilePath,
      codeSnippet: selectedSnippet,
      baseContent: fileContent,
      responseLength: "balanced",
      ...(isSelectionActive ? { selectedLineRange: [selectionStart, selectionEnd] } : {}),
    };

    try {
      const res = await fetch("/api/local-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentAiResponse(data);

        const newFindings = Array.isArray(data.reviewFindings) ? (data.reviewFindings as CodeReviewFinding[]) : [];
        if (newFindings.length > 0) {
          setFindings((prev) => [...newFindings, ...prev]);
          setWorkspaceTab("findings");
        }

        // Record session history
        const newHistoryItem: CodeReviewSessionItem = {
          id: `cr-${Date.now()}`,
          repoFullName: selectedRepo,
          ref: selectedBranch,
          commitSha: selectedCommitSha,
          filePath: selectedFilePath,
          selectedLines: isSelectionActive ? [selectionStart, selectionEnd] : undefined,
          action,
          model: selectedModel,
          timestamp: new Date().toISOString(),
          findingsCount: newFindings.length,
          findings: newFindings,
          responsePreview: (data.response || "").slice(0, 140),
        };
        setSessionHistory((prev) => [newHistoryItem, ...prev]);

        // Prepopulate PR details if suggest_patch
        if (action === "suggest_patch") {
          setCommitMessage(`fix(security): resolve issue in ${selectedFilePath}`);
          setPrTitle(`[Security Patch] Fix issue in ${selectedFilePath}`);
          setPrBody(
            `Automated security remediation patch generated by PipelineShield Local AI.\n\n` +
              `Target File: \`${selectedFilePath}\`\n` +
              (isSelectionActive ? `Line Range: ${selectionStart}-${selectionEnd}\n` : "") +
              `Base Commit: \`${selectedCommitSha.slice(0, 7)}\`\n\n` +
              `### Patch Rationale:\n${(data.response || "").slice(0, 400)}`
          );
        }
      } else {
        setAiError(data.error || "Local AI analysis failed.");
      }
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "Error contacting local AI endpoint.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // 6. Finding-to-Code Traceable Navigation
  const handleSelectFinding = async (finding: CodeReviewFinding) => {
    setSelectedFinding(finding);

    const validation = validateFindingNavigation(finding, {
      currentRepo: selectedRepo,
      currentBranch: selectedBranch,
      currentCommitSha: selectedCommitSha,
    });

    if (validation.state === "repo_mismatch") {
      setNavigationAlert({
        type: "repo_mismatch",
        message: validation.message,
        finding,
      });
      return;
    }

    if (validation.state === "stale_commit") {
      setNavigationAlert({
        type: "stale_commit",
        message: validation.message,
        finding,
      });
    } else {
      setNavigationAlert(null);
    }

    // Load file if not loaded or if revision differs from historical commitSha
    const targetRef = finding.commitSha || selectedBranch;
    const shouldFetch = selectedFilePath !== finding.filePath || loadedFileRevision !== targetRef;

    if (shouldFetch) {
      setSelectedFilePath(finding.filePath);
      setLoadedFileRevision(targetRef);
      setIsLoadingFile(true);
      setFileError(null);
      try {
        const res = await fetch(
          `/api/github/file?repo=${encodeURIComponent(finding.repoFullName)}&path=${encodeURIComponent(
            finding.filePath
          )}&ref=${encodeURIComponent(targetRef)}`
        );
        const data = await res.json();
        if (data.success && typeof data.content === "string") {
          setFileContent(data.content);
        } else {
          setFileError(data.error || "Failed to load file at reviewed revision.");
        }
      } catch (err: unknown) {
        setFileError(err instanceof Error ? err.message : "Error reading file.");
      } finally {
        setIsLoadingFile(false);
      }
    }

    // Highlight target line range on the rendered content
    setSelectionStart(finding.startLine);
    setSelectionEnd(finding.endLine);
  };

  // Switch back to current branch HEAD
  const handleReloadCurrentHead = async () => {
    if (!selectedFilePath) return;
    setLoadedFileRevision(selectedBranch);
    setIsLoadingFile(true);
    setFileError(null);
    try {
      const res = await fetch(
        `/api/github/file?repo=${encodeURIComponent(selectedRepo)}&path=${encodeURIComponent(
          selectedFilePath
        )}&ref=${encodeURIComponent(selectedBranch)}`
      );
      const data = await res.json();
      if (data.success && typeof data.content === "string") {
        setFileContent(data.content);
        setNavigationAlert(null);
      } else {
        setFileError(data.error || "Failed to load current branch file.");
      }
    } catch (err: unknown) {
      setFileError(err instanceof Error ? err.message : "Error reading file.");
    } finally {
      setIsLoadingFile(false);
    }
  };

  // Baseline vs Regression Comparison calculation
  const comparisonResult: FindingComparisonResult = useMemo(() => {
    const baselineSession = sessionHistory.find((s) => s.id === baselineSessionId);
    const targetSession = sessionHistory.find((s) => s.id === targetSessionId);

    const bFindings = baselineSession?.findings || (sessionHistory.length > 1 ? sessionHistory[sessionHistory.length - 1].findings || [] : []);
    const tFindings = targetSession?.findings || findings;

    const bCommit = baselineSession?.commitSha || (sessionHistory.length > 1 ? sessionHistory[sessionHistory.length - 1].commitSha : undefined) || "baseline";
    const tCommit = targetSession?.commitSha || selectedCommitSha || "current";

    return compareFindingSnapshots({
      baselineFindings: bFindings,
      targetFindings: tFindings,
      baselineCommit: bCommit,
      targetCommit: tCommit,
    });
  }, [baselineSessionId, targetSessionId, sessionHistory, findings, selectedCommitSha]);

  // 6. Handle Approval-Gated Apply & Push
  const handleApplyAndPush = async () => {
    const patchVal = currentAiResponse?.patchValidation as PatchValidationResult | undefined;
    if (!userConfirmedApproval || !patchVal?.valid || typeof patchVal.patchedContent !== "string") return;

    setIsApplyingPatch(true);
    setApplyResult(null);

    const patchedContent = patchVal.patchedContent;

    try {
      const res = await fetch("/api/github/patch-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: selectedRepo,
          baseBranch: selectedBranch,
          expectedBaseSha: selectedCommitSha,
          targetFilePath: selectedFilePath,
          unifiedDiff: patchVal.diff,
          patchedContent,
          commitMessage,
          prTitle,
          prBody,
          userConfirmedApproval: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setApplyResult({
          success: true,
          prUrl: data.prUrl,
          prNumber: data.prNumber,
          branchName: data.branchName,
        });
      } else {
        setApplyResult({
          success: false,
          error: data.error || "Failed to apply and push patch.",
        });
      }
    } catch (err: unknown) {
      setApplyResult({
        success: false,
        error: err instanceof Error ? err.message : "Network error applying patch.",
      });
    } finally {
      setIsApplyingPatch(false);
    }
  };

  // Render tree item recursively
  const renderTreeItem = (item: GitHubTreeItem, depth: number = 0) => {
    const isExpanded = expandedFolders.has(item.path);
    const isSelected = selectedFilePath === item.path;
    const children = treeCache[item.path] || [];

    return (
      <div key={item.path} className="text-xs">
        <button
          type="button"
          onClick={() => handleSelectFile(item)}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          className={`w-full flex items-center gap-1.5 py-1 px-2 rounded-sm text-left transition-colors font-mono ${
            isSelected
              ? "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"
          }`}
        >
          {item.type === "dir" ? (
            <>
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
              {isExpanded ? (
                <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              )}
            </>
          ) : (
            <>
              <span className="w-3.5 shrink-0" />
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </>
          )}
          <span className="truncate">{item.name}</span>
        </button>

        {item.type === "dir" && isExpanded && (
          <div>
            {children.length === 0 ? (
              <div
                style={{ paddingLeft: `${(depth + 1) * 14 + 20}px` }}
                className="py-1 text-[11px] text-slate-400 font-mono italic"
              >
                {isLoadingTree ? "loading..." : "(empty)"}
              </div>
            ) : (
              children
                .filter((child) => (treeSearch ? child.name.toLowerCase().includes(treeSearch.toLowerCase()) : true))
                .map((child) => renderTreeItem(child, depth + 1))
            )}
          </div>
        )}
      </div>
    );
  };

  // Export session log
  const exportSessionMarkdown = () => {
    if (sessionHistory.length === 0) return;
    const lines = [
      `# PipelineShield Code Review & Patch Session Log`,
      `Date: ${new Date().toISOString()}`,
      `Repository: ${selectedRepo}`,
      `Branch: ${selectedBranch} (${selectedCommitSha.slice(0, 7)})`,
      `Total Review Actions: ${sessionHistory.length}`,
      "",
      "---",
      "",
    ];

    sessionHistory.forEach((item, idx) => {
      lines.push(`## Review Action #${idx + 1}: ${item.action}`);
      lines.push(`- **File:** \`${item.filePath}\``);
      if (item.selectedLines) lines.push(`- **Lines:** ${item.selectedLines[0]} - ${item.selectedLines[1]}`);
      lines.push(`- **Model:** \`${item.model}\``);
      lines.push(`- **Timestamp:** ${item.timestamp}`);
      lines.push(`- **Preview:** ${item.responsePreview}...`);
      lines.push("");
    });

    if (findings.length > 0) {
      lines.push("---");
      lines.push("## Traceable Findings Identified");
      lines.push("");
      findings.forEach((f, idx) => {
        lines.push(`### Finding #${idx + 1}: [${f.severity}] ${f.title}`);
        lines.push(`- **Location:** \`${f.repoFullName}@${f.commitSha?.slice(0, 7) || "HEAD"}:${f.filePath}#L${f.startLine}-L${f.endLine}\``);
        lines.push(`- **Status:** ${f.status}`);
        lines.push(`- **Explanation:** ${f.explanation}`);
        if (f.evidence) lines.push(`- **Evidence:** \`${f.evidence}\``);
        lines.push("");
      });
    }

    if (comparisonResult.summary.baselineTotal > 0 || comparisonResult.summary.targetTotal > 0) {
      lines.push("---");
      lines.push("## Baseline vs Regression Comparison Summary");
      lines.push(`- **Baseline Commit:** \`${comparisonResult.summary.baselineCommit}\``);
      lines.push(`- **Target Commit:** \`${comparisonResult.summary.targetCommit}\``);
      lines.push(`- **New Findings (Regressions):** +${comparisonResult.summary.newCount}`);
      lines.push(`- **Resolved Findings (Fixed):** -${comparisonResult.summary.resolvedCount}`);
      lines.push(`- **Persistent Findings:** ${comparisonResult.summary.persistentCount}`);
      lines.push(`- **Net Security Delta:** ${comparisonResult.summary.netDelta > 0 ? `+${comparisonResult.summary.netDelta} (Regressed)` : comparisonResult.summary.netDelta < 0 ? `${comparisonResult.summary.netDelta} (Improved)` : "0 (Unchanged)"}`);
      lines.push("");
    }

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `code-review-log-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* View Header */}
      <ViewHeader
        title="Repository Code Review & Patch Workspace"
        description="On-demand repository inspection, local AI security reviews, unified diff proposals, and approval-gated patch publishing."
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5" />
            CI Gate Authoritative
          </span>
        }
      />

      {/* Top Context & Control Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Repo & Branch pickers */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Repo Picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsRepoPickerOpen(!isRepoPickerOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-md transition-colors"
              >
                <FileCode2 className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-mono">{selectedRepo}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isRepoPickerOpen && (
                <div className="absolute left-0 mt-1 w-72 max-h-64 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg z-30 p-2 space-y-1">
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search repositories..."
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      className="w-full pl-7 pr-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  {isLoadingRepos ? (
                    <div className="text-center py-2 text-xs text-slate-400">Loading repositories...</div>
                  ) : (
                    repoList
                      .filter((r) => r.fullName.toLowerCase().includes(repoSearch.toLowerCase()))
                      .map((repo) => (
                        <button
                          key={repo.id}
                          type="button"
                          onClick={() => {
                            setSelectedRepo(repo.fullName);
                            setIsRepoPickerOpen(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono transition-colors truncate ${
                            selectedRepo === repo.fullName
                              ? "bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-semibold"
                              : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {repo.fullName}
                        </button>
                      ))
                  )}
                </div>
              )}
            </div>

            {/* Branch Selector */}
            <div className="flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedBranch}
                onChange={(e) => {
                  const newBranch = e.target.value;
                  setSelectedBranch(newBranch);
                  setTreeCache({});
                  setSelectedFilePath("");
                  setFileContent("");
                  loadDirectory("", newBranch);
                }}
                disabled={isLoadingBranches}
                className="px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                {branches.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name} {b.protected ? "(protected)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Commit Hash Indicator */}
            {selectedCommitSha && (
              <span className="text-[11px] font-mono px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-700">
                HEAD: {selectedCommitSha.slice(0, 7)}
              </span>
            )}
          </div>

          {/* Right: Permission scope & rate limit badges */}
          <div className="flex items-center gap-2">
            {scopes && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium ${
                  scopes.hasWritePermission
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                }`}
                title={scopes.reason}
              >
                {scopes.hasWritePermission ? (
                  <>
                    <ShieldCheck className="w-3 h-3" />
                    Write Authorized
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3" />
                    Read-Only Mode
                  </>
                )}
              </span>
            )}

            {rateLimit && (
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 tabular-nums">
                API: {rateLimit.remaining}/{rateLimit.limit}
              </span>
            )}

            {sessionHistory.length > 0 && (
              <button
                type="button"
                onClick={exportSessionMarkdown}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded transition-colors"
                title="Export session review transcript"
              >
                <Download className="w-3 h-3" />
                Export Log
              </button>
            )}
          </div>
        </div>

        {branchError && (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 p-2 rounded border border-red-200 dark:border-red-900">
            {branchError}
          </div>
        )}
      </div>

      {/* Main Workspace Grid: File Tree + Code Viewer + AI Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: On-Demand File Tree (3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Repository Tree
            </h3>
            <button
              type="button"
              onClick={() => {
                setTreeCache({});
                loadDirectory("");
              }}
              title="Refresh directory tree"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTree ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="relative mb-2">
            <Search className="w-3 h-3 absolute left-2 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter files..."
              value={treeSearch}
              onChange={(e) => setTreeSearch(e.target.value)}
              className="w-full pl-6 pr-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="max-h-[580px] overflow-y-auto space-y-0.5 border border-slate-100 dark:border-slate-800/80 rounded p-1">
            {treeCache[""] ? (
              treeCache[""]
                .filter((child) => (treeSearch ? child.name.toLowerCase().includes(treeSearch.toLowerCase()) : true))
                .map((child) => renderTreeItem(child, 0))
            ) : (
              <div className="text-center py-6 text-xs text-slate-400">
                {isLoadingTree ? "Loading file tree..." : "No files found."}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Code Viewer & AI Analysis Panel (9 cols) */}
        <div className="lg:col-span-9 space-y-4">
          {/* Code Viewer Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs overflow-hidden">
            {/* File Header Bar */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="font-mono text-xs font-medium text-slate-800 dark:text-slate-200">
                  {selectedFilePath || "No file selected. Choose a file from the repository tree."}
                </span>
                {fileContent && (
                  <>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      ({fileLines.length} lines)
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      ref: {loadedFileRevision ? loadedFileRevision.slice(0, 7) : selectedBranch}
                    </span>
                    {loadedFileRevision && selectedCommitSha && loadedFileRevision !== selectedBranch && loadedFileRevision !== selectedCommitSha && (
                      <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700">
                        Historical Revision
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Selection controls & Model Selector */}
              {fileContent && (
                <div className="flex items-center gap-2">
                  {selectionStart !== null && selectionEnd !== null ? (
                    <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 text-xs px-2.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 font-mono">
                      <span>
                        Lines {selectionStart}-{selectionEnd} ({selectionEnd - selectionStart + 1} lines)
                      </span>
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="hover:text-blue-900 dark:hover:text-blue-100 ml-1"
                        title="Clear line selection"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">
                      Click line numbers to select range for targeted review
                    </span>
                  )}

                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-300 focus:outline-none"
                  >
                    <option value="qwen2.5:3b">qwen2.5:3b (default)</option>
                    <option value="qwen2.5-coder:7b">qwen2.5-coder:7b</option>
                    <option value="gemma4:26b">gemma4:26b</option>
                  </select>
                </div>
              )}
            </div>

            {/* Action Bar */}
            {fileContent && (
              <div className="px-4 py-2 bg-slate-100/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                  Local AI Actions:
                </span>

                <button
                  type="button"
                  onClick={() => runAiAction("review_code")}
                  disabled={isAiLoading}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-xs"
                >
                  <Sparkles className="w-3 h-3" />
                  {selectionStart ? "Review Selection" : "Review File"}
                </button>

                <button
                  type="button"
                  onClick={() => runAiAction("find_security_risks")}
                  disabled={isAiLoading}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-xs"
                >
                  <ShieldAlert className="w-3 h-3" />
                  Find Security Risks
                </button>

                <button
                  type="button"
                  onClick={() => runAiAction("explain_code")}
                  disabled={isAiLoading}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-slate-700 text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors shadow-xs"
                >
                  <FileText className="w-3 h-3" />
                  Explain Code
                </button>

                <button
                  type="button"
                  onClick={() => runAiAction("suggest_patch")}
                  disabled={isAiLoading}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Suggest Patch
                </button>

                <button
                  type="button"
                  onClick={() => runAiAction("verify_guidance")}
                  disabled={isAiLoading}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-xs"
                >
                  <Play className="w-3 h-3" />
                  Verification Guidance
                </button>
              </div>
            )}

            {/* Navigation Alert Banner */}
            {navigationAlert && (
              <div
                className={`px-4 py-2 text-xs flex items-center justify-between border-b ${
                  navigationAlert.type === "stale_commit"
                    ? "bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800"
                    : "bg-red-50 dark:bg-red-950/70 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800"
                }`}
              >
                <div className="flex items-center gap-2">
                  {navigationAlert.type === "stale_commit" ? (
                    <Clock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                  )}
                  <span>{navigationAlert.message}</span>
                  {navigationAlert.type === "stale_commit" && (
                    <button
                      type="button"
                      onClick={handleReloadCurrentHead}
                      className="ml-2 px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-semibold hover:bg-amber-300 dark:hover:bg-amber-800 text-[11px] transition-colors"
                    >
                      Reload Current Branch HEAD
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setNavigationAlert(null)}
                  className="hover:opacity-75 p-1"
                  title="Dismiss alert"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Code Body */}
            {isLoadingFile ? (
              <div className="py-20 text-center text-xs text-slate-400">Loading file content...</div>
            ) : fileError ? (
              <div className="p-4 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40">
                {fileError}
              </div>
            ) : fileContent ? (
              <div className="max-h-[420px] overflow-auto font-mono text-xs bg-slate-950 text-slate-100 p-2">
                <table className="w-full border-collapse">
                  <tbody>
                    {fileLines.map((line, idx) => {
                      const lineNum = idx + 1;
                      const isSelected =
                        selectionStart !== null &&
                        selectionEnd !== null &&
                        lineNum >= selectionStart &&
                        lineNum <= selectionEnd;

                      return (
                        <tr
                          key={lineNum}
                          className={`${
                            isSelected
                              ? "bg-amber-950/60 hover:bg-amber-950/70 border-l-2 border-amber-500"
                              : "hover:bg-slate-900/60"
                          } transition-colors`}
                        >
                          <td
                            onClick={() => handleLineClick(lineNum)}
                            className="w-10 pr-3 text-right select-none text-slate-500 hover:text-blue-400 cursor-pointer tabular-nums border-r border-slate-800"
                          >
                            {lineNum}
                          </td>
                          <td className="pl-3 whitespace-pre font-mono leading-relaxed">{line}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-20 text-center text-xs text-slate-400">
                Select a file from the tree to view source code and initiate AI reviews.
              </div>
            )}
          </div>

          {/* AI Analysis, Findings Traceability & History Panel */}
          {(isAiLoading || aiError || currentAiResponse || findings.length > 0 || sessionHistory.length > 0) && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-xs space-y-4">
              {/* Workspace Result Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setWorkspaceTab("analysis")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      workspaceTab === "analysis"
                        ? "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Analysis & Patch
                  </button>

                  <button
                    type="button"
                    onClick={() => setWorkspaceTab("findings")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      workspaceTab === "findings"
                        ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Review Findings ({findings.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setWorkspaceTab("comparison")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      workspaceTab === "comparison"
                        ? "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <GitCompare className="w-3.5 h-3.5" />
                    Regression Compare ({comparisonResult.summary.newCount > 0 ? `+${comparisonResult.summary.newCount}` : "0"})
                  </button>

                  <button
                    type="button"
                    onClick={() => setWorkspaceTab("history")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      workspaceTab === "history"
                        ? "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    Session History ({sessionHistory.length})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    Advisory Only
                  </span>
                  {currentAiResponse?.redactedSecretsCount ? (
                    <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                      {currentAiResponse.redactedSecretsCount} secret(s) redacted
                    </span>
                  ) : null}
                </div>
              </div>

              {/* TAB 1: AI ANALYSIS & PATCH PREVIEW */}
              {workspaceTab === "analysis" && (
                <div className="space-y-3">
                  {/* Model & Action Header */}
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Action: <code className="font-mono text-purple-600 dark:text-purple-400">{activeAiAction || "code_review"}</code>
                    </span>
                    <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                      Model: {currentAiResponse?.model || selectedModel}
                    </span>
                  </div>

                  {/* Loading State */}
                  {isAiLoading && (
                    <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-500">
                      <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                      <p className="text-xs">Querying local Ollama runtime...</p>
                    </div>
                  )}

                  {/* Error State */}
                  {aiError && (
                    <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-3 rounded border border-red-200 dark:border-red-900 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Analysis Failed</p>
                        <p>{aiError}</p>
                      </div>
                    </div>
                  )}

                  {/* AI Response Body */}
                  {currentAiResponse && (
                    <div className="space-y-4">
                      <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans bg-slate-50 dark:bg-slate-800/40 p-3 rounded border border-slate-200 dark:border-slate-700 whitespace-pre-wrap font-mono">
                        {currentAiResponse.response}
                      </div>

                      {/* Patch Validation Status & Apply Actions */}
                      {Boolean(currentAiResponse.patchValidation) && (() => {
                        const patchValidation = currentAiResponse.patchValidation as PatchValidationResult;
                        return (
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-md border border-slate-200 dark:border-slate-700 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CheckCircle2
                                  className={`w-4 h-4 ${
                                    patchValidation.valid ? "text-emerald-500" : "text-red-500"
                                  }`}
                                />
                                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                  In-Memory Dry-Run Status:
                                </span>
                                <span
                                  className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${
                                    patchValidation.valid
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                      : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                                  }`}
                                >
                                  {patchValidation.valid
                                    ? "Dry-Run Validated (Applies Cleanly)"
                                    : "Validation Failed"}
                                </span>
                              </div>

                              {/* Apply & Push Trigger Button */}
                              {patchValidation.valid ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUserConfirmedApproval(false);
                                    setApplyResult(null);
                                    setIsApplyModalOpen(true);
                                  }}
                                  disabled={!scopes?.hasWritePermission}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors shadow-xs ${
                                    scopes?.hasWritePermission
                                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                      : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-300 dark:border-slate-700"
                                  }`}
                                  title={
                                    scopes?.hasWritePermission
                                      ? "Proceed to approval-gated patch publishing workflow"
                                      : "Write scope missing on GitHub token. Patch publishing disabled."
                                  }
                                >
                                  <GitPullRequest className="w-3.5 h-3.5" />
                                  Apply & Push to GitHub (Approval Gated)
                                </button>
                              ) : null}
                            </div>

                            {/* Scopes explanation if read-only */}
                            {!scopes?.hasWritePermission && (
                              <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2 rounded border border-amber-200 dark:border-amber-800 flex items-center gap-1.5">
                                <Lock className="w-3 h-3 shrink-0" />
                                <span>
                                  Token is in read-only mode ({scopes?.reason || "missing repo scope"}). In-memory patch dry-run is verified, but remote branch creation is disabled.
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: FINDINGS TRACEABILITY RESULTS */}
              {workspaceTab === "findings" && (
                <div className="space-y-3">
                  {/* Severity Count Summary */}
                  <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Total Findings: {findings.length}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-semibold">
                      Critical: {findings.filter((f) => f.severity === "CRITICAL").length}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 font-semibold">
                      High: {findings.filter((f) => f.severity === "HIGH").length}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold">
                      Medium: {findings.filter((f) => f.severity === "MEDIUM").length}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-semibold">
                      Low: {findings.filter((f) => f.severity === "LOW").length}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 font-semibold">
                      Info: {findings.filter((f) => f.severity === "INFO").length}
                    </span>
                  </div>

                  {findings.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      No findings identified yet. Run <span className="font-semibold text-slate-600 dark:text-slate-300">&apos;Find Security Risks&apos;</span> or <span className="font-semibold text-slate-600 dark:text-slate-300">&apos;Review Code&apos;</span> on a source file to populate traceable findings.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {findings.map((f) => {
                        const isStale = Boolean(f.commitSha && selectedCommitSha && f.commitSha !== selectedCommitSha);
                        const isSelected = selectedFinding?.id === f.id;

                        const severityStyles: Record<string, string> = {
                          CRITICAL: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800",
                          HIGH: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-800",
                          MEDIUM: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800",
                          LOW: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800",
                          INFO: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
                        };

                        return (
                          <div
                            key={f.id}
                            className={`p-3 rounded-lg border text-xs space-y-2 transition-colors ${
                              isSelected
                                ? "bg-blue-50/50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600"
                                : "bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                            }`}
                          >
                            {/* Finding Header */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase font-mono ${
                                    severityStyles[f.severity] || severityStyles.INFO
                                  }`}
                                >
                                  {f.severity}
                                </span>
                                <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                                  {f.title}
                                </h4>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleSelectFinding(f)}
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                              >
                                <Target className="w-3 h-3" />
                                Jump to Code (L{f.startLine}-L{f.endLine})
                              </button>
                            </div>

                            {/* Location & Traceability Banner */}
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 font-mono">
                              <GitBranch className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {f.repoFullName}
                              </span>
                              <span>@</span>
                              <span className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-purple-600 dark:text-purple-400">
                                {f.commitSha ? f.commitSha.slice(0, 7) : "HEAD"}
                              </span>
                              <span>&gt;</span>
                              <span className="text-blue-600 dark:text-blue-400">
                                {f.filePath}:{f.startLine}-{f.endLine}
                              </span>
                            </div>

                            {/* Stale Commit Warning */}
                            {isStale && (
                              <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2 rounded border border-amber-200 dark:border-amber-800 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                                <span>
                                  <strong>Stale Reference:</strong> Finding was evaluated at commit{" "}
                                  <code className="font-mono">{f.commitSha.slice(0, 7)}</code>. Active workspace branch is at{" "}
                                  <code className="font-mono">{selectedCommitSha.slice(0, 7)}</code>. Clicking Jump to Code loads the exact reviewed revision.
                                </span>
                              </div>
                            )}

                            {/* Explanation */}
                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                              {f.explanation}
                            </p>

                            {/* Evidence */}
                            {f.evidence ? (
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">
                                  Supporting Evidence:
                                </span>
                                <pre className="font-mono text-[11px] bg-slate-100 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 overflow-x-auto whitespace-pre-wrap">
                                  {f.evidence}
                                </pre>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: BASELINE / REGRESSION COMPARISON */}
              {workspaceTab === "comparison" && (
                <div className="space-y-4">
                  {/* Revision Selectors */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                        Baseline Revision (Comparison Reference):
                      </label>
                      <select
                        value={baselineSessionId}
                        onChange={(e) => setBaselineSessionId(e.target.value)}
                        className="w-full text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none"
                      >
                        <option value="">(Select baseline session / commit)</option>
                        {sessionHistory.map((s) => (
                          <option key={`baseline-${s.id}`} value={s.id}>
                            {(s.commitSha || "HEAD").slice(0, 7)} — {s.filePath} ({new Date(s.timestamp).toLocaleTimeString()}) - {s.findingsCount} finding(s)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                        Target Revision:
                      </label>
                      <select
                        value={targetSessionId}
                        onChange={(e) => setTargetSessionId(e.target.value)}
                        className="w-full text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none"
                      >
                        <option value="current">Current Workspace Findings ({selectedCommitSha ? selectedCommitSha.slice(0, 7) : "Active"})</option>
                        {sessionHistory.map((s) => (
                          <option key={`target-${s.id}`} value={s.id}>
                            {(s.commitSha || "HEAD").slice(0, 7)} — {s.filePath} ({new Date(s.timestamp).toLocaleTimeString()}) - {s.findingsCount} finding(s)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Metric Overview Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg">
                      <span className="text-[11px] font-semibold uppercase text-rose-700 dark:text-rose-300 tracking-wide">
                        New Regressions
                      </span>
                      <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
                        +{comparisonResult.summary.newCount}
                      </div>
                      <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                        Introduced findings
                      </p>
                    </div>

                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg">
                      <span className="text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-300 tracking-wide">
                        Resolved / Fixed
                      </span>
                      <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                        -{comparisonResult.summary.resolvedCount}
                      </div>
                      <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                        Eliminated findings
                      </p>
                    </div>

                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg">
                      <span className="text-[11px] font-semibold uppercase text-amber-700 dark:text-amber-300 tracking-wide">
                        Persistent Issues
                      </span>
                      <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                        {comparisonResult.summary.persistentCount}
                      </div>
                      <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                        Present in both revisions
                      </p>
                    </div>

                    <div className="p-3 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <span className="text-[11px] font-semibold uppercase text-slate-700 dark:text-slate-300 tracking-wide">
                        Net Security Delta
                      </span>
                      <div
                        className={`text-xl font-bold font-mono mt-1 ${
                          comparisonResult.summary.netDelta > 0
                            ? "text-rose-600 dark:text-rose-400"
                            : comparisonResult.summary.netDelta < 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {comparisonResult.summary.netDelta > 0
                          ? `+${comparisonResult.summary.netDelta}`
                          : comparisonResult.summary.netDelta}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {comparisonResult.summary.netDelta > 0
                          ? "Security regression"
                          : comparisonResult.summary.netDelta < 0
                          ? "Security improved"
                          : "No net delta"}
                      </p>
                    </div>
                  </div>

                  {/* Category Filter Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-medium mr-1 text-[11px]">Filter:</span>
                      {(["all", "new", "resolved", "persistent"] as const).map((filter) => {
                        const count =
                          filter === "all"
                            ? comparisonResult.newFindings.length +
                              comparisonResult.resolvedFindings.length +
                              comparisonResult.persistentFindings.length
                            : filter === "new"
                            ? comparisonResult.newFindings.length
                            : filter === "resolved"
                            ? comparisonResult.resolvedFindings.length
                            : comparisonResult.persistentFindings.length;

                        return (
                          <button
                            key={filter}
                            type="button"
                            onClick={() => setComparisonFilter(filter)}
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold capitalize transition-colors ${
                              comparisonFilter === filter
                                ? "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                            }`}
                          >
                            {filter} ({count})
                          </button>
                        );
                      })}
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono">
                      Baseline: <span className="font-semibold text-purple-600 dark:text-purple-400">{comparisonResult.summary.baselineCommit.slice(0, 7)}</span> &rarr; Target: <span className="font-semibold text-blue-600 dark:text-blue-400">{comparisonResult.summary.targetCommit.slice(0, 7)}</span>
                    </div>
                  </div>

                  {/* Compared Findings List */}
                  {(() => {
                    const displayedFindings: ComparedCodeReviewFinding[] =
                      comparisonFilter === "all"
                        ? [
                            ...comparisonResult.newFindings,
                            ...comparisonResult.resolvedFindings,
                            ...comparisonResult.persistentFindings,
                          ]
                        : comparisonFilter === "new"
                        ? comparisonResult.newFindings
                        : comparisonFilter === "resolved"
                        ? comparisonResult.resolvedFindings
                        : comparisonResult.persistentFindings;

                    if (displayedFindings.length === 0) {
                      return (
                        <div className="py-12 text-center text-xs text-slate-400">
                          No findings match the selected comparison filter.
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {displayedFindings.map((f) => {
                          const statusStyles: Record<string, string> = {
                            new: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800",
                            resolved: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800",
                            persistent: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800",
                          };

                          const statusLabels: Record<string, string> = {
                            new: "New Regression",
                            resolved: "Resolved / Fixed",
                            persistent: "Persistent Issue",
                          };

                          return (
                            <div
                              key={`${f.comparisonStatus}-${f.id}`}
                              className="p-3 rounded-lg border text-xs space-y-2 bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 transition-colors"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase font-mono ${
                                      statusStyles[f.comparisonStatus]
                                    }`}
                                  >
                                    {statusLabels[f.comparisonStatus]}
                                  </span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
                                    {f.severity}
                                  </span>
                                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                                    {f.title}
                                  </h4>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleSelectFinding(f)}
                                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                >
                                  <Target className="w-3 h-3" />
                                  Inspect at Ref (L{f.startLine}-L{f.endLine})
                                </button>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 font-mono">
                                <GitBranch className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {f.repoFullName}
                                </span>
                                <span>@</span>
                                <span className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-purple-600 dark:text-purple-400">
                                  {f.commitSha ? f.commitSha.slice(0, 7) : "HEAD"}
                                </span>
                                <span>&gt;</span>
                                <span className="text-blue-600 dark:text-blue-400">
                                  {f.filePath}:{f.startLine}-{f.endLine}
                                </span>
                              </div>

                              <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                                {f.explanation}
                              </p>

                              {f.evidence ? (
                                <div className="space-y-1">
                                  <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">
                                    Code Evidence:
                                  </span>
                                  <pre className="font-mono text-[11px] bg-slate-100 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 overflow-x-auto whitespace-pre-wrap">
                                    {f.evidence}
                                  </pre>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB 3: SESSION REVIEW HISTORY */}
              {workspaceTab === "history" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                    <span>Recorded AI Review Interactions: {sessionHistory.length}</span>
                    <button
                      type="button"
                      onClick={exportSessionMarkdown}
                      disabled={sessionHistory.length === 0}
                      className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium disabled:opacity-50"
                    >
                      <Download className="w-3 h-3" />
                      Download Markdown Log
                    </button>
                  </div>

                  {sessionHistory.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      No session history recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sessionHistory.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {item.action}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(item.timestamp).toLocaleTimeString()}
                            </span>
                          </div>

                          <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                            {item.filePath}
                            {item.selectedLines ? ` (Lines ${item.selectedLines[0]}-${item.selectedLines[1]})` : ""}
                            {" @ "}
                            {item.commitSha?.slice(0, 7)}
                          </div>

                          <p className="text-slate-500 text-[11px] italic">
                            &quot;{item.responsePreview}...&quot;
                          </p>

                          <div className="flex items-center gap-2 pt-1 text-[11px]">
                            <span className="text-slate-400">Model: {item.model}</span>
                            <span className="text-purple-600 dark:text-purple-400 font-medium">
                              Findings: {item.findingsCount}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Approval-Gated Apply & Push Modal */}
      {isApplyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-xl w-full p-5 space-y-4 shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <GitPullRequest className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Gated Patch Publishing Workflow
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsApplyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Safety & Workflow Rules */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-200 space-y-1">
              <p className="font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Safety Invariants Enforced:
              </p>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                <li>Never pushes directly to default or protected branches ({selectedBranch}).</li>
                <li>Creates an isolated review branch: <code className="font-mono">patch/pipelineshield-&lt;timestamp&gt;</code>.</li>
                <li>Stale base commit check: aborts if base branch commit moves beyond {selectedCommitSha.slice(0, 7)}.</li>
                <li>Opens a Pull Request for human operator & CI Security Gate evaluation.</li>
              </ul>
            </div>

            {/* Inputs */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target File:
                </label>
                <input
                  type="text"
                  disabled
                  value={selectedFilePath}
                  className="w-full px-2.5 py-1.5 font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Commit Message:
                </label>
                <input
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  className="w-full px-2.5 py-1.5 font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Pull Request Title:
                </label>
                <input
                  type="text"
                  value={prTitle}
                  onChange={(e) => setPrTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
                />
              </div>

              {/* Explicit Approval Checkbox */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userConfirmedApproval}
                    onChange={(e) => setUserConfirmedApproval(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    I explicitly confirm and authorize applying this patch to a new branch and opening a pull request for CI security gate evaluation.
                  </span>
                </label>
              </div>
            </div>

            {/* Apply Result Message */}
            {applyResult && (
              <div
                className={`p-3 rounded text-xs ${
                  applyResult.success
                    ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                    : "bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800"
                }`}
              >
                {applyResult.success ? (
                  <div className="space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Patch Branch and Pull Request Created Successfully!
                    </p>
                    <p className="font-mono text-[11px]">Branch: {applyResult.branchName}</p>
                    {applyResult.prUrl && (
                      <a
                        href={applyResult.prUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 underline font-semibold mt-1"
                      >
                        View Pull Request #{applyResult.prNumber} on GitHub
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      Publishing Failed
                    </p>
                    <p>{applyResult.error}</p>
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsApplyModalOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleApplyAndPush}
                disabled={!userConfirmedApproval || isApplyingPatch}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isApplyingPatch ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-3.5 h-3.5" />
                    Confirm, Branch & Open PR
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

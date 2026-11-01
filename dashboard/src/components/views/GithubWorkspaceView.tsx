"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ViewHeader } from "../common/ViewHeader";
import { VerdictBadge } from "../VerdictBadge";
import { CopyButton } from "../common/CopyButton";
import { ContextualAIPanel } from "../common/ContextualAIPanel";
import type {
  GitHubRepositorySummary,
  RepositoryOverviewResult,
  GitHubPullRequestSummary,
  GitHubChangedFile,
  GitHubCheckRunSummary,
} from "@/lib/github-service";
import {
  FolderGit2,
  GitBranch,
  GitPullRequest,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Radio,
  FileCode2,
  CheckCircle2,
  Sparkles,
  Wrench,
  Activity,
  ChevronDown,
} from "lucide-react";

interface GithubWorkspaceViewProps {
  initialRepo?: string;
  onSelectRepo?: (repoFullName: string) => void;
}

export function GithubWorkspaceView({
  initialRepo = "YogamruthReddy/PipelineShield",
  onSelectRepo,
}: GithubWorkspaceViewProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "pulls" | "reliability">("overview");

  // Repository Discovery & Selection
  const [selectedRepo, setSelectedRepo] = useState<string>(initialRepo);
  const [repoSearch, setRepoSearch] = useState<string>("");
  const [repoList, setRepoList] = useState<GitHubRepositorySummary[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState<boolean>(true);
  const [repoListError, setRepoListError] = useState<string | null>(null);
  const [isRepoPickerOpen, setIsRepoPickerOpen] = useState<boolean>(false);

  // Overview Data
  const [overview, setOverview] = useState<RepositoryOverviewResult | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState<boolean>(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // Pull Request Selection & Details
  const [selectedPrNumber, setSelectedPrNumber] = useState<number | null>(null);
  const [selectedPrDetails, setSelectedPrDetails] = useState<{
    pullRequest?: GitHubPullRequestSummary;
    files?: GitHubChangedFile[];
    checkRuns?: GitHubCheckRunSummary[];
  } | null>(null);
  const [isLoadingPr, setIsLoadingPr] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<GitHubChangedFile | null>(null);

  // Local AI Code Review & Patch Panel
  const [aiModalAction, setAiModalAction] = useState<"review_code" | "suggest_patch" | "verify_guidance" | null>(null);

  // Webhook deliveries
  const [webhookDeliveries, setWebhookDeliveries] = useState<Array<{
    deliveryId: string;
    runId: number;
    event: string;
    receivedAt: string;
    status: string;
  }>>([]);

  // Fetch account repositories on mount
  useEffect(() => {
    let isMounted = true;

    fetch("/api/github/repos?per_page=50")
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && Array.isArray(data.repositories)) {
          setRepoList(data.repositories);
        } else {
          setRepoListError(data.error || "Could not list account repositories.");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setRepoListError(err instanceof Error ? err.message : "Network error");
      })
      .finally(() => {
        if (isMounted) setIsLoadingRepos(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch repository overview when selectedRepo changes
  useEffect(() => {
    let isMounted = true;

    fetch(`/api/github/overview?repo=${encodeURIComponent(selectedRepo)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.overview) {
          setOverview(data.overview);
          // Auto-select first PR if available
          if (data.overview.recentPullRequests.length > 0) {
            setSelectedPrNumber(data.overview.recentPullRequests[0].number);
            setIsLoadingPr(true);
          }
        } else {
          setOverviewError(data.error || "Failed to load repository overview.");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setOverviewError(err instanceof Error ? err.message : "Network error");
      })
      .finally(() => {
        if (isMounted) setIsLoadingOverview(false);
      });

    // Also fetch webhook diagnostics
    fetch("/api/webhook/github")
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.lastDelivery) {
          setWebhookDeliveries([
            {
              deliveryId: data.lastDelivery.deliveryId,
              runId: data.lastDelivery.runId,
              event: data.lastDelivery.event,
              receivedAt: data.lastDelivery.receivedAt,
              status: "PROCESSED",
            },
          ]);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [selectedRepo]);

  // Fetch PR details when selectedPrNumber changes
  useEffect(() => {
    if (!selectedPrNumber) return;
    let isMounted = true;

    fetch(`/api/github/pulls?repo=${encodeURIComponent(selectedRepo)}&pull_number=${selectedPrNumber}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success) {
          setSelectedPrDetails({
            pullRequest: data.pullRequest,
            files: data.files,
            checkRuns: data.checkRuns,
          });
          if (data.files && data.files.length > 0) {
            setSelectedFile(data.files[0]);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoadingPr(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedRepo, selectedPrNumber]);

  // Filter repositories by search
  const filteredRepos = useMemo(() => {
    if (!repoSearch.trim()) return repoList;
    const q = repoSearch.toLowerCase().trim();
    return repoList.filter(
      (r) => r.fullName.toLowerCase().includes(q) || (r.description && r.description.toLowerCase().includes(q))
    );
  }, [repoList, repoSearch]);

  const handleSelectRepository = (fullName: string) => {
    setSelectedRepo(fullName);
    setIsLoadingOverview(true);
    setOverviewError(null);
    setSelectedPrNumber(null);
    setSelectedPrDetails(null);
    setSelectedFile(null);
    setIsRepoPickerOpen(false);
    onSelectRepo?.(fullName);
  };

  const handleSelectPr = (prNumber: number) => {
    setSelectedPrNumber(prNumber);
    setIsLoadingPr(true);
  };

  const handleRefreshOverview = () => {
    setIsLoadingOverview(true);
    fetch(`/api/github/overview?repo=${encodeURIComponent(selectedRepo)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.overview) setOverview(data.overview);
      })
      .finally(() => setIsLoadingOverview(false));
  };

  // Generate copyable PR security review markdown
  const copyablePrReview = useMemo(() => {
    if (!selectedPrDetails?.pullRequest) return "";
    const pr = selectedPrDetails.pullRequest;
    const files = selectedPrDetails.files || [];
    const checks = selectedPrDetails.checkRuns || [];

    return [
      `## 🛡️ PipelineShield Repository Security Review`,
      ``,
      `**Repository:** \`${selectedRepo}\`  `,
      `**Pull Request:** [#${pr.number} — ${pr.title}](${pr.htmlUrl})  `,
      `**Author:** @${pr.user.login} | **Branch:** \`${pr.head.ref}\` -> \`${pr.base.ref}\`  `,
      ``,
      `### Security Check Summary`,
      ...checks.map(
        (c) =>
          `- ${c.conclusion === "success" ? "✅" : c.conclusion === "failure" ? "❌" : "⏳"} **${c.name}**: ${c.conclusion?.toUpperCase() || c.status}`
      ),
      ``,
      `### Changed Files Inspected (${files.length})`,
      ...files.map((f) => `- \`${f.filename}\` (+${f.additions} / -${f.deletions})`),
      ``,
      `### Advisory Notice`,
      `*Evaluation generated strictly from read-only GitHub API telemetry and local deterministic security policies.*`,
    ].join("\n");
  }, [selectedRepo, selectedPrDetails]);

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <ViewHeader
        title="GitHub Repository Security Workspace"
        description="Account-wide repository discovery, pull request security auditing, local AI code review, and webhook delivery telemetry."
        icon={<FolderGit2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
        badge={
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
            Read-Only Workspace
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefreshOverview}
              disabled={isLoadingOverview}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOverview ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* Account-wide Repository Switcher Bar */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsRepoPickerOpen(!isRepoPickerOpen)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-teal-500/30 bg-teal-50/50 dark:bg-teal-950/30 hover:bg-teal-100/60 text-teal-900 dark:text-teal-200 font-mono text-xs font-bold transition-all cursor-pointer shadow-2xs"
            >
              <FolderGit2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
              <span>{selectedRepo}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-teal-600 transition-transform ${isRepoPickerOpen ? "rotate-180" : ""}`} />
            </button>

            {isRepoPickerOpen && (
              <div className="absolute left-0 mt-2 w-80 sm:w-96 max-h-96 overflow-y-auto bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 p-2 space-y-2 animate-fadeIn">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                    placeholder="Search account repositories..."
                    className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  {isLoadingRepos ? (
                    <div className="py-6 text-center text-xs text-slate-500 font-mono">
                      Discovering accessible repositories...
                    </div>
                  ) : repoListError ? (
                    <div className="p-3 text-xs text-amber-800 dark:text-amber-300 font-mono">
                      {repoListError}
                    </div>
                  ) : filteredRepos.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400 font-mono">
                      No matching repositories found.
                    </div>
                  ) : (
                    filteredRepos.map((r) => {
                      const isSelected = r.fullName === selectedRepo;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => handleSelectRepository(r.fullName)}
                          className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 font-bold"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="font-mono truncate">{r.fullName}</div>
                            {r.description && (
                              <div className="text-[11px] text-slate-400 truncate">{r.description}</div>
                            )}
                          </div>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                            {r.private ? "Private" : "Public"}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-slate-500 flex-wrap">
            <span className="flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5 text-slate-400" />
              <span>Branch: <strong>{overview?.repository.defaultBranch || "main"}</strong></span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              <span>Rate Limit: <strong>{overview?.rateLimit.remaining ?? "—"} / {overview?.rateLimit.limit ?? "—"}</strong></span>
            </span>
            <a
              href={`https://github.com/${selectedRepo}`}
              target="_blank"
              rel="noreferrer"
              className="text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === "overview"
                ? "bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            Repository Overview &amp; Posture
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pulls")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === "pulls"
                ? "bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            Pull Requests &amp; AI Review ({overview?.recentPullRequests.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("reliability")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === "reliability"
                ? "bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            Webhook &amp; Workflow Reliability
          </button>
        </div>
      </div>

      {overviewError && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p>{overviewError}</p>
        </div>
      )}

      {/* ─── TAB 1: Repository Overview & Security Posture ────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Security Posture Matrix */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 font-subheading">
              <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Repository Security Posture &amp; Configuration Controls</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* Branch Protection */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">Branch Protection</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                      overview?.securityPosture.branchProtection.status === "configured"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : overview?.securityPosture.branchProtection.status === "not_accessible"
                        ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                  >
                    {overview?.securityPosture.branchProtection.status || "not_configured"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                  {overview?.securityPosture.branchProtection.details ||
                    "Protects default branch from unreviewed pushes and bypasses."}
                </p>
                {overview?.securityPosture.branchProtection.requiredStatusChecks.length ? (
                  <div className="text-[10px] font-mono text-slate-400">
                    Required checks: {overview.securityPosture.branchProtection.requiredStatusChecks.join(", ")}
                  </div>
                ) : null}
              </div>

              {/* Dependabot */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">Dependabot</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                      overview?.securityPosture.dependabot.status === "no_findings"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : overview?.securityPosture.dependabot.status === "findings_present"
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {overview?.securityPosture.dependabot.status || "not_accessible"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                  {overview?.securityPosture.dependabot.details || "Continuous dependency CVE alert monitoring."}
                </p>
              </div>

              {/* Code Scanning */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">Code Scanning</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                      overview?.securityPosture.codeScanning.status === "no_findings"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : overview?.securityPosture.codeScanning.status === "findings_present"
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {overview?.securityPosture.codeScanning.status || "not_configured"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                  {overview?.securityPosture.codeScanning.details || "SARIF-based SAST analysis pipeline."}
                </p>
              </div>

              {/* Secret Scanning */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">Secret Scanning</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                      overview?.securityPosture.secretScanning.status === "no_findings"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : overview?.securityPosture.secretScanning.status === "findings_present"
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {overview?.securityPosture.secretScanning.status || "not_configured"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                  {overview?.securityPosture.secretScanning.details || "Token and private credential leak detection."}
                </p>
              </div>
            </div>
          </div>

          {/* Recent CI Runs */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 font-subheading">
                <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Recent GitHub Actions Runs</span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {overview?.recentRuns.length || 0} runs fetched
              </span>
            </div>

            <div className="space-y-2">
              {overview?.recentRuns.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 font-mono">
                  No GitHub Actions runs found for this repository.
                </div>
              ) : (
                overview?.recentRuns.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            r.conclusion === "success"
                              ? "bg-emerald-500"
                              : r.conclusion === "failure"
                              ? "bg-rose-500"
                              : "bg-amber-500"
                          }`}
                        />
                        <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                          {r.name}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">#{r.id}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 flex items-center gap-2">
                        <span>branch: {r.headBranch}</span>
                        <span>•</span>
                        <span>commit: {r.headSha}</span>
                        <span>•</span>
                        <span>event: {r.event}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <VerdictBadge
                        decision={
                          r.conclusion === "success"
                            ? "PASS"
                            : r.conclusion === "failure"
                            ? "BLOCK"
                            : "WARN"
                        }
                        size="sm"
                      />
                      <a
                        href={r.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-teal-600 hover:text-teal-700 p-1"
                        title="Open run on GitHub"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: Pull Requests & Local AI Code Review ──────────────────────── */}
      {activeTab === "pulls" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* PR List Column */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 px-1">
              Pull Requests ({overview?.recentPullRequests.length || 0})
            </h3>

            <div className="space-y-2">
              {overview?.recentPullRequests.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800">
                  No active pull requests in this repository.
                </div>
              ) : (
                overview?.recentPullRequests.map((pr) => {
                  const isSelected = pr.number === selectedPrNumber;
                  return (
                    <button
                      key={pr.number}
                      type="button"
                      onClick={() => handleSelectPr(pr.number)}
                      className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer space-y-1.5 ${
                        isSelected
                          ? "bg-teal-50/70 dark:bg-teal-950/40 border-teal-500 shadow-2xs"
                          : "bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 line-clamp-1">
                          #{pr.number} {pr.title}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded uppercase shrink-0 font-bold ${
                            pr.state === "open"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                          }`}
                        >
                          {pr.state}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 truncate">
                        by @{pr.user.login} • {pr.head.ref}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* PR Details & Changed Files Explorer */}
          <div className="lg:col-span-8 space-y-4">
            {isLoadingPr ? (
              <div className="p-12 text-center text-xs font-mono text-slate-500 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800">
                Loading PR changed files and check runs...
              </div>
            ) : selectedPrDetails?.pullRequest ? (
              <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-xs">
                {/* PR Header Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <GitPullRequest className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-subheading">
                        #{selectedPrDetails.pullRequest.number} — {selectedPrDetails.pullRequest.title}
                      </h3>
                    </div>
                    <p className="text-xs font-mono text-slate-500">
                      Author: @{selectedPrDetails.pullRequest.user.login} • Branch:{" "}
                      <code className="text-teal-600">{selectedPrDetails.pullRequest.head.ref}</code> into{" "}
                      <code className="text-slate-700">{selectedPrDetails.pullRequest.base.ref}</code>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <CopyButton text={copyablePrReview} />
                    <a
                      href={selectedPrDetails.pullRequest.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <span>Open on GitHub</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Changed Files Explorer */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                    <span>Changed Files ({selectedPrDetails.files?.length || 0})</span>
                    <span className="text-[11px] text-slate-400 font-normal">Click file to inspect diff</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {selectedPrDetails.files?.map((f) => {
                      const isSelected = selectedFile?.filename === f.filename;
                      return (
                        <button
                          key={f.filename}
                          type="button"
                          onClick={() => setSelectedFile(f)}
                          className={`p-2.5 rounded-xl border text-left text-xs font-mono transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? "bg-teal-50 dark:bg-teal-950/60 border-teal-500 font-bold"
                              : "bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:bg-white"
                          }`}
                        >
                          <span className="truncate pr-2">{f.filename}</span>
                          <span className="text-[10px] shrink-0 text-slate-400">
                            +{f.additions} / -{f.deletions}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Diff Viewer & Local AI Actions */}
                {selectedFile && (
                  <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileCode2 className="w-4 h-4 text-teal-600" />
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {selectedFile.filename}
                        </span>
                      </div>

                      {/* AI Action Triggers */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setAiModalAction("review_code")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-linear-to-r from-teal-500/10 to-indigo-500/10 hover:from-teal-500/20 hover:to-indigo-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30 transition-all shadow-2xs cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-teal-500" />
                          <span>AI Review Diff</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setAiModalAction("suggest_patch")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-linear-to-r from-blue-500/10 to-teal-500/10 hover:from-blue-500/20 hover:to-teal-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 transition-all shadow-2xs cursor-pointer"
                        >
                          <Wrench className="w-3.5 h-3.5 text-blue-500" />
                          <span>AI Propose Patch</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setAiModalAction("verify_guidance")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer shadow-2xs"
                        >
                          <span>Verification Guidance</span>
                        </button>
                      </div>
                    </div>

                    {/* Diff Content Box */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-200 overflow-x-auto max-h-80 leading-relaxed shadow-inner">
                      {selectedFile.patch ? (
                        <pre className="whitespace-pre-wrap">
                          {selectedFile.patch.split("\n").map((line, idx) => {
                            const isAdd = line.startsWith("+");
                            const isDel = line.startsWith("-");
                            const isHdr = line.startsWith("@@");
                            return (
                              <div
                                key={idx}
                                className={
                                  isAdd
                                    ? "bg-emerald-950/60 text-emerald-300 px-1 rounded-xs"
                                    : isDel
                                    ? "bg-rose-950/60 text-rose-300 px-1 rounded-xs"
                                    : isHdr
                                    ? "text-teal-400 font-bold py-0.5"
                                    : "text-slate-400"
                                }
                              >
                                {line}
                              </div>
                            );
                          })}
                        </pre>
                      ) : (
                        <div className="text-slate-500 italic">
                          Binary file or no unified diff text available from GitHub API.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-xs font-mono text-slate-400 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800">
                Select a pull request from the list to inspect changed files and run local AI review.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: Workflow & Webhook Reliability ───────────────────────────── */}
      {activeTab === "reliability" && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 font-subheading">
              <Radio className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Real-Time Webhook Deliveries &amp; Idempotency Telemetry</span>
            </h3>

            <div className="space-y-2">
              {webhookDeliveries.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-slate-500 border border-slate-100 dark:border-slate-800 rounded-xl">
                  No incoming webhook deliveries recorded in the current session.
                </div>
              ) : (
                webhookDeliveries.map((d) => (
                  <div
                    key={d.deliveryId}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between text-xs font-mono"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {d.event} (Run #{d.runId})
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">UUID: {d.deliveryId}</div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        {d.status}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {new Date(d.receivedAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contextual AI Panel Modal for Code Review / Patch Suggestion */}
      {aiModalAction && (
        <ContextualAIPanel
          isOpen={Boolean(aiModalAction)}
          onClose={() => setAiModalAction(null)}
          action={aiModalAction}
          title={
            aiModalAction === "review_code"
              ? "Local AI Code Review"
              : aiModalAction === "suggest_patch"
              ? "Local AI Patch Proposal"
              : "Local AI Verification Guidance"
          }
          subtitle={`Analyzing ${selectedFile?.filename || "selected diff"} in ${selectedRepo}`}
          codeDiff={selectedFile?.patch || "No diff content"}
          filePath={selectedFile?.filename}
          prNumber={selectedPrDetails?.pullRequest?.number}
          repoFullName={selectedRepo}
        />
      )}
    </div>
  );
}

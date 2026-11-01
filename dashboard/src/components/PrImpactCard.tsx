"use client";

import React, { useState, useMemo } from "react";
import type { EvaluationResult } from "@/types/dashboard";
import { computePrImpact } from "@/lib/pr-impact";
import { SAMPLE_REPORTS } from "@/data/sample-reports";
import { ContextualAIPanel } from "./common/ContextualAIPanel";
import {
  GitPullRequest,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Layers,
  Sparkles,
} from "lucide-react";

interface PrImpactCardProps {
  currentReport: EvaluationResult;
  baselineKey?: string;
  onNavigateToFinding?: (findingId: string) => void;
}

export function PrImpactCard({
  currentReport,
  baselineKey = "clean",
  onNavigateToFinding,
}: PrImpactCardProps) {
  const [selectedBaseline, setSelectedBaseline] = useState<string>(baselineKey);
  const [copiedMd, setCopiedMd] = useState(false);
  const [isAiReviewOpen, setIsAiReviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"new_blockers" | "new_warnings" | "fixed" | "persistent">("new_blockers");

  const baselineReport = useMemo(() => {
    return SAMPLE_REPORTS[selectedBaseline]?.data || null;
  }, [selectedBaseline]);

  const impact = useMemo(() => {
    return computePrImpact(currentReport, baselineReport, {
      prBranch: currentReport.branch || "feat/current-change",
      baseBranch: baselineReport?.branch || "main",
      prCommitSha: currentReport.commit_sha || "HEAD",
    });
  }, [currentReport, baselineReport]);

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(impact.markdownComment);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs transition-colors space-y-5">
      {/* Header Tier */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 shadow-2xs">
            <GitPullRequest className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight font-subheading">
                Pull Request Impact &amp; Diff Analysis
              </h3>
              <span
                className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                  impact.summary.newBlockersCount > 0
                    ? "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800"
                    : impact.summary.newWarningsCount > 0
                    ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                    : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                }`}
              >
                {impact.summary.newBlockersCount > 0
                  ? `+${impact.summary.newBlockersCount} NEW BLOCKERS`
                  : impact.summary.newWarningsCount > 0
                  ? `+${impact.summary.newWarningsCount} ADVISORY`
                  : "PR INTRODUCES 0 BLOCKERS"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              Delta analysis between this PR commit and the target baseline branch.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Baseline Picker */}
          <div className="flex items-center gap-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-slate-400">Base:</span>
            <select
              value={selectedBaseline}
              onChange={(e) => setSelectedBaseline(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-200 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="clean">Clean Baseline (PASS)</option>
              <option value="warnings_only">Advisory Warnings (WARN)</option>
              <option value="vulnerable">Vulnerable Baseline (BLOCK)</option>
            </select>
          </div>

          {/* Copy PR Comment Markdown */}
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold font-mono border transition-all cursor-pointer shadow-2xs ${
              copiedMd
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
            title="Copy GitHub pull request markdown comment"
          >
            {copiedMd ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copiedMd ? "Copied!" : "Copy PR Comment"}</span>
          </button>

          {/* AI Security Review Draft */}
          <button
            type="button"
            onClick={() => setIsAiReviewOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold font-mono border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-all cursor-pointer shadow-2xs"
            title="Draft an advisory PR security review comment via Local AI"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Draft AI Review</span>
          </button>
        </div>
      </div>

      {/* 4 Metric Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* New Blockers */}
        <button
          type="button"
          onClick={() => setActiveTab("new_blockers")}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            activeTab === "new_blockers"
              ? "bg-red-50/70 dark:bg-red-950/40 border-red-300 dark:border-red-800 ring-2 ring-red-400/20"
              : "bg-slate-50/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 hover:bg-slate-100/60"
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-400">New Blockers</span>
            <ShieldAlert className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-xl font-black text-red-600 dark:text-red-400 mt-1">
            {impact.summary.newBlockersCount}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Introduced in this PR</p>
        </button>

        {/* New Warnings */}
        <button
          type="button"
          onClick={() => setActiveTab("new_warnings")}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            activeTab === "new_warnings"
              ? "bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 ring-2 ring-amber-400/20"
              : "bg-slate-50/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 hover:bg-slate-100/60"
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-400">New Warnings</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {impact.summary.newWarningsCount}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Advisory warnings</p>
        </button>

        {/* Fixed Findings */}
        <button
          type="button"
          onClick={() => setActiveTab("fixed")}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            activeTab === "fixed"
              ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 ring-2 ring-emerald-400/20"
              : "bg-slate-50/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 hover:bg-slate-100/60"
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-400">Remediated</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {impact.summary.fixedCount}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Fixed by this PR</p>
        </button>

        {/* Baseline Debt */}
        <button
          type="button"
          onClick={() => setActiveTab("persistent")}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            activeTab === "persistent"
              ? "bg-purple-50/70 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 ring-2 ring-purple-400/20"
              : "bg-slate-50/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 hover:bg-slate-100/60"
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-400">Baseline Debt</span>
            <Layers className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-black text-slate-800 dark:text-slate-200 mt-1">
            {impact.summary.persistentCount}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Pre-existing on target</p>
        </button>
      </div>

      {/* Tabbed Findings List */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20 text-xs space-y-3">
        {activeTab === "new_blockers" && (
          <div>
            <div className="font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center justify-between">
              <span>New Blocking Findings ({impact.newBlockers.length})</span>
              <span className="text-[10px] text-red-600 font-mono font-semibold">Must resolve before merge</span>
            </div>
            {impact.newBlockers.length > 0 ? (
              <div className="space-y-2">
                {impact.newBlockers.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => onNavigateToFinding?.(b.id)}
                    className="p-2.5 rounded-lg bg-white dark:bg-[#111827] border border-red-200 dark:border-red-900/60 hover:border-red-400 cursor-pointer transition-all flex items-center justify-between shadow-2xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-red-700 dark:text-red-400">{b.id}</span>
                        <span className="text-[10px] font-mono text-slate-400">({b.scanner})</span>
                      </div>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">{b.title}</p>
                    </div>
                    {b.fixed_version && (
                      <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                        Fix: v{b.fixed_version}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400">
                ✓ No new blocking vulnerabilities introduced by this pull request.
              </div>
            )}
          </div>
        )}

        {activeTab === "new_warnings" && (
          <div>
            <div className="font-bold text-slate-800 dark:text-slate-200 mb-2">
              New Advisory Warnings ({impact.newWarnings.length})
            </div>
            {impact.newWarnings.length > 0 ? (
              <div className="space-y-2">
                {impact.newWarnings.map((w) => (
                  <div
                    key={w.id}
                    onClick={() => onNavigateToFinding?.(w.id)}
                    className="p-2.5 rounded-lg bg-white dark:bg-[#111827] border border-amber-200 dark:border-amber-900/60 hover:border-amber-400 cursor-pointer transition-all flex items-center justify-between shadow-2xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{w.id}</span>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">{w.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400">
                ✓ No new advisory warnings introduced by this pull request.
              </div>
            )}
          </div>
        )}

        {activeTab === "fixed" && (
          <div>
            <div className="font-bold text-slate-800 dark:text-slate-200 mb-2">
              Findings Remediated by this PR ({impact.fixedFindings.length})
            </div>
            {impact.fixedFindings.length > 0 ? (
              <div className="space-y-2">
                {impact.fixedFindings.map((f) => (
                  <div
                    key={f.id}
                    className="p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300">{f.id}</span>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300">{f.title}</p>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold">Resolved ✓</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400">
                No baseline findings resolved in this pull request comparison.
              </div>
            )}
          </div>
        )}

        {activeTab === "persistent" && (
          <div>
            <div className="font-bold text-slate-800 dark:text-slate-200 mb-2">
              Pre-existing Baseline Debt ({impact.summary.persistentCount})
            </div>
            {impact.persistentBlockers.length > 0 || impact.persistentWarnings.length > 0 ? (
              <div className="space-y-2">
                {[...impact.persistentBlockers, ...impact.persistentWarnings].map((p) => (
                  <div
                    key={p.id}
                    onClick={() => onNavigateToFinding?.(p.id)}
                    className="p-2.5 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-slate-400 flex items-center justify-between shadow-2xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{p.id}</span>
                      <p className="text-[11px] text-slate-500">{p.title}</p>
                    </div>
                    <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 px-2 py-0.5 rounded">
                      Pre-existing
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400">
                Zero pre-existing baseline vulnerabilities on target branch.
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI PR Security Review Draft Modal */}
      <ContextualAIPanel
        isOpen={isAiReviewOpen}
        onClose={() => setIsAiReviewOpen(false)}
        action="draft_pr_review"
        title="AI Pull Request Security Review Draft"
        subtitle="Concise, developer-friendly PR review comment grounded in delta findings"
        prImpact={impact}
      />
    </div>
  );
}


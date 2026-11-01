"use client";

import React, { useState } from "react";
import { EvaluationResult, ProcessedFinding, LiveRunInfo } from "@/types/dashboard";
import { VerdictBanner } from "../VerdictBanner";
import { CiGateEvidenceDrawer } from "../CiGateEvidenceDrawer";
import { KpiCards } from "../KpiCards";
import { PrImpactCard } from "../PrImpactCard";
import { SeverityBadge } from "../SeverityBadge";
import { ScannerBadge } from "../ScannerBadge";
import { ContextualAIPanel } from "../common/ContextualAIPanel";
import {
  Activity,
  ChevronRight,
  ShieldAlert,
  SlidersHorizontal,
  CheckCircle2,
  FileCode2,
  Package,
  ShieldCheck,
  Radio,
  ArrowRight,
  AlertCircle,
  TrendingUp,
  Cpu,
  Layers,
} from "lucide-react";

interface OverviewViewProps {
  report: EvaluationResult;
  allFindings: ProcessedFinding[];
  activeReportKey: string;
  onSelectSample: (key: string) => void;
  sampleKeys: Array<{ key: string; label: string; tag: string }>;
  isDemoActive: boolean;
  onNavigateToFindings: (categoryFilter?: string, severityFilter?: string) => void;
  onSelectFinding: (finding: ProcessedFinding) => void;
  liveRunInfo?: LiveRunInfo | null;
}

export function OverviewView({
  report,
  allFindings,
  activeReportKey,
  onSelectSample,
  sampleKeys,
  isDemoActive,
  onNavigateToFindings,
  onSelectFinding,
  liveRunInfo,
}: OverviewViewProps) {
  const [aiExplainOpen, setAiExplainOpen] = useState(false);
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState(false);

  const summary = report.summary || {
    total_findings: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    exempted: 0,
    blocking_count: 0,
    warning_count: 0,
  };

  const blockingFindings = allFindings.filter((f) => f.gateCategory === "blocking");
  const warningFindings = allFindings.filter((f) => f.gateCategory === "warning");

  const getScannerStatus = (scannerId: string) => {
    return (report.scanner_status || {})[scannerId] || "COMPLETED";
  };

  const severityItems = [
    {
      id: "CRITICAL",
      label: "Critical",
      count: summary.critical,
      color: "bg-red-600 hover:bg-red-500",
      text: "text-red-700 dark:text-red-300",
      bg: "bg-red-50/70 dark:bg-red-950/40 border-red-200/80 dark:border-red-900/60",
      badge: "Blocks Gate",
    },
    {
      id: "HIGH",
      label: "High",
      count: summary.high,
      color: "bg-orange-500 hover:bg-orange-400",
      text: "text-orange-700 dark:text-orange-300",
      bg: "bg-orange-50/70 dark:bg-orange-950/40 border-orange-200/80 dark:border-orange-900/60",
      badge: "Blocks Gate",
    },
    {
      id: "MEDIUM",
      label: "Medium",
      count: summary.medium,
      color: "bg-amber-500 hover:bg-amber-400",
      text: "text-amber-700 dark:text-amber-300",
      bg: "bg-amber-50/70 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-900/60",
      badge: "Review",
    },
    {
      id: "LOW",
      label: "Low",
      count: summary.low,
      color: "bg-emerald-500 hover:bg-emerald-400",
      text: "text-emerald-700 dark:text-emerald-300",
      bg: "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-900/60",
      badge: "Advisory",
    },
    {
      id: "INFO",
      label: "Info",
      count: summary.info,
      color: "bg-slate-400 hover:bg-slate-300",
      text: "text-slate-700 dark:text-slate-400",
      bg: "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700",
      badge: "Notice",
    },
  ];

  const totalWeighted = summary.total_findings || 0;

  // Scanner statuses
  const trivyStatus = getScannerStatus("trivy");
  const semgrepStatus = getScannerStatus("semgrep");
  const depReviewStatus = getScannerStatus("dependency_review");

  return (
    <div className="space-y-6">
      {/* Executive Overview Header & Scenario Switcher Card */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors p-5 sm:p-6">
        {/* Top Tier: Title, Provenance Badges, and Executive Telemetry Chips */}
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5 pb-5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-start sm:items-center space-x-3.5 min-w-0">
            <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800 shadow-2xs shrink-0">
              <Activity className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap font-heading">
                  Security Operations Overview
                </h1>
                {isDemoActive ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shrink-0">
                    <Radio className="w-3 h-3 text-amber-500 animate-pulse" />
                    SYNTHETIC DEMO
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    LIVE CI DATA
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Continuous automated security verification, gatekeeper policy enforcement, and scanner telemetry across CI/CD workflows.
              </p>
            </div>
          </div>

          {/* Right Status Metadata: Balanced Telemetry Strip */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono self-start xl:self-center shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 shadow-2xs">
              <span className="text-slate-400">Target:</span>
              <strong className="text-slate-900 dark:text-slate-100 font-semibold">{report.branch || "main"}</strong>
              <span className="text-slate-400 font-normal">({report.commit_sha ? report.commit_sha.slice(0, 7) : "HEAD"})</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 shadow-2xs">
              <span className="text-slate-400">Profile:</span>
              <span className="text-teal-700 dark:text-teal-300 font-bold">Strict Gatekeeper</span>
            </div>

            {liveRunInfo && !isDemoActive ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300/80 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Run: <strong>#{liveRunInfo.run.id}</strong></span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-teal-500" />
                <span>Scanners: <strong>3/3 Active</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Tier: Evaluation Scenario Switcher Bar */}
        <div className="pt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-slate-600 dark:text-slate-400 tracking-tight shrink-0">
            <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>Evaluation Scenarios:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
            {liveRunInfo && (
              <button
                type="button"
                onClick={() => onSelectSample("live")}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  activeReportKey === "live"
                    ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs font-bold ring-1 ring-emerald-300 dark:ring-emerald-800"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    activeReportKey === "live" ? "bg-emerald-500 animate-pulse" : "bg-emerald-400"
                  }`}
                />
                <span>Live CI Run #{liveRunInfo.run.id}</span>
              </button>
            )}
            {sampleKeys.map((s) => {
              const isSelected = activeReportKey === s.key;
              const cleanLabel = s.label.replace(/^Demo:\s*/, "");
              const dotColor =
                s.tag === "PASS"
                  ? "bg-emerald-500"
                  : s.tag === "WARN"
                  ? "bg-amber-500"
                  : s.tag === "ERROR"
                  ? "bg-rose-500"
                  : "bg-red-500";

              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => onSelectSample(s.key)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                    isSelected
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-bold ring-1 ring-slate-300 dark:ring-slate-700"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                  <span>{cleanLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Primary Verdict Hero Banner */}
      <VerdictBanner
        report={report}
        isDemoActive={isDemoActive}
        onNavigateToBlockers={() => onNavigateToFindings("blocking")}
        onExplainVerdict={() => setAiExplainOpen(true)}
        onViewGateEvidence={() => setEvidenceDrawerOpen(true)}
      />

      {/* Compact Policy Verification & Action Required Card */}
      <div className={`p-5 rounded-2xl border shadow-xs transition-colors ${
        blockingFindings.length > 0
          ? "bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/60"
          : warningFindings.length > 0
          ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60"
          : "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {blockingFindings.length > 0 ? (
                <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
              ) : warningFindings.length > 0 ? (
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              )}
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-subheading">
                {blockingFindings.length > 0
                  ? "Action Required: Policy Gate Blockers"
                  : warningFindings.length > 0
                  ? "Advisory Review: Policy Warnings"
                  : "Gate Verification Status: All Checks Passed"}
              </h3>
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                blockingFindings.length > 0
                  ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300"
                  : warningFindings.length > 0
                  ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                  : "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
              }`}>
                {blockingFindings.length > 0
                  ? `${blockingFindings.length} BLOCKERS`
                  : warningFindings.length > 0
                  ? `${warningFindings.length} WARNINGS`
                  : "ALL CHECKS SATISFIED"}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {blockingFindings.length > 0
                ? `${blockingFindings.length} blocking security violation(s) violate repository policy thresholds. These must be remediated or waived before pull request merge.`
                : warningFindings.length > 0
                ? `${warningFindings.length} non-blocking advisory finding(s) detected. Gate is allowed to pass, but remediation is recommended.`
                : "No blocking violations or advisory warnings. All automated security checks satisfy configured repository policy thresholds. Gate evaluation cleared for pull request merge."}
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEvidenceDrawerOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5 font-subheading"
            >
              <span>Gate Evidence Breakdown</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            {blockingFindings.length > 0 ? (
              <button
                type="button"
                onClick={() => onNavigateToFindings("blocking")}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <span>Triage {blockingFindings.length} Blockers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigateToFindings("ALL")}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                <span>Explore Findings Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Top Attention Items Preview */}
        {blockingFindings.length > 0 && (
          <div className="mt-4 pt-3 border-t border-red-200/60 dark:border-red-900/40 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {blockingFindings.slice(0, 3).map((f) => (
              <div
                key={f.id}
                onClick={() => onSelectFinding(f)}
                className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-red-200/80 dark:border-red-900/60 hover:border-red-400 cursor-pointer transition-all space-y-1 shadow-2xs"
              >
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="font-bold text-red-700 dark:text-red-400 truncate max-w-[150px]">{f.id}</span>
                  <span className="text-slate-400">{f.scanner}</span>
                </div>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium truncate">{f.title}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PR Impact & Change Intelligence Card */}
      <PrImpactCard
        currentReport={report}
        onNavigateToFinding={(findingId) => {
          const finding = allFindings.find((f) => f.id === findingId);
          if (finding) onSelectFinding(finding);
        }}
      />

      {/* KPI Cards */}
      <KpiCards
        summary={summary}
        onSelectCategory={(cat) => onNavigateToFindings(cat)}
      />

      {/* Main Grid: Severity Spectrum & Scanner Coverage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Severity Distribution & Priority Blocking Issues */}
        <div className="lg:col-span-7 space-y-6">
          {/* Interactive Severity Spectrum Breakdown Panel */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs transition-colors">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <SlidersHorizontal className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 font-subheading">
                  Severity Spectrum & Distribution
                </h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {summary.total_findings} total findings
              </span>
            </div>

            {/* Visual Multi-Segment Distribution Bar */}
            {totalWeighted > 0 ? (
              <div className="mt-4 space-y-4">
                <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner p-0.5 gap-0.5">
                  {severityItems.map((s) => {
                    if (s.count === 0) return null;
                    const percent = Math.round((s.count / totalWeighted) * 100);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onNavigateToFindings(undefined, s.id)}
                        className={`${s.color} h-full rounded-sm transition-all cursor-pointer hover:opacity-90 relative group`}
                        style={{ width: `${(s.count / totalWeighted) * 100}%` }}
                        title={`${s.label}: ${s.count} (${percent}%) - Click to filter`}
                      />
                    );
                  })}
                </div>

                {/* Severity Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
                  {severityItems.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onNavigateToFindings(undefined, s.id)}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer hover:scale-[1.02] shadow-2xs ${s.bg}`}
                      title={`Filter findings by ${s.label}`}
                    >
                      <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        {s.label}
                      </div>
                      <div className={`text-xl font-extrabold tracking-tight mt-0.5 ${s.text}`}>
                        {s.count}
                      </div>
                      <span className="inline-block text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">
                        {s.badge}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center space-y-2">
                <ShieldCheck className="w-8 h-8 text-emerald-500" />
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Clean Security Posture
                </p>
                <p>No vulnerabilities detected across evaluated severity spectrum.</p>
              </div>
            )}
          </div>

          {/* Priority Gate-Blocking Issues Section */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs transition-colors">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />
                <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 font-subheading">
                  Priority Gate-Blocking Issues ({blockingFindings.length})
                </h2>
              </div>
              {blockingFindings.length > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigateToFindings("blocking")}
                  className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer flex items-center space-x-1"
                >
                  <span>View all {blockingFindings.length}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="mt-4 space-y-2.5">
              {blockingFindings.length > 0 ? (
                blockingFindings.slice(0, 4).map((f) => (
                  <div
                    key={f.id}
                    onClick={() => onSelectFinding(f)}
                    className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer space-y-2 shadow-2xs group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 min-w-0">
                        <SeverityBadge severity={f.severity} />
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                          {f.id}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <ScannerBadge scanner={f.scanner} />
                        <span className="text-xs text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 group-hover:translate-x-0.5 transition-transform">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1 font-medium">
                      {f.title}
                    </p>
                    <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                      {f.file_path && (
                        <span className="flex items-center space-x-1 truncate max-w-[220px]">
                          <FileCode2 className="w-3 h-3 shrink-0 text-slate-400" />
                          <span className="truncate">{f.file_path}{f.line_number ? `:${f.line_number}` : ""}</span>
                        </span>
                      )}
                      {f.package_name && (
                        <span className="flex items-center space-x-1 truncate text-slate-700 dark:text-slate-300">
                          <Package className="w-3 h-3 shrink-0 text-slate-400" />
                          <span className="truncate font-semibold">{f.package_name}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center space-y-2">
                  <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    No Blocking Violations Detected
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    All findings satisfy repository gatekeeper thresholds.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Scanner Coverage & Evaluation Trend */}
        <div className="lg:col-span-5 space-y-6">
          {/* Scanner Coverage & Health Card */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4 transition-colors">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 font-subheading">
                  Automated Scanner Health & Coverage
                </h2>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                100% COVERAGE
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">Trivy Scanner</span>
                    <span className="text-[10px] text-slate-500">SCA, Containers & Exposed Secrets</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  {trivyStatus}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">Semgrep SAST</span>
                    <span className="text-[10px] text-slate-500">Semantic Static Code Analysis</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  {semgrepStatus}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">Dependency Review</span>
                    <span className="text-[10px] text-slate-500">PR Dependency Diffs & Licenses</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {depReviewStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Evaluation Trajectory */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4 transition-colors">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 font-subheading">
                  {isDemoActive ? "Synthetic Demonstration Trajectory" : "Active Ingested Run Evaluation"}
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {isDemoActive ? "Baseline Demo Progression" : "Live CI Telemetry"}
              </span>
            </div>

            {isDemoActive ? (
              <div className="space-y-3 text-xs">
                <div className="text-[11px] text-slate-500 italic pb-0.5">
                  Synthetic reference progression demonstrating evaluation verdicts across three sample PR states:
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl border border-red-200/60 dark:border-red-950 bg-red-50/20 dark:bg-red-950/20">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">1. Initial PR Check (#1)</div>
                    <div className="text-[11px] text-slate-500 font-mono">3 Blockers (CVE-2022-42966, command injection)</div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                    BLOCK
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-950 bg-amber-50/20 dark:bg-amber-950/20">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">2. Advisory Remediation (#2)</div>
                    <div className="text-[11px] text-slate-500 font-mono">0 Blockers, 1 Advisory (TLS socket review)</div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    WARN
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-950 bg-emerald-50/20 dark:bg-emerald-950/20">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">3. Verified Target Baseline</div>
                    <div className="text-[11px] text-slate-500 font-mono">0 Blockers, 0 Warnings, 100% Policy Pass</div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    PASS
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-2">
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      Run #{liveRunInfo ? liveRunInfo.run.id : "Ingested Report"}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      report.decision === "BLOCK"
                        ? "bg-red-100 text-red-700"
                        : report.decision === "WARN"
                        ? "bg-amber-100 text-amber-700"
                        : report.decision === "ERROR"
                        ? "bg-red-100 text-red-800"
                        : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {report.decision}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 font-mono space-y-1">
                    <div>Branch: {liveRunInfo ? liveRunInfo.run.head_branch : (report.branch || "Not specified")}</div>
                    <div>Commit: {liveRunInfo ? liveRunInfo.run.head_sha.slice(0, 7) : (report.commit_sha || "Not specified")}</div>
                    <div>Total findings: {report.summary?.total_findings ?? 0} ({report.summary?.blocking_count ?? 0} blocking)</div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  To view comparative deltas between runs or evaluate historical executions, navigate to the <strong>CI/CD Runs</strong> tab.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CI Gate Decision & Evidence Drawer */}
      <CiGateEvidenceDrawer
        isOpen={evidenceDrawerOpen}
        onClose={() => setEvidenceDrawerOpen(false)}
        report={report}
        allFindings={allFindings}
        onSelectFinding={onSelectFinding}
        onExplainWithAi={() => setAiExplainOpen(true)}
        isDemoActive={isDemoActive}
      />

      {/* Contextual AI Verdict Investigation Panel */}
      <ContextualAIPanel
        isOpen={aiExplainOpen}
        onClose={() => setAiExplainOpen(false)}
        action="explain_verdict"
        title="AI Security Gate Verdict Analysis"
        subtitle="Plain-language explanation of gate rules, blocking violations, and reviewer action items"
        report={report}
      />
    </div>
  );
}

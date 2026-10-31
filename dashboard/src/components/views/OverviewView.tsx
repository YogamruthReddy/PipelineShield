"use client";

import React from "react";
import { EvaluationResult, ProcessedFinding } from "@/types/dashboard";
import { VerdictBanner } from "../VerdictBanner";
import { KpiCards } from "../KpiCards";
import { SeverityBadge } from "../SeverityBadge";
import { ScannerBadge } from "../ScannerBadge";
import { ViewHeader } from "../common/ViewHeader";
import {
  Activity,
  Layers,
  ChevronRight,
  ShieldAlert,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  FileCode2,
  Package,
  ShieldCheck,
  GitCommit,
  GitBranch,
  Clock,
  Radio,
  ExternalLink,
  ArrowRight,
  Sparkles,
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
}: OverviewViewProps) {
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

  const getScannerStatusBadge = (status?: string) => {
    switch ((status || "").toUpperCase()) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            COMPLETED
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
            <XCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
            FAILED
          </span>
        );
      case "DISABLED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            DISABLED
          </span>
        );
      case "NOT_APPLICABLE":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            NOT_APPLICABLE
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            {status || "UNKNOWN"}
          </span>
        );
    }
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

  return (
    <div className="space-y-6">
      {/* Page Header with Integrated Scenario Switcher */}
      <ViewHeader
        title="Security Operations Overview"
        isPresentationTitle={true}
        editorialIntro="Continuous automated security verification and policy enforcement across CI/CD."
        description="Real-time gate verdict, scanner health coverage, severity distribution, and blocker triage."
        icon={<Activity className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
        badge={
          isDemoActive ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              <Radio className="w-3 h-3 text-amber-500 animate-pulse" />
              SYNTHETIC DEMO
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
              INGESTED RUN
            </span>
          )
        }
        actions={
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            {sampleKeys.map((s) => {
              const isSelected = activeReportKey === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => onSelectSample(s.key)}
                  className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    isSelected
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        }
      />

      {/* Primary Verdict Hero Banner */}
      <VerdictBanner
        report={report}
        isDemoActive={isDemoActive}
        onNavigateToBlockers={() => onNavigateToFindings("blocking")}
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
                <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
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
                {/* Segmented Bar with Tooltip Information */}
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
                <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
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
                    Pull request complies with all configured strict gate policies.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Automated Scanner Execution Health & Pipeline Provenance */}
        <div className="lg:col-span-5 space-y-6">
          {/* Scanner Execution Health */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs transition-colors">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  Automated Scanner Health
                </h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                CI/CD Gate
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {/* Trivy */}
              <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between shadow-2xs">
                <div className="space-y-1">
                  <div className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">trivy</span>
                    <span className="text-[10px] text-slate-400 font-sans font-normal">
                      (SCA / Secrets / IaC)
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {allFindings.filter((f) => f.scanner === "trivy").length} findings detected
                  </div>
                </div>
                {getScannerStatusBadge(report.scanner_status?.trivy)}
              </div>

              {/* Semgrep */}
              <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between shadow-2xs">
                <div className="space-y-1">
                  <div className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">semgrep</span>
                    <span className="text-[10px] text-slate-400 font-sans font-normal">
                      (SAST Static Code)
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {allFindings.filter((f) => f.scanner === "semgrep").length} findings detected
                  </div>
                </div>
                {getScannerStatusBadge(report.scanner_status?.semgrep)}
              </div>

              {/* Dependency Review */}
              <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between shadow-2xs">
                <div className="space-y-1">
                  <div className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">dependency_review</span>
                    <span className="text-[10px] text-slate-400 font-sans font-normal">
                      (Supply Chain PR Diff)
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {allFindings.filter((f) => f.scanner === "dependency_review").length} findings detected
                  </div>
                </div>
                {getScannerStatusBadge(report.scanner_status?.dependency_review)}
              </div>
            </div>
          </div>

          {/* Audit Telemetry & Provenance */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs transition-colors space-y-3">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Evaluation Telemetry</span>
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Contract v0.1.0
              </span>
            </div>

            <div className="text-xs space-y-2.5 text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Target Branch:</span>
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {report.branch || "main"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
                  <GitCommit className="w-3.5 h-3.5" />
                  <span>Commit SHA:</span>
                </span>
                <span className="font-mono text-slate-900 dark:text-slate-100 font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  {report.commit_sha ? report.commit_sha.slice(0, 7) : "N/A (Synthetic)"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Evaluated At:</span>
                </span>
                <span className="font-mono text-[11px] text-slate-900 dark:text-slate-100">
                  {report.evaluated_at ? new Date(report.evaluated_at).toLocaleString() : "2026-10-30T18:00:00Z"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500 dark:text-slate-400">Canonical Repo:</span>
                <a
                  href="https://github.com/YogamruthReddy/PipelineShield"
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-teal-600 dark:text-teal-400 hover:underline flex items-center space-x-1"
                >
                  <span>YogamruthReddy/PipelineShield</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

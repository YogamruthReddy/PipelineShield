"use client";

import React, { useState } from "react";
import { EvaluationResult } from "@/types/dashboard";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  AlertOctagon,
  Clock,
  ArrowRight,
  Copy,
  Check,
  Zap,
  Terminal,
} from "lucide-react";

interface VerdictBannerProps {
  report: EvaluationResult;
  isDemoActive?: boolean;
  onNavigateToBlockers?: () => void;
}

export function VerdictBanner({
  report,
  isDemoActive,
  onNavigateToBlockers,
}: VerdictBannerProps) {
  const [copied, setCopied] = useState(false);
  const decision = (report.decision || "BLOCK").toUpperCase();

  const handleCopySummary = () => {
    const summaryText = `PipelineShield Gate Verdict: ${decision}
Exit Code: ${decision === "PASS" || decision === "WARN" ? 0 : decision === "ERROR" ? 2 : 1}
Evaluated At: ${report.evaluated_at || new Date().toISOString()}
Target: ${report.branch || "main"} (${report.commit_sha ? report.commit_sha.slice(0, 7) : "HEAD"})
Blocking Findings: ${report.summary?.blocking_count ?? 0}
Advisory Warnings: ${report.summary?.warning_count ?? 0}
Total Findings: ${report.summary?.total_findings ?? 0}
Reasons:
${(report.reasons || []).map((r) => ` - ${r}`).join("\n")}`;

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTheme = () => {
    switch (decision) {
      case "PASS":
        return {
          glow: "from-emerald-500/10 via-transparent to-transparent",
          cardBorder: "border-emerald-200 dark:border-emerald-900/60",
          iconBorder: "border-emerald-200 dark:border-emerald-800",
          iconBg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400",
          icon: <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />,
          title: "PR Security Gate: PASSED",
          subtitle: "All automated security checks satisfy configured repository policy thresholds.",
          badgeBg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
          exitCode: "Exit Code 0",
          verdictColor: "text-emerald-700 dark:text-emerald-400",
          pulseColor: "bg-emerald-500",
          actionText: "Gate Compliant",
        };
      case "WARN":
        return {
          glow: "from-amber-500/10 via-transparent to-transparent",
          cardBorder: "border-amber-200 dark:border-amber-900/60",
          iconBorder: "border-amber-200 dark:border-amber-800",
          iconBg: "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400",
          icon: <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />,
          title: "PR Security Gate: ADVISORY WARNING",
          subtitle: "Security gate passed baseline verification with non-blocking advisory warnings.",
          badgeBg: "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800",
          exitCode: "Exit Code 0",
          verdictColor: "text-amber-700 dark:text-amber-400",
          pulseColor: "bg-amber-500",
          actionText: "Review Warnings",
        };
      case "ERROR":
        return {
          glow: "from-rose-500/10 via-transparent to-transparent",
          cardBorder: "border-rose-200 dark:border-rose-900/60",
          iconBorder: "border-rose-200 dark:border-rose-800",
          iconBg: "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400",
          icon: <AlertOctagon className="w-6 h-6 text-rose-600 dark:text-rose-400" />,
          title: "PR Security Gate: SCANNER ERROR",
          subtitle: "Fail-closed policy triggered: one or more required automated security scanners failed to execute.",
          badgeBg: "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800",
          exitCode: "Exit Code 2",
          verdictColor: "text-rose-700 dark:text-rose-400",
          pulseColor: "bg-rose-500",
          actionText: "Diagnose Scanners",
        };
      default: // BLOCK
        return {
          glow: "from-red-500/10 via-transparent to-transparent",
          cardBorder: "border-red-200 dark:border-red-900/60",
          iconBorder: "border-red-200 dark:border-red-800",
          iconBg: "bg-red-50 text-red-700 dark:bg-red-950/70 dark:text-red-400",
          icon: <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-400" />,
          title: "PR Security Gate: BLOCKED",
          subtitle: "Pull request gatekeeper failed: critical or high severity security findings violate repository policy.",
          badgeBg: "bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border-red-300 dark:border-red-800",
          exitCode: "Exit Code 1",
          verdictColor: "text-red-700 dark:text-red-400",
          pulseColor: "bg-red-500",
          actionText: `Triage ${report.summary?.blocking_count ?? 0} Blockers`,
        };
    }
  };

  const theme = getTheme();
  const reasons = report.reasons || [];
  const blockingCount = report.summary?.blocking_count ?? 0;

  return (
    <div
      className={`relative overflow-hidden bg-white dark:bg-[#111827] rounded-2xl p-6 sm:p-7 border ${theme.cardBorder} shadow-sm transition-all`}
      role="region"
      aria-label="Security Gate Verdict"
    >
      {/* Background Accent Glow */}
      <div
        className={`absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-gradient-to-br ${theme.glow} blur-3xl pointer-events-none`}
      />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        {/* Left Side: Verdict Shield, Title, Subtitle, Policy Violations List */}
        <div className="flex items-start space-x-4 max-w-3xl">
          <div
            className={`p-3 rounded-xl border shrink-0 relative ${theme.iconBg} ${theme.iconBorder} shadow-xs`}
          >
            {theme.icon}
            <span
              className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-[#111827] ${theme.pulseColor} animate-pulse`}
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {theme.title}
              </h2>
              <span
                className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${theme.badgeBg}`}
              >
                {theme.exitCode}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <Zap className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                <span>Strict Gatekeeper Profile</span>
              </span>
              {isDemoActive && (
                <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/60">
                  Demo
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
              {theme.subtitle}
            </p>

            {reasons.length > 0 && (
              <div className="mt-3.5 space-y-2">
                <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5 uppercase tracking-wider">
                  <Terminal className="w-3.5 h-3.5 text-slate-400" />
                  <span>Policy Gate Violation Log ({reasons.length})</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                  {reasons.map((r, i) => (
                    <div key={i} className="flex items-start space-x-2 text-xs font-mono text-slate-800 dark:text-slate-200">
                      <span className="text-red-500 font-bold leading-tight select-none">✕</span>
                      <span className="leading-snug break-all">{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Verdict Action Card & Executive Stats */}
        <div className="lg:w-64 shrink-0 flex flex-col justify-between pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800/80 lg:pl-6 space-y-4">
          <div className="space-y-1">
            <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">
              Policy Gate Decision
            </div>
            <div className={`text-3xl font-black tracking-tight ${theme.verdictColor}`}>
              {decision}
            </div>
            {report.evaluated_at && (
              <div className="flex items-center space-x-1.5 text-xs font-mono text-slate-500 dark:text-slate-400 pt-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{new Date(report.evaluated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2">
            {blockingCount > 0 && onNavigateToBlockers && (
              <button
                type="button"
                onClick={onNavigateToBlockers}
                className="w-full inline-flex items-center justify-center space-x-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 px-3.5 py-2.5 rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                <span>{theme.actionText}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={handleCopySummary}
              className="w-full inline-flex items-center justify-center space-x-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-2 rounded-lg transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Summary Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Audit Summary</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

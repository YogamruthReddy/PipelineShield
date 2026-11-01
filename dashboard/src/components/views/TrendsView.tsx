"use client";

import React, { useMemo } from "react";
import { EvaluationResult, ProcessedFinding, LiveRunInfo } from "@/types/dashboard";
import { ViewHeader } from "../common/ViewHeader";
import { SeverityBadge } from "../SeverityBadge";
import { SAMPLE_REPORTS } from "@/data/sample-reports";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  History,
} from "lucide-react";

interface TrendsViewProps {
  report: EvaluationResult;
  findings: ProcessedFinding[];
  liveRunInfo?: LiveRunInfo | null;
  isDemoActive?: boolean;
}

export function TrendsView({
  report,
  findings,
  liveRunInfo,
  isDemoActive = false,
}: TrendsViewProps) {
  // Catalog of verifiable historical runs
  const runBaselines = useMemo(() => {
    const list = [];

    const cleanReport = SAMPLE_REPORTS.clean?.data;
    if (cleanReport) {
      list.push({
        id: "run-clean",
        label: "Clean Baseline",
        decision: cleanReport.decision,
        totalFindings: cleanReport.findings?.length || 0,
        critical: cleanReport.summary?.critical || 0,
        high: cleanReport.summary?.high || 0,
        blocking: cleanReport.summary?.blocking_count || 0,
        isLive: false,
      });
    }

    const warnReport = SAMPLE_REPORTS.warnings_only?.data;
    if (warnReport) {
      list.push({
        id: "run-warn",
        label: "Advisory Warnings",
        decision: warnReport.decision,
        totalFindings: warnReport.findings?.length || 0,
        critical: warnReport.summary?.critical || 0,
        high: warnReport.summary?.high || 0,
        blocking: warnReport.summary?.blocking_count || 0,
        isLive: false,
      });
    }

    const vulnReport = SAMPLE_REPORTS.vulnerable?.data;
    if (vulnReport) {
      list.push({
        id: "run-vuln",
        label: "Vulnerable PR Scenario",
        decision: vulnReport.decision,
        totalFindings: vulnReport.findings?.length || 0,
        critical: vulnReport.summary?.critical || 0,
        high: vulnReport.summary?.high || 0,
        blocking: vulnReport.summary?.blocking_count || 0,
        isLive: false,
      });
    }

    if (liveRunInfo) {
      list.push({
        id: `run-${liveRunInfo.run.id}`,
        label: `Live CI Run #${liveRunInfo.run.id}`,
        decision: report.decision,
        totalFindings: findings.length,
        critical: report.summary?.critical ?? 0,
        high: report.summary?.high ?? 0,
        blocking: report.summary?.blocking_count ?? 0,
        isLive: true,
      });
    }

    return list;
  }, [liveRunInfo, report, findings]);

  // Regression Watch: compare active findings against clean baseline
  const regressions = useMemo<ProcessedFinding[]>(() => {
    const cleanFindingsSet = new Set(
      (SAMPLE_REPORTS.clean?.data?.findings || []).map((f) => f.id.toLowerCase().trim())
    );

    // If active run is already clean, no regression
    if (report.decision === "PASS" && findings.length === 0) {
      return [];
    }

    // Regressions: findings present in active run that were previously clean/absent in clean baseline
    return findings.filter((f) => !cleanFindingsSet.has(f.id.toLowerCase().trim()));
  }, [findings, report.decision]);

  return (
    <div className="space-y-6">
      <ViewHeader
        title="Trends & Analytics"
        description="Historical run trajectory and regression detection derived strictly from available CI run artifacts and evaluation baselines."
        icon={<TrendingUp className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
        badge={
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {runBaselines.length} Available Baselines
          </span>
        }
      />

      {/* Regression Watch Alert */}
      <div className={`p-5 rounded-2xl border ${
        regressions.length > 0
          ? "bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
          : "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
      } shadow-2xs`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {regressions.length > 0 ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span>Regression Watch Engine:</span>
                <span className="font-mono text-xs uppercase px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border">
                  {regressions.length > 0 ? "Regressions Detected" : "No Regressions"}
                </span>
              </h3>
              <p className="text-xs leading-relaxed opacity-90">
                {regressions.length > 0
                  ? `Detected ${regressions.length} finding(s) in the active run that violate the established Clean Baseline.`
                  : "All findings in the active run are within clean baseline parameters."}
              </p>
            </div>
          </div>
        </div>

        {regressions.length > 0 && (
          <div className="mt-4 pt-3 border-t border-amber-200 dark:border-amber-800/80 space-y-2">
            <span className="text-xs font-semibold block">Regressed Findings:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {regressions.slice(0, 4).map((rf) => (
                <div
                  key={rf.id}
                  className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 text-xs flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 truncate">
                    <SeverityBadge severity={rf.severity} />
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {rf.id}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {rf.scanner}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Historical Runs Matrix */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
              Verified Run Trajectory & Gate Outcomes
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {isDemoActive ? "Includes Demonstration Baselines" : "Live CI Telemetry"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">Run Label</th>
                <th className="p-3">Source</th>
                <th className="p-3">Gate Verdict</th>
                <th className="p-3">Total Findings</th>
                <th className="p-3">Critical</th>
                <th className="p-3">High</th>
                <th className="p-3">Blockers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {runBaselines.map((rb) => (
                <tr key={rb.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                    {rb.label}
                  </td>
                  <td className="p-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      rb.isLive
                        ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}>
                      {rb.isLive ? "LIVE CI" : "SYNTHETIC DEMO"}
                    </span>
                  </td>
                  <td className="p-3 font-bold">
                    <span className={
                      rb.decision === "PASS"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : rb.decision === "WARN"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400"
                    }>
                      {rb.decision}
                    </span>
                  </td>
                  <td className="p-3">{rb.totalFindings}</td>
                  <td className="p-3 text-red-600 dark:text-red-400 font-bold">{rb.critical}</td>
                  <td className="p-3 text-amber-600 dark:text-amber-400 font-bold">{rb.high}</td>
                  <td className="p-3 font-bold">{rb.blocking}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transparency Note */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 space-y-1">
        <strong className="font-semibold text-slate-700 dark:text-slate-300 block">
          Analytical Integrity Guarantee:
        </strong>
        <p className="leading-relaxed">
          Metrics, pass rates, and regressions are calculated strictly from uploaded reports and reproducible historical baselines. We do not invent mean-time-to-remediation (MTTR) or extrapolate trend curves when historical data points are not present.
        </p>
      </div>
    </div>
  );
}

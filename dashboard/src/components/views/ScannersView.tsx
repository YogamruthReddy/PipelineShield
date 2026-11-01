"use client";

import React from "react";
import { EvaluationResult, ProcessedFinding } from "@/types/dashboard";
import { ViewHeader } from "../common/ViewHeader";
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  ArrowRight,
  Clock,
  HelpCircle,
  ExternalLink,
} from "lucide-react";

interface ScannersViewProps {
  report: EvaluationResult;
  findings: ProcessedFinding[];
  onNavigateToScannerFindings: (scannerName: string) => void;
  isDemoActive?: boolean;
}

export function ScannersView({
  report,
  findings,
  onNavigateToScannerFindings,
  isDemoActive = false,
}: ScannersViewProps) {
  const scannerConfigs = [
    {
      id: "trivy",
      name: "Trivy Vulnerability & Config Scanner",
      role: "Software Composition Analysis (SCA), Secrets & IaC Misconfiguration",
      description:
        "Analyzes container images, filesystem packages, npm/pip manifests, and detects exposed credentials and insecure configurations.",
      blockingSeverities: ["CRITICAL", "HIGH"],
      estimatedDuration: "4.8s",
      docUrl: "https://trivy.dev",
    },
    {
      id: "semgrep",
      name: "Semgrep SAST Code Scanner",
      role: "Static Application Security Testing (SAST)",
      description:
        "Performs semantic static code analysis to detect injection vulnerabilities, unsafe deserialization, insecure crypto, and dangerous subprocess invocations.",
      blockingSeverities: ["CRITICAL", "HIGH"],
      estimatedDuration: "6.1s",
      docUrl: "https://semgrep.dev",
    },
    {
      id: "dependency_review",
      name: "GitHub Dependency Review Gatekeeper",
      role: "Pull Request Dependency Diff & License Enforcement",
      description:
        "Validates newly introduced dependency changes on PR commits against license allow/denylists and known advisory advisories.",
      blockingSeverities: ["CRITICAL", "HIGH"],
      estimatedDuration: "2.0s",
      docUrl: "https://github.com/actions/dependency-review-action",
    },
  ];

  const getScannerStatus = (scannerId: string): string => {
    if (!report.scanner_status) return "NOT_RUN";
    const status = report.scanner_status[scannerId];
    if (!status) return "NOT_RUN";
    return status;
  };

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            COMPLETED
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800">
            <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            FAILED
          </span>
        );
      case "SKIPPED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            SKIPPED
          </span>
        );
      case "DISABLED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            DISABLED
          </span>
        );
      case "NOT_APPLICABLE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            NOT_APPLICABLE (PR ONLY)
          </span>
        );
      case "NOT_RUN":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <HelpCircle className="w-3.5 h-3.5" />
            NOT RUN
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            {status}
          </span>
        );
    }
  };

  // Overall metrics
  const completedCount = scannerConfigs.filter((s) => getScannerStatus(s.id).toUpperCase() === "COMPLETED").length;
  const failedCount = scannerConfigs.filter((s) => getScannerStatus(s.id).toUpperCase() === "FAILED").length;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <ViewHeader
        title="Automated Scanner Pipeline Health"
        description="Execution status, telemetry, rule coverage, and failure diagnostics across configured security analyzers."
        icon={<Activity className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
        badge={
          <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {completedCount} of {scannerConfigs.length} Scanners Active
          </span>
        }
      />

      {/* Pipeline Health Overview Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold block">Coverage Ratio</span>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {Math.round((completedCount / scannerConfigs.length) * 100)}%
          </div>
          <p className="text-xs text-slate-500">{completedCount} of {scannerConfigs.length} engines executed cleanly</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold block">Execution Failures</span>
          <div className={`text-xl font-bold font-mono ${failedCount > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
            {failedCount} Failed
          </div>
          <p className="text-xs text-slate-500">
            {failedCount > 0 ? "Engine errors trigger fail-closed ERROR policy" : "Zero scanner execution crashes"}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold block">Evaluated At</span>
          <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 truncate">
            {report.evaluated_at ? new Date(report.evaluated_at).toUTCString() : "Not available"}
          </div>
          <p className="text-xs text-slate-500">Authoritative timestamp of security gate</p>
        </div>
      </div>

      {/* Scanners Grid */}
      <div className="grid grid-cols-1 gap-5">
        {scannerConfigs.map((sc) => {
          const status = getScannerStatus(sc.id);
          const scannerFindings = findings.filter((f) => f.scanner === sc.id);
          const blockingCount = scannerFindings.filter((f) => f.gateCategory === "blocking").length;
          const warningCount = scannerFindings.filter((f) => f.gateCategory === "warning").length;
          const advisoryCount = scannerFindings.filter((f) => f.gateCategory === "advisory").length;
          const isFailed = status.toUpperCase() === "FAILED";

          return (
            <div
              key={sc.id}
              className={`bg-white dark:bg-[#111827] rounded-xl border p-5 sm:p-6 shadow-xs space-y-4 transition-colors ${
                isFailed
                  ? "border-red-300 dark:border-red-900/80 bg-red-50/20 dark:bg-red-950/10"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2.5">
                    <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 tracking-tight">
                      {sc.name}
                    </span>
                    <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                      {sc.id}
                    </span>
                  </div>
                  <div className="text-xs text-teal-700 dark:text-teal-400 font-medium">
                    {sc.role}
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  {getStatusBadge(status)}
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {sc.description}
              </p>

              {/* Failure Reason Diagnostic Alert if FAILED */}
              {isFailed && (
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/80 text-xs text-red-900 dark:text-red-200 space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4 text-red-600" />
                    <span>Scanner Execution Failure Diagnostics</span>
                  </div>
                  <p className="leading-relaxed">
                    The {sc.name} job failed during execution or returned a non-zero exit code. Under strict policy enforcement, scanner crashes prevent definitive gate authorization and result in an immediate fail-closed <strong>ERROR</strong> verdict.
                  </p>
                  <div className="font-mono text-[11px] bg-white dark:bg-slate-900 p-2.5 rounded border border-red-200 dark:border-red-900/80">
                    Exit Code: 2 | Error: Analyzer subprocess timed out or crashed during scan
                  </div>
                </div>
              )}

              {/* Telemetry Metrics & Findings Count */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs font-mono">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Findings</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {scannerFindings.length}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Blocking Issues</span>
                  <span className={`text-sm font-bold ${blockingCount > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {blockingCount}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Advisory / Warn</span>
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                    {warningCount + advisoryCount}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Execution Time</span>
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{isDemoActive ? `${sc.estimatedDuration} (benchmark)` : "Not available in report"}</span>
                  </span>
                </div>
              </div>

              {/* Actions & Links */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                <a
                  href={sc.docUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1 font-medium"
                >
                  <span>Official Documentation</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <button
                  type="button"
                  onClick={() => onNavigateToScannerFindings(sc.id)}
                  className="font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Inspect {scannerFindings.length} findings</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

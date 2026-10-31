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
} from "lucide-react";

interface ScannersViewProps {
  report: EvaluationResult;
  findings: ProcessedFinding[];
  onNavigateToScannerFindings: (scannerName: string) => void;
}

export function ScannersView({
  report,
  findings,
  onNavigateToScannerFindings,
}: ScannersViewProps) {
  const scannerConfigs = [
    {
      id: "trivy",
      name: "Trivy Vulnerability & Config Scanner",
      role: "Software Composition Analysis (SCA), Secrets & IaC Misconfiguration",
      description:
        "Analyzes container images, filesystem packages, npm/pip manifests, and detects exposed credentials and insecure configurations.",
      blockingSeverities: ["CRITICAL", "HIGH"],
    },
    {
      id: "semgrep",
      name: "Semgrep SAST Code Scanner",
      role: "Static Application Security Testing (SAST)",
      description:
        "Performs semantic static code analysis to detect injection vulnerabilities, unsafe deserialization, insecure crypto, and dangerous subprocess invocations.",
      blockingSeverities: ["CRITICAL", "HIGH"],
    },
    {
      id: "dependency_review",
      name: "GitHub Dependency Review Gatekeeper",
      role: "Pull Request Dependency Diff & License Enforcement",
      description:
        "Validates newly introduced dependency changes on PR commits against license allow/denylists and known advisory advisories.",
      blockingSeverities: ["CRITICAL", "HIGH"],
    },
  ];

  const getScannerStatus = (scannerId: string) => {
    return (report.scanner_status || {})[scannerId] || "COMPLETED";
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
      case "DISABLED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            DISABLED
          </span>
        );
      case "NOT_APPLICABLE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            NOT_APPLICABLE
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

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <ViewHeader
        title="Automated Scanner Pipeline Health"
        description="Execution status, telemetry, rule coverage, and failure diagnostics across configured security analyzers."
        icon={<Activity className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
        badge={
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            3 Integrated Scanners
          </span>
        }
      />

      {/* Scanners Grid */}
      <div className="grid grid-cols-1 gap-5">
        {scannerConfigs.map((sc) => {
          const status = getScannerStatus(sc.id);
          const scannerFindings = findings.filter((f) => f.scanner === sc.id);
          const blockingCount = scannerFindings.filter((f) => f.gateCategory === "blocking").length;
          const isFailed = status === "FAILED";

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

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {sc.description}
              </p>

              {isFailed && (
                <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-900 dark:text-red-200 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5 text-red-700 dark:text-red-300 font-mono">
                    <AlertOctagon className="w-4 h-4 shrink-0" />
                    <span>Scanner Failure Condition:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Scanner process returned non-zero or failed execution. The PipelineShield security gate evaluates in a fail-closed posture, returning exit code 2 and verdict ERROR.
                  </p>
                </div>
              )}

              {/* Stats Footer */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-4">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 text-[11px]">Findings: </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      {scannerFindings.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 text-[11px]">Blocking Violations: </span>
                    <span
                      className={`font-mono font-bold ${
                        blockingCount > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {blockingCount}
                    </span>
                  </div>
                </div>

                {scannerFindings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onNavigateToScannerFindings(sc.id)}
                    className="inline-flex items-center space-x-1.5 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    <span>View {sc.id} findings</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import {
  EvaluationResult,
  ProcessedFinding,
} from "@/types/dashboard";
import { SeverityBadge } from "./SeverityBadge";
import { ScannerBadge } from "./ScannerBadge";
import {
  X,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  FileCode,
  Sliders,
  CheckCircle2,
  Lock,
  ChevronRight,
  Layers,
  Sparkles,
  HelpCircle,
} from "lucide-react";

interface CiGateEvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  report: EvaluationResult;
  allFindings: ProcessedFinding[];
  onSelectFinding?: (finding: ProcessedFinding) => void;
  onExplainWithAi?: () => void;
  isDemoActive?: boolean;
}

function getScannerStatusInfo(status?: string) {
  switch ((status || "").toUpperCase()) {
    case "COMPLETED":
      return {
        label: "COMPLETED",
        badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
        dotColor: "bg-emerald-500",
        statusText: "Scanner completed successfully and generated findings artifact.",
      };
    case "FAILED":
      return {
        label: "FAILED",
        badgeColor: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300",
        dotColor: "bg-red-500",
        statusText: "Scanner execution failed or crashed. Fail-closed policy enforces gate failure (Exit Code 2).",
      };
    case "DISABLED":
      return {
        label: "DISABLED",
        badgeColor: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400",
        dotColor: "bg-slate-400",
        statusText: "Scanner disabled in repository policy configuration.",
      };
    case "NOT_APPLICABLE":
      return {
        label: "NOT APPLICABLE",
        badgeColor: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400",
        dotColor: "bg-slate-300",
        statusText: "Check not applicable to this trigger event (e.g. push event without PR diff).",
      };
    default:
      return {
        label: "UNAVAILABLE",
        badgeColor: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
        dotColor: "bg-amber-500",
        statusText: "Scanner execution status telemetry was not captured in this report artifact.",
      };
  }
}

export function CiGateEvidenceDrawer({
  isOpen,
  onClose,
  report,
  allFindings,
  onSelectFinding,
  onExplainWithAi,
  isDemoActive = false,
}: CiGateEvidenceDrawerProps) {
  const [activeTab, setActiveTab] = useState<"evidence" | "scanners" | "policy">("evidence");

  // Keyboard escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const decision = (report.decision || "BLOCK").toUpperCase();
  const exitCode = decision === "PASS" || decision === "WARN" ? 0 : decision === "ERROR" ? 2 : 1;
  const reasons = report.reasons || [];
  const blockingFindings = allFindings.filter((f) => f.gateCategory === "blocking");
  const warningFindings = allFindings.filter((f) => f.gateCategory === "warning");

  // Safe provenance and target resolution
  const branchName = report.branch || "Branch unavailable";
  const commitShortSha = report.commit_sha ? report.commit_sha.slice(0, 7) : "Commit unavailable";
  const formattedTimestamp = report.evaluated_at
    ? new Date(report.evaluated_at).toLocaleString()
    : "Timestamp unavailable";

  const getDecisionTheme = () => {
    switch (decision) {
      case "PASS":
        return {
          bg: "bg-emerald-50 dark:bg-emerald-950/40",
          border: "border-emerald-200 dark:border-emerald-800",
          text: "text-emerald-700 dark:text-emerald-300",
          badgeBg: "bg-emerald-600 text-white",
          icon: <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
          title: "CI Security Gate: PASSED",
          subtitle: "All evaluated scanners and findings satisfy repository policy thresholds.",
        };
      case "WARN":
        return {
          bg: "bg-amber-50 dark:bg-amber-950/40",
          border: "border-amber-200 dark:border-amber-800",
          text: "text-amber-700 dark:text-amber-300",
          badgeBg: "bg-amber-500 text-white",
          icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
          title: "CI Security Gate: ADVISORY WARNING",
          subtitle: "Gate passed with non-blocking advisory warnings requiring reviewer attention.",
        };
      case "ERROR":
        return {
          bg: "bg-rose-50 dark:bg-rose-950/40",
          border: "border-rose-200 dark:border-rose-800",
          text: "text-rose-700 dark:text-rose-300",
          badgeBg: "bg-rose-600 text-white",
          icon: <AlertOctagon className="w-5 h-5 text-rose-600 dark:text-rose-400" />,
          title: "CI Security Gate: SCANNER ERROR",
          subtitle: "Fail-closed policy triggered: one or more required scanners failed to run.",
        };
      default:
        return {
          bg: "bg-red-50 dark:bg-red-950/40",
          border: "border-red-200 dark:border-red-800",
          text: "text-red-700 dark:text-red-300",
          badgeBg: "bg-red-600 text-white",
          icon: <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />,
          title: "CI Security Gate: BLOCKED",
          subtitle: "Pull request gatekeeper failed: findings exceed maximum allowed policy thresholds.",
        };
    }
  };

  const theme = getDecisionTheme();

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-drawer-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#111827] shadow-2xl flex flex-col h-full border-l border-slate-200 dark:border-slate-800 transform transition-transform"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-2.5 rounded-xl border ${theme.border} ${theme.bg} shrink-0 shadow-2xs`}>
              {theme.icon}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="evidence-drawer-title"
                  className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-heading"
                >
                  CI Gate Evidence &amp; Rule Inspector
                </h2>
                <span className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-bold ${theme.badgeBg}`}>
                  {decision}
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Exit Code {exitCode}
                </span>
                {isDemoActive ? (
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Sample Data
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Live CI Artifact
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-mono">
                <span>Branch: <strong className="text-slate-700 dark:text-slate-200">{branchName}</strong></span>
                <span>•</span>
                <span>Commit: <strong className="text-slate-700 dark:text-slate-200">{commitShortSha}</strong></span>
                <span>•</span>
                <span>Evaluated: <strong className="text-slate-700 dark:text-slate-200">{formattedTimestamp}</strong></span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close evidence inspector"
          >
            <X size={20} />
          </button>
        </div>

        {/* Gatekeeper Sovereignty Callout */}
        <div className="px-5 sm:px-6 py-3 bg-teal-50/70 dark:bg-teal-950/40 border-b border-teal-200/80 dark:border-teal-800/60 flex items-start gap-2.5 text-xs text-teal-900 dark:text-teal-200 font-body">
          <Lock size={15} className="text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Authoritative CI Result:</strong> This decision was computed deterministically by the
            PipelineShield CLI during runner execution. Session triage states or advisory AI suggestions
            cannot bypass or override this verdict.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 sm:px-6 bg-slate-50/50 dark:bg-slate-900/50 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("evidence")}
            className={`py-3 px-3 border-b-2 font-subheading transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "evidence"
                ? "border-teal-600 text-teal-700 dark:text-teal-400 font-bold"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <FileCode size={14} />
            <span>Violations &amp; Evidence ({blockingFindings.length + warningFindings.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("scanners")}
            className={`py-3 px-3 border-b-2 font-subheading transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "scanners"
                ? "border-teal-600 text-teal-700 dark:text-teal-400 font-bold"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Layers size={14} />
            <span>Scanner Fleet Telemetry</span>
          </button>
          <button
            onClick={() => setActiveTab("policy")}
            className={`py-3 px-3 border-b-2 font-subheading transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "policy"
                ? "border-teal-600 text-teal-700 dark:text-teal-400 font-bold"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Sliders size={14} />
            <span>Enforced Policy Rules</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* TAB 1: EVIDENCE & VIOLATIONS */}
          {activeTab === "evidence" && (
            <div className="space-y-6">
              {/* Special ERROR Banner if Scanner Failed */}
              {decision === "ERROR" && (
                <div className="p-4 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 text-xs space-y-1.5 font-body">
                  <p className="font-bold flex items-center gap-1.5 text-sm font-subheading">
                    <AlertOctagon size={16} className="text-rose-600" />
                    Fail-Closed Scanner Failure Triggered (Exit Code 2)
                  </p>
                  <p className="leading-relaxed">
                    One or more required automated security scanners failed during execution. Under the
                    PipelineShield fail-closed security policy, incomplete scanner coverage halts the pipeline
                    with Exit Code 2 to prevent vulnerabilities from bypassing CI uninspected.
                  </p>
                </div>
              )}

              {/* Evaluated Decision Reasons Log */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                  Policy Decision Rationale ({reasons.length})
                </span>
                <div className={`p-4 rounded-xl border ${theme.border} ${theme.bg} space-y-1.5 font-mono text-xs`}>
                  {reasons.length > 0 ? (
                    reasons.map((r, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className={`font-bold ${theme.text}`}>
                          {decision === "PASS" ? "✓" : decision === "WARN" ? "⚠" : "✕"}
                        </span>
                        <span className="leading-relaxed text-slate-800 dark:text-slate-200">{r}</span>
                      </div>
                    ))
                  ) : decision === "PASS" ? (
                    <p className="text-slate-500">0 rule violations. Security gate thresholds satisfied.</p>
                  ) : decision === "BLOCK" ? (
                    <p className="text-amber-800 dark:text-amber-300">
                      Warning: Gate decision is BLOCK (Exit Code 1), but explicit violation reasons are missing from this report payload.
                    </p>
                  ) : (
                    <p className="text-slate-500">No specific decision reasons available in this report artifact.</p>
                  )}
                </div>
              </div>

              {/* Exact Findings Triggering Block or Warning */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                    Findings Causing Gate Action ({blockingFindings.length} Blocking, {warningFindings.length} Advisory)
                  </span>
                </div>

                {blockingFindings.length === 0 && warningFindings.length === 0 ? (
                  decision === "BLOCK" ? (
                    <div className="p-5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 space-y-1.5 text-xs font-body">
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <HelpCircle size={16} className="text-amber-600" />
                        <span>Incomplete Finding Artifact Payload</span>
                      </div>
                      <p>
                        The gate evaluated to <strong>BLOCK (Exit Code 1)</strong>, but individual finding records were not
                        attached to this report artifact payload. Check scanner job artifacts in GitHub Actions.
                      </p>
                    </div>
                  ) : (
                    <div className="p-6 text-center rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 space-y-1">
                      <CheckCircle2 size={24} className="mx-auto text-emerald-600 mb-1" />
                      <p className="font-bold text-sm">Clean Gate Verification</p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        No blocking or warning findings detected in this evaluation run.
                      </p>
                    </div>
                  )
                ) : (
                  <div className="space-y-3">
                    {/* Blocking Findings First */}
                    {blockingFindings.map((finding) => (
                      <div
                        key={finding.id}
                        className="p-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-900/60 shadow-2xs space-y-2.5 hover:border-red-400 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                                BLOCKING GATE
                              </span>
                              <SeverityBadge severity={finding.severity} />
                              <ScannerBadge scanner={finding.scanner} />
                              <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                                {finding.id}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-subheading">
                              {finding.title}
                            </h4>
                          </div>

                          {onSelectFinding && (
                            <button
                              onClick={() => {
                                onSelectFinding(finding);
                                onClose();
                              }}
                              className="text-xs font-semibold text-teal-700 hover:text-teal-900 dark:text-teal-400 flex items-center gap-1 shrink-0 cursor-pointer pt-1"
                            >
                              <span>Inspect</span>
                              <ChevronRight size={13} />
                            </button>
                          )}
                        </div>

                        {/* Location & Package Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase">File Location:</span>
                            <span className="text-slate-800 dark:text-slate-200 break-all font-semibold">
                              {finding.file_path || "Location unavailable"}
                              {finding.line_number ? `:${finding.line_number}` : ""}
                            </span>
                          </div>
                          {finding.package_name && (
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase">Component:</span>
                              <span className="text-slate-800 dark:text-slate-200">
                                {finding.package_name}{" "}
                                {finding.installed_version && (
                                  <span className="text-red-600 dark:text-red-400 font-semibold">
                                    ({finding.installed_version}
                                    {finding.fixed_version ? ` → ${finding.fixed_version}` : ""})
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
                        </div>

                        {finding.remediation && (
                          <div className="text-xs text-slate-600 dark:text-slate-300 font-mono bg-slate-900 text-green-400 p-2.5 rounded-lg">
                            <span className="text-[10px] text-slate-400 block uppercase font-bold">
                              Remediation Recipe:
                            </span>
                            {finding.remediation}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Warning Findings */}
                    {warningFindings.map((finding) => (
                      <div
                        key={finding.id}
                        className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-slate-900/60 shadow-2xs space-y-2.5 hover:border-amber-400 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                ADVISORY WARN
                              </span>
                              <SeverityBadge severity={finding.severity} />
                              <ScannerBadge scanner={finding.scanner} />
                              <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                                {finding.id}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-subheading">
                              {finding.title}
                            </h4>
                          </div>

                          {onSelectFinding && (
                            <button
                              onClick={() => {
                                onSelectFinding(finding);
                                onClose();
                              }}
                              className="text-xs font-semibold text-teal-700 hover:text-teal-900 dark:text-teal-400 flex items-center gap-1 shrink-0 cursor-pointer pt-1"
                            >
                              <span>Inspect</span>
                              <ChevronRight size={13} />
                            </button>
                          )}
                        </div>

                        <div className="text-xs font-mono bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
                          <span className="text-slate-400 block text-[10px] uppercase">File Location:</span>
                          <span className="text-slate-800 dark:text-slate-200 break-all font-semibold">
                            {finding.file_path || "Location unavailable"}
                            {finding.line_number ? `:${finding.line_number}` : ""}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SCANNERS */}
          {activeTab === "scanners" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                  Scanner Fleet Execution Status
                </span>
                {isDemoActive ? (
                  <span className="text-[10px] font-mono font-bold text-indigo-700 dark:text-indigo-300">
                    Representative Telemetry
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300">
                    CI Artifact Provenance
                  </span>
                )}
              </div>

              {isDemoActive ? (
                <div className="p-3 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 text-xs text-indigo-900 dark:text-indigo-200">
                  <p>
                    <strong>Demonstration Run:</strong> The scanner statuses below illustrate telemetry capture.
                    In live pipelines, statuses are parsed directly from GitHub Actions job artifacts.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 text-xs text-emerald-900 dark:text-emerald-200">
                  <p>
                    <strong>Live Runner Artifact:</strong> Sourced directly from GitHub Actions workflow artifact
                    evaluated on commit <code className="font-mono font-bold">{commitShortSha}</code>.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                {/* Trivy */}
                {(() => {
                  const trivyStatus = getScannerStatusInfo(report.scanner_status?.["trivy"]);
                  return (
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${trivyStatus.dotColor}`} />
                          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 font-subheading">
                            Trivy — SCA &amp; Secret Detection
                          </h4>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${trivyStatus.badgeColor}`}>
                          {trivyStatus.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-body">
                        {trivyStatus.statusText}
                      </p>
                      <div className="text-xs font-mono text-slate-500 bg-slate-50 dark:bg-slate-800 p-2 rounded">
                        Evaluated Modes: vuln, secret, misconfig · Policy Fail Threshold: CRITICAL, HIGH
                      </div>
                    </div>
                  );
                })()}

                {/* Semgrep */}
                {(() => {
                  const semgrepStatus = getScannerStatusInfo(report.scanner_status?.["semgrep"]);
                  return (
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${semgrepStatus.dotColor}`} />
                          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 font-subheading">
                            Semgrep — Static Code Analysis (SAST)
                          </h4>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${semgrepStatus.badgeColor}`}>
                          {semgrepStatus.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-body">
                        {semgrepStatus.statusText}
                      </p>
                      <div className="text-xs font-mono text-slate-500 bg-slate-50 dark:bg-slate-800 p-2 rounded">
                        Rulesets: p/security-audit, p/secrets, p/owasp-top-ten · Fail on: ERROR
                      </div>
                    </div>
                  );
                })()}

                {/* GitHub Dependency Review */}
                {(() => {
                  const depStatus = getScannerStatusInfo(report.scanner_status?.["dependency_review"]);
                  return (
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${depStatus.dotColor}`} />
                          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 font-subheading">
                            GitHub Dependency Review
                          </h4>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${depStatus.badgeColor}`}>
                          {depStatus.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-body">
                        {depStatus.statusText}
                      </p>
                      <div className="text-xs font-mono text-slate-500 bg-slate-50 dark:bg-slate-800 p-2 rounded">
                        License Check: MIT, Apache-2.0, BSD · Denied: GPL-3.0, AGPL-3.0
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* TAB 3: POLICY */}
          {activeTab === "policy" && (
            <div className="space-y-5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                Enforced Policy Rules (config/policy.yaml)
              </span>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-3 text-xs font-body">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Policy Source:</span>
                  <code className="font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                    config/policy.yaml
                  </code>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Enforcement Mode:</span>
                  <span className="font-mono text-teal-700 dark:text-teal-300 font-bold uppercase">
                    strict (fail_on_block: true)
                  </span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Critical Finding Policy:</span>
                  <span className="font-mono font-bold text-red-600">BLOCK (tolerates 0)</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-700 dark:text-slate-300">High Finding Policy:</span>
                  <span className="font-mono font-bold text-red-600">BLOCK (tolerates 0)</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Medium Finding Policy:</span>
                  <span className="font-mono font-bold text-amber-600">WARN (tolerates advisory review)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Exempted Test Paths:</span>
                  <code className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                    tests/**, engine/tests/**, examples/**
                  </code>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            <span>Deterministic gate evaluation</span>
          </div>

          <div className="flex items-center gap-2">
            {onExplainWithAi && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onExplainWithAi();
                }}
                className="px-3.5 py-2 rounded-lg bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 text-teal-800 dark:text-teal-200 text-xs font-bold border border-teal-200 dark:border-teal-800 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles size={13} className="text-teal-600" />
                <span>Explain with AI Copilot (Advisory)</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

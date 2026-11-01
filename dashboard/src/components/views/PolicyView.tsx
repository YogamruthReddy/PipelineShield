"use client";

import React, { useState, useMemo } from "react";
import { EvaluationResult, ProcessedFinding } from "@/types/dashboard";
import { ViewHeader } from "../common/ViewHeader";
import {
  BookOpen,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Shield,
  Sliders,
  Sparkles,
  Info,
} from "lucide-react";

interface PolicyViewProps {
  report: EvaluationResult;
  findings?: ProcessedFinding[];
}

export function PolicyView({ report, findings = [] }: PolicyViewProps) {
  const [activeTab, setActiveTab] = useState<"rules" | "simulator">("rules");

  // In-Memory Simulator State (Strictly Read-Only, Non-Persistent)
  const [criticalTolerance, setCriticalTolerance] = useState<"BLOCK" | "WARN">("BLOCK");
  const [highTolerance, setHighTolerance] = useState<"BLOCK" | "WARN">("BLOCK");
  const [failClosedScanners, setFailClosedScanners] = useState<boolean>(true);

  const policyRules = [
    {
      id: "FAIL_ON_SEVERITY",
      title: "Strict Blocking Thresholds",
      value: "CRITICAL, HIGH",
      description:
        "Any unexempted finding classified with severity CRITICAL or HIGH results in an immediate BLOCK verdict (Exit Code 1).",
      icon: <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />,
      tag: "Enforced",
      tagColor: "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900",
    },
    {
      id: "WARN_ON_SEVERITY",
      title: "Advisory Warning Thresholds",
      value: "MEDIUM",
      description:
        "Findings with MEDIUM severity generate advisory warnings (Exit Code 0), enabling non-blocking PR reviews.",
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
      tag: "Advisory",
      tagColor: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
    },
    {
      id: "FAIL_CLOSED_SCANNERS",
      title: "Fail-Closed Scanner Protection",
      value: "true (Active)",
      description:
        "If any mandatory security scanner fails during pipeline execution, the security gate triggers an ERROR verdict (Exit Code 2).",
      icon: <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
      tag: "Fail-Closed",
      tagColor: "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900",
    },
    {
      id: "EXEMPTION_GOVERNANCE",
      title: "Policy Exemption & Waiver Engine",
      value: "GitOps Governed",
      description:
        "Rule-based waivers are version-controlled in repository workflows. Wildcard waivers and unauthenticated policy overrides are strictly prohibited.",
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      tag: "Audited",
      tagColor: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
    },
  ];

  // Compute in-memory dry-run simulated outcome
  const simulatedOutcome = useMemo(() => {
    // If scanner failed and failClosed is active
    const hasScannerFailure = Object.values(report.scanner_status || {}).some(
      (st) => st === "FAILED" || st === "ERROR"
    );
    if (hasScannerFailure && failClosedScanners) {
      return {
        decision: "ERROR" as const,
        blockingCount: 0,
        warningCount: 0,
        reasons: ["Mandatory security scanner failed (fail-closed active)."],
      };
    }

    let blockingCount = 0;
    let warningCount = 0;
    const reasons: string[] = [];

    findings.forEach((f) => {
      if (f.severity === "CRITICAL") {
        if (criticalTolerance === "BLOCK") {
          blockingCount++;
        } else {
          warningCount++;
        }
      } else if (f.severity === "HIGH") {
        if (highTolerance === "BLOCK") {
          blockingCount++;
        } else {
          warningCount++;
        }
      } else if (f.severity === "MEDIUM") {
        warningCount++;
      }
    });

    let decision: "PASS" | "WARN" | "BLOCK" = "PASS";
    if (blockingCount > 0) {
      decision = "BLOCK";
      reasons.push(`${blockingCount} finding(s) violate simulated blocking threshold.`);
    } else if (warningCount > 0) {
      decision = "WARN";
      reasons.push(`${warningCount} advisory warning(s) under simulated policy.`);
    }

    return {
      decision,
      blockingCount,
      warningCount,
      reasons,
    };
  }, [
    findings,
    report.scanner_status,
    failClosedScanners,
    criticalTolerance,
    highTolerance,
  ]);

  return (
    <div className="space-y-6">
      <ViewHeader
        title="Gatekeeper Policy Configuration"
        description="Authoritative thresholds, severity rules, scanner fail-closed posture, and dry-run policy simulation."
        icon={<BookOpen className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
        badge={
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
            <Lock className="w-3 h-3 text-slate-400" />
            GitOps Managed
          </span>
        }
        actions={
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("rules")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === "rules"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              Enforced Policy Rules
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("simulator")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                activeTab === "simulator"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Policy Simulator (Dry-Run)</span>
            </button>
          </div>
        }
      />

      {activeTab === "rules" ? (
        <div className="space-y-6">
          {/* Policy Governance Banner */}
          <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-xs text-slate-600 dark:text-slate-300 flex items-start space-x-3">
            <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                Policy As Code (GitOps Driven)
              </p>
              <p className="leading-relaxed">
                Policy definitions and severity thresholds are version-controlled in the repository configuration. Changes are reviewed through standard pull request approvals and tracked in git history.
              </p>
            </div>
          </div>

          {/* Rules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {policyRules.map((rule) => (
              <div
                key={rule.id}
                className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3 transition-colors"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-2">
                    {rule.icon}
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      {rule.title}
                    </span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${rule.tagColor}`}>
                    {rule.tag}
                  </span>
                </div>

                <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                  Threshold: {rule.value}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {rule.description}
                </p>
              </div>
            ))}
          </div>

          {/* Active Evaluation Summary */}
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs transition-colors space-y-3">
            <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Current Policy Decision Rationale
            </h3>
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-500 dark:text-slate-400">Gatekeeper Decision:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 uppercase">
                  {report.decision}
                </span>
              </div>
              {report.reasons && report.reasons.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px] block">
                    Rule violations reported:
                  </span>
                  <ul className="space-y-1">
                    {report.reasons.map((r, i) => (
                      <li key={i} className="font-mono text-[11px] text-red-600 dark:text-red-400 flex items-start space-x-1.5">
                        <span>•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Policy Simulator Tab */
        <div className="space-y-6">
          {/* Simulator Guardrail Alert */}
          <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-2xs">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-semibold block">Policy Dry-Run Simulator Note:</strong>
              <p className="leading-relaxed">
                This simulator previews gate decisions under hypothetical threshold adjustments in real-time. It <strong>never</strong> alters real repository policy, CI gate contracts, or PR check outcomes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Simulation Controls */}
            <div className="lg:col-span-6 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Adjust Simulated Policy Thresholds</span>
              </h3>

              <div className="space-y-4 text-xs">
                {/* Critical Tolerance */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                    Critical Severity Handling
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCriticalTolerance("BLOCK")}
                      className={`p-2.5 rounded-lg border font-mono text-center cursor-pointer ${
                        criticalTolerance === "BLOCK"
                          ? "bg-red-50 dark:bg-red-950/60 border-red-400 text-red-700 dark:text-red-300 font-bold"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      BLOCK (Exit 1)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCriticalTolerance("WARN")}
                      className={`p-2.5 rounded-lg border font-mono text-center cursor-pointer ${
                        criticalTolerance === "WARN"
                          ? "bg-amber-50 dark:bg-amber-950/60 border-amber-400 text-amber-700 dark:text-amber-300 font-bold"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      WARN (Advisory)
                    </button>
                  </div>
                </div>

                {/* High Tolerance */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                    High Severity Handling
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setHighTolerance("BLOCK")}
                      className={`p-2.5 rounded-lg border font-mono text-center cursor-pointer ${
                        highTolerance === "BLOCK"
                          ? "bg-red-50 dark:bg-red-950/60 border-red-400 text-red-700 dark:text-red-300 font-bold"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      BLOCK (Exit 1)
                    </button>
                    <button
                      type="button"
                      onClick={() => setHighTolerance("WARN")}
                      className={`p-2.5 rounded-lg border font-mono text-center cursor-pointer ${
                        highTolerance === "WARN"
                          ? "bg-amber-50 dark:bg-amber-950/60 border-amber-400 text-amber-700 dark:text-amber-300 font-bold"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      WARN (Advisory)
                    </button>
                  </div>
                </div>

                {/* Medium Tolerance (Fixed Advisory in Policy) */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                    Medium Severity Handling
                  </label>
                  <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-xs font-mono text-amber-700 dark:text-amber-300 font-semibold text-center">
                    WARN (Advisory — Non-Blocking Exit Code 0)
                  </div>
                </div>

                {/* Scanner Fail-Closed */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                      Fail-Closed on Scanner Outage
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Trigger ERROR (Exit 2) if scanner fails
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={failClosedScanners}
                    onChange={(e) => setFailClosedScanners(e.target.checked)}
                    className="w-4 h-4 accent-teal-600 rounded cursor-pointer"
                  />
                </div>

                {/* Waiver Governance Notice */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                  <span className="font-semibold block text-slate-700 dark:text-slate-300">
                    GitOps Waiver Policy Governance:
                  </span>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Exemption rules and waivers are version-controlled in the repository configuration and reviewed via pull requests. Ad-hoc wildcard waiver paths are strictly prohibited to maintain security posture integrity.
                  </p>
                </div>
              </div>
            </div>

            {/* Dry-Run Outcome Preview */}
            <div className="lg:col-span-6 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Simulated Verdict Comparison</span>
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-500">Real Policy Verdict</span>
                  <div className={`text-xl font-bold font-mono ${
                    report.decision === "PASS"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : report.decision === "WARN"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    {report.decision}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {report.summary?.blocking_count ?? 0} blockers
                  </span>
                </div>

                <div className={`p-4 rounded-xl border space-y-1 ${
                  simulatedOutcome.decision === "PASS"
                    ? "bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                    : simulatedOutcome.decision === "WARN"
                    ? "bg-amber-50/60 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                    : "bg-red-50/60 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200"
                }`}>
                  <span className="text-[10px] font-mono uppercase opacity-75">Simulated Verdict</span>
                  <div className="text-xl font-bold font-mono">
                    {simulatedOutcome.decision}
                  </div>
                  <span className="text-[11px] opacity-75">
                    {simulatedOutcome.blockingCount} blockers, {simulatedOutcome.warningCount} warnings
                  </span>
                </div>
              </div>

              {/* Simulation Insights */}
              <div className="p-4 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/60 text-xs text-teal-900 dark:text-teal-200 space-y-2">
                <span className="font-semibold block">Simulation Impact Analysis:</span>
                <p className="leading-relaxed">
                  {report.decision === simulatedOutcome.decision
                    ? "Simulated thresholds yield the identical gate verdict as the active repository policy."
                    : `Changing thresholds alters the PR gate outcome from ${report.decision} to ${simulatedOutcome.decision}.`}
                </p>
                {simulatedOutcome.reasons.length > 0 && (
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                    {simulatedOutcome.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Gatekeeper Sovereignty Invariant */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>Gatekeeper Sovereignty Invariant:</strong> This outcome is strictly an in-memory dry-run simulation. It has zero authority to alter the CI gate verdict or bypass blocking policy rules in GitHub Actions.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

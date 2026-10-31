"use client";

import React from "react";
import { EvaluationResult } from "@/types/dashboard";
import { ViewHeader } from "../common/ViewHeader";
import {
  BookOpen,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Shield,
} from "lucide-react";

interface PolicyViewProps {
  report: EvaluationResult;
}

export function PolicyView({ report }: PolicyViewProps) {
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
      value: "Path & CVE Rules",
      description:
        "Rule-based waivers can exempt specific CVEs, test fixtures, or vendor paths while preserving audit trail logs.",
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      tag: "Audited",
      tagColor: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <ViewHeader
        title="Gatekeeper Policy Configuration"
        description="Authoritative thresholds, severity rules, scanner fail-closed posture, and exemption governance."
        icon={<BookOpen className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
        badge={
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
            <Lock className="w-3 h-3 text-slate-400" />
            Read-Only (Git Managed)
          </span>
        }
      />

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
  );
}

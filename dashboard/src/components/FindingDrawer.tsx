"use client";

import React, { useEffect, useState } from "react";
import { ProcessedFinding } from "@/types/dashboard";
import { SeverityBadge } from "./SeverityBadge";
import { ScannerBadge } from "./ScannerBadge";
import { CopyButton } from "./common/CopyButton";
import {
  X,
  Package,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Tag,
  Wrench,
  Terminal,
  Shield,
} from "lucide-react";

interface FindingDrawerProps {
  finding: ProcessedFinding | null;
  onClose: () => void;
}

export function FindingDrawer({ finding, onClose }: FindingDrawerProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "code" | "remediation" | "policy">("overview");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (finding) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [finding, onClose]);

  if (!finding) return null;

  const getGateBadge = () => {
    switch (finding.gateCategory) {
      case "blocking":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-900/80">
            <ShieldAlert className="w-3 h-3" />
            Blocking Gate Violation
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-900/80">
            <AlertTriangle className="w-3 h-3" />
            Advisory Warning
          </span>
        );
      case "exempted":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-900/80">
            <CheckCircle2 className="w-3 h-3" />
            Policy Exempted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Informational Finding
          </span>
        );
    }
  };

  const remediationCommand =
    finding.package_name && finding.fixed_version
      ? `npm update ${finding.package_name}@${finding.fixed_version}`
      : finding.scanner === "semgrep"
      ? `semgrep --autofix --config auto`
      : null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#111827] h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 overflow-y-auto transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md z-10 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={finding.severity} />
                <ScannerBadge scanner={finding.scanner} />
                {getGateBadge()}
              </div>
              <div className="flex items-center space-x-2 pt-0.5">
                <h2
                  id="drawer-title"
                  className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 font-mono break-all"
                >
                  {finding.id}
                </h2>
                <CopyButton text={finding.id} />
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close details drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Navigation Tabs */}
          <div className="flex items-center space-x-1 border-b border-slate-100 dark:border-slate-800/80 pt-2 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`pb-2 px-3 border-b-2 transition-colors cursor-pointer ${
                activeTab === "overview"
                  ? "border-teal-600 text-teal-700 dark:text-teal-400"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("code")}
              className={`pb-2 px-3 border-b-2 transition-colors cursor-pointer ${
                activeTab === "code"
                  ? "border-teal-600 text-teal-700 dark:text-teal-400"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Code & Evidence
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("remediation")}
              className={`pb-2 px-3 border-b-2 transition-colors cursor-pointer ${
                activeTab === "remediation"
                  ? "border-teal-600 text-teal-700 dark:text-teal-400"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Remediation CLI
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("policy")}
              className={`pb-2 px-3 border-b-2 transition-colors cursor-pointer ${
                activeTab === "policy"
                  ? "border-teal-600 text-teal-700 dark:text-teal-400"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Policy Trace
            </button>
          </div>
        </div>

        {/* Drawer Content */}
        <div className="p-6 space-y-6 flex-1">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Title & Description */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                  {finding.title}
                </h3>
                <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  {finding.description || "No extended vulnerability description supplied by scanner."}
                </div>
              </div>

              {/* Package Dependency Info (if SCA) */}
              {finding.package_name && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 tracking-tight flex items-center space-x-1.5">
                    <Package className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>Vulnerable Dependency Package</span>
                  </h4>
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                        {finding.package_name}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
                      <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase block font-semibold">Installed Version</span>
                        <span className="text-slate-800 dark:text-slate-200 font-bold text-sm">
                          {finding.installed_version || "Unknown"}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase block font-semibold">Fixed In</span>
                        <span className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                          {finding.fixed_version || "Not specified"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Taxonomy & CWE Classifications */}
              {finding.cwe_ids && finding.cwe_ids.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 tracking-tight flex items-center space-x-1.5">
                    <Tag className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span>CWE Classifications</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {finding.cwe_ids.map((cwe) => (
                      <span
                        key={cwe}
                        className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      >
                        {cwe}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "code" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Target File & Line Reference
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Exact location where the static analyzer detected this vulnerability or policy issue.
                </p>
              </div>

              {finding.file_path ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="truncate text-slate-800 dark:text-slate-200 font-semibold">
                      {finding.file_path}{finding.line_number ? `:${finding.line_number}` : ""}
                    </span>
                    <CopyButton text={`${finding.file_path}${finding.line_number ? `:${finding.line_number}` : ""}`} />
                  </div>

                  {/* Simulated Code Block */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[#0B0F17] text-slate-200 p-4 font-mono text-xs overflow-x-auto shadow-inner">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px] text-slate-400">
                      <span>{finding.file_path}</span>
                      <span>Line {finding.line_number || "1"}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-slate-500 select-none">
                        {(finding.line_number ? finding.line_number - 1 : 1)} | // Source context
                      </div>
                      <div className="bg-red-950/70 text-red-200 px-1.5 py-0.5 rounded border border-red-800/80">
                        <span className="text-red-400 select-none font-bold mr-2">{finding.line_number || "1"} ▶</span>
                        <span>{finding.title}</span>
                      </div>
                      <div className="text-slate-500 select-none">
                        {(finding.line_number ? finding.line_number + 1 : 2)} | // Remediation required
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  No explicit file location specified. This finding applies to package dependencies or pipeline configuration.
                </div>
              )}
            </div>
          )}

          {activeTab === "remediation" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                  <Wrench className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Actionable Remediation Guidance</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Recommended upgrade commands and steps to satisfy repository policy thresholds.
                </p>
              </div>

              {finding.remediation ? (
                <div className="bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/60 p-4 rounded-xl text-xs space-y-3">
                  <p className="text-teal-900 dark:text-teal-200 leading-relaxed font-medium">
                    {finding.remediation}
                  </p>

                  {remediationCommand && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-mono text-teal-700 dark:text-teal-300">
                        <span className="flex items-center gap-1">
                          <Terminal className="w-3.5 h-3.5" />
                          <span>Shell upgrade command:</span>
                        </span>
                        <CopyButton text={remediationCommand} />
                      </div>
                      <code className="block bg-white dark:bg-slate-900 p-3 rounded-lg border border-teal-300 dark:border-teal-800 font-mono text-xs text-slate-900 dark:text-slate-100">
                        {remediationCommand}
                      </code>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  No automated remediation instructions provided by the scanner.
                </div>
              )}
            </div>
          )}

          {activeTab === "policy" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                  <Shield className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Gatekeeper Evaluation Decision Path</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Trace showing how this finding was evaluated by the PipelineShield security engine.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs space-y-3">
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500 dark:text-slate-400">Source Scanner:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{finding.scanner}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500 dark:text-slate-400">Finding Severity:</span>
                  <span className="font-mono font-bold">{finding.severity}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500 dark:text-slate-400">Evaluated Gate Category:</span>
                  <span className="font-mono font-bold uppercase text-red-600 dark:text-red-400">{finding.gateCategory}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500 dark:text-slate-400">Policy Waiver Applied:</span>
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">None (Active Violation)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
          <CopyButton text={JSON.stringify(finding, null, 2)} label="Copy Finding JSON" />
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-2xs"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

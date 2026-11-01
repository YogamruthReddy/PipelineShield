"use client";

import React, { useEffect, useState } from "react";
import type { ProcessedFinding, TriageStatus, TriagePriority } from "@/types/dashboard";
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
  Shield,
  ExternalLink,
  ClipboardCheck,
  Clock,
  Info,
  User,
  Flag,
  FileCode2,
  History,
  Check,
  Copy,
} from "lucide-react";

interface FindingDrawerProps {
  finding: ProcessedFinding | null;
  onClose: () => void;
  onUpdateTriage?: (
    findingId: string,
    status: TriageStatus,
    note: string,
    assignee?: string,
    priority?: TriagePriority,
    targetDate?: string
  ) => void;
}

export function FindingDrawer({ finding, onClose, onUpdateTriage }: FindingDrawerProps) {
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

  return (
    <FindingDrawerBody
      key={finding.id}
      finding={finding}
      onClose={onClose}
      onUpdateTriage={onUpdateTriage}
    />
  );
}

function FindingDrawerBody({
  finding,
  onClose,
  onUpdateTriage,
}: {
  finding: ProcessedFinding;
  onClose: () => void;
  onUpdateTriage?: (
    findingId: string,
    status: TriageStatus,
    note: string,
    assignee?: string,
    priority?: TriagePriority,
    targetDate?: string
  ) => void;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "code" | "remediation" | "policy" | "triage">("overview");

  // Triage form state initialized per finding ID
  const [triageStatus, setTriageStatus] = useState<TriageStatus>(finding.triage?.status || "unreviewed");
  const [triageAssignee, setTriageAssignee] = useState<string>(finding.triage?.assignee || "");
  const [triagePriority, setTriagePriority] = useState<TriagePriority>(
    finding.triage?.priority || (finding.severity === "CRITICAL" ? "P0" : finding.severity === "HIGH" ? "P1" : "P2")
  );
  const [triageTargetDate, setTriageTargetDate] = useState<string>(finding.triage?.targetDate || "");
  const [triageNote, setTriageNote] = useState<string>(finding.triage?.note || "");
  const [triageSavedMessage, setTriageSavedMessage] = useState<boolean>(false);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);

  const handleSaveTriage = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateTriage) {
      onUpdateTriage(
        finding.id,
        triageStatus,
        triageNote,
        triageAssignee,
        triagePriority,
        triageTargetDate
      );
      setTriageSavedMessage(true);
      setTimeout(() => setTriageSavedMessage(false), 2500);
    }
  };

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

  const getTriagePill = (status?: TriageStatus) => {
    switch (status) {
      case "in_triage":
      case "investigating":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-900/80">
            <Clock className="w-2.5 h-2.5" />
            IN TRIAGE
          </span>
        );
      case "assigned":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-900/80">
            <User className="w-2.5 h-2.5" />
            ASSIGNED
          </span>
        );
      case "remediation_in_progress":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-900/80">
            <Wrench className="w-2.5 h-2.5" />
            FIX IN PROGRESS
          </span>
        );
      case "fixed":
      case "verified_resolved":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-900/80">
            <CheckCircle2 className="w-2.5 h-2.5" />
            VERIFIED RESOLVED
          </span>
        );
      case "accepted_risk":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-900/80">
            <Shield className="w-2.5 h-2.5" />
            ACCEPTED RISK
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            UNREVIEWED
          </span>
        );
    }
  };

  const getDocumentationUrl = (): string | null => {
    const id = finding.id;
    if (id.startsWith("CVE-")) {
      return `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(id)}`;
    }
    if (id.startsWith("GHSA-")) {
      return `https://github.com/advisories/${encodeURIComponent(id)}`;
    }
    if (finding.scanner === "semgrep") {
      return `https://semgrep.dev/r?q=${encodeURIComponent(id)}`;
    }
    return null;
  };

  const docUrl = getDocumentationUrl();

  // Strict sanitization regex to prevent shell metacharacter injection in suggested CLI commands
  const SAFE_PKG_IDENTIFIER = /^[@a-zA-Z0-9._\/-]+$/;
  const isSafePackage = Boolean(finding.package_name && SAFE_PKG_IDENTIFIER.test(finding.package_name));
  const isSafeVersion = Boolean(finding.fixed_version && SAFE_PKG_IDENTIFIER.test(finding.fixed_version));

  const remediationCommand =
    isSafePackage && isSafeVersion
      ? `npm install ${finding.package_name}@${finding.fixed_version}`
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
                {getTriagePill(finding.triage?.status)}
                {finding.triage?.priority && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    <Flag className="w-2.5 h-2.5 text-red-500" />
                    {finding.triage.priority}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2 pt-0.5">
                <h2
                  id="drawer-title"
                  className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 font-mono break-all"
                >
                  {finding.id}
                </h2>
                <CopyButton text={finding.id} />
                {docUrl && (
                  <a
                    href={docUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium"
                    title="View authoritative advisory"
                  >
                    <span>Advisory</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
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
          <div className="flex items-center space-x-1 border-b border-slate-100 dark:border-slate-800/80 pt-2 text-xs font-semibold overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`pb-2 px-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
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
              className={`pb-2 px-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "code"
                  ? "border-teal-600 text-teal-700 dark:text-teal-400"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Evidence &amp; Code
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("remediation")}
              className={`pb-2 px-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "remediation"
                  ? "border-teal-600 text-teal-700 dark:text-teal-400"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Remediation Plan
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("policy")}
              className={`pb-2 px-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "policy"
                  ? "border-teal-600 text-teal-700 dark:text-teal-400"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Policy Trace
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("triage")}
              className={`pb-2 px-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "triage"
                  ? "border-teal-600 text-teal-700 dark:text-teal-400"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Ownership &amp; Triage</span>
              {finding.triage && finding.triage.status !== "unreviewed" && finding.triage.status !== "open" && (
                <span className="w-2 h-2 rounded-full bg-blue-500" />
              )}
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
                    <span>Target Dependency Package</span>
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
                          {finding.installed_version || "Not available"}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase block font-semibold">Fixed In</span>
                        <span className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                          {finding.fixed_version || "Not available"}
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
                    <span>Taxonomy &amp; CWE Classifications</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {finding.cwe_ids.map((cwe) => {
                      const cweNum = cwe.replace(/^CWE-/, "");
                      return (
                        <a
                          key={cwe}
                          href={`https://cwe.mitre.org/data/definitions/${cweNum}.html`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-teal-400 transition-colors"
                          title="Open MITRE CWE Definition"
                        >
                          <span>{cwe}</span>
                          <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "code" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Target File &amp; Static Evidence Reference
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Source code location and scanner evidence where this vulnerability was flagged.
                </p>
              </div>

              {finding.file_path ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 truncate text-slate-800 dark:text-slate-200 font-semibold">
                      <FileCode2 className="w-3.5 h-3.5 text-teal-600" />
                      <span>{finding.file_path}{finding.line_number ? `:${finding.line_number}` : ""}</span>
                    </div>
                    <CopyButton text={`${finding.file_path}${finding.line_number ? `:${finding.line_number}` : ""}`} />
                  </div>

                  {/* Simulated Code Block */}
                  <div className="rounded-xl border border-slate-800 bg-[#0B0F17] text-slate-200 p-4 font-mono text-xs overflow-x-auto shadow-inner">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px] text-slate-400">
                      <span>{finding.file_path}</span>
                      <span>Line {finding.line_number || "All lines"}</span>
                    </div>
                    <pre className="text-emerald-400">
                      <code>{finding.package_name ? `${finding.package_name}==${finding.installed_version || "unknown"}` : finding.title}</code>
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 text-center">
                  Zero file path metadata provided by detecting scanner.
                </div>
              )}
            </div>
          )}

          {activeTab === "remediation" && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                  <Wrench className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Actionable Remediation Guidance</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Step-by-step developer plan to resolve this vulnerability and satisfy CI policy gates.
                </p>
              </div>

              {/* Step 1: Upgrade Package */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 font-mono font-bold text-[10px] flex items-center justify-center">
                    1
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Apply Recommended Component Upgrade
                  </span>
                </div>
                {remediationCommand ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 text-slate-200 overflow-hidden shadow-xs">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[10px] font-mono text-slate-400">
                      <span>TERMINAL COMMAND</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(remediationCommand);
                          setCopiedCmd(true);
                          setTimeout(() => setCopiedCmd(false), 2000);
                        }}
                        className="flex items-center gap-1 hover:text-white cursor-pointer"
                      >
                        {copiedCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedCmd ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                    <pre className="p-3 text-xs font-mono text-emerald-400 overflow-x-auto">
                      <code>{remediationCommand}</code>
                    </pre>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {finding.remediation || "Consult vendor security advisory for patch details."}
                  </p>
                )}
              </div>

              {/* Step 2: Verification Check */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 font-mono font-bold text-[10px] flex items-center justify-center">
                    2
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Verify Fix Locally Before Push
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 text-xs font-mono text-slate-300">
                  <code>python -m engine.cli scan --policy strict</code>
                </div>
                <p className="text-[11px] text-slate-500">
                  Runs local policy evaluation gate to verify zero blocking violations remain.
                </p>
              </div>

              {/* Review Warning */}
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Review all package updates in your test suite before executing in production environments.</span>
              </div>
            </div>
          )}

          {activeTab === "policy" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Authoritative Policy Evaluation Trace
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Deterministic gate rule evaluation from GitHub Actions CI engine.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs space-y-2.5">
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500 dark:text-slate-400">Gate Policy Classification:</span>
                  <span className="font-mono font-bold uppercase">{finding.gateCategory}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500 dark:text-slate-400">Authoritative Severity:</span>
                  <span className="font-mono font-bold">{finding.severity}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500 dark:text-slate-400">Triggered Policy Rule:</span>
                  <span className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                    {finding.gateCategory === "blocking" ? "block_on_critical_severity (Threshold: 0)" : "advisory_warning_check"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500 dark:text-slate-400">Enforcement Mode:</span>
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                    Strict Gatekeeper Profile
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "triage" && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                  <ClipboardCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Security Ownership, Lifecycle &amp; Triage</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Assign owner, set priority, track remediation lifecycle, and record investigation rationale.
                </p>
              </div>

              {/* Authoritative Gate Boundary Disclaimer */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1 leading-relaxed">
                  <p>
                    <strong>Session-Scoped &amp; Non-Authoritative Assessment:</strong> Triage status, priority, and notes are tracked in-memory for the current review session only.
                  </p>
                  <p className="text-blue-700 dark:text-blue-300">
                    Setting a status to &ldquo;Accepted Risk&rdquo;, &ldquo;Acknowledged&rdquo;, or &ldquo;Resolved&rdquo; <strong>does NOT</strong> suppress findings, bypass security gates, or alter the authoritative CI verdict (<code className="font-mono text-[11px]">BLOCK</code> / <code className="font-mono text-[11px]">WARN</code> / <code className="font-mono text-[11px]">PASS</code>) evaluated in GitHub Actions.
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono pt-1">
                    Actor: Session Operator (Unauthenticated) · Storage: Session Memory
                  </p>
                </div>
              </div>

              {/* Triage Form */}
              <form onSubmit={handleSaveTriage} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Lifecycle Status */}
                  <div className="space-y-1.5">
                    <label htmlFor="triage-status-select" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                      Triage Lifecycle Status
                    </label>
                    <select
                      id="triage-status-select"
                      value={triageStatus}
                      onChange={(e) => setTriageStatus(e.target.value as TriageStatus)}
                      className="w-full text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-3 py-2 focus:ring-2 focus:ring-teal-500 outline-hidden cursor-pointer"
                    >
                      <option value="open">Open (Unreviewed Finding)</option>
                      <option value="acknowledged">Acknowledged (Under Investigation)</option>
                      <option value="in_triage">In Triage (Under Security Review)</option>
                      <option value="assigned">Assigned (Owner Designated)</option>
                      <option value="remediation_in_progress">Remediation In Progress</option>
                      <option value="verified_resolved">Resolved (Local Branch Assessment)</option>
                      <option value="accepted_risk">Accepted Risk (Session Note — Does NOT Suppress)</option>
                    </select>
                  </div>

                  {/* Priority */}
                  <div className="space-y-1.5">
                    <label htmlFor="triage-priority-select" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                      Remediation Priority
                    </label>
                    <select
                      id="triage-priority-select"
                      value={triagePriority}
                      onChange={(e) => setTriagePriority(e.target.value as TriagePriority)}
                      className="w-full text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-3 py-2 focus:ring-2 focus:ring-teal-500 outline-hidden cursor-pointer"
                    >
                      <option value="P0">P0 - Blocker (Immediate Fix Required)</option>
                      <option value="P1">P1 - High (Current Sprint)</option>
                      <option value="P2">P2 - Medium (Next Release)</option>
                      <option value="P3">P3 - Low (Technical Debt)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Assignee / Owner */}
                  <div className="space-y-1.5">
                    <label htmlFor="triage-assignee-input" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                      Assigned Owner / Team
                    </label>
                    <input
                      id="triage-assignee-input"
                      type="text"
                      placeholder="e.g. @devops-lead or user@company.com"
                      value={triageAssignee}
                      onChange={(e) => setTriageAssignee(e.target.value)}
                      className="w-full text-xs font-sans rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-3 py-2 focus:ring-2 focus:ring-teal-500 outline-hidden"
                    />
                  </div>

                  {/* Target Date */}
                  <div className="space-y-1.5">
                    <label htmlFor="triage-date-input" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                      Target Resolution Date
                    </label>
                    <input
                      id="triage-date-input"
                      type="date"
                      value={triageTargetDate}
                      onChange={(e) => setTriageTargetDate(e.target.value)}
                      className="w-full text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-3 py-2 focus:ring-2 focus:ring-teal-500 outline-hidden cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="triage-notes-input" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    Investigation Notes &amp; Rationale
                  </label>
                  <textarea
                    id="triage-notes-input"
                    rows={3}
                    value={triageNote}
                    onChange={(e) => setTriageNote(e.target.value)}
                    placeholder="Document root cause analysis, pull request references, or justification for risk acceptance..."
                    className="w-full text-xs font-sans rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-3 focus:ring-2 focus:ring-teal-500 outline-hidden leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    {finding.triage?.updatedAt ? (
                      <>
                        <Clock className="w-3 h-3" />
                        <span>Last updated: {new Date(finding.triage.updatedAt).toLocaleTimeString()}</span>
                      </>
                    ) : (
                      <span>Not yet triaged</span>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>Save Triage Assessment</span>
                  </button>
                </div>

                {triageSavedMessage && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5 animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Triage assessment saved to current review session (local, non-authoritative).</span>
                  </div>
                )}
              </form>

              {/* Triage Audit History */}
              {finding.triage?.history && finding.triage.history.length > 0 && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <h5 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-slate-400" />
                    <span>Triage Audit Trail ({finding.triage.history.length})</span>
                  </h5>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {finding.triage.history.map((h, i) => (
                      <div
                        key={i}
                        className="p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-[11px] flex items-center justify-between"
                      >
                        <div>
                          <span className="font-mono font-bold uppercase text-slate-800 dark:text-slate-200">{h.status}</span>
                          {h.assignee && <span className="text-slate-500 ml-1.5">→ {h.assignee}</span>}
                          {h.note && <p className="text-slate-600 dark:text-slate-400 text-[10px] mt-0.5">&ldquo;{h.note}&rdquo;</p>}
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                          {new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

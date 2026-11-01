"use client";

import React, { ChangeEvent, useRef, useState, useMemo } from "react";
import { EvaluationResult, ProcessedFinding } from "@/types/dashboard";
import { VerdictBadge } from "../VerdictBadge";
import { ViewHeader } from "../common/ViewHeader";
import { CopyButton } from "../common/CopyButton";
import { ContextualAIPanel } from "../common/ContextualAIPanel";
import {
  FileText,
  Download,
  Upload,
  Printer,
  AlertCircle,
  Database,
  Radio,
  FileSpreadsheet,
  FileJson,
  History,
  Sparkles,
} from "lucide-react";

interface ReportsViewProps {
  report: EvaluationResult;
  isDemoActive: boolean;
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  uploadError: string | null;
  customFileName: string;
  onSelectReportKey?: (key: string) => void;
  activeReportKey?: string;
}

export function ReportsView({
  report,
  isDemoActive,
  onFileUpload,
  uploadError,
  customFileName,
  onSelectReportKey,
  activeReportKey = "vulnerable",
}: ReportsViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"executive" | "json" | "markdown">("executive");
  const [aiReportBriefingOpen, setAiReportBriefingOpen] = useState(false);

  const allFindings = useMemo<ProcessedFinding[]>(() => {
    const list: ProcessedFinding[] = [];
    (report.blocking_findings || []).forEach((f) => list.push({ ...f, gateCategory: "blocking" }));
    (report.warning_findings || []).forEach((f) => list.push({ ...f, gateCategory: "warning" }));
    (report.advisory_findings || []).forEach((f) => list.push({ ...f, gateCategory: "advisory" }));
    (report.exempted_findings || []).forEach((f) => list.push({ ...f, gateCategory: "exempted" }));
    return list;
  }, [report]);

  const handleDownloadJson = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(report, null, 2)
    )}`;
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute(
      "download",
      `pipelineshield-report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleDownloadCsv = () => {
    const headers = [
      "ID",
      "Severity",
      "Scanner",
      "Gate_Category",
      "Package",
      "File_Path",
      "Line",
      "Title",
      "Remediation",
    ];
    const rows = allFindings.map((f) => [
      `"${(f.id || "").replace(/"/g, '""')}"`,
      `"${f.severity}"`,
      `"${f.scanner}"`,
      `"${f.gateCategory}"`,
      `"${(f.package_name || "").replace(/"/g, '""')}"`,
      `"${(f.file_path || "").replace(/"/g, '""')}"`,
      `"${f.line_number ?? ""}"`,
      `"${(f.title || "").replace(/"/g, '""')}"`,
      `"${(f.remediation || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      encodeURIComponent([headers.join(","), ...rows.map((r) => r.join(","))].join("\n"));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", csvContent);
    downloadAnchor.setAttribute(
      "download",
      `pipelineshield-audit-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getMarkdownContent = () => {
    const lines = [
      `# 🛡️ PipelineShield Security Assessment Report`,
      ``,
      `**Evaluated At**: \`${report.evaluated_at || new Date().toISOString()}\`  `,
      `**Decision**: **${report.decision}**  `,
      ``,
      `## Summary`,
      `- Total Findings: ${report.summary?.total_findings ?? 0}`,
      `- Blocking Violations: ${report.summary?.blocking_count ?? 0}`,
      `- Advisory Warnings: ${report.summary?.warning_count ?? 0}`,
      `- Exempted Findings: ${report.summary?.exempted ?? 0}`,
      ``,
      `## Decision Reasons`,
      ...(report.reasons || []).map((r) => `- ${r}`),
      ``,
      `## Findings Breakdown`,
      `| Severity | ID | Title | Scanner | Path |`,
      `| --- | --- | --- | --- | --- |`,
      ...allFindings.map(
        (f) =>
          `| ${f.severity} | \`${f.id}\` | ${f.title} | \`${f.scanner}\` | \`${f.file_path || "-"}\` |`
      ),
    ];
    return lines.join("\n");
  };

  const handleDownloadMarkdown = () => {
    const mdString = `data:text/markdown;charset=utf-8,${encodeURIComponent(getMarkdownContent())}`;
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", mdString);
    downloadAnchor.setAttribute(
      "download",
      `pipelineshield-summary-${new Date().toISOString().replace(/[:.]/g, "-")}.md`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handlePrintSummary = () => {
    window.print();
  };

  const historyEntries = [
    { key: "vulnerable", label: "Vulnerable PR (Initial BLOCK)", decision: "BLOCK", time: "2026-10-30" },
    { key: "warnings_only", label: "Advisory Remediation (WARN)", decision: "WARN", time: "2026-10-31" },
    { key: "clean", label: "Clean Baseline (Final PASS)", decision: "PASS", time: "2026-10-31" },
    { key: "scanner_error", label: "Scanner Crash Simulation (ERROR)", decision: "ERROR", time: "2026-10-31" },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <ViewHeader
        title="Security Audit Reports & Compliance Exports"
        isPresentationTitle={true}
        editorialIntro="Authoritative security compliance audit summaries and gatekeeper reports."
        description="Generate schema-compliant JSON evaluation summaries, CSV spreadsheets, Markdown PR annotations, and print-ready executive summaries."
        icon={<FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
        badge={<VerdictBadge decision={report.decision} size="sm" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAiReportBriefingOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-linear-to-r from-teal-500/10 to-indigo-500/10 hover:from-teal-500/20 hover:to-indigo-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30 transition-all shadow-xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-500" />
              <span>AI Scan Summary</span>
            </button>
            <button
              type="button"
              onClick={handlePrintSummary}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print / PDF</span>
            </button>
          </div>
        }
      />

      {/* Overview Metadata Card & Export Actions */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-subheading">
              Active Assessment Artifact
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Evaluated at: {report.evaluated_at ? new Date(report.evaluated_at).toUTCString() : "Not available"}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {isDemoActive ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                <Radio className="w-3 h-3 text-amber-500 animate-pulse" />
                DEMO EVALUATION
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
                <Database className="w-3 h-3 text-teal-600" />
                INGESTED: {customFileName || "Live CI Report"}
              </span>
            )}
          </div>
        </div>

        {/* Action Export Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={handleDownloadJson}
            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 transition-all text-left cursor-pointer shadow-2xs group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Download JSON
              </span>
              <FileJson className="w-4 h-4 text-teal-600" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Full evaluation report</p>
          </button>

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 transition-all text-left cursor-pointer shadow-2xs group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Download CSV
              </span>
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Tabular spreadsheet</p>
          </button>

          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 transition-all text-left cursor-pointer shadow-2xs group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Download Markdown
              </span>
              <Download className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">GitHub PR comment summary</p>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-3.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/20 hover:bg-white dark:hover:bg-slate-800 transition-all text-left cursor-pointer shadow-2xs group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Upload Custom JSON
              </span>
              <Upload className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Offline report file</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={onFileUpload}
            />
          </button>
        </div>

        {uploadError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      {/* Report History Catalog */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3 transition-colors">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">
              Report Evaluation History Catalog
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Available baselines</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {historyEntries.map((h) => {
            const isSelected = activeReportKey === h.key;
            return (
              <button
                key={h.key}
                type="button"
                onClick={() => onSelectReportKey && onSelectReportKey(h.key)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-teal-50/50 dark:bg-teal-950/40 border-teal-400 dark:border-teal-800 ring-2 ring-teal-500/20"
                    : "bg-slate-50/40 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">{h.time}</span>
                  <span className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${
                    h.decision === "BLOCK"
                      ? "bg-red-100 text-red-700"
                      : h.decision === "WARN"
                      ? "bg-amber-100 text-amber-700"
                      : h.decision === "ERROR"
                      ? "bg-red-100 text-red-800"
                      : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {h.decision}
                  </span>
                </div>
                <div className="font-semibold text-xs text-slate-800 dark:text-slate-200 mt-1 line-clamp-1">
                  {h.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Executive Summary vs Code Tabs */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab("executive")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "executive"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs border border-slate-200 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Executive Summary View
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("json")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "json"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs border border-slate-200 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              JSON Spec
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("markdown")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "markdown"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs border border-slate-200 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Markdown Spec
            </button>
          </div>

          <CopyButton
            text={activeTab === "json" ? JSON.stringify(report, null, 2) : getMarkdownContent()}
            label="Copy Spec"
          />
        </div>

        <div className="p-6">
          {activeTab === "executive" ? (
            /* Printable Executive Summary Document */
            <div className="space-y-6 max-w-3xl mx-auto font-sans text-slate-800 dark:text-slate-200">
              <div className="border-b pb-4 border-slate-200 dark:border-slate-800 flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    PipelineShield Security Operations Gatekeeper
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Continuous DevSecOps Compliance & Attestation Report
                  </p>
                </div>
                <VerdictBadge decision={report.decision} size="md" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block font-semibold">Repository</span>
                  <span className="font-bold">PipelineShield</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block font-semibold">Gate Verdict</span>
                  <span className="font-bold font-mono">{report.decision}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block font-semibold">Blocking Issues</span>
                  <span className="font-bold font-mono text-red-600">{report.summary?.blocking_count ?? 0}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block font-semibold">Total Scope</span>
                  <span className="font-bold font-mono">{report.summary?.total_findings ?? 0}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                  Evaluation Decision Attestation
                </h3>
                <ul className="text-xs space-y-1.5 list-disc pl-5 text-slate-700 dark:text-slate-300">
                  {(report.reasons || []).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                  Finding Inventory ({allFindings.length} Items)
                </h3>
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-mono uppercase text-slate-500">
                      <tr>
                        <th className="p-2.5">Severity</th>
                        <th className="p-2.5">ID</th>
                        <th className="p-2.5">Scanner</th>
                        <th className="p-2.5">Title</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {allFindings.map((f) => (
                        <tr key={f.id} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-bold font-mono">{f.severity}</td>
                          <td className="p-2.5 font-mono">{f.id}</td>
                          <td className="p-2.5 font-mono">{f.scanner}</td>
                          <td className="p-2.5">{f.title}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Generated by PipelineShield Security Gatekeeper</span>
                <span>Policy Evaluation Engine: Verified Contract Output</span>
              </div>
            </div>
          ) : activeTab === "json" ? (
            <pre className="font-mono text-xs text-slate-800 dark:text-slate-200 overflow-x-auto p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 leading-relaxed max-h-[500px]">
              {JSON.stringify(report, null, 2)}
            </pre>
          ) : (
            <pre className="font-mono text-xs text-slate-800 dark:text-slate-200 overflow-x-auto p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 leading-relaxed max-h-[500px] whitespace-pre-wrap">
              {getMarkdownContent()}
            </pre>
          )}
        </div>
      </div>

      <ContextualAIPanel
        isOpen={aiReportBriefingOpen}
        onClose={() => setAiReportBriefingOpen(false)}
        action="summarize_scan"
        title="AI Executive Scan Summary"
        subtitle={`Evaluation at ${report.evaluated_at || "Recent"}`}
        report={report}
      />
    </div>
  );
}

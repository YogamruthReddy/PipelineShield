"use client";

import React, { useState, useMemo } from "react";
import { EvaluationResult, LiveRunInfo, Finding } from "@/types/dashboard";
import { VerdictBadge } from "../VerdictBadge";
import { ViewHeader } from "../common/ViewHeader";
import { SeverityBadge } from "../SeverityBadge";
import { ScannerBadge } from "../ScannerBadge";
import { SAMPLE_REPORTS } from "@/data/sample-reports";
import { getFindingIdentityKey } from "@/lib/finding-identity";
import { ContextualAIPanel } from "../common/ContextualAIPanel";
import {
  GitBranch,
  GitCommit,
  Clock,
  CheckCircle2,
  Radio,
  Workflow,
  FolderGit2,
  ExternalLink,
  GitCompare,
  PlusCircle,
  MinusCircle,
  Equal,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

interface RunsViewProps {
  report: EvaluationResult;
  isDemoActive: boolean;
  liveRunInfo?: LiveRunInfo | null;
}

interface RunEntry {
  id: string;
  label: string;
  branch: string;
  commitSha: string;
  event: string;
  decision: "PASS" | "WARN" | "BLOCK" | "ERROR";
  findings: Finding[];
  htmlUrl?: string;
  timestamp: string;
  isLive: boolean;
}

export function RunsView({ report, isDemoActive, liveRunInfo }: RunsViewProps) {
  // Built-in run catalog combining live run (if present) and sample baseline runs
  const runCatalog = useMemo<RunEntry[]>(() => {
    const list: RunEntry[] = [];

    if (liveRunInfo) {
      list.push({
        id: `run-${liveRunInfo.run.id}`,
        label: `Live CI Run #${liveRunInfo.run.id} (${liveRunInfo.run.conclusion?.toUpperCase() || "PASS"})`,
        branch: liveRunInfo.run.head_branch,
        commitSha: liveRunInfo.run.head_sha.slice(0, 7),
        event: liveRunInfo.run.event,
        decision: report.decision,
        findings: report.findings || report.blocking_findings || [],
        htmlUrl: liveRunInfo.run.html_url,
        timestamp: liveRunInfo.fetchedAt,
        isLive: true,
      });
    }

    list.push({
      id: "run-vulnerable",
      label: "Run #1: Vulnerable PR (Initial BLOCK)",
      branch: "feat/multi-view-secops-dashboard",
      commitSha: "84cf337",
      event: "pull_request",
      decision: "BLOCK",
      findings: [
        ...SAMPLE_REPORTS.vulnerable.data.blocking_findings,
        ...SAMPLE_REPORTS.vulnerable.data.warning_findings,
        ...(SAMPLE_REPORTS.vulnerable.data.advisory_findings || []),
      ],
      timestamp: "2026-10-30T18:00:00Z",
      isLive: false,
    });

    list.push({
      id: "run-warnings",
      label: "Run #2: Advisory Remediation (WARN)",
      branch: "feat/multi-view-secops-dashboard",
      commitSha: "4fa6309",
      event: "pull_request",
      decision: "WARN",
      findings: [
        ...SAMPLE_REPORTS.warnings_only.data.warning_findings,
        ...(SAMPLE_REPORTS.warnings_only.data.advisory_findings || []),
      ],
      timestamp: "2026-10-31T12:00:00Z",
      isLive: false,
    });

    list.push({
      id: "run-clean",
      label: "Run #3: Clean Target Baseline (PASS)",
      branch: "main",
      commitSha: "ca17407",
      event: "push",
      decision: "PASS",
      findings: [],
      timestamp: "2026-10-31T18:28:00Z",
      isLive: false,
    });

    return list;
  }, [liveRunInfo, report]);

  // Comparison State
  const [baseRunId, setBaseRunId] = useState<string>("run-vulnerable");
  const [targetRunId, setTargetRunId] = useState<string>(
    liveRunInfo ? `run-${liveRunInfo.run.id}` : "run-clean"
  );
  const [comparisonTab, setComparisonTab] = useState<"all" | "new" | "fixed" | "persistent">("all");
  const [aiDiffOpen, setAiDiffOpen] = useState(false);

  const baseRun = runCatalog.find((r) => r.id === baseRunId) || runCatalog[0];
  const targetRun = runCatalog.find((r) => r.id === targetRunId) || runCatalog[runCatalog.length - 1];

  // Compute Delta Comparison using stable identities
  const comparison = useMemo(() => {
    const baseMap = new Map<string, Finding>();
    baseRun.findings.forEach((f) => baseMap.set(getFindingIdentityKey(f), f));

    const targetMap = new Map<string, Finding>();
    targetRun.findings.forEach((f) => targetMap.set(getFindingIdentityKey(f), f));

    const newFindings: Finding[] = [];
    const persistentFindings: Finding[] = [];
    const fixedFindings: Finding[] = [];

    targetRun.findings.forEach((f) => {
      const key = getFindingIdentityKey(f);
      if (baseMap.has(key)) {
        persistentFindings.push(f);
      } else {
        newFindings.push(f);
      }
    });

    baseRun.findings.forEach((f) => {
      const key = getFindingIdentityKey(f);
      if (!targetMap.has(key)) {
        fixedFindings.push(f);
      }
    });

    return {
      newFindings,
      fixedFindings,
      persistentFindings,
    };
  }, [baseRun, targetRun]);

  const getStepStatus = (scannerKey: string) => {
    if (!report.scanner_status || !(scannerKey in report.scanner_status)) {
      return "UNAVAILABLE";
    }
    return report.scanner_status[scannerKey];
  };

  const steps = [
    {
      name: "Checkout Source Code",
      status: "COMPLETED",
      duration: "1.2s",
      tool: "actions/checkout@v4",
    },
    {
      name: "Execute Trivy Scanner (SCA & Secrets)",
      status: getStepStatus("trivy"),
      duration: report.scanner_status?.trivy ? "4.8s" : "—",
      tool: "aquasecurity/trivy-action",
    },
    {
      name: "Execute Semgrep SAST Analysis",
      status: getStepStatus("semgrep"),
      duration: report.scanner_status?.semgrep ? "6.1s" : "—",
      tool: "returntocorp/semgrep-action",
    },
    {
      name: "Execute GitHub Dependency Review",
      status: getStepStatus("dependency_review"),
      duration: report.scanner_status?.dependency_review ? "2.0s" : "—",
      tool: "actions/dependency-review-action@v4",
    },
    {
      name: "PipelineShield Policy Evaluation",
      status: report.decision === "ERROR" ? "FAILED" : "COMPLETED",
      duration: "0.4s",
      tool: "pipelineshield evaluate",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <ViewHeader
        title="CI/CD Runs & Delta Comparison Workspace"
        description="Inspect execution workflow traces, examine historical CI runs, and compare security deltas between pull request commits."
        icon={<GitBranch className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
        badge={
          isDemoActive ? (
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
              <Radio className="w-3 h-3 text-amber-500 animate-pulse" />
              SYNTHETIC TELEMETRY
            </span>
          ) : (
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              LIVE CI TELEMETRY
            </span>
          )
        }
      />

      {/* CI Run Context Card */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Workflow className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 font-subheading">
              <span>GitHub Actions Workflow Run #{liveRunInfo?.run.id ?? 412}</span>
              {liveRunInfo?.run.html_url && (
                <a
                  href={liveRunInfo.run.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors inline-flex items-center"
                  title="View run on GitHub Actions"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </h2>
          </div>
          <VerdictBadge decision={report.decision} size="sm" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-400 dark:text-slate-500 text-[10px] font-mono uppercase block">Repository</span>
            <div className="font-semibold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1">
              <FolderGit2 className="w-3.5 h-3.5 text-slate-400" />
              <span>YogamruthReddy/PipelineShield</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-400 dark:text-slate-500 text-[10px] font-mono uppercase block">Branch / Event</span>
            <div className="font-mono text-slate-900 dark:text-slate-100 font-semibold truncate flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {liveRunInfo
                  ? `${liveRunInfo.run.head_branch} (${liveRunInfo.run.event})`
                  : `${report.branch || "feat/multi-view-secops-dashboard"} (pull_request)`}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-400 dark:text-slate-500 text-[10px] font-mono uppercase block">Commit SHA</span>
            <div className="font-mono text-slate-900 dark:text-slate-100 font-semibold truncate flex items-center gap-1">
              <GitCommit className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {liveRunInfo
                  ? liveRunInfo.run.head_sha.slice(0, 7)
                  : (report.commit_sha || "736bdc5")}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-400 dark:text-slate-500 text-[10px] font-mono uppercase block">
              {liveRunInfo ? "Retrieved At" : "Evaluated At"}
            </span>
            <div className="font-mono text-slate-900 dark:text-slate-100 text-[11px] truncate flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {liveRunInfo
                  ? new Date(liveRunInfo.fetchedAt).toLocaleTimeString()
                  : (report.evaluated_at ? new Date(report.evaluated_at).toLocaleTimeString() : "Recent")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Run Delta Comparison Tool */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800 gap-2">
          <div className="flex items-center space-x-2">
            <GitCompare className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-subheading">
              Run Delta & Finding Comparison Engine
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAiDiffOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-linear-to-r from-teal-500/10 to-indigo-500/10 hover:from-teal-500/20 hover:to-indigo-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30 transition-all shadow-xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-500" />
              <span>AI Summarize Diff</span>
            </button>
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">
              Diff between CI runs
            </span>
          </div>
        </div>

        {/* Cross-Source Comparison Notice if comparing Live vs Demo */}
        {baseRun.isLive !== targetRun.isLive && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Cross-Source Comparison Notice:</strong> Comparing <strong>{baseRun.isLive ? "[LIVE CI RUN]" : "[SYNTHETIC DEMO]"}</strong> ({baseRun.label}) against <strong>{targetRun.isLive ? "[LIVE CI RUN]" : "[SYNTHETIC DEMO]"}</strong> ({targetRun.label}).
              Deltas reflect changes between separate evaluation environments (live GitHub Actions vs synthetic local baselines).
            </div>
          </div>
        )}

        {/* Comparison Selector Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">
              Base Run (Baseline)
            </label>
            <select
              value={baseRunId}
              onChange={(e) => setBaseRunId(e.target.value)}
              className="w-full text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-2.5 outline-hidden focus:ring-2 focus:ring-teal-500"
            >
              {runCatalog.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.isLive ? `[LIVE CI] ${r.label}` : `[DEMO] ${r.label}`}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">
              Target Run (Comparison Target)
            </label>
            <select
              value={targetRunId}
              onChange={(e) => setTargetRunId(e.target.value)}
              className="w-full text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-2.5 outline-hidden focus:ring-2 focus:ring-teal-500"
            >
              {runCatalog.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.isLive ? `[LIVE CI] ${r.label}` : `[DEMO] ${r.label}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Delta Summary Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setComparisonTab("new")}
            className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
              comparisonTab === "new"
                ? "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800"
                : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
            }`}
          >
            <span className="text-[10px] font-mono uppercase font-semibold text-slate-500 block">New Findings</span>
            <span className="text-lg font-bold text-red-600 dark:text-red-400">
              +{comparison.newFindings.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setComparisonTab("fixed")}
            className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
              comparisonTab === "fixed"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"
                : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
            }`}
          >
            <span className="text-[10px] font-mono uppercase font-semibold text-slate-500 block">Fixed / Resolved</span>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              -{comparison.fixedFindings.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setComparisonTab("persistent")}
            className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
              comparisonTab === "persistent"
                ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800"
                : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
            }`}
          >
            <span className="text-[10px] font-mono uppercase font-semibold text-slate-500 block">Persistent Issues</span>
            <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
              ={comparison.persistentFindings.length}
            </span>
          </button>
        </div>

        {/* Delta Finding Details List */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>
              {comparisonTab === "new"
                ? "Newly Introduced Issues (In Target Run only)"
                : comparisonTab === "fixed"
                ? "Resolved Findings (Fixed in Target Run)"
                : comparisonTab === "persistent"
                ? "Persistent Issues (Unresolved across both runs)"
                : "All Comparative Finding Deltas"}
            </span>
            <span className="text-slate-400 font-mono text-[11px]">
              {comparisonTab === "new"
                ? comparison.newFindings.length
                : comparisonTab === "fixed"
                ? comparison.fixedFindings.length
                : comparison.persistentFindings.length}{" "}
              items
            </span>
          </div>

          <div className="space-y-2">
            {comparisonTab === "fixed" && comparison.fixedFindings.length > 0 && (
              comparison.fixedFindings.map((f) => (
                <div
                  key={f.id}
                  className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 text-xs flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <MinusCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="font-mono font-bold text-emerald-800 dark:text-emerald-200">{f.id}</span>
                      <SeverityBadge severity={f.severity} />
                      <ScannerBadge scanner={f.scanner} />
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 line-clamp-1">{f.title}</p>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                    RESOLVED
                  </span>
                </div>
              ))
            )}

            {comparisonTab === "new" && comparison.newFindings.length > 0 && (
              comparison.newFindings.map((f) => (
                <div
                  key={f.id}
                  className="p-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 text-xs flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <PlusCircle className="w-3.5 h-3.5 text-red-600" />
                      <span className="font-mono font-bold text-red-800 dark:text-red-200">{f.id}</span>
                      <SeverityBadge severity={f.severity} />
                      <ScannerBadge scanner={f.scanner} />
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 line-clamp-1">{f.title}</p>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-red-700 dark:text-red-300 shrink-0">
                    NEW ISSUE
                  </span>
                </div>
              ))
            )}

            {comparisonTab === "persistent" && comparison.persistentFindings.length > 0 && (
              comparison.persistentFindings.map((f) => (
                <div
                  key={f.id}
                  className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 text-xs flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Equal className="w-3.5 h-3.5 text-amber-600" />
                      <span className="font-mono font-bold text-amber-800 dark:text-amber-200">{f.id}</span>
                      <SeverityBadge severity={f.severity} />
                      <ScannerBadge scanner={f.scanner} />
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 line-clamp-1">{f.title}</p>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-amber-700 dark:text-amber-300 shrink-0">
                    PERSISTENT
                  </span>
                </div>
              ))
            )}

            {comparisonTab === "all" && (
              <div className="space-y-2">
                {comparison.fixedFindings.map((f) => (
                  <div
                    key={`fixed-${f.id}`}
                    className="p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 text-xs flex items-center justify-between"
                  >
                    <span className="font-mono font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <MinusCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{f.id} — {f.title}</span>
                    </span>
                    <span className="font-mono text-[10px] text-emerald-600 font-bold uppercase">Fixed</span>
                  </div>
                ))}
                {comparison.newFindings.map((f) => (
                  <div
                    key={`new-${f.id}`}
                    className="p-2.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/30 text-xs flex items-center justify-between"
                  >
                    <span className="font-mono font-semibold text-red-800 dark:text-red-300 flex items-center gap-1.5">
                      <PlusCircle className="w-3.5 h-3.5 text-red-600" />
                      <span>{f.id} — {f.title}</span>
                    </span>
                    <span className="font-mono text-[10px] text-red-600 font-bold uppercase">New</span>
                  </div>
                ))}
                {comparison.persistentFindings.map((f) => (
                  <div
                    key={`persist-${f.id}`}
                    className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/30 text-xs flex items-center justify-between"
                  >
                    <span className="font-mono font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <Equal className="w-3.5 h-3.5 text-amber-600" />
                      <span>{f.id} — {f.title}</span>
                    </span>
                    <span className="font-mono text-[10px] text-amber-600 font-bold uppercase">Persistent</span>
                  </div>
                ))}
                {comparison.newFindings.length === 0 &&
                  comparison.fixedFindings.length === 0 &&
                  comparison.persistentFindings.length === 0 && (
                    <div className="py-6 text-center text-xs text-slate-500">
                      No findings detected in either run. Both runs are completely clean.
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CI/CD Execution Telemetry Trace */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4 transition-colors">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2 font-subheading">
          <Workflow className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span>Security Gate Step Execution Breakdown</span>
        </h3>

        <div className="space-y-2.5">
          {steps.map((st, i) => (
            <div
              key={st.name}
              className="p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs"
            >
              <div className="flex items-center space-x-2.5">
                <span className="text-slate-400 font-mono text-[10px] w-4">{i + 1}.</span>
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                    {st.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{st.tool}</span>
                </div>
              </div>

              <div className="flex items-center space-x-3 font-mono">
                <span className="text-[11px] text-slate-500">{st.duration}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    st.status === "COMPLETED"
                      ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                      : st.status === "FAILED"
                      ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800"
                      : st.status === "DISABLED" || st.status === "NOT_APPLICABLE"
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                      : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                  }`}
                >
                  {st.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ContextualAIPanel
        isOpen={aiDiffOpen}
        onClose={() => setAiDiffOpen(false)}
        action="summarize_run_diff"
        title="AI Run Diff & Regression Analysis"
        subtitle={`Comparing ${baseRun.label} against ${targetRun.label}`}
        runDiff={{
          baseRunId: baseRun.id,
          targetRunId: targetRun.id,
          baseDecision: baseRun.decision,
          targetDecision: targetRun.decision,
          newCount: comparison.newFindings.length,
          fixedCount: comparison.fixedFindings.length,
          persistentCount: comparison.persistentFindings.length,
          newFindings: comparison.newFindings,
          fixedFindings: comparison.fixedFindings,
        }}
      />
    </div>
  );
}

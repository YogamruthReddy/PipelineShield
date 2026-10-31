"use client";

import React from "react";
import { EvaluationResult, LiveRunInfo } from "@/types/dashboard";
import { VerdictBadge } from "../VerdictBadge";
import { ViewHeader } from "../common/ViewHeader";
import {
  GitBranch,
  GitCommit,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Radio,
  Workflow,
  FolderGit2,
  ExternalLink,
} from "lucide-react";

interface RunsViewProps {
  report: EvaluationResult;
  isDemoActive: boolean;
  liveRunInfo?: LiveRunInfo | null;
}

export function RunsView({ report, isDemoActive, liveRunInfo }: RunsViewProps) {
  const steps = [
    {
      name: "Checkout Source Code",
      status: "COMPLETED",
      duration: "1.2s",
      tool: "actions/checkout@v4",
    },
    {
      name: "Execute Trivy Scanner (SCA & Secrets)",
      status: report.scanner_status?.trivy || "COMPLETED",
      duration: "4.8s",
      tool: "aquasecurity/trivy-action",
    },
    {
      name: "Execute Semgrep SAST Analysis",
      status: report.scanner_status?.semgrep || "COMPLETED",
      duration: "6.1s",
      tool: "returntocorp/semgrep-action",
    },
    {
      name: "Execute GitHub Dependency Review",
      status: report.scanner_status?.dependency_review || "NOT_APPLICABLE",
      duration: "2.0s",
      tool: "actions/dependency-review-action@v4",
    },
    {
      name: "PipelineShield Policy Evaluation",
      status: "COMPLETED",
      duration: "0.4s",
      tool: "pipelineshield evaluate",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <ViewHeader
        title="CI/CD Pipeline Telemetry & Provenance"
        description="Execution workflow traces, commit context, runner environment, and security gate evaluation lifecycle."
        icon={<GitBranch className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
        badge={
          isDemoActive ? (
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
              <Radio className="w-3 h-3 text-amber-500 animate-pulse" />
              SYNTHETIC TELEMETRY
            </span>
          ) : (
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
              INGESTED TELEMETRY
            </span>
          )
        }
      />

      {/* CI Run Context Card */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Workflow className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
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
                  : `${report.branch || "main"} (pull_request)`}
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
                  : (report.commit_sha || "f6906bc")}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-400 dark:text-slate-500 text-[10px] font-mono uppercase block">
              {liveRunInfo ? "Retrieved At" : "Triggered Timestamp"}
            </span>
            <div className="font-mono text-slate-900 dark:text-slate-100 text-[11px] truncate flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {liveRunInfo
                  ? new Date(liveRunInfo.fetchedAt).toLocaleTimeString()
                  : (report.evaluated_at || "2026-10-30T18:00:00Z")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Execution Timeline Steps */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4 transition-colors">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Security Gate Pipeline Execution Steps
        </h3>

        <div className="space-y-2.5">
          {steps.map((step, idx) => {
            const isFailed = step.status === "FAILED";
            const isCompleted = step.status === "COMPLETED";

            return (
              <div
                key={idx}
                className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-3">
                  <span className="font-mono text-slate-400 font-bold">{idx + 1}.</span>
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                      {step.name}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400 block">
                      {step.tool}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <span className="font-mono text-slate-400 text-[11px]">{step.duration}</span>
                  {isCompleted && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      SUCCESS
                    </span>
                  )}
                  {isFailed && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300">
                      <ShieldAlert className="w-3 h-3 text-red-600" />
                      FAILED
                    </span>
                  )}
                  {!isCompleted && !isFailed && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">
                      {step.status}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

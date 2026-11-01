"use client";

import React, { useState, useEffect } from "react";
import type { Finding, ProcessedFinding, EvaluationResult, LocalAIAction, LocalAIResponse, LocalAIStatus } from "@/types/dashboard";
import type { PrImpactAnalysis } from "@/lib/pr-impact";
import { AIResponseRenderer } from "./AIResponseRenderer";
import {
  Sparkles,
  X,
  RefreshCw,
  Cpu,
  AlertTriangle,
  ShieldCheck,
  Copy,
  Check,
} from "lucide-react";

export interface ContextualAIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  action: LocalAIAction;
  title: string;
  subtitle?: string;
  finding?: Finding | ProcessedFinding | null;
  report?: EvaluationResult | null;
  runDiff?: Record<string, unknown> | null;
  prImpact?: PrImpactAnalysis | Record<string, unknown> | null;
  codeDiff?: string;
  codeSnippet?: string;
  selectedLineRange?: [number, number];
  baseContent?: string;
  filePath?: string;
  prNumber?: number;
  repoFullName?: string;
  customQuery?: string;
}

interface ModalContentProps {
  onClose: () => void;
  action: LocalAIAction;
  title: string;
  subtitle?: string;
  finding?: Finding | ProcessedFinding | null;
  report?: EvaluationResult | null;
  runDiff?: Record<string, unknown> | null;
  prImpact?: PrImpactAnalysis | Record<string, unknown> | null;
  codeDiff?: string;
  codeSnippet?: string;
  selectedLineRange?: [number, number];
  baseContent?: string;
  filePath?: string;
  prNumber?: number;
  repoFullName?: string;
  customQuery?: string;
}

function ContextualAIModalContent({
  onClose,
  action,
  title,
  subtitle,
  finding,
  report,
  runDiff,
  prImpact,
  codeDiff,
  codeSnippet,
  selectedLineRange,
  baseContent,
  filePath,
  prNumber,
  repoFullName,
  customQuery,
}: ModalContentProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [response, setResponse] = useState<LocalAIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<LocalAIStatus | null>(null);
  const [copied, setCopied] = useState(false);

  // Execute action on mount
  useEffect(() => {
    let isMounted = true;

    async function runAction() {
      try {
        // First check runtime status
        const statusRes = await fetch("/api/local-ai");
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (isMounted) setRuntimeStatus(statusData);
        }

        // Build request body
        const payload: Record<string, unknown> = {
          action,
          responseLength: "balanced",
        };

        if (finding) payload.finding = finding;
        if (report) {
          payload.reportSummary = {
            decision: report.decision,
            branch: report.branch,
            commit_sha: report.commit_sha,
            summary: report.summary,
            reasons: report.reasons,
            scanner_status: report.scanner_status,
          };
        }
        if (runDiff) payload.runDiff = runDiff;
        if (prImpact) payload.prImpact = prImpact;
        if (codeDiff) payload.codeDiff = codeDiff;
        if (codeSnippet) payload.codeSnippet = codeSnippet;
        if (selectedLineRange) payload.selectedLineRange = selectedLineRange;
        if (baseContent) payload.baseContent = baseContent;
        if (filePath) payload.filePath = filePath;
        if (prNumber) payload.prNumber = prNumber;
        if (repoFullName) payload.repoFullName = repoFullName;
        if (customQuery) payload.customQuery = customQuery;

        const res = await fetch("/api/local-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!isMounted) return;

        if (res.ok && data.success) {
          setResponse(data);
        } else {
          setError(data.error || "Local AI execution failed.");
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Network error contacting local AI endpoint.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    runAction();

    return () => {
      isMounted = false;
    };
  }, [action, finding, report, runDiff, prImpact, codeDiff, codeSnippet, selectedLineRange, baseContent, filePath, prNumber, repoFullName, customQuery]);

  const handleCopy = () => {
    if (!response?.response) return;
    navigator.clipboard.writeText(response.response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const patchValidation = response?.patchValidation as {
    appliesCleanly?: boolean;
    isValidDiff?: boolean;
    addedLinesCount?: number;
    removedLinesCount?: number;
    failureReason?: string;
  } | undefined;

  return (
    <div
      className="bg-white dark:bg-[#111827] w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-modal-title"
    >
      {/* Modal Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/50">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </span>
            <h2 id="ai-modal-title" className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 font-sans">
              {title}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              Advisory Only
            </span>
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 font-sans pl-8">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {runtimeStatus && (
            <span
              className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                runtimeStatus.available
                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                  : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
              }`}
            >
              <Cpu className="w-3 h-3" />
              {runtimeStatus.available ? "Ollama Online" : "Ollama Offline"}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal Body */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
        {isLoading ? (
          <div className="py-14 flex flex-col items-center justify-center text-center space-y-3">
            <RefreshCw size={28} className="text-teal-600 animate-spin" />
            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              Generating grounded analysis via local model...
            </p>
            <p className="text-xs text-slate-500 max-w-md">
              Inference runs locally on your CPU/GPU with strict delimiter isolation and token sanitization.
            </p>
          </div>
        ) : error ? (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-5 text-xs text-amber-900 dark:text-amber-200 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Local AI Runtime Unavailable</span>
            </div>
            <p className="leading-relaxed font-sans">{error}</p>
            <div className="p-3 bg-white/80 dark:bg-slate-900 rounded-lg border border-amber-200/80 dark:border-amber-800 font-mono text-[11px] space-y-1">
              <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                How to start your local Ollama runtime:
              </div>
              <div className="text-emerald-700 dark:text-emerald-300">1. ollama serve</div>
              <div className="text-emerald-700 dark:text-emerald-300">2. ollama pull qwen2.5:3b</div>
            </div>
          </div>
        ) : response ? (
          <div className="space-y-4">
            {patchValidation && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-2.5 ${
                  patchValidation.appliesCleanly
                    ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                    : patchValidation.isValidDiff
                    ? "bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                    : "bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200"
                }`}
              >
                <div className="flex items-center justify-between font-mono font-bold flex-wrap gap-2">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>
                      {patchValidation.appliesCleanly
                        ? "Dry-Run Patch: Validated (Applies Cleanly to Base Content)"
                        : patchValidation.isValidDiff
                        ? "Dry-Run Patch: Valid Diff Syntax (Unverified Against Source Content)"
                        : "Dry-Run Patch: Invalid Unified Diff Structure"}
                    </span>
                  </span>
                  <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono">
                    +{patchValidation.addedLinesCount || 0} / -{patchValidation.removedLinesCount || 0} lines
                  </span>
                </div>
                {patchValidation.failureReason && (
                  <p className="font-sans text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                    {patchValidation.failureReason}
                  </p>
                )}
                <p className="text-[10px] font-mono text-slate-500">
                  Advisory Invariant: PipelineShield never applies patches automatically. Review and copy the patch to apply manually.
                </p>
              </div>
            )}

            <AIResponseRenderer
              content={response.response}
              confidence={response.confidence}
              model={response.model}
              evidenceReferences={response.evidenceReferences}
              uncertainties={response.uncertainties}
              action={action}
            />
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 text-xs">
            No analysis data available.
          </div>
        )}
      </div>

      {/* Modal Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px] font-sans">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          <span>CI Security Gate remains authoritative · Output is advisory-only</span>
        </div>

        <div className="flex items-center gap-2">
          {response && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold cursor-pointer shadow-2xs transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy Analysis"}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold cursor-pointer shadow-2xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function ContextualAIPanel({
  isOpen,
  onClose,
  action,
  title,
  subtitle,
  finding,
  report,
  runDiff,
  prImpact,
  codeDiff,
  codeSnippet,
  selectedLineRange,
  baseContent,
  filePath,
  prNumber,
  repoFullName,
  customQuery,
}: ContextualAIPanelProps) {
  // Close on Escape key
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <ContextualAIModalContent
        onClose={onClose}
        action={action}
        title={title}
        subtitle={subtitle}
        finding={finding}
        report={report}
        runDiff={runDiff}
        prImpact={prImpact}
        codeDiff={codeDiff}
        codeSnippet={codeSnippet}
        selectedLineRange={selectedLineRange}
        baseContent={baseContent}
        filePath={filePath}
        prNumber={prNumber}
        repoFullName={repoFullName}
        customQuery={customQuery}
      />
    </div>
  );
}

"use client";

import React, { useState, useMemo } from "react";
import { EvaluationResult, ProcessedFinding, FixCampaign } from "@/types/dashboard";
import { ViewHeader } from "../common/ViewHeader";
import { SeverityBadge } from "../SeverityBadge";
import { CopyButton } from "../common/CopyButton";
import { ContextualAIPanel } from "../common/ContextualAIPanel";
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  Clock,
  Sparkles,
} from "lucide-react";

interface RemediationViewProps {
  report: EvaluationResult;
  findings: ProcessedFinding[];
  onSelectFinding?: (finding: ProcessedFinding) => void;
  isDemoActive?: boolean;
}

const SAFE_PKG_IDENTIFIER = /^[@a-zA-Z0-9._\/-]+$/;

export function RemediationView({
  report,
  findings,
  onSelectFinding,
  isDemoActive = false,
}: RemediationViewProps) {
  const [activeTab, setActiveTab] = useState<"campaigns" | "verification">("campaigns");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [aiRemediationFinding, setAiRemediationFinding] = useState<ProcessedFinding | null>(null);

  // Group findings into actionable Fix Campaigns
  const fixCampaigns = useMemo<FixCampaign[]>(() => {
    const groupMap = new Map<string, ProcessedFinding[]>();

    findings.forEach((f) => {
      let groupKey = "";
      if (f.package_name) {
        groupKey = `pkg:${f.package_name.toLowerCase().trim()}`;
      } else if (f.scanner === "semgrep") {
        groupKey = `semgrep:${f.id.split(".").slice(0, 3).join(".") || f.id}`;
      } else {
        groupKey = `scanner:${f.scanner}:${f.file_path || "general"}`;
      }

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, []);
      }
      groupMap.get(groupKey)!.push(f);
    });

    const campaigns: FixCampaign[] = [];

    groupMap.forEach((items, key) => {
      const first = items[0];
      const hasCritical = items.some((i) => i.severity === "CRITICAL");
      const hasHigh = items.some((i) => i.severity === "HIGH");
      const hasMedium = items.some((i) => i.severity === "MEDIUM");
      const highestSeverity = hasCritical ? "CRITICAL" : hasHigh ? "HIGH" : hasMedium ? "MEDIUM" : "LOW";
      const blockingCount = items.filter((i) => i.gateCategory === "blocking").length;

      let name = "";
      let suggestedCommand: string | null = null;
      let targetVersion: string | null = null;
      let remediationGuidance = "";

      if (key.startsWith("pkg:")) {
        const pkgName = first.package_name || key.replace("pkg:", "");
        const fixedVer = items.find((i) => i.fixed_version)?.fixed_version || null;
        targetVersion = fixedVer;
        name = `Upgrade '${pkgName}' ${fixedVer ? `to >= ${fixedVer}` : "to patched version"}`;

        const isSafePkg = SAFE_PKG_IDENTIFIER.test(pkgName);
        const isSafeVer = fixedVer ? SAFE_PKG_IDENTIFIER.test(fixedVer) : false;

        if (isSafePkg && isSafeVer && fixedVer) {
          suggestedCommand = `npm install ${pkgName}@${fixedVer}`;
        }

        remediationGuidance = fixedVer
          ? `Upgrading package '${pkgName}' to ${fixedVer} resolves all ${items.length} related vulnerability advisories.`
          : `Review dependencies referencing '${pkgName}' and replace with maintained alternative.`;
      } else if (key.startsWith("semgrep:")) {
        name = `Remediate SAST Code Patterns (${first.title || "Semgrep Finding"})`;
        suggestedCommand = `semgrep --autofix --config auto`;
        remediationGuidance = "Apply static analysis code refactoring or validation sanitizers in source code.";
      } else {
        name = `Resolve ${first.scanner} Configuration Issues`;
        remediationGuidance = "Review scanner advisories and update repository workflow configuration.";
      }

      campaigns.push({
        id: key,
        name,
        targetPackage: first.package_name || undefined,
        scanner: first.scanner,
        highestSeverity,
        findings: items,
        suggestedCommand,
        targetVersion,
        remediationGuidance,
        blockingCount,
      });
    });

    // Sort by highest blocking count descending, then by severity
    return campaigns.sort((a, b) => {
      if (b.blockingCount !== a.blockingCount) {
        return b.blockingCount - a.blockingCount;
      }
      const sevWeight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };
      return sevWeight[b.highestSeverity] - sevWeight[a.highestSeverity];
    });
  }, [findings]);

  // Selected Campaign details
  const currentCampaign = useMemo(() => {
    if (!selectedCampaignId) return fixCampaigns[0] || null;
    return fixCampaigns.find((c) => c.id === selectedCampaignId) || fixCampaigns[0] || null;
  }, [fixCampaigns, selectedCampaignId]);

  // Verification breakdown
  const verifiedStats = useMemo(() => {
    let triagedCount = 0;
    let openCount = 0;
    findings.forEach((f) => {
      if (
        f.triage?.status === "fixed" ||
        f.triage?.status === "verified_resolved" ||
        f.triage?.status === "accepted_risk"
      ) {
        triagedCount++;
      } else {
        openCount++;
      }
    });
    return {
      total: findings.length,
      triagedCount,
      openCount,
      ciGateDecision: report.decision,
    };
  }, [findings, report]);

  return (
    <div className="space-y-6">
      <ViewHeader
        title="Remediation & Fix Campaigns"
        description="Cluster related security findings into actionable remediation batches, generate safe shell upgrades, and verify resolutions against CI gate baselines."
        icon={<Wrench className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
        badge={
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
            {fixCampaigns.length} Fix Campaigns
          </span>
        }
        actions={
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab("campaigns")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === "campaigns"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              Fix Campaigns ({fixCampaigns.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("verification")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === "verification"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              Remediation Verification
            </button>
          </div>
        }
      />

      {activeTab === "campaigns" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Campaign List */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 px-1">
              <span>Remediation Batches</span>
              <span>Impact</span>
            </div>

            {fixCampaigns.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                No active security findings require remediation in this report.
              </div>
            ) : (
              fixCampaigns.map((c) => {
                const isSelected = currentCampaign?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCampaignId(c.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer text-left ${
                      isSelected
                        ? "bg-teal-50/50 dark:bg-teal-950/30 border-teal-400 dark:border-teal-700 shadow-xs"
                        : "bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <SeverityBadge severity={c.highestSeverity} />
                          {c.blockingCount > 0 && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
                              {c.blockingCount} Blocker{c.blockingCount > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate pt-1">
                          {c.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {c.findings.length} finding{c.findings.length > 1 ? "s" : ""} across {c.scanner}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-teal-600 dark:text-teal-400 font-semibold">
                          View Batch <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Campaign Detail Focus Panel */}
          <div className="lg:col-span-7">
            {currentCampaign ? (
              <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-2xs">
                <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <SeverityBadge severity={currentCampaign.highestSeverity} />
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        Scanner: {currentCampaign.scanner}
                      </span>
                      {currentCampaign.blockingCount > 0 && (
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
                          Fails CI Security Gate
                        </span>
                      )}
                    </div>
                    {currentCampaign.findings.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setAiRemediationFinding(currentCampaign.findings[0])}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-linear-to-r from-teal-500/10 to-indigo-500/10 hover:from-teal-500/20 hover:to-indigo-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30 transition-all shadow-xs cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-teal-500" />
                        <span>AI Fix Planner</span>
                      </button>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-subheading">
                    {currentCampaign.name}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {currentCampaign.remediationGuidance}
                  </p>
                </div>

                {/* Shell Upgrade Command */}
                {currentCampaign.suggestedCommand && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 text-teal-700 dark:text-teal-300">
                        <Terminal className="w-4 h-4" />
                        <span>Suggested Remediation Command (Review before executing):</span>
                      </span>
                      <CopyButton text={currentCampaign.suggestedCommand} />
                    </div>
                    <code className="block p-3 rounded-xl bg-slate-900 text-teal-400 font-mono text-xs border border-slate-800 overflow-x-auto shadow-inner">
                      {currentCampaign.suggestedCommand}
                    </code>
                  </div>
                )}

                {/* Remediation Impact */}
                <div className="p-4 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/60 flex items-start gap-3">
                  <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <div className="font-semibold text-teal-900 dark:text-teal-100">
                      Remediation Gate Impact
                    </div>
                    <p className="text-teal-800 dark:text-teal-300 leading-relaxed">
                      Executing this campaign resolves{" "}
                      <strong>{currentCampaign.findings.length} security finding(s)</strong> and eliminates{" "}
                      <strong>{currentCampaign.blockingCount} policy blocking violation(s)</strong>.
                    </p>
                  </div>
                </div>

                {/* Affected Findings */}
                <div className="space-y-3 pt-1">
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                    <span>Affected Findings in this Batch ({currentCampaign.findings.length})</span>
                    <span className="text-[11px] font-normal text-slate-500">Click to open drawer</span>
                  </h4>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {currentCampaign.findings.map((f) => (
                      <div
                        key={f.id}
                        onClick={() => onSelectFinding?.(f)}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-teal-400 dark:hover:border-teal-600 bg-slate-50/50 dark:bg-slate-800/30 transition-colors cursor-pointer flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <SeverityBadge severity={f.severity} />
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100 truncate">
                              {f.id}
                            </span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-400 truncate">
                            {f.title}
                          </p>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
                          Inspect →
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                Select a fix campaign to inspect affected findings and remediation guidance.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Remediation Verification Tab */
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-semibold block">Authoritative Verification Invariant:</strong>
              <p className="leading-relaxed">
                Local triage notes mark findings as investigated in your browser workspace. Authoritative resolution requires running a subsequent CI pipeline scan where the finding is absent from the uploaded <code className="font-mono bg-blue-100 dark:bg-blue-900/60 px-1 py-0.5 rounded">security-summary-reports</code> artifact.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-1">
              <span className="text-xs font-mono uppercase text-slate-500">Current CI Verdict</span>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>{report.decision}</span>
                {report.decision === "PASS" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                )}
              </div>
              <span className="text-[11px] text-slate-400">Authoritative gate output</span>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-1">
              <span className="text-xs font-mono uppercase text-slate-500">Workspace Triaged</span>
              <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
                {verifiedStats.triagedCount} / {verifiedStats.total}
              </div>
              <span className="text-[11px] text-slate-400">Marked fixed or risk accepted</span>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-1">
              <span className="text-xs font-mono uppercase text-slate-500">Active Pipeline Blockers</span>
              <div className="text-xl font-bold font-mono text-red-600 dark:text-red-400">
                {report.summary?.blocking_count ?? 0}
              </div>
              <span className="text-[11px] text-slate-400">Violating policy thresholds</span>
            </div>
          </div>

          {/* Finding Verification Status Table */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                Finding Verification Ledger
              </h3>
              <span className="text-xs text-slate-400">
                {isDemoActive ? "Synthetic Demo Run" : "Active CI Run"}
              </span>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {findings.map((f) => {
                const isTriaged = f.triage?.status === "fixed" || f.triage?.status === "accepted_risk";
                return (
                  <div key={f.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={f.severity} />
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{f.id}</span>
                        <span className="font-mono text-slate-400">({f.scanner})</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 truncate">{f.title}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-[11px] font-mono font-semibold">
                          {isTriaged ? (
                            <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Triaged ({f.triage?.status})
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Untriaged
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Gate: <strong className="uppercase">{f.gateCategory}</strong>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectFinding?.(f)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] hover:border-teal-500 cursor-pointer"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <ContextualAIPanel
        isOpen={Boolean(aiRemediationFinding)}
        onClose={() => setAiRemediationFinding(null)}
        action="suggest_remediation"
        title="AI Fix Planner & Remediation Guidance"
        subtitle={aiRemediationFinding ? `${aiRemediationFinding.id} (${aiRemediationFinding.scanner})` : undefined}
        finding={aiRemediationFinding || undefined}
      />
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { EvaluationResult, ProcessedFinding, RiskException } from "@/types/dashboard";
import { ViewHeader } from "../common/ViewHeader";
import { SeverityBadge } from "../SeverityBadge";
import {
  ShieldAlert,
  Plus,
  Trash2,
  Calendar,
  User,
  Clock,
  AlertCircle,
  FileText,
} from "lucide-react";

interface ExceptionsViewProps {
  report: EvaluationResult;
  findings: ProcessedFinding[];
  exceptions: RiskException[];
  onAddException: (exception: RiskException) => void;
  onRemoveException: (id: string) => void;
}

export function ExceptionsView({
  findings,
  exceptions,
  onAddException,
  onRemoveException,
}: ExceptionsViewProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedFindingId, setSelectedFindingId] = useState(findings[0]?.id || "");
  const [owner, setOwner] = useState("");
  const [rationale, setRationale] = useState("");
  const [expiryDate, setExpiryDate] = useState("2026-12-31");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "under_review" | "expired">("all");

  const handleCreateException = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFindingId || !rationale.trim() || !owner.trim()) return;

    const finding = findings.find((f) => f.id === selectedFindingId);
    const target = finding?.package_name || finding?.file_path || "Repository Dependency";

    const newEx: RiskException = {
      id: `ex-${Date.now()}`,
      findingId: selectedFindingId,
      target,
      owner: owner.trim(),
      rationale: rationale.trim(),
      expiryDate,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    onAddException(newEx);
    setShowAddModal(false);
    setOwner("");
    setRationale("");
  };

  const filteredExceptions = exceptions.filter((ex) => {
    if (filterStatus === "all") return true;
    return ex.status === filterStatus;
  });

  return (
    <div className="space-y-6">
      <ViewHeader
        title="Exceptions & Risk Governance"
        description="Document accepted security risks, policy waivers, ownership assignments, and expiration review cycles within your local investigation workspace."
        icon={<ShieldAlert className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
        badge={
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            {exceptions.length} Registered Exceptions
          </span>
        }
        actions={
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Document Risk Exception</span>
          </button>
        }
      />

      {/* Authoritative Security Guardrail Banner */}
      <div className="p-4 rounded-xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 text-xs text-purple-900 dark:text-purple-200 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="font-semibold block">Local Governance Scope & Guardrail:</strong>
          <p className="leading-relaxed">
            Exception records and waivers recorded here are managed in your browser workspace storage (<code className="font-mono bg-purple-100 dark:bg-purple-900/60 px-1 py-0.5 rounded">localStorage</code>). They document security team decisions and risk acceptance but <strong>never</strong> override the authoritative CI security gate verdict (<code className="font-mono">BLOCK</code> / <code className="font-mono">WARN</code> / <code className="font-mono">PASS</code>) evaluated in GitHub Actions without committing rule exemptions to repository policy.
          </p>
        </div>
      </div>

      {/* Exception Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]">
          <span className="text-xs font-mono uppercase text-slate-500">Total Exceptions</span>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {exceptions.length}
          </div>
          <span className="text-[11px] text-slate-400">Documented in workspace</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]">
          <span className="text-xs font-mono uppercase text-slate-500">Active Waivers</span>
          <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-1">
            {exceptions.filter((e) => e.status === "active").length}
          </div>
          <span className="text-[11px] text-slate-400">Within valid timeframe</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]">
          <span className="text-xs font-mono uppercase text-slate-500">Under Review</span>
          <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
            {exceptions.filter((e) => e.status === "under_review").length}
          </div>
          <span className="text-[11px] text-slate-400">Pending renewal</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]">
          <span className="text-xs font-mono uppercase text-slate-500">Expired</span>
          <div className="text-xl font-bold font-mono text-slate-600 dark:text-slate-400 mt-1">
            {exceptions.filter((e) => e.status === "expired").length}
          </div>
          <span className="text-[11px] text-slate-400">Require remediation</span>
        </div>
      </div>

      {/* Filter and Exceptions Table */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold">
            {(["all", "active", "under_review", "expired"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer capitalize ${
                  filterStatus === st
                    ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-2xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                {st.replace("_", " ")}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-400 font-mono">
            Showing {filteredExceptions.length} of {exceptions.length} records
          </span>
        </div>

        {filteredExceptions.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 space-y-2">
            <FileText className="w-8 h-8 text-slate-400 mx-auto" />
            <p>No risk exceptions recorded for this filter.</p>
            <p className="text-[11px] text-slate-400">
              Click &quot;Document Risk Exception&quot; above to record a business risk acceptance.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
            {filteredExceptions.map((ex) => {
              const finding = findings.find((f) => f.id === ex.findingId);
              return (
                <div key={ex.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {finding && <SeverityBadge severity={finding.severity} />}
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {ex.findingId}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        Target: {ex.target}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        {ex.status.replace("_", " ")}
                      </span>
                    </div>

                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-sans bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <strong>Business Rationale:</strong> {ex.rationale}
                    </p>

                    <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 pt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Owner: <strong className="text-slate-700 dark:text-slate-300">{ex.owner}</strong></span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Expires: <strong className="text-slate-700 dark:text-slate-300">{ex.expiryDate}</strong></span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Recorded: {new Date(ex.createdAt).toLocaleDateString()}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onRemoveException(ex.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer"
                      title="Remove Exception Record"
                      aria-label="Remove Exception Record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Exception Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <span>Document Risk Acceptance Exception</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Register a documented security waiver in your local workspace.
              </p>
            </div>

            <form onSubmit={handleCreateException} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Select Vulnerability / Finding
                </label>
                <select
                  value={selectedFindingId}
                  onChange={(e) => setSelectedFindingId(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono outline-hidden focus:ring-2 focus:ring-purple-500"
                >
                  {findings.map((f) => (
                    <option key={f.id} value={f.id}>
                      [{f.severity}] {f.id} - {f.title.slice(0, 50)}...
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Owner / Assigned Lead
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. secops-lead, @amruth, platform-team"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Expiration Date
                </label>
                <input
                  type="date"
                  required
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Business Rationale & Mitigation Plan
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain why this risk is accepted, compensatory controls in place, and timeline for eventual resolution..."
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-purple-500 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold cursor-pointer shadow-2xs"
                >
                  Record Exception
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

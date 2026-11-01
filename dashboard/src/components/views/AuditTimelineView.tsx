"use client";

import React, { useState, useMemo } from "react";
import { EvaluationResult, AuditEvent } from "@/types/dashboard";
import { ViewHeader } from "../common/ViewHeader";
import {
  Clock,
  Download,
  Filter,
  CheckCircle2,
  ShieldAlert,
  GitBranch,
  FileText,
  UserCheck,
  ShieldCheck,
  Activity,
} from "lucide-react";

interface AuditTimelineViewProps {
  report: EvaluationResult;
  events: AuditEvent[];
  isDemoActive?: boolean;
}

export function AuditTimelineView({
  report,
  events,
  isDemoActive = false,
}: AuditTimelineViewProps) {
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterSource, setFilterSource] = useState<string>("ALL");

  // Dynamic baseline events synthesized from the active report
  const combinedEvents = useMemo<AuditEvent[]>(() => {
    const list: AuditEvent[] = [...events];

    // Authoritative Gate Decision Event from active report
    const eventTime = report.evaluated_at || "2026-11-01T00:00:00.000Z";

    list.push({
      id: "ev-decision-current",
      timestamp: eventTime,
      type: "gate_decision",
      source: "security_engine",
      title: `Policy Security Gate Decision: ${report.decision}`,
      details: `Gate evaluated with ${report.summary?.blocking_count ?? 0} blocking violation(s) and ${report.summary?.warning_count ?? 0} warning(s). Reasons: ${report.reasons.join(" | ") || "All policy checks satisfied."}`,
      severity: report.decision === "BLOCK" ? "CRITICAL" : report.decision === "WARN" ? "MEDIUM" : "INFO",
    });

    // Ingestion Event from active report
    list.push({
      id: "ev-ingest-current",
      timestamp: eventTime,
      type: "ingestion",
      source: isDemoActive ? "local_workspace" : "github_actions",
      title: isDemoActive ? "Demonstration Report Ingested" : "GitHub Actions Report Ingested",
      details: isDemoActive
        ? "Loaded synthetic local demonstration scenario for security policy evaluation."
        : "Fetched and unzipped 'security-summary-reports' artifact from active CI pipeline run.",
    });

    // Sort newest first
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [events, report, isDemoActive]);

  const filteredEvents = useMemo(() => {
    return combinedEvents.filter((ev) => {
      if (filterType !== "ALL" && ev.type !== filterType) return false;
      if (filterSource !== "ALL" && ev.source !== filterSource) return false;
      return true;
    });
  }, [combinedEvents, filterType, filterSource]);

  const handleExportAuditLog = () => {
    const jsonStr = JSON.stringify(combinedEvents, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipelineshield-audit-timeline-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSourceBadge = (source: AuditEvent["source"]) => {
    switch (source) {
      case "github_actions":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
            <GitBranch className="w-2.5 h-2.5" />
            GITHUB ACTIONS
          </span>
        );
      case "security_engine":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-900">
            <ShieldCheck className="w-2.5 h-2.5" />
            SECURITY ENGINE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Activity className="w-2.5 h-2.5" />
            LOCAL WORKSPACE
          </span>
        );
    }
  };

  const getTypeIcon = (type: AuditEvent["type"]) => {
    switch (type) {
      case "gate_decision":
        return <ShieldAlert className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case "ingestion":
        return <GitBranch className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case "triage_update":
        return <UserCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
      case "risk_exception":
        return <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case "report_export":
        return <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <ViewHeader
        title="Audit Timeline"
        description="Chronological event log tracking CI report ingestion, security gate decisions, local triage updates, and audit exports with verified origins."
        icon={<Clock className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
        badge={
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {combinedEvents.length} Events Logged
          </span>
        }
        actions={
          <button
            type="button"
            onClick={handleExportAuditLog}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export Audit Log</span>
          </button>
        }
      />

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Type:</span>
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-1.5 outline-hidden"
          >
            <option value="ALL">All Event Types</option>
            <option value="gate_decision">Gate Decisions</option>
            <option value="ingestion">Report Ingestion</option>
            <option value="triage_update">Triage Updates</option>
            <option value="risk_exception">Risk Exceptions</option>
            <option value="report_export">Exports</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 ml-2">
            <span>Source:</span>
          </div>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-1.5 outline-hidden"
          >
            <option value="ALL">All Sources</option>
            <option value="github_actions">GitHub Actions</option>
            <option value="security_engine">Security Engine</option>
            <option value="local_workspace">Local Workspace</option>
          </select>
        </div>

        <span className="text-xs font-mono text-slate-400">
          Showing {filteredEvents.length} events
        </span>
      </div>

      {/* Timeline Stream */}
      <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
        {filteredEvents.map((ev) => (
          <div key={ev.id} className="relative group">
            {/* Timeline node icon */}
            <div className="absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 rounded-full bg-white dark:bg-[#111827] border-2 border-teal-500 dark:border-teal-400 flex items-center justify-center shrink-0 shadow-2xs">
              <span className="scale-75">{getTypeIcon(ev.type)}</span>
            </div>

            {/* Event Card */}
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-2.5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {getSourceBadge(ev.source)}
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                    {ev.title}
                  </h4>
                </div>
                <time className="text-[11px] font-mono text-slate-400 shrink-0">
                  {new Date(ev.timestamp).toLocaleString()}
                </time>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                {ev.details}
              </p>

              {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {Object.entries(ev.metadata).map(([k, v]) => (
                    <span
                      key={k}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                    >
                      {k}: {v}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

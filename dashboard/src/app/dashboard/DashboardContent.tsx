"use client";

import React, { useState, useMemo, ChangeEvent, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Finding,
  EvaluationResult,
  ProcessedFinding,
  DashboardView,
  LiveRunInfo,
  TriageRecord,
  TriageStatus,
  TriagePriority,
  RiskException,
  AuditEvent,
} from "@/types/dashboard";
import { SAMPLE_REPORTS } from "@/data/sample-reports";
import { validateReportSchema } from "@/lib/report-validator";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { FindingDrawer } from "@/components/FindingDrawer";
import { OverviewView } from "@/components/views/OverviewView";
import { FindingsView } from "@/components/views/FindingsView";
import { ScannersView } from "@/components/views/ScannersView";
import { PolicyView } from "@/components/views/PolicyView";
import { ReportsView } from "@/components/views/ReportsView";
import { RunsView } from "@/components/views/RunsView";
import { SettingsView } from "@/components/views/SettingsView";
import { RemediationView } from "@/components/views/RemediationView";
import { ExceptionsView } from "@/components/views/ExceptionsView";
import { AuditTimelineView } from "@/components/views/AuditTimelineView";
import { AssetsView } from "@/components/views/AssetsView";
import { TrendsView } from "@/components/views/TrendsView";
import { IntegrationsView } from "@/components/views/IntegrationsView";
import { LocalAIView } from "@/components/views/LocalAIView";
import { GithubWorkspaceView } from "@/components/views/GithubWorkspaceView";
import { CodeReviewWorkspaceView } from "@/components/views/CodeReviewWorkspaceView";
import { X, AlertTriangle } from "lucide-react";

const VALID_VIEWS: DashboardView[] = [
  "overview",
  "findings",
  "runs",
  "github",
  "code-review",
  "assets",
  "scanners",
  "remediation",
  "exceptions",
  "local-ai",
  "policy",
  "audit",
  "reports",
  "trends",
  "integrations",
  "settings",
];

export default function DashboardContent() {
  const searchParams = useSearchParams();
  const queryView = searchParams.get("view") as DashboardView | null;

  const [currentView, setCurrentView] = useState<DashboardView>(() => {
    if (queryView && VALID_VIEWS.includes(queryView)) {
      return queryView;
    }
    return "overview";
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Active dataset state
  const [activeReportKey, setActiveReportKey] = useState<string>("vulnerable");
  const [customReport, setCustomReport] = useState<EvaluationResult | null>(null);
  const [customFileName, setCustomFileName] = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Live GitHub sync state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [liveRunInfo, setLiveRunInfo] = useState<LiveRunInfo | null>(null);

  // Search & interaction state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedFinding, setSelectedFinding] = useState<ProcessedFinding | null>(null);
  const [findingsCategoryFilter, setFindingsCategoryFilter] = useState<string>("ALL");
  const [findingsSeverityFilter, setFindingsSeverityFilter] = useState<string>("ALL");

  // Local triage records with lazy localStorage initialization
  const [triageMap, setTriageMap] = useState<Record<string, TriageRecord>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = window.localStorage.getItem("pipelineshield_triage_records");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch {
      // Browser storage unavailable
    }
    return {};
  });

  // Local risk exceptions with lazy localStorage initialization
  const [exceptions, setExceptions] = useState<RiskException[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem("pipelineshield_risk_exceptions");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Browser storage unavailable
    }
    return [];
  });

  // Local audit events with lazy localStorage initialization
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem("pipelineshield_audit_events");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Browser storage unavailable
    }
    return [];
  });

  // Initial load of durable server-side triage records
  useEffect(() => {
    fetch("/api/triage")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.success && data.triageMap && typeof data.triageMap === "object") {
          setTriageMap((prev) => ({
            ...data.triageMap,
            ...prev,
          }));
        }
      })
      .catch(() => {
        // Non-blocking
      });
  }, []);

  const appendAuditEvent = (event: Omit<AuditEvent, "id" | "timestamp">) => {
    const newEv: AuditEvent = {
      ...event,
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    setAuditEvents((prev) => {
      const updated = [newEv, ...prev].slice(0, 100);
      try {
        window.localStorage.setItem("pipelineshield_audit_events", JSON.stringify(updated));
      } catch {
        // Storage full
      }
      return updated;
    });
  };

  const handleUpdateTriage = (
    findingId: string,
    status: TriageStatus,
    note: string,
    assignee?: string,
    priority?: TriagePriority,
    targetDate?: string
  ) => {
    const updatedAt = new Date().toISOString();
    const newRecord: TriageRecord = {
      findingId,
      status,
      note,
      assignee,
      priority,
      targetDate,
      updatedAt,
      updatedBy: "Session Operator (Unauthenticated)",
    };

    setTriageMap((prev) => {
      const existing = prev[findingId];
      const history = existing?.history ? [...existing.history] : [];
      history.push({
        status,
        assignee,
        priority,
        note,
        timestamp: updatedAt,
        actor: "Session Operator (Unauthenticated)",
      });

      const updated = {
        ...prev,
        [findingId]: {
          ...newRecord,
          history,
        },
      };
      return updated;
    });

    appendAuditEvent({
      type: "triage_update",
      source: "local_workspace",
      title: `Session Triage Updated: ${findingId}`,
      details: `Status: '${status}' (Session-only, Non-authoritative)${assignee ? ` · Assigned: ${assignee}` : ""}${priority ? ` · Priority: ${priority}` : ""}. ${note ? `Note: "${note}"` : ""}`,
      metadata: { findingId, status, assignee: assignee || "", nonAuthoritative: "true" },
    });
  };

  const handleAddException = (exception: RiskException) => {
    setExceptions((prev) => {
      const updated = [exception, ...prev];
      try {
        window.localStorage.setItem("pipelineshield_risk_exceptions", JSON.stringify(updated));
      } catch {
        // Storage full
      }
      return updated;
    });

    appendAuditEvent({
      type: "risk_exception",
      source: "local_workspace",
      title: `Risk Exception Registered: ${exception.findingId}`,
      details: `Owner '${exception.owner}' registered exception for '${exception.target}'. Rationale: ${exception.rationale}. Expiry: ${exception.expiryDate}`,
      metadata: { findingId: exception.findingId, owner: exception.owner },
    });
  };

  const handleRemoveException = (id: string) => {
    setExceptions((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      try {
        window.localStorage.setItem("pipelineshield_risk_exceptions", JSON.stringify(updated));
      } catch {
        // Storage full
      }
      return updated;
    });
  };

  // Global keyboard shortcut to toggle sidebar ('[')
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "[" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName || "")) {
        setSidebarCollapsed((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Active report data
  const currentResult: EvaluationResult = useMemo(() => {
    if ((activeReportKey === "custom" || activeReportKey === "live") && customReport) {
      return customReport;
    }
    return SAMPLE_REPORTS[activeReportKey]?.data || SAMPLE_REPORTS.vulnerable.data;
  }, [activeReportKey, customReport]);

  const isDemoActive = activeReportKey !== "custom" && activeReportKey !== "live";

  // Combine and normalize all findings across categories:
  const allFindings = useMemo<ProcessedFinding[]>(() => {
    if (Array.isArray(currentResult.findings) && currentResult.findings.length > 0) {
      const blockingIds = new Set((currentResult.blocking_findings || []).map((f) => f.id));
      const warningIds = new Set((currentResult.warning_findings || []).map((f) => f.id));
      const exemptedIds = new Set((currentResult.exempted_findings || []).map((f) => f.id));

      return currentResult.findings.map((f: Finding) => {
        let gateCategory: "blocking" | "warning" | "advisory" | "exempted" = "advisory";
        if (blockingIds.has(f.id)) {
          gateCategory = "blocking";
        } else if (warningIds.has(f.id)) {
          gateCategory = "warning";
        } else if (exemptedIds.has(f.id)) {
          gateCategory = "exempted";
        }
        return { ...f, gateCategory, triage: triageMap[f.id] };
      });
    }

    // Fallback if 'findings' collection is not explicitly populated
    const list: ProcessedFinding[] = [];
    (currentResult.blocking_findings || []).forEach((f) =>
      list.push({ ...f, gateCategory: "blocking", triage: triageMap[f.id] })
    );
    (currentResult.warning_findings || []).forEach((f) =>
      list.push({ ...f, gateCategory: "warning", triage: triageMap[f.id] })
    );
    (currentResult.advisory_findings || []).forEach((f) =>
      list.push({ ...f, gateCategory: "advisory", triage: triageMap[f.id] })
    );
    (currentResult.exempted_findings || []).forEach((f) =>
      list.push({ ...f, gateCategory: "exempted", triage: triageMap[f.id] })
    );
    return list;
  }, [currentResult, triageMap]);

  // Handle report upload with authoritative schema validation
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const validation = validateReportSchema(parsed);

        if (!validation.valid) {
          setUploadError(validation.error || "Invalid report schema structure.");
          return;
        }

        setCustomReport(parsed);
        setCustomFileName(file.name);
        setActiveReportKey("custom");

        appendAuditEvent({
          type: "ingestion",
          source: "local_workspace",
          title: `Uploaded Local Report File: ${file.name}`,
          details: `Validated report schema successfully. Gate Decision: ${parsed.decision}. Total findings: ${parsed.summary?.total_findings || 0}.`,
          metadata: { fileName: file.name, decision: parsed.decision },
        });
      } catch (err) {
        setUploadError(
          `Failed to parse JSON file: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Handle live report sync from GitHub Actions
  const handleSyncLiveReport = async () => {
    setSyncError(null);
    setUploadError(null);
    setIsSyncing(true);
    try {
      const res = await fetch("/api/latest-report?refresh=true");
      const data = await res.json();
      if (res.ok && data.success && data.report) {
        const enrichedReport: EvaluationResult = {
          ...data.report,
          branch: data.report.branch || data.run?.head_branch,
          commit_sha: data.report.commit_sha || data.run?.head_sha,
        };
        setCustomReport(enrichedReport);
        setLiveRunInfo({
          run: data.run,
          artifact: data.artifact,
          fetchedAt: data.fetched_at,
        });
        setActiveReportKey("live");

        appendAuditEvent({
          type: "ingestion",
          source: "github_actions",
          title: `Ingested CI Run #${data.run?.id || "Live"}`,
          details: `Successfully fetched and verified 'security-summary-reports' artifact with verdict ${data.report.decision}. Exit code: ${data.report.decision === "PASS" ? 0 : 1}.`,
          metadata: { runId: String(data.run?.id), decision: data.report.decision },
        });
      } else {
        setSyncError(data.error || "Failed to retrieve report from GitHub Actions.");
      }
    } catch (err) {
      setSyncError(
        `Error requesting live report: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const sampleKeys = useMemo(() => {
    return Object.entries(SAMPLE_REPORTS).map(([k, item]) => ({
      key: k,
      label: item.label,
      tag: item.tag,
    }));
  }, []);

  const handleNavigateToFindings = (category?: string, severity?: string) => {
    if (category) setFindingsCategoryFilter(category);
    if (severity) setFindingsSeverityFilter(severity);
    setCurrentView("findings");
  };

  const handleNavigateToScannerFindings = (scannerName: string) => {
    setSearchQuery(scannerName);
    setCurrentView("findings");
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 font-sans antialiased transition-colors">
      {/* Persistent Left Sidebar (Desktop) */}
      <Sidebar
        currentView={currentView}
        onSelectView={(v) => {
          setCurrentView(v);
          setMobileMenuOpen(false);
        }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        findingsCount={allFindings.length}
        blockingCount={currentResult.summary?.blocking_count ?? 0}
      />

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs lg:hidden flex"
          onClick={() => setMobileMenuOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
        >
          <div
            className="w-72 bg-white dark:bg-[#111827] h-full shadow-2xl flex flex-col border-r border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-14 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between">
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100 font-mono">
                PipelineShield
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Sidebar
                currentView={currentView}
                onSelectView={(v) => {
                  setCurrentView(v);
                  setMobileMenuOpen(false);
                }}
                collapsed={false}
                onToggleCollapse={() => {}}
                findingsCount={allFindings.length}
                blockingCount={currentResult.summary?.blocking_count ?? 0}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Persistent Top Navigation Bar */}
        <TopBar
          currentView={currentView}
          isDemoActive={isDemoActive}
          onFileUpload={handleFileUpload}
          searchQuery={searchQuery}
          onSearchChange={(q) => {
            setSearchQuery(q);
            if (q.trim() && currentView !== "findings") {
              setCurrentView("findings");
            }
          }}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          activeReportKey={activeReportKey}
          onSelectSample={(k) => {
            setActiveReportKey(k);
            setUploadError(null);
            setSyncError(null);
          }}
          sampleKeys={sampleKeys}
          onSyncLive={handleSyncLiveReport}
          isSyncing={isSyncing}
          liveRunInfo={liveRunInfo}
        />

        {/* View Content Workspace */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          {/* Sync Error Notice Banner */}
          {syncError && (
            <div className="mb-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start justify-between gap-3 shadow-2xs">
              <div className="space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Live CI Sync Notice</span>
                </div>
                <p className="text-amber-800 dark:text-amber-300">{syncError}</p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                  Tip: You can always load reports offline via the <strong>Load Report</strong> button or inspect the bundled demonstration datasets.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSyncError(null)}
                className="cursor-pointer p-1 rounded-md text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors"
                aria-label="Dismiss notice"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {currentView === "overview" && (
            <OverviewView
              report={currentResult}
              allFindings={allFindings}
              activeReportKey={activeReportKey}
              onSelectSample={(k) => {
                setActiveReportKey(k);
                setUploadError(null);
              }}
              sampleKeys={sampleKeys}
              isDemoActive={isDemoActive}
              onNavigateToFindings={handleNavigateToFindings}
              onSelectFinding={(f) => setSelectedFinding(f)}
              liveRunInfo={liveRunInfo}
            />
          )}

          {currentView === "findings" && (
            <FindingsView
              findings={allFindings}
              onSelectFinding={(f) => setSelectedFinding(f)}
              initialCategoryFilter={findingsCategoryFilter}
              initialSeverityFilter={findingsSeverityFilter}
            />
          )}

          {currentView === "scanners" && (
            <ScannersView
              report={currentResult}
              findings={allFindings}
              onNavigateToScannerFindings={handleNavigateToScannerFindings}
              isDemoActive={isDemoActive}
            />
          )}

          {currentView === "policy" && (
            <PolicyView report={currentResult} findings={allFindings} />
          )}

          {currentView === "remediation" && (
            <RemediationView
              report={currentResult}
              findings={allFindings}
              onSelectFinding={(f) => setSelectedFinding(f)}
              isDemoActive={isDemoActive}
            />
          )}

          {currentView === "exceptions" && (
            <ExceptionsView
              report={currentResult}
              findings={allFindings}
              exceptions={exceptions}
              onAddException={handleAddException}
              onRemoveException={handleRemoveException}
            />
          )}

          {currentView === "local-ai" && (
            <LocalAIView
              report={currentResult}
              findings={allFindings}
              isDemoActive={isDemoActive}
            />
          )}

          {currentView === "audit" && (
            <AuditTimelineView
              report={currentResult}
              events={auditEvents}
              isDemoActive={isDemoActive}
            />
          )}

          {currentView === "assets" && (
            <AssetsView
              report={currentResult}
              findings={allFindings}
              onSelectFinding={(f) => setSelectedFinding(f)}
            />
          )}

          {currentView === "trends" && (
            <TrendsView
              report={currentResult}
              findings={allFindings}
              liveRunInfo={liveRunInfo}
              isDemoActive={isDemoActive}
            />
          )}

          {currentView === "integrations" && (
            <IntegrationsView
              report={currentResult}
              liveRunInfo={liveRunInfo}
              onSyncLive={handleSyncLiveReport}
              isSyncing={isSyncing}
            />
          )}

          {currentView === "reports" && (
            <ReportsView
              report={currentResult}
              isDemoActive={isDemoActive}
              onFileUpload={handleFileUpload}
              uploadError={uploadError}
              customFileName={customFileName}
              onSelectReportKey={(k) => {
                setActiveReportKey(k);
                setUploadError(null);
                setSyncError(null);
              }}
              activeReportKey={activeReportKey}
            />
          )}

          {currentView === "runs" && (
            <RunsView
              report={currentResult}
              isDemoActive={isDemoActive}
              liveRunInfo={liveRunInfo}
            />
          )}

          {currentView === "github" && <GithubWorkspaceView />}

          {currentView === "code-review" && <CodeReviewWorkspaceView />}

          {currentView === "settings" && <SettingsView />}
        </main>
      </div>

      {/* Finding Detail Slide-Over Drawer */}
      <FindingDrawer
        key={selectedFinding?.id || "empty"}
        finding={
          selectedFinding
            ? { ...selectedFinding, triage: triageMap[selectedFinding.id] || selectedFinding.triage }
            : null
        }
        onClose={() => setSelectedFinding(null)}
        onUpdateTriage={handleUpdateTriage}
      />
    </div>
  );
}

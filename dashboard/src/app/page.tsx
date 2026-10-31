"use client";

import React, { useState, useMemo, ChangeEvent, useEffect } from "react";
import {
  Finding,
  EvaluationResult,
  ProcessedFinding,
  DashboardView,
  LiveRunInfo,
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
import { X, AlertTriangle } from "lucide-react";

export default function Home() {
  const [currentView, setCurrentView] = useState<DashboardView>("overview");
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
        return { ...f, gateCategory };
      });
    }

    // Fallback if 'findings' collection is not explicitly populated
    const list: ProcessedFinding[] = [];
    (currentResult.blocking_findings || []).forEach((f) =>
      list.push({ ...f, gateCategory: "blocking" })
    );
    (currentResult.warning_findings || []).forEach((f) =>
      list.push({ ...f, gateCategory: "warning" })
    );
    (currentResult.advisory_findings || []).forEach((f) =>
      list.push({ ...f, gateCategory: "advisory" })
    );
    (currentResult.exempted_findings || []).forEach((f) =>
      list.push({ ...f, gateCategory: "exempted" })
    );
    return list;
  }, [currentResult]);

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
        setCustomReport(data.report);
        setLiveRunInfo({
          run: data.run,
          artifact: data.artifact,
          fetchedAt: data.fetched_at,
        });
        setActiveReportKey("live");
      } else {
        setSyncError(data.error || "Failed to retrieve report from GitHub Actions.");
      }
    } catch (err) {
      setSyncError(
        err instanceof Error
          ? err.message
          : "Network failure while reaching live sync API route."
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const sampleKeys = [
    { key: "vulnerable", label: "Vulnerable PR (BLOCK)", tag: "BLOCK" },
    { key: "clean", label: "Clean Baseline (PASS)", tag: "PASS" },
    { key: "warnings_only", label: "Advisory Warnings (WARN)", tag: "WARN" },
    { key: "scanner_error", label: "Scanner Failure (ERROR)", tag: "ERROR" },
  ];

  const handleNavigateToFindings = (categoryFilter?: string, severityFilter?: string) => {
    if (categoryFilter) {
      setFindingsCategoryFilter(categoryFilter);
    } else {
      setFindingsCategoryFilter("ALL");
    }
    if (severityFilter) {
      setFindingsSeverityFilter(severityFilter);
    } else {
      setFindingsSeverityFilter("ALL");
    }
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
            />
          )}

          {currentView === "policy" && <PolicyView report={currentResult} />}

          {currentView === "reports" && (
            <ReportsView
              report={currentResult}
              isDemoActive={isDemoActive}
              onFileUpload={handleFileUpload}
              uploadError={uploadError}
              customFileName={customFileName}
            />
          )}

          {currentView === "runs" && (
            <RunsView
              report={currentResult}
              isDemoActive={isDemoActive}
              liveRunInfo={liveRunInfo}
            />
          )}

          {currentView === "settings" && <SettingsView />}
        </main>
      </div>

      {/* Finding Detail Slide-Over Drawer */}
      <FindingDrawer
        key={selectedFinding?.id || "empty"}
        finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
      />
    </div>
  );
}

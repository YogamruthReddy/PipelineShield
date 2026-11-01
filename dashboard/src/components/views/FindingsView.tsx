"use client";

import React, { useState, useMemo } from "react";
import { ProcessedFinding, TriageStatus } from "@/types/dashboard";
import { SeverityBadge } from "../SeverityBadge";
import { ScannerBadge } from "../ScannerBadge";
import { ViewHeader } from "../common/ViewHeader";
import { ActiveFilterChips, ActiveFilter } from "../common/ActiveFilterChips";
import { EmptyState } from "../common/EmptyState";
import { ContextualAIPanel } from "../common/ContextualAIPanel";
import {
  Search,
  ArrowUpDown,
  FileCode2,
  Package,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  LayoutList,
  LayoutGrid,
  X,
  ArrowRight,
  Copy,
  Check,
  Clock,
  Shield,
  Layers,
  FileSpreadsheet,
  FileJson,
  Sparkles,
} from "lucide-react";

interface FindingsViewProps {
  findings: ProcessedFinding[];
  onSelectFinding: (finding: ProcessedFinding) => void;
  initialCategoryFilter?: string;
  initialSeverityFilter?: string;
}

function exportFindingsToJson(items: ProcessedFinding[]) {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(items, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `pipelineshield-findings-${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function exportFindingsToCsv(items: ProcessedFinding[]) {
  const headers = [
    "ID",
    "Severity",
    "Scanner",
    "Gate_Category",
    "Triage_Status",
    "Package",
    "File_Path",
    "Line",
    "Title",
    "Remediation",
  ];
  const rows = items.map((f) => [
    `"${(f.id || "").replace(/"/g, '""')}"`,
    `"${f.severity}"`,
    `"${f.scanner}"`,
    `"${f.gateCategory}"`,
    `"${f.triage?.status || "open"}"`,
    `"${(f.package_name || "").replace(/"/g, '""')}"`,
    `"${(f.file_path || "").replace(/"/g, '""')}"`,
    `"${f.line_number ?? ""}"`,
    `"${(f.title || "").replace(/"/g, '""')}"`,
    `"${(f.remediation || "").replace(/"/g, '""')}"`,
  ]);
  const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent([headers.join(","), ...rows.map((r) => r.join(","))].join("\n"));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", csvContent);
  downloadAnchor.setAttribute("download", `pipelineshield-findings-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

const SEVERITY_WEIGHT: Record<string, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

export function FindingsView({
  findings,
  onSelectFinding,
  initialCategoryFilter = "ALL",
  initialSeverityFilter = "ALL",
}: FindingsViewProps) {
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState(initialSeverityFilter);
  const [scanner, setScanner] = useState("ALL");
  const [category, setCategory] = useState(initialCategoryFilter);
  const [packageFilter, setPackageFilter] = useState("ALL");
  const [triageFilter, setTriageFilter] = useState<string>("ALL");
  const [deduplicate, setDeduplicate] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<"severity-desc" | "severity-asc" | "title" | "scanner" | "file" | "package">("severity-desc");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [page, setPage] = useState(1);
  const [activeAiFinding, setActiveAiFinding] = useState<ProcessedFinding | null>(null);
  const pageSize = 10;
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyFindingId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Distinct list of packages for filter dropdown
  const uniquePackages = useMemo(() => {
    const pkgs = new Set<string>();
    findings.forEach((f) => {
      if (f.package_name && f.package_name.trim()) {
        pkgs.add(f.package_name.trim());
      }
    });
    return Array.from(pkgs).sort();
  }, [findings]);

  // Filtering and Deduplication
  const filteredAndSorted = useMemo(() => {
    let list = findings.filter((item) => {
      if (severity !== "ALL" && item.severity !== severity) return false;
      if (scanner !== "ALL" && item.scanner !== scanner) return false;
      if (category !== "ALL" && item.gateCategory !== category) return false;
      if (packageFilter !== "ALL" && item.package_name !== packageFilter) return false;
      if (triageFilter !== "ALL") {
        const itemTriage = item.triage?.status || "open";
        if (itemTriage !== triageFilter) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchId = (item.id || "").toLowerCase().includes(q);
        const matchTitle = (item.title || "").toLowerCase().includes(q);
        const matchFile = (item.file_path || "").toLowerCase().includes(q);
        const matchPkg = (item.package_name || "").toLowerCase().includes(q);
        const matchCwe = (item.cwe_ids || []).some((c) => c.toLowerCase().includes(q));
        return matchId || matchTitle || matchFile || matchPkg || matchCwe;
      }
      return true;
    });

    // Deduplication logic: Group by stable identity (ID or title+package)
    if (deduplicate) {
      const seen = new Map<string, ProcessedFinding & { count: number }>();
      list.forEach((item) => {
        const key = item.id ? item.id : `${item.title}-${item.package_name || item.file_path}`;
        if (seen.has(key)) {
          const existing = seen.get(key)!;
          existing.count += 1;
        } else {
          seen.set(key, { ...item, count: 1 });
        }
      });
      list = Array.from(seen.values()).map((item) => ({
        ...item,
        occurrenceCount: item.count,
      }));
    }

    list.sort((a, b) => {
      if (sortBy === "severity-desc") {
        return (SEVERITY_WEIGHT[b.severity] || 0) - (SEVERITY_WEIGHT[a.severity] || 0);
      }
      if (sortBy === "severity-asc") {
        return (SEVERITY_WEIGHT[a.severity] || 0) - (SEVERITY_WEIGHT[b.severity] || 0);
      }
      if (sortBy === "title") {
        return (a.title || "").localeCompare(b.title || "");
      }
      if (sortBy === "scanner") {
        return (a.scanner || "").localeCompare(b.scanner || "");
      }
      if (sortBy === "file") {
        return (a.file_path || "").localeCompare(b.file_path || "");
      }
      if (sortBy === "package") {
        return (a.package_name || "").localeCompare(b.package_name || "");
      }
      return 0;
    });

    return list;
  }, [findings, severity, scanner, category, packageFilter, triageFilter, deduplicate, search, sortBy]);

  const totalPages = Math.ceil(filteredAndSorted.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, page, pageSize]);

  // Counts for quick filter presets
  const counts = useMemo(() => {
    return {
      all: findings.length,
      blocking: findings.filter((f) => f.gateCategory === "blocking").length,
      warning: findings.filter((f) => f.gateCategory === "warning").length,
      exempted: findings.filter((f) => f.gateCategory === "exempted").length,
      criticalHigh: findings.filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH").length,
      trivy: findings.filter((f) => f.scanner === "trivy").length,
      semgrep: findings.filter((f) => f.scanner === "semgrep").length,
      dependencyReview: findings.filter((f) => f.scanner === "dependency_review").length,
      investigating: findings.filter((f) => f.triage?.status === "investigating").length,
    };
  }, [findings]);

  // Active filter chips list
  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const chips: ActiveFilter[] = [];
    if (search.trim()) {
      chips.push({ id: "search", label: "Keyword", value: search, displayValue: `"${search}"` });
    }
    if (severity !== "ALL") {
      chips.push({ id: "severity", label: "Severity", value: severity, displayValue: severity });
    }
    if (scanner !== "ALL") {
      chips.push({ id: "scanner", label: "Scanner", value: scanner, displayValue: scanner });
    }
    if (category !== "ALL") {
      chips.push({ id: "category", label: "Gate Status", value: category, displayValue: category.toUpperCase() });
    }
    if (packageFilter !== "ALL") {
      chips.push({ id: "package", label: "Package", value: packageFilter, displayValue: packageFilter });
    }
    if (triageFilter !== "ALL") {
      chips.push({ id: "triage", label: "Triage", value: triageFilter, displayValue: triageFilter.toUpperCase() });
    }
    if (deduplicate) {
      chips.push({ id: "dedup", label: "View", value: "dedup", displayValue: "Deduplicated" });
    }
    return chips;
  }, [search, severity, scanner, category, packageFilter, triageFilter, deduplicate]);

  const handleRemoveFilter = (id: string) => {
    if (id === "search") setSearch("");
    if (id === "severity") setSeverity("ALL");
    if (id === "scanner") setScanner("ALL");
    if (id === "category") setCategory("ALL");
    if (id === "package") setPackageFilter("ALL");
    if (id === "triage") setTriageFilter("ALL");
    if (id === "dedup") setDeduplicate(false);
    setPage(1);
  };

  const handleClearAllFilters = () => {
    setSearch("");
    setSeverity("ALL");
    setScanner("ALL");
    setCategory("ALL");
    setPackageFilter("ALL");
    setTriageFilter("ALL");
    setDeduplicate(false);
    setPage(1);
  };

  const applyPreset = (preset: "blockers" | "critical_high" | "trivy" | "semgrep" | "pr_deps" | "investigating" | "all") => {
    handleClearAllFilters();
    if (preset === "blockers") {
      setCategory("blocking");
    } else if (preset === "critical_high") {
      setSeverity("HIGH"); // or custom multi filter
    } else if (preset === "trivy") {
      setScanner("trivy");
    } else if (preset === "semgrep") {
      setScanner("semgrep");
    } else if (preset === "pr_deps") {
      setScanner("dependency_review");
    } else if (preset === "investigating") {
      setTriageFilter("investigating");
    }
  };

  const getGateTag = (cat: string) => {
    switch (cat) {
      case "blocking":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-900/80">
            <ShieldAlert className="w-2.5 h-2.5" />
            BLOCKING
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-900/80">
            <AlertTriangle className="w-2.5 h-2.5" />
            WARNING
          </span>
        );
      case "exempted":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-900/80">
            <CheckCircle2 className="w-2.5 h-2.5" />
            EXEMPTED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            ADVISORY
          </span>
        );
    }
  };

  const getTriageTag = (status?: TriageStatus) => {
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-900/80">
            ASSIGNED
          </span>
        );
      case "remediation_in_progress":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-900/80">
            FIXING
          </span>
        );
      case "fixed":
      case "verified_resolved":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-900/80">
            <CheckCircle2 className="w-2.5 h-2.5" />
            RESOLVED
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
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 dark:text-slate-500">
            Unreviewed
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <ViewHeader
        title="Security Findings Investigation Workspace"
        description="Investigate, triage, and remediate findings across Trivy, Semgrep, and Dependency Review with full policy and evidence context."
        icon={<AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
        badge={
          <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {filteredAndSorted.length} of {findings.length} findings
          </span>
        }
        actions={
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => exportFindingsToJson(filteredAndSorted)}
              className="inline-flex items-center space-x-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Export filtered findings as JSON"
            >
              <FileJson className="w-3.5 h-3.5 text-slate-400" />
              <span>JSON</span>
            </button>

            <button
              type="button"
              onClick={() => exportFindingsToCsv(filteredAndSorted)}
              className="inline-flex items-center space-x-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Export filtered findings as CSV spreadsheet"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
              <span>CSV</span>
            </button>

            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs"
                    : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
                title="Table view"
                aria-label="Table view"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs"
                    : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
                title="Card view"
                aria-label="Card view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        }
      />

      {/* Saved Finding Views Bar */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Saved Views:</span>
        <button
          type="button"
          onClick={() => applyPreset("all")}
          className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors cursor-pointer ${
            category === "ALL" && severity === "ALL" && scanner === "ALL" && triageFilter === "ALL"
              ? "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-800 font-semibold"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
          }`}
        >
          All ({counts.all})
        </button>
        <button
          type="button"
          onClick={() => applyPreset("blockers")}
          className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors cursor-pointer flex items-center gap-1 ${
            category === "blocking"
              ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800 font-semibold"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
          }`}
        >
          <ShieldAlert className="w-3 h-3 text-red-500" />
          <span>Blockers ({counts.blocking})</span>
        </button>
        <button
          type="button"
          onClick={() => applyPreset("trivy")}
          className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors cursor-pointer ${
            scanner === "trivy"
              ? "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800 font-semibold"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
          }`}
        >
          Trivy ({counts.trivy})
        </button>
        <button
          type="button"
          onClick={() => applyPreset("semgrep")}
          className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors cursor-pointer ${
            scanner === "semgrep"
              ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800 font-semibold"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
          }`}
        >
          Semgrep ({counts.semgrep})
        </button>
        <button
          type="button"
          onClick={() => applyPreset("pr_deps")}
          className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors cursor-pointer ${
            scanner === "dependency_review"
              ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800 font-semibold"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
          }`}
        >
          Dependency Review ({counts.dependencyReview})
        </button>
        <button
          type="button"
          onClick={() => applyPreset("investigating")}
          className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors cursor-pointer flex items-center gap-1 ${
            triageFilter === "investigating"
              ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800 font-semibold"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
          }`}
        >
          <Clock className="w-3 h-3 text-blue-500" />
          <span>Investigating ({counts.investigating})</span>
        </button>
        <button
          type="button"
          onClick={() => {
            handleClearAllFilters();
            setTriageFilter("accepted_risk");
          }}
          className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors cursor-pointer flex items-center gap-1 ${
            triageFilter === "accepted_risk"
              ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800 font-semibold"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
          }`}
        >
          <ShieldAlert className="w-3 h-3 text-purple-500" />
          <span>Accepted Risks</span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={deduplicate}
              onChange={(e) => setDeduplicate(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
            />
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Group Duplicate Findings</span>
          </label>
        </div>
      </div>

      {/* Multi-Criteria Filter Controls */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3 transition-colors">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Keyword Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by ID, title, file, package..."
              className="w-full text-xs pl-9 pr-8 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500 transition-all font-mono"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Severity Filter */}
          <div>
            <select
              value={severity}
              onChange={(e) => {
                setSeverity(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-mono"
            >
              <option value="ALL">Severity: All</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
              <option value="INFO">Info</option>
            </select>
          </div>

          {/* Scanner Filter */}
          <div>
            <select
              value={scanner}
              onChange={(e) => {
                setScanner(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-mono"
            >
              <option value="ALL">Scanner: All</option>
              <option value="trivy">Trivy</option>
              <option value="semgrep">Semgrep</option>
              <option value="dependency_review">Dependency Review</option>
            </select>
          </div>

          {/* Gate Category */}
          <div>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-mono"
            >
              <option value="ALL">Gate: All</option>
              <option value="blocking">Blocking Only</option>
              <option value="warning">Warning Only</option>
              <option value="advisory">Advisory Only</option>
              <option value="exempted">Exempted</option>
            </select>
          </div>

          {/* Triage Status */}
          <div>
            <select
              value={triageFilter}
              onChange={(e) => {
                setTriageFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-mono"
            >
              <option value="ALL">Triage: All</option>
              <option value="unreviewed">Unreviewed</option>
              <option value="in_triage">In Triage</option>
              <option value="assigned">Assigned</option>
              <option value="remediation_in_progress">Fix In Progress</option>
              <option value="verified_resolved">Verified Resolved</option>
              <option value="accepted_risk">Accepted Risk</option>
            </select>
          </div>
        </div>

        {/* Second Row: Package Filter & Sort Selection */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <span className="text-xs text-slate-400 font-medium shrink-0">Package:</span>
            <select
              value={packageFilter}
              onChange={(e) => {
                setPackageFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono"
            >
              <option value="ALL">All Packages ({uniquePackages.length})</option>
              {uniquePackages.map((pkg) => (
                <option key={pkg} value={pkg}>
                  {pkg}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-400 font-medium">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as
                    | "severity-desc"
                    | "severity-asc"
                    | "title"
                    | "scanner"
                    | "file"
                    | "package"
                )
              }
              className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono"
            >
              <option value="severity-desc">Severity (High → Low)</option>
              <option value="severity-asc">Severity (Low → High)</option>
              <option value="title">Title (A → Z)</option>
              <option value="scanner">Scanner</option>
              <option value="file">File Path</option>
              <option value="package">Package</option>
            </select>
          </div>
        </div>

        {/* Active Filter Chips */}
        {activeFilters.length > 0 && (
          <div className="pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <ActiveFilterChips
              filters={activeFilters}
              onRemove={handleRemoveFilter}
              onClearAll={handleClearAllFilters}
            />
          </div>
        )}
      </div>

      {/* Findings Content: Table View */}
      {viewMode === "table" ? (
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-mono uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">ID & Identifier</th>
                  <th className="py-3 px-4">Scanner</th>
                  <th className="py-3 px-4">Gate Impact</th>
                  <th className="py-3 px-4">Triage</th>
                  <th className="py-3 px-4">Target / Package</th>
                  <th className="py-3 px-4">Finding Summary</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginated.length > 0 ? (
                  paginated.map((item) => (
                    <tr
                      key={`${item.id}-${item.file_path || item.package_name}`}
                      onClick={() => onSelectFinding(item)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4 shrink-0">
                        <SeverityBadge severity={item.severity} />
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center space-x-1.5">
                          <span className="truncate max-w-[160px]">{item.id}</span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyFindingId(e, item.id)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                            title="Copy Finding ID"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          {item.occurrenceCount && item.occurrenceCount > 1 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                              {item.occurrenceCount}x
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <ScannerBadge scanner={item.scanner} />
                      </td>
                      <td className="py-3 px-4">
                        {getGateTag(item.gateCategory)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {getTriageTag(item.triage?.status)}
                          {item.triage?.assignee && (
                            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                              {item.triage.assignee}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {item.package_name ? (
                          <span className="inline-flex items-center gap-1 text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[140px]">
                            <Package className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{item.package_name}</span>
                          </span>
                        ) : item.file_path ? (
                          <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 truncate max-w-[150px]">
                            <FileCode2 className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{item.file_path.split("/").pop()}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {item.title}
                        </div>
                        {item.remediation && (
                          <div className="text-[11px] text-teal-600 dark:text-teal-400 truncate font-mono">
                            ↳ {item.remediation}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveAiFinding(item);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200 dark:border-teal-800 px-2 py-0.5 rounded transition-colors mr-2 cursor-pointer shadow-2xs"
                          title="Analyze finding with Local AI"
                        >
                          <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                          <span>AI Explain</span>
                        </button>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 group-hover:underline">
                          <span>Inspect</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12">
                      <EmptyState
                        icon={Search}
                        title="No findings match your filter"
                        description="Try resetting the severity, scanner, or keyword search criteria."
                        actionLabel="Reset All Filters"
                        onAction={handleClearAllFilters}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Findings Content: Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paginated.length > 0 ? (
            paginated.map((item) => (
              <div
                key={`${item.id}-${item.file_path || item.package_name}`}
                onClick={() => onSelectFinding(item)}
                className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-teal-500/50 hover:shadow-md transition-all cursor-pointer space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <SeverityBadge severity={item.severity} />
                    <ScannerBadge scanner={item.scanner} />
                    {getGateTag(item.gateCategory)}
                    {getTriageTag(item.triage?.status)}
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 shrink-0">
                    {item.scanner}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 break-all">
                    {item.id}
                  </h3>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 line-clamp-2">
                    {item.title}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-mono truncate max-w-[200px]">
                    {item.package_name ? `pkg: ${item.package_name}` : item.file_path || "General Finding"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveAiFinding(item);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200 dark:border-teal-800 px-2 py-0.5 rounded transition-colors cursor-pointer shadow-2xs"
                      title="Analyze finding with Local AI"
                    >
                      <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                      <span>AI Explain</span>
                    </button>
                    <span className="text-teal-600 dark:text-teal-400 font-semibold inline-flex items-center gap-0.5">
                      <span>Inspect</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-2 py-12">
              <EmptyState
                icon={Search}
                title="No findings match your filter"
                description="Try resetting the severity, scanner, or keyword search criteria."
                actionLabel="Reset All Filters"
                onAction={handleClearAllFilters}
              />
            </div>
          )}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredAndSorted.length)} of {filteredAndSorted.length} findings
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-mono font-semibold text-slate-800 dark:text-slate-200">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Contextual AI Finding Investigation Dialog */}
      <ContextualAIPanel
        isOpen={Boolean(activeAiFinding)}
        onClose={() => setActiveAiFinding(null)}
        action="explain_finding"
        title={activeAiFinding ? `AI Finding Investigation: ${activeAiFinding.id}` : "AI Finding Investigation"}
        subtitle="Plain-language explanation of root cause, evidence references, and impact"
        finding={activeAiFinding}
      />
    </div>
  );
}

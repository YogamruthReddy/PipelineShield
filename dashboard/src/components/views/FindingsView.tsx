"use client";

import React, { useState, useMemo } from "react";
import { ProcessedFinding } from "@/types/dashboard";
import { SeverityBadge } from "../SeverityBadge";
import { ScannerBadge } from "../ScannerBadge";
import { ViewHeader } from "../common/ViewHeader";
import { ActiveFilterChips, ActiveFilter } from "../common/ActiveFilterChips";
import { EmptyState } from "../common/EmptyState";
import {
  Search,
  Filter,
  ArrowUpDown,
  FileCode2,
  Package,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  LayoutList,
  LayoutGrid,
  X,
  ShieldCheck,
  ArrowRight,
  Download,
  Copy,
  Check,
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
  downloadAnchor.setAttribute("download", `pipelineshield-findings.json`);
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
  const [sortBy, setSortBy] = useState<"severity-desc" | "severity-asc" | "title" | "scanner" | "file">("severity-desc");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyFindingId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const filteredAndSorted = useMemo(() => {
    const list = findings.filter((item) => {
      if (severity !== "ALL" && item.severity !== severity) return false;
      if (scanner !== "ALL" && item.scanner !== scanner) return false;
      if (category !== "ALL" && item.gateCategory !== category) return false;

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
      return 0;
    });

    return list;
  }, [findings, severity, scanner, category, search, sortBy]);

  const totalPages = Math.ceil(filteredAndSorted.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, page, pageSize]);

  const handleExportJson = () => {
    exportFindingsToJson(filteredAndSorted);
  };

  // Counts for quick filter pills
  const counts = useMemo(() => {
    return {
      all: findings.length,
      blocking: findings.filter((f) => f.gateCategory === "blocking").length,
      warning: findings.filter((f) => f.gateCategory === "warning").length,
      exempted: findings.filter((f) => f.gateCategory === "exempted").length,
      critical: findings.filter((f) => f.severity === "CRITICAL").length,
      high: findings.filter((f) => f.severity === "HIGH").length,
    };
  }, [findings]);

  // Active filter chips list
  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const chips: ActiveFilter[] = [];
    if (search.trim()) {
      chips.push({
        id: "search",
        label: "Keyword",
        value: search,
        displayValue: `"${search}"`,
      });
    }
    if (severity !== "ALL") {
      chips.push({
        id: "severity",
        label: "Severity",
        value: severity,
        displayValue: severity,
      });
    }
    if (scanner !== "ALL") {
      chips.push({
        id: "scanner",
        label: "Scanner",
        value: scanner,
        displayValue: scanner,
      });
    }
    if (category !== "ALL") {
      chips.push({
        id: "category",
        label: "Gate Status",
        value: category,
        displayValue: category.toUpperCase(),
      });
    }
    return chips;
  }, [search, severity, scanner, category]);

  const handleRemoveFilter = (id: string) => {
    if (id === "search") setSearch("");
    if (id === "severity") setSeverity("ALL");
    if (id === "scanner") setScanner("ALL");
    if (id === "category") setCategory("ALL");
    setPage(1);
  };

  const handleClearAllFilters = () => {
    setSearch("");
    setSeverity("ALL");
    setScanner("ALL");
    setCategory("ALL");
    setPage(1);
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

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <ViewHeader
        title="Security Findings & Vulnerabilities"
        description="Filter, inspect, and remediate findings across Trivy, Semgrep, and Dependency Review with policy classification."
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
              onClick={handleExportJson}
              className="inline-flex items-center space-x-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Export filtered findings as JSON"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Export JSON</span>
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

      {/* Quick Filter Status Ribbon */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs font-medium">
        <button
          type="button"
          onClick={() => {
            setCategory("ALL");
            setSeverity("ALL");
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
            category === "ALL" && severity === "ALL"
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <span>All Findings</span>
          <span className="font-mono text-[11px] bg-slate-200/70 dark:bg-slate-700/70 px-1.5 rounded-full">
            {counts.all}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCategory("blocking");
            setSeverity("ALL");
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
            category === "blocking"
              ? "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/60 shadow-2xs font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span>Gate Blockers</span>
          <span className="font-mono text-[11px] bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200 px-1.5 rounded-full font-bold">
            {counts.blocking}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCategory("warning");
            setSeverity("ALL");
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
            category === "warning"
              ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 shadow-2xs font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>Advisory Warnings</span>
          <span className="font-mono text-[11px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 px-1.5 rounded-full font-bold">
            {counts.warning}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCategory("ALL");
            setSeverity("CRITICAL");
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
            severity === "CRITICAL"
              ? "bg-red-600 text-white shadow-2xs font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <span>Critical Severity</span>
          <span className={`font-mono text-[11px] px-1.5 rounded-full ${severity === "CRITICAL" ? "bg-red-700 text-white" : "bg-slate-200/70 dark:bg-slate-700/70"}`}>
            {counts.critical}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCategory("ALL");
            setSeverity("HIGH");
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
            severity === "HIGH"
              ? "bg-orange-500 text-white shadow-2xs font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <span>High Severity</span>
          <span className={`font-mono text-[11px] px-1.5 rounded-full ${severity === "HIGH" ? "bg-orange-600 text-white" : "bg-slate-200/70 dark:bg-slate-700/70"}`}>
            {counts.high}
          </span>
        </button>
      </div>

      {/* Sticky Search & Multi-Filter Toolbar */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3 sticky top-14 z-20 backdrop-blur-md bg-white/95 dark:bg-[#111827]/95 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search CVE ID, rule title, file path, package, CWE..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all shadow-2xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                aria-label="Clear search text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center space-x-2 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="text-xs border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer shadow-2xs"
            >
              <option value="severity-desc">Severity: High to Low</option>
              <option value="severity-asc">Severity: Low to High</option>
              <option value="title">Title (A-Z)</option>
              <option value="scanner">Scanner (A-Z)</option>
              <option value="file">File Path (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span className="font-semibold text-slate-600 dark:text-slate-400">Filter By:</span>
          </div>

          {/* Severity selector */}
          <div className="flex items-center space-x-1">
            <span className="text-slate-500 dark:text-slate-400">Severity:</span>
            <select
              value={severity}
              onChange={(e) => {
                setSeverity(e.target.value);
                setPage(1);
              }}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
              <option value="INFO">Info</option>
            </select>
          </div>

          {/* Scanner selector */}
          <div className="flex items-center space-x-1">
            <span className="text-slate-500 dark:text-slate-400">Scanner:</span>
            <select
              value={scanner}
              onChange={(e) => {
                setScanner(e.target.value);
                setPage(1);
              }}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="ALL">All Scanners</option>
              <option value="trivy">Trivy (SCA/Secrets/IaC)</option>
              <option value="semgrep">Semgrep (SAST)</option>
              <option value="dependency_review">Dependency Review (Supply Chain)</option>
            </select>
          </div>

          {/* Gate status selector */}
          <div className="flex items-center space-x-1">
            <span className="text-slate-500 dark:text-slate-400">Gate Policy:</span>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="blocking">Blocking Only</option>
              <option value="warning">Warnings Only</option>
              <option value="exempted">Exempted Only</option>
            </select>
          </div>
        </div>

        {/* Active Filter Chips */}
        <ActiveFilterChips
          filters={activeFilters}
          onRemove={handleRemoveFilter}
          onClearAll={handleClearAllFilters}
        />
      </div>

      {/* Main Content Area: Table / Cards */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
        {/* Table/Card Header Row */}
        <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <span>Showing {filteredAndSorted.length} matching finding{filteredAndSorted.length === 1 ? "" : "s"}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 dark:text-slate-400">Page size:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="border border-slate-200 dark:border-slate-700 rounded-md px-2 py-0.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {paginated.length > 0 ? (
          viewMode === "table" ? (
            /* Responsive Table View */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <th className="py-3 px-4 w-28">Severity</th>
                    <th className="py-3 px-4 w-32">Scanner</th>
                    <th className="py-3 px-4 w-32">Gate Status</th>
                    <th className="py-3 px-4">Identifier & Title</th>
                    <th className="py-3 px-4 w-64">Location / Target</th>
                    <th className="py-3 px-4 w-24 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginated.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => onSelectFinding(item)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <SeverityBadge severity={item.severity} />
                      </td>
                      <td className="py-3.5 px-4">
                        <ScannerBadge scanner={item.scanner} />
                      </td>
                      <td className="py-3.5 px-4">{getGateTag(item.gateCategory)}</td>
                      <td className="py-3.5 px-4 min-w-[220px]">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                            {item.id}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyFindingId(e, item.id)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Copy ID"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1 mt-0.5">
                          {item.title}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {item.file_path && (
                          <div className="flex items-center space-x-1 truncate max-w-[240px]">
                            <FileCode2 className="w-3 h-3 shrink-0 text-slate-400" />
                            <span className="truncate">{item.file_path}{item.line_number ? `:${item.line_number}` : ""}</span>
                          </div>
                        )}
                        {item.package_name && (
                          <div className="flex items-center space-x-1 truncate max-w-[240px] text-slate-700 dark:text-slate-300">
                            <Package className="w-3 h-3 shrink-0 text-slate-400" />
                            <span className="truncate font-semibold">{item.package_name}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center space-x-1 text-xs font-semibold text-teal-600 dark:text-teal-400 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                          <span>Inspect</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Responsive Card View */
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {paginated.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectFinding(item)}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/40 dark:bg-slate-800/20 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer space-y-3 shadow-2xs group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <SeverityBadge severity={item.severity} />
                      <ScannerBadge scanner={item.scanner} />
                    </div>
                    {getGateTag(item.gateCategory)}
                  </div>
                  <div>
                    <h3 className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                      {item.id}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-1">
                      {item.title}
                    </p>
                  </div>
                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <div className="truncate max-w-[260px]">
                      {item.file_path && (
                        <div className="flex items-center space-x-1 truncate">
                          <FileCode2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">{item.file_path}{item.line_number ? `:${item.line_number}` : ""}</span>
                        </div>
                      )}
                      {item.package_name && (
                        <div className="flex items-center space-x-1 truncate text-slate-700 dark:text-slate-300">
                          <Package className="w-3 h-3 shrink-0" />
                          <span className="truncate font-semibold">{item.package_name}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-teal-600 dark:text-teal-400 font-semibold flex items-center space-x-1 text-xs shrink-0 group-hover:translate-x-0.5 transition-transform">
                      <span>Inspect</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Empty States */
          findings.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="Clean Baseline — No Findings"
              description="This assessment run completed without any security vulnerabilities or static analysis findings."
            />
          ) : (
            <EmptyState
              icon={SlidersHorizontal}
              title="No Matching Findings Found"
              description="No security findings match your current search keywords or active filter parameters."
              actionLabel="Clear All Filters"
              onAction={handleClearAllFilters}
            />
          )
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex items-center justify-between text-xs">
            <div className="text-slate-500 dark:text-slate-400">
              Page <span className="font-semibold text-slate-900 dark:text-slate-100">{page}</span> of{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">{totalPages}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-1 shadow-2xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-1 shadow-2xs"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

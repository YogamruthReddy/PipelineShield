"use client";

import React, { ChangeEvent, useRef, useEffect, useState } from "react";
import { DashboardView, LiveRunInfo } from "@/types/dashboard";
import { useTheme } from "@/lib/theme";
import {
  Printer,
  Upload,
  ExternalLink,
  Search,
  Menu,
  GitBranch,
  FolderGit2,
  Database,
  Radio,
  Sun,
  Moon,
  X,
  ChevronDown,
  RefreshCw,
} from "lucide-react";

interface TopBarProps {
  currentView: DashboardView;
  isDemoActive: boolean;
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenMobileMenu: () => void;
  activeReportKey?: string;
  onSelectSample?: (key: string) => void;
  sampleKeys?: Array<{ key: string; label: string; tag: string }>;
  onSyncLive?: () => void;
  isSyncing?: boolean;
  liveRunInfo?: LiveRunInfo | null;
}

export function TopBar({
  currentView,
  isDemoActive,
  onFileUpload,
  searchQuery,
  onSearchChange,
  onOpenMobileMenu,
  activeReportKey = "vulnerable",
  onSelectSample,
  sampleKeys = [],
  onSyncLive,
  isSyncing = false,
  liveRunInfo = null,
}: TopBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { resolvedTheme, toggleTheme } = useTheme();
  const [datasetDropdownOpen, setDatasetDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDatasetDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Keyboard shortcut: '/' or 'Ctrl+K' / 'Cmd+K' focuses search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key === "k")) && document.activeElement !== searchInputRef.current) {
        if (!["INPUT", "TEXTAREA"].includes((document.activeElement?.tagName || ""))) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);



  const getDatasetTagColor = (tag: string) => {
    switch (tag) {
      case "PASS":
        return "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800";
      case "WARN":
        return "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800";
      case "ERROR":
        return "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800";
      default:
        return "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-800";
    }
  };

  const currentSample = sampleKeys.find((s) => s.key === activeReportKey);

  const handlePrint = () => {
    window.print();
  };

  return (
    <header className="no-print bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-30 h-14 shrink-0 flex items-center justify-between px-3.5 sm:px-6 transition-colors shadow-2xs">
      {/* Left side: Mobile menu toggle + Breadcrumbs & View Name */}
      <div className="flex items-center space-x-3 overflow-hidden">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
          <span className="font-semibold text-slate-800 dark:text-slate-200">PipelineShield</span>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span className="capitalize font-semibold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded-md border border-teal-200/60 dark:border-teal-900/60">
            {currentView}
          </span>
        </div>
      </div>

      {/* Center: Repository Context & Dataset Switcher Dropdown */}
      <div className="hidden lg:flex items-center space-x-2.5">
        {/* Repo & Branch Pill */}
        <div className="flex items-center space-x-1.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg">
          <FolderGit2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span className="font-semibold">YogamruthReddy/PipelineShield</span>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <GitBranch className="w-3 h-3 text-slate-400 dark:text-slate-500" />
          <span className="font-mono text-[11px] font-medium text-slate-600 dark:text-slate-300">main</span>
        </div>

        {/* Dataset Switcher Dropdown */}
        {sampleKeys.length > 0 && onSelectSample && (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDatasetDropdownOpen(!datasetDropdownOpen)}
              className="inline-flex items-center space-x-2 text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
              title="Switch evaluation scenario dataset"
              aria-expanded={datasetDropdownOpen}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  activeReportKey === "live"
                    ? "bg-emerald-500 animate-pulse"
                    : activeReportKey === "custom"
                    ? "bg-teal-500"
                    : activeReportKey === "clean"
                    ? "bg-emerald-500"
                    : activeReportKey === "warnings_only"
                    ? "bg-amber-500"
                    : activeReportKey === "scanner_error"
                    ? "bg-rose-500"
                    : activeReportKey === "vulnerable"
                    ? "bg-red-500"
                    : "bg-emerald-500"
                }`}
              />
              <span className="font-semibold truncate max-w-[170px]">
                {activeReportKey === "live"
                  ? "Live CI Data"
                  : activeReportKey === "custom"
                  ? "Ingested Custom Report"
                  : currentSample?.label || "Select Dataset"}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {datasetDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-50">
                <div className="px-3 py-1 text-[10px] font-mono font-semibold uppercase text-slate-400 dark:text-slate-500">
                  Data Sources & Scenarios
                </div>
                {liveRunInfo && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSample("live");
                      setDatasetDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer ${
                      activeReportKey === "live"
                        ? "bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Live CI Run #{liveRunInfo.run.id}</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800">
                      LIVE
                    </span>
                  </button>
                )}
                {sampleKeys.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      onSelectSample(s.key);
                      setDatasetDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer ${
                      activeReportKey === s.key
                        ? "bg-teal-50/70 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-semibold"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span className="truncate">{s.label}</span>
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${getDatasetTagColor(
                        s.tag
                      )}`}
                    >
                      {s.tag}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Provenance Badge */}
        {activeReportKey === "live" && liveRunInfo ? (
          <a
            href={liveRunInfo.run.html_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-1.5 text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 px-2.5 py-1 rounded-lg font-medium hover:underline"
            title={`Viewing live report from GitHub Actions Run #${liveRunInfo.run.id} (${liveRunInfo.run.head_sha.slice(0, 7)})`}
          >
            <Radio className="w-3 h-3 text-emerald-600 dark:text-emerald-400 animate-pulse" />
            <span>Live CI Run #{liveRunInfo.run.id}</span>
          </a>
        ) : isDemoActive ? (
          <div
            className="flex items-center space-x-1.5 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 px-2.5 py-1 rounded-lg font-medium"
            title="Viewing synthetic evaluation dataset for UI inspection"
          >
            <Radio className="w-3 h-3 text-amber-600 dark:text-amber-400 animate-pulse" />
            <span>Synthetic Demo</span>
          </div>
        ) : (
          <div
            className="flex items-center space-x-1.5 text-xs text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800/80 px-2.5 py-1 rounded-lg font-medium"
            title="Viewing user uploaded report JSON"
          >
            <Database className="w-3 h-3 text-teal-600 dark:text-teal-400" />
            <span>Ingested Run</span>
          </div>
        )}
      </div>

      {/* Right side: Search, Theme Toggle, Upload, Print, GitHub */}
      <div className="flex items-center space-x-2 shrink-0">
        {/* Command Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search findings..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-36 sm:w-48 md:w-56 pl-8 pr-14 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all shadow-2xs"
            aria-label="Search security findings"
          />
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="pointer-events-auto text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 rounded px-1.5 py-0.5 leading-tight shadow-2xs">
                Ctrl+K
              </kbd>
            )}
          </div>
        </div>

        {/* Theme Toggle (Light / Dark) */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-2xs"
          title={`Switch to ${resolvedTheme === "dark" ? "Light" : "Dark"} theme`}
          aria-label={`Toggle theme (currently ${resolvedTheme})`}
        >
          {resolvedTheme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {/* Print / PDF Export */}
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center space-x-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer shadow-2xs"
          title="Print or Export PDF"
        >
          <Printer className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <span className="hidden md:inline">Print / PDF</span>
        </button>

        {/* Sync CI Run */}
        <button
          type="button"
          onClick={onSyncLive}
          disabled={isSyncing}
          className="cursor-pointer inline-flex items-center space-x-1.5 text-xs font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200 dark:border-teal-800 rounded-lg px-2.5 py-1.5 transition-colors shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed"
          title="Fetch latest verified security report from GitHub Actions"
          aria-label="Sync CI Run"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-teal-600 dark:text-teal-400 ${isSyncing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">{isSyncing ? "Syncing..." : "Sync CI Run"}</span>
        </button>

        {/* Load Report JSON */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileUpload}
          accept=".json"
          className="hidden"
          aria-label="Upload JSON Report"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer inline-flex items-center space-x-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 transition-colors shadow-2xs"
          title="Load local PipelineShield summary JSON"
        >
          <Upload className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span className="hidden sm:inline">Load Report</span>
        </button>

        {/* GitHub Repository Link */}
        <a
          href="https://github.com/YogamruthReddy/PipelineShield"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center space-x-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 transition-colors shadow-2xs"
          title="Open repository on GitHub"
        >
          <span>GitHub</span>
          <ExternalLink className="w-3 h-3 text-slate-400 dark:text-slate-500" />
        </a>
      </div>
    </header>
  );
}

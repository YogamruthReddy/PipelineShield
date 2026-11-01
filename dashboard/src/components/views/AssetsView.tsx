"use client";

import React, { useState, useMemo } from "react";
import { EvaluationResult, ProcessedFinding, AssetItem } from "@/types/dashboard";
import { ViewHeader } from "../common/ViewHeader";
import { SeverityBadge } from "../SeverityBadge";
import {
  Boxes,
  Package,
  FileCode,
  GitBranch,
  Search,
  ExternalLink,
} from "lucide-react";

interface AssetsViewProps {
  report: EvaluationResult;
  findings: ProcessedFinding[];
  onSelectFinding?: (finding: ProcessedFinding) => void;
}

export function AssetsView({
  report,
  findings,
  onSelectFinding,
}: AssetsViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<"ALL" | "package" | "source_file" | "repository">("ALL");
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);

  // Derive inventory strictly from data actually present in the active report
  const assets = useMemo<AssetItem[]>(() => {
    const list: AssetItem[] = [];

    // 1. Scanned Repository Asset
    list.push({
      id: "asset-repo-main",
      type: "repository",
      name: report.policy_metadata?.repository || "YogamruthReddy/PipelineShield",
      version: report.commit_sha?.slice(0, 7) || "ca17407",
      findingsCount: findings.length,
      criticalCount: findings.filter((f) => f.severity === "CRITICAL").length,
      highCount: findings.filter((f) => f.severity === "HIGH").length,
      scanners: Object.keys(report.scanner_status || {}),
      findings,
    });

    // 2. Packages detected with findings
    const pkgMap = new Map<string, ProcessedFinding[]>();
    findings.forEach((f) => {
      if (f.package_name) {
        const pkg = f.package_name.trim();
        if (!pkgMap.has(pkg)) pkgMap.set(pkg, []);
        pkgMap.get(pkg)!.push(f);
      }
    });

    pkgMap.forEach((pkgFindings, pkgName) => {
      const first = pkgFindings[0];
      const scanners = Array.from(new Set(pkgFindings.map((f) => f.scanner)));
      const fixedVer = pkgFindings.find((f) => f.fixed_version)?.fixed_version || undefined;

      list.push({
        id: `pkg-${pkgName}`,
        type: "package",
        name: pkgName,
        version: first.installed_version || "Detected Dependency",
        fixedVersion: fixedVer,
        findingsCount: pkgFindings.length,
        criticalCount: pkgFindings.filter((f) => f.severity === "CRITICAL").length,
        highCount: pkgFindings.filter((f) => f.severity === "HIGH").length,
        scanners,
        findings: pkgFindings,
      });
    });

    // 3. Source Files detected with findings (SAST)
    const fileMap = new Map<string, ProcessedFinding[]>();
    findings.forEach((f) => {
      if (f.file_path && !f.package_name) {
        const file = f.file_path.trim();
        if (!fileMap.has(file)) fileMap.set(file, []);
        fileMap.get(file)!.push(f);
      }
    });

    fileMap.forEach((fileFindings, filePath) => {
      const scanners = Array.from(new Set(fileFindings.map((f) => f.scanner)));
      list.push({
        id: `file-${filePath}`,
        type: "source_file",
        name: filePath,
        findingsCount: fileFindings.length,
        criticalCount: fileFindings.filter((f) => f.severity === "CRITICAL").length,
        highCount: fileFindings.filter((f) => f.severity === "HIGH").length,
        scanners,
        findings: fileFindings,
      });
    });

    return list;
  }, [report, findings]);

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (selectedType !== "ALL" && asset.type !== selectedType) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          asset.name.toLowerCase().includes(query) ||
          asset.scanners.some((s) => s.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [assets, selectedType, searchQuery]);

  const getAssetIcon = (type: AssetItem["type"]) => {
    switch (type) {
      case "package":
        return <Package className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
      case "source_file":
        return <FileCode className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      default:
        return <GitBranch className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <ViewHeader
        title="Assets & Inventory"
        description="Catalog of repository dependencies, packages, and source code files strictly derived from security scanner findings and CI metadata."
        icon={<Boxes className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
        badge={
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {assets.length} Detected Assets
          </span>
        }
      />

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search assets by name or scanner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold">
          {(["ALL", "package", "source_file", "repository"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer capitalize ${
                selectedType === t
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              {t === "ALL" ? "All Assets" : t.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Asset Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredAssets.length === 0 ? (
          <div className="col-span-2 p-12 text-center bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            No assets match the search criteria.
          </div>
        ) : (
          filteredAssets.map((asset) => {
            const isExpanded = expandedAssetId === asset.id;
            return (
              <div
                key={asset.id}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-2xs space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {getAssetIcon(asset.type)}
                      </div>
                      <span className="text-[10px] font-mono uppercase font-bold text-slate-500">
                        {asset.type.replace("_", " ")}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 truncate pt-0.5">
                      {asset.name}
                    </h3>
                    {asset.version && (
                      <p className="text-[11px] font-mono text-slate-500">
                        Version: {asset.version}{" "}
                        {asset.fixedVersion && (
                          <span className="text-teal-600 dark:text-teal-400 font-semibold">
                            (Fix available: {asset.fixedVersion})
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
                      {asset.findingsCount} finding{asset.findingsCount > 1 ? "s" : ""}
                    </span>
                    {asset.criticalCount > 0 && (
                      <span className="text-[10px] font-mono text-red-600 dark:text-red-400 font-bold">
                        {asset.criticalCount} Critical
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-400">Scanners:</span>
                    {asset.scanners.map((s) => (
                      <span
                        key={s}
                        className="font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedAssetId(isExpanded ? null : asset.id)}
                    className="text-teal-600 dark:text-teal-400 font-semibold hover:underline cursor-pointer"
                  >
                    {isExpanded ? "Hide Findings" : `View Findings (${asset.findingsCount})`}
                  </button>
                </div>

                {/* Expanded Findings Drawer List */}
                {isExpanded && (
                  <div className="pt-2 space-y-1.5 border-t border-slate-100 dark:border-slate-800">
                    {asset.findings.map((f) => (
                      <div
                        key={f.id}
                        onClick={() => onSelectFinding?.(f)}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <SeverityBadge severity={f.severity} />
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                            {f.id}
                          </span>
                          <span className="text-slate-500 truncate text-[11px]">{f.title}</span>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

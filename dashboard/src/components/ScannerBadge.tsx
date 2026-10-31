import React from "react";

interface ScannerBadgeProps {
  scanner: "trivy" | "semgrep" | "dependency_review" | "manual" | string;
  className?: string;
}

export function ScannerBadge({ scanner, className = "" }: ScannerBadgeProps) {
  const norm = (scanner || "").toLowerCase();
  switch (norm) {
    case "trivy":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#F0FDF4] dark:bg-emerald-950/50 text-[#166534] dark:text-emerald-300 border border-[#BBF7D0] dark:border-emerald-800/80 shadow-2xs ${className}`}
        >
          trivy
        </span>
      );
    case "semgrep":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#EFF6FF] dark:bg-blue-950/50 text-[#1D4ED8] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-800/80 shadow-2xs ${className}`}
        >
          semgrep
        </span>
      );
    case "dependency_review":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#FAF5FF] dark:bg-purple-950/50 text-[#7E22CE] dark:text-purple-300 border border-[#E9D5FF] dark:border-purple-800/80 shadow-2xs ${className}`}
        >
          dependency_review
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#F1F5F9] dark:bg-slate-800 text-[#475569] dark:text-slate-300 border border-[#CBD5E1] dark:border-slate-700 shadow-2xs ${className}`}
        >
          {scanner || "scanner"}
        </span>
      );
  }
}

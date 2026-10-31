import React from "react";

interface SeverityBadgeProps {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO" | string;
  className?: string;
}

export function SeverityBadge({ severity, className = "" }: SeverityBadgeProps) {
  const norm = (severity || "INFO").toUpperCase();
  switch (norm) {
    case "CRITICAL":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-[#FEF2F2] dark:bg-red-950/60 text-[#991B1B] dark:text-red-300 border border-[#FCA5A5] dark:border-red-900/80 shadow-2xs ${className}`}
        >
          CRITICAL
        </span>
      );
    case "HIGH":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-[#FFF7ED] dark:bg-orange-950/60 text-[#C2410C] dark:text-orange-300 border border-[#FDBA74] dark:border-orange-900/80 shadow-2xs ${className}`}
        >
          HIGH
        </span>
      );
    case "MEDIUM":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-[#FEFCE8] dark:bg-amber-950/60 text-[#854D0E] dark:text-amber-300 border border-[#FDE047] dark:border-amber-900/80 shadow-2xs ${className}`}
        >
          MEDIUM
        </span>
      );
    case "LOW":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#166534] dark:text-emerald-300 border border-[#86EFAC] dark:border-emerald-900/80 shadow-2xs ${className}`}
        >
          LOW
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium font-mono bg-[#F8FAFC] dark:bg-slate-800 text-[#475569] dark:text-slate-300 border border-[#CBD5E1] dark:border-slate-700 shadow-2xs ${className}`}
        >
          {norm}
        </span>
      );
  }
}

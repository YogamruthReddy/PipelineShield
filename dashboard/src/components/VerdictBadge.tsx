import React from "react";
import { ShieldCheck, ShieldAlert, AlertTriangle, AlertOctagon } from "lucide-react";

interface VerdictBadgeProps {
  decision: "PASS" | "WARN" | "BLOCK" | "ERROR" | string;
  size?: "sm" | "md" | "lg";
}

export function VerdictBadge({ decision, size = "md" }: VerdictBadgeProps) {
  const norm = (decision || "").toUpperCase();

  const getExitCode = () => {
    switch (norm) {
      case "PASS":
      case "WARN":
        return 0;
      case "BLOCK":
        return 1;
      case "ERROR":
        return 2;
      default:
        return 1;
    }
  };

  const exitCode = getExitCode();

  if (norm === "PASS") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-bold rounded-lg border border-[#86EFAC] dark:border-emerald-800 bg-[#F0FDF4] dark:bg-emerald-950/60 text-[#166534] dark:text-emerald-300 shadow-2xs ${
          size === "sm"
            ? "px-2 py-0.5 text-xs"
            : size === "lg"
            ? "px-3 py-1.5 text-sm"
            : "px-2.5 py-1 text-xs"
        }`}
      >
        <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A] dark:text-emerald-400" />
        <span>PASS</span>
        <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-white/70 dark:bg-emerald-900/60 border border-[#86EFAC] dark:border-emerald-700">
          Exit {exitCode}
        </span>
      </span>
    );
  }

  if (norm === "WARN") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-bold rounded-lg border border-[#FDE047] dark:border-amber-800 bg-[#FEFCE8] dark:bg-amber-950/60 text-[#854D0E] dark:text-amber-300 shadow-2xs ${
          size === "sm"
            ? "px-2 py-0.5 text-xs"
            : size === "lg"
            ? "px-3 py-1.5 text-sm"
            : "px-2.5 py-1 text-xs"
        }`}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-[#CA8A04] dark:text-amber-400" />
        <span>WARN</span>
        <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-white/70 dark:bg-amber-900/60 border border-[#FDE047] dark:border-amber-700">
          Exit {exitCode}
        </span>
      </span>
    );
  }

  if (norm === "ERROR") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-bold rounded-lg border border-[#FCA5A5] dark:border-red-900 bg-[#FEF2F2] dark:bg-red-950/60 text-[#991B1B] dark:text-red-300 shadow-2xs ${
          size === "sm"
            ? "px-2 py-0.5 text-xs"
            : size === "lg"
            ? "px-3 py-1.5 text-sm"
            : "px-2.5 py-1 text-xs"
        }`}
      >
        <AlertOctagon className="w-3.5 h-3.5 text-[#DC2626] dark:text-red-400" />
        <span>ERROR</span>
        <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-white/70 dark:bg-red-900/60 border border-[#FCA5A5] dark:border-red-700">
          Exit {exitCode}
        </span>
      </span>
    );
  }

  // Default BLOCK
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold rounded-lg border border-[#FCA5A5] dark:border-red-900 bg-[#FEF2F2] dark:bg-red-950/60 text-[#B91C1C] dark:text-red-300 shadow-2xs ${
        size === "sm"
          ? "px-2 py-0.5 text-xs"
          : size === "lg"
          ? "px-3 py-1.5 text-sm"
          : "px-2.5 py-1 text-xs"
      }`}
    >
      <ShieldAlert className="w-3.5 h-3.5 text-[#DC2626] dark:text-red-400" />
      <span>BLOCK</span>
      <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-white/70 dark:bg-red-900/60 border border-[#FCA5A5] dark:border-red-700">
        Exit {exitCode}
      </span>
    </span>
  );
}

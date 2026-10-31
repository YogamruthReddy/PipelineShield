"use client";

import React from "react";
import { EvaluationSummary } from "@/types/dashboard";
import { Shield, ShieldAlert, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";

interface KpiCardsProps {
  summary: EvaluationSummary;
  activeCategory?: string;
  onSelectCategory?: (category: "ALL" | "blocking" | "warning" | "exempted") => void;
}

export function KpiCards({ summary, activeCategory, onSelectCategory }: KpiCardsProps) {
  const total = summary.total_findings ?? 0;
  const blocking = summary.blocking_count ?? 0;
  const warning = summary.warning_count ?? 0;
  const exempted = summary.exempted ?? 0;

  const cards = [
    {
      id: "ALL" as const,
      label: "Total Findings",
      value: total,
      subtext: "Aggregated across all scanners",
      badge: "Full Scope",
      icon: <Shield className="w-4 h-4 text-slate-600 dark:text-slate-300" />,
      valueColor: "text-slate-900 dark:text-slate-100",
      accentBg: "bg-slate-100 dark:bg-slate-800",
      borderAccent: "hover:border-slate-400 dark:hover:border-slate-600",
      activeRing: "ring-2 ring-slate-400 dark:ring-slate-500",
      pillBg: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
    },
    {
      id: "blocking" as const,
      label: "Blocking Violations",
      value: blocking,
      subtext: "Strict policy threshold exceeded",
      badge: blocking > 0 ? "Fails Gate" : "Clean",
      icon: <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />,
      valueColor: blocking > 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-100",
      accentBg: blocking > 0 ? "bg-red-50 dark:bg-red-950/50" : "bg-slate-100 dark:bg-slate-800",
      borderAccent: "hover:border-red-300 dark:hover:border-red-800",
      activeRing: "ring-2 ring-red-500 dark:ring-red-500",
      pillBg: blocking > 0 ? "bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
    },
    {
      id: "warning" as const,
      label: "Advisory Warnings",
      value: warning,
      subtext: "Non-blocking security review",
      badge: warning > 0 ? "Action Recommended" : "None",
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
      valueColor: warning > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-slate-100",
      accentBg: warning > 0 ? "bg-amber-50 dark:bg-amber-950/50" : "bg-slate-100 dark:bg-slate-800",
      borderAccent: "hover:border-amber-300 dark:hover:border-amber-800",
      activeRing: "ring-2 ring-amber-500 dark:ring-amber-500",
      pillBg: warning > 0 ? "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
    },
    {
      id: "exempted" as const,
      label: "Exempted Findings",
      value: exempted,
      subtext: "Rule-based policy waivers",
      badge: exempted > 0 ? "Active Waivers" : "No Waivers",
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      valueColor: "text-slate-900 dark:text-slate-100",
      accentBg: exempted > 0 ? "bg-emerald-50 dark:bg-emerald-950/50" : "bg-slate-100 dark:bg-slate-800",
      borderAccent: "hover:border-emerald-300 dark:hover:border-emerald-800",
      activeRing: "ring-2 ring-emerald-500 dark:ring-emerald-500",
      pillBg: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
    },
  ];

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      role="region"
      aria-label="Key Performance Indicators"
    >
      {cards.map((c) => {
        const isSelected = activeCategory === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelectCategory?.(c.id)}
            className={`relative bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs text-left transition-all hover:shadow-xs cursor-pointer group ${c.borderAccent} ${
              isSelected ? c.activeRing : ""
            }`}
            title={`Filter findings by ${c.label}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 tracking-tight">
                {c.label}
              </span>
              <div
                className={`p-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 ${c.accentBg} transition-transform group-hover:scale-105`}
              >
                {c.icon}
              </div>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <span className={`text-3xl font-extrabold tracking-tight ${c.valueColor}`}>
                {c.value}
              </span>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80">
                {c.badge}
              </span>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <span className="truncate">{c.subtext}</span>
              <span className="text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-100 group-hover:translate-x-0.5 transition-transform shrink-0 ml-1">
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

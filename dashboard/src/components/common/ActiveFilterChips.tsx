import React from "react";
import { X, RotateCcw } from "lucide-react";

export interface ActiveFilter {
  id: string;
  label: string;
  value: string;
  displayValue: string;
}

interface ActiveFilterChipsProps {
  filters: ActiveFilter[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

export function ActiveFilterChips({
  filters,
  onRemove,
  onClearAll,
}: ActiveFilterChipsProps) {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
      <span className="text-slate-400 dark:text-slate-500 font-medium text-[11px] uppercase tracking-wider">
        Active Filters:
      </span>
      {filters.map((f) => (
        <span
          key={f.id}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
        >
          <span className="text-slate-400 dark:text-slate-400 text-[11px]">{f.label}:</span>
          <span className="font-semibold">{f.displayValue}</span>
          <button
            type="button"
            onClick={() => onRemove(f.id)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label={`Remove filter for ${f.label}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="inline-flex items-center gap-1 text-xs text-[#0D9488] dark:text-teal-400 hover:underline cursor-pointer font-medium ml-1"
      >
        <RotateCcw className="w-3 h-3" />
        <span>Clear all</span>
      </button>
    </div>
  );
}


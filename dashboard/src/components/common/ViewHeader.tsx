import React from "react";

interface ViewHeaderProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  isPresentationTitle?: boolean;
  editorialIntro?: string;
}

export function ViewHeader({
  title,
  description,
  icon,
  badge,
  actions,
  isPresentationTitle = false,
  editorialIntro,
}: ViewHeaderProps) {
  return (
    <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xs transition-colors mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2.5 flex-wrap">
            {icon && (
              <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700">
                {icon}
              </div>
            )}
            <h1
              className={`text-base sm:text-lg tracking-tight leading-snug ${
                isPresentationTitle
                  ? "font-presentation-title text-slate-900 dark:text-slate-100"
                  : "font-bold text-slate-900 dark:text-slate-100 font-sans"
              }`}
            >
              {title}
            </h1>
            {badge}
          </div>

          {editorialIntro && (
            <p className="font-editorial-intro text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              {editorialIntro}
            </p>
          )}

          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed font-sans">
            {description}
          </p>
        </div>

        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

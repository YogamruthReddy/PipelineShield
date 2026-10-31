"use client";

import React from "react";
import { ViewHeader } from "../common/ViewHeader";
import { useTheme, Theme } from "@/lib/theme";
import {
  Settings,
  Shield,
  Layers,
  BookOpen,
  Sun,
  Moon,
  Laptop,
  Command,
} from "lucide-react";

export function SettingsView() {
  const { theme, setTheme } = useTheme();

  const themes: Array<{ id: Theme; label: string; icon: React.ReactNode; desc: string }> = [
    {
      id: "light",
      label: "Light",
      icon: <Sun className="w-4 h-4 text-amber-500" />,
      desc: "Clean high-contrast theme optimized for daytime reading",
    },
    {
      id: "dark",
      label: "Dark",
      icon: <Moon className="w-4 h-4 text-sky-400" />,
      desc: "Deep enterprise palette for reduced eye fatigue",
    },
    {
      id: "system",
      label: "System",
      icon: <Laptop className="w-4 h-4 text-teal-500" />,
      desc: "Automatically adapts to your operating system preference",
    },
  ];

  const shortcuts = [
    { key: "/", desc: "Focus vulnerability search bar from anywhere" },
    { key: "Esc", desc: "Dismiss finding details drawer or modal" },
    { key: "Ctrl + P", desc: "Trigger printer / PDF export layout" },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <ViewHeader
        title="Dashboard Preferences & Architecture"
        description="Theme customization, keyboard navigation shortcuts, runtime specifications, and system contracts."
        icon={<Settings className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
      />

      {/* Theme Preference Card */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4 transition-colors">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sun className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>Appearance & Theme Mode</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Choose how PipelineShield looks to you. Preferences are saved locally in your browser.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {themes.map((t) => {
            const isSelected = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer shadow-2xs space-y-2 ${
                  isSelected
                    ? "bg-teal-50/50 dark:bg-teal-950/40 border-teal-500 dark:border-teal-400 ring-2 ring-teal-500/20"
                    : "bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                    {t.label}
                  </span>
                  {t.icon}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Keyboard Shortcuts Card */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4 transition-colors">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Command className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>Keyboard Shortcuts</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Accelerate triage workflows with quick keyboard bindings.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {shortcuts.map((s) => (
            <div
              key={s.key}
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1.5"
            >
              <kbd className="px-2 py-1 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md shadow-2xs text-slate-800 dark:text-slate-200 inline-block">
                {s.key}
              </kbd>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* System Specifications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Core System Specifications */}
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3 transition-colors">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Shield className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              System Specifications
            </h3>
          </div>
          <div className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 dark:text-slate-500">Gatekeeper Engine:</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">v0.1.0-alpha</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 dark:text-slate-500">Canonical Repository:</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">YogamruthReddy/PipelineShield</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 dark:text-slate-500">Default Branch:</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">main</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 dark:text-slate-500">Deployment Target:</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">Vercel Edge</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400 dark:text-slate-500">Database Requirement:</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">Stateless (No DB required)</span>
            </div>
          </div>
        </div>

        {/* Open Source Tooling Stack */}
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3 transition-colors">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Open-Source Tooling Stack
            </h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="font-mono text-slate-900 dark:text-slate-100">Trivy (Aqua Security)</span>
              <span className="text-slate-400 dark:text-slate-500">Apache 2.0</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="font-mono text-slate-900 dark:text-slate-100">Semgrep (Semgrep Inc.)</span>
              <span className="text-slate-400 dark:text-slate-500">LGPL 2.1</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="font-mono text-slate-900 dark:text-slate-100">GitHub Dependency Review</span>
              <span className="text-slate-400 dark:text-slate-500">GitHub Native Action</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="font-mono text-slate-900 dark:text-slate-100">Next.js 16 + React 19 + Tailwind v4</span>
              <span className="text-slate-400 dark:text-slate-500">MIT License</span>
            </div>
          </div>
        </div>

        {/* Documentation References */}
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3 md:col-span-2 transition-colors">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <BookOpen className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Repository Architecture & Documentation
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="font-bold text-slate-900 dark:text-slate-100 block">Architecture Specification</span>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                Detailed data flow, normalization rules, and policy evaluation lifecycle.
              </p>
              <div className="pt-1 font-mono text-[10px] text-teal-600 dark:text-teal-400 font-semibold">
                docs/architecture.md
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="font-bold text-slate-900 dark:text-slate-100 block">Testing Strategy</span>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                Unit test specs, integration verifiers, and contract test definitions.
              </p>
              <div className="pt-1 font-mono text-[10px] text-teal-600 dark:text-teal-400 font-semibold">
                docs/testing.md
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="font-bold text-slate-900 dark:text-slate-100 block">Contributing Guide</span>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                Development guidelines, branch model, pull request protocol, and license notice.
              </p>
              <div className="pt-1 font-mono text-[10px] text-teal-600 dark:text-teal-400 font-semibold">
                CONTRIBUTING.md
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

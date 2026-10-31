"use client";

import React from "react";
import Image from "next/image";
import { DashboardView } from "@/types/dashboard";
import {
  Shield,
  AlertTriangle,
  Activity,
  BookOpen,
  FileText,
  GitBranch,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface SidebarProps {
  currentView: DashboardView;
  onSelectView: (view: DashboardView) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  findingsCount: number;
  blockingCount: number;
}

export function Sidebar({
  currentView,
  onSelectView,
  collapsed,
  onToggleCollapse,
  findingsCount,
  blockingCount,
}: SidebarProps) {
  const navItems = [
    {
      id: "overview" as DashboardView,
      label: "Overview",
      icon: <Shield className="w-4 h-4 shrink-0" />,
      badge: null,
    },
    {
      id: "findings" as DashboardView,
      label: "Security Findings",
      icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
      badge: findingsCount > 0 ? (
        <span
          className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full font-mono ${
            blockingCount > 0
              ? "bg-red-50 text-red-700 dark:bg-red-950/80 dark:text-red-300 border border-red-200 dark:border-red-800"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
          }`}
        >
          {findingsCount}
        </span>
      ) : null,
    },
    {
      id: "scanners" as DashboardView,
      label: "Scanners",
      icon: <Activity className="w-4 h-4 shrink-0" />,
      badge: null,
    },
    {
      id: "policy" as DashboardView,
      label: "Policy Rules",
      icon: <BookOpen className="w-4 h-4 shrink-0" />,
      badge: null,
    },
    {
      id: "reports" as DashboardView,
      label: "Reports & Exports",
      icon: <FileText className="w-4 h-4 shrink-0" />,
      badge: null,
    },
    {
      id: "runs" as DashboardView,
      label: "CI/CD Runs",
      icon: <GitBranch className="w-4 h-4 shrink-0" />,
      badge: null,
    },
    {
      id: "settings" as DashboardView,
      label: "Settings",
      icon: <Settings className="w-4 h-4 shrink-0" />,
      badge: null,
    },
  ];

  return (
    <aside
      className={`no-print bg-white dark:bg-[#111827] border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-200 z-30 shrink-0 select-none ${
        collapsed ? "w-16" : "w-64"
      }`}
      aria-label="Dashboard Navigation Sidebar"
    >
      {/* Brand Header */}
      <div className="h-14 border-b border-slate-200 dark:border-slate-800 px-3.5 flex items-center justify-between">
        {!collapsed ? (
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-slate-800 p-1 flex items-center justify-center shrink-0 border border-teal-200/80 dark:border-slate-700 shadow-2xs">
              <Image
                src="/shield-icon.png"
                alt="PipelineShield Logo"
                width={24}
                height={24}
                className="object-contain"
                priority
              />
            </div>
            <div className="truncate">
              <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100 block truncate">
                PipelineShield
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 block truncate font-medium">
                DevSecOps Gatekeeper
              </span>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-8 h-8 rounded-lg bg-teal-50 dark:bg-slate-800 p-1 flex items-center justify-center border border-teal-200/80 dark:border-slate-700 shadow-2xs">
            <Image
              src="/shield-icon.png"
              alt="PipelineShield Logo"
              width={24}
              height={24}
              className="object-contain"
              priority
            />
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto" aria-label="Main Navigation">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                isActive
                  ? "bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-semibold border border-teal-200/70 dark:border-teal-800/80 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              }`}
            >
              <span className={isActive ? "text-teal-700 dark:text-teal-400" : "text-slate-400 dark:text-slate-500"}>
                {item.icon}
              </span>
              {!collapsed && (
                <span className="flex-1 truncate">{item.label}</span>
              )}
              {!collapsed && item.badge}
            </button>
          );
        })}
      </nav>

      {/* Bottom Footer & Collapse Toggle */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
        {!collapsed && (
          <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span className="font-mono">Gate Status</span>
            <span
              className={`font-semibold font-mono text-[10px] px-1.5 py-0.5 rounded ${
                blockingCount > 0
                  ? "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900"
                  : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900"
              }`}
            >
              {blockingCount > 0 ? "BLOCKING" : "CLEAR"}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label={collapsed ? "Expand sidebar navigation" : "Collapse sidebar navigation"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <div className="flex items-center space-x-2 text-xs font-medium">
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse Sidebar</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}

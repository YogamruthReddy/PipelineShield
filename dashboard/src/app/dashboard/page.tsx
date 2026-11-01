"use client";

import React, { Suspense } from "react";
import DashboardContent from "./DashboardContent";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B0F17] text-slate-500 font-mono text-xs">
          Loading PipelineShield DevSecOps Console...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}


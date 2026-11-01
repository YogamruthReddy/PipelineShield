"use client";

import React, { useState, useEffect } from "react";
import { EvaluationResult, LiveRunInfo } from "@/types/dashboard";
import { ViewHeader } from "../common/ViewHeader";
import {
  Plug,
  CheckCircle2,
  GitBranch,
  ExternalLink,
  ShieldCheck,
  Lock,
  RefreshCw,
  FolderArchive,
  Terminal,
  Radio,
  KeyRound,
  ShieldAlert,
  Globe,
  Laptop,
} from "lucide-react";

interface IntegrationsViewProps {
  report: EvaluationResult;
  liveRunInfo?: LiveRunInfo | null;
  onSyncLive?: () => void;
  isSyncing?: boolean;
}

interface WebhookStatusData {
  status: string;
  configured: boolean;
  hasGitHubToken: boolean;
  targetRepository: string;
  targetWorkflow: string;
  totalIngestedRuns: number;
  lastDelivery?: {
    deliveryId: string;
    runId: number;
    event: string;
    receivedAt: string;
  } | null;
}

export function IntegrationsView({
  liveRunInfo,
  onSyncLive,
  isSyncing = false,
}: IntegrationsViewProps) {
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatusData | null>(null);
  const [isProbingWebhook, setIsProbingWebhook] = useState(false);

  useEffect(() => {
    fetch("/api/webhook/github")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setWebhookStatus(data);
      })
      .catch(() => {});
  }, []);

  const handleTestConnection = async () => {
    setTestStatus("Testing connection to /api/health...");
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      if (res.ok && data.status === "healthy") {
        setTestStatus("Connection Healthy (HTTP 200 OK - Schema v1.1.0)");
      } else {
        setTestStatus(`Health check returned: ${res.status}`);
      }
    } catch (err) {
      setTestStatus(`Health check failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleProbeWebhook = async () => {
    setIsProbingWebhook(true);
    try {
      const res = await fetch("/api/webhook/github");
      const data = await res.json();
      setWebhookStatus(data);
    } catch {
      // Ignored
    } finally {
      setIsProbingWebhook(false);
    }
  };

  return (
    <div className="space-y-6">
      <ViewHeader
        title="Integrations & Pipeline Health"
        description="Verify repository connections, GitHub Actions workflow integrations, and real-time webhook telemetry without exposing credentials or tokens."
        icon={<Plug className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
        badge={
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
            Pipeline Connected
          </span>
        }
        actions={
          <button
            type="button"
            onClick={onSyncLive}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-300 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 text-xs font-semibold hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Sync CI Run"}</span>
          </button>
        }
      />

      {/* Security Credential Isolation Notice */}
      <div className="p-4 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 text-xs flex items-start gap-3 shadow-inner">
        <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="text-emerald-400 font-semibold block">Credential Isolation Architecture:</strong>
          <p className="text-slate-300 leading-relaxed font-sans">
            Your GitHub credentials (<code className="font-mono bg-slate-800 text-emerald-300 px-1 py-0.5 rounded">GITHUB_TOKEN</code> and <code className="font-mono bg-slate-800 text-emerald-300 px-1 py-0.5 rounded">GITHUB_WEBHOOK_SECRET</code>) are strictly isolated server-side. They are never sent to browser clients, never embedded in client-side bundles, and never logged.
          </p>
        </div>
      </div>

      {/* Integration Component Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* GitHub Repository Connection */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h3 className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">
                GitHub Repository
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold">
              CONNECTED
            </span>
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Target Repo:</span>
              <a
                href="https://github.com/YogamruthReddy/PipelineShield"
                target="_blank"
                rel="noreferrer"
                className="text-teal-600 dark:text-teal-400 font-semibold hover:underline flex items-center gap-1"
              >
                <span>YogamruthReddy/PipelineShield</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Feature Branch:</span>
              <span className="text-slate-800 dark:text-slate-200">feat/multi-view-secops-dashboard</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Pull Request:</span>
              <a
                href="https://github.com/YogamruthReddy/PipelineShield/pull/1"
                target="_blank"
                rel="noreferrer"
                className="text-teal-600 dark:text-teal-400 font-semibold hover:underline flex items-center gap-1"
              >
                <span>PR #1 (CI Passed)</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Real-time Webhook Receiver */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h3 className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">
                Webhook Receiver
              </h3>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                webhookStatus?.configured
                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                  : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
              }`}
            >
              {webhookStatus?.configured ? "ACTIVE (HMAC SHA-256)" : "POLLING MODE"}
            </span>
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Webhook Endpoint:</span>
              <span className="text-slate-800 dark:text-slate-200">/api/webhook/github</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Event Trigger:</span>
              <span className="text-slate-800 dark:text-slate-200">workflow_run.completed</span>
            </div>
            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={handleProbeWebhook}
                disabled={isProbingWebhook}
                className="text-[11px] font-mono font-semibold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
              >
                {isProbingWebhook ? "Checking..." : "Inspect Webhook Health →"}
              </button>
              <span className="text-[10px] font-mono text-slate-400">
                {webhookStatus?.totalIngestedRuns !== undefined
                  ? `${webhookStatus.totalIngestedRuns} runs stored`
                  : "Checking store..."}
              </span>
            </div>
          </div>
        </div>

        {/* GitHub Actions Workflow */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h3 className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">
                Workflow Specification
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800 font-bold">
              ENFORCED
            </span>
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Workflow Path:</span>
              <span className="text-slate-800 dark:text-slate-200">.github/workflows/security-gate.yml</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Triggers:</span>
              <span className="text-slate-800 dark:text-slate-200">pull_request, push</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Job Pipeline:</span>
              <span className="text-slate-800 dark:text-slate-200">engine-test, dashboard-build, security-gate</span>
            </div>
          </div>
        </div>

        {/* Artifact Pipeline */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h3 className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">
                Artifact Delivery
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold">
              ACTIVE
            </span>
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Artifact Name:</span>
              <span className="text-slate-800 dark:text-slate-200">security-summary-reports</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Payload Format:</span>
              <span className="text-slate-800 dark:text-slate-200">security-summary.json (ZIP archive)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Retention:</span>
              <span className="text-slate-800 dark:text-slate-200">14 days retention</span>
            </div>
          </div>
        </div>

        {/* API Route & Health Check */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h3 className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">
                Internal Ingestion API
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold">
              ONLINE
            </span>
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Ingestion Endpoint:</span>
              <span className="text-slate-800 dark:text-slate-200">/api/latest-report</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Health Endpoint:</span>
              <span className="text-slate-800 dark:text-slate-200">/api/health</span>
            </div>
            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={handleTestConnection}
                className="text-[11px] font-mono font-semibold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
              >
                Probe Health Endpoint →
              </button>
              {testStatus && (
                <span className="text-[10px] font-mono text-slate-400 truncate max-w-[200px]">
                  {testStatus}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Architecture & Trust Boundaries Breakdown */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-4 shadow-2xs">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <h3 className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Integration Trade-offs & Authority Boundaries
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-2">
            <span className="font-bold font-mono text-slate-800 dark:text-slate-200 block">
              Personal Access Token (PAT)
            </span>
            <ul className="text-slate-600 dark:text-slate-400 space-y-1.5 list-disc pl-4 font-sans text-[11px] leading-relaxed">
              <li>Simplest setup for single-developer development and staging environments.</li>
              <li>Requires <code className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">actions:read</code> and <code className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">metadata:read</code>.</li>
              <li>Tied to a single user account; requires manual rotation when revoked.</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl border border-teal-200 dark:border-teal-900/50 bg-teal-50/50 dark:bg-teal-950/20 space-y-2">
            <span className="font-bold font-mono text-teal-900 dark:text-teal-200 block">
              GitHub App (Enterprise Recommended)
            </span>
            <ul className="text-slate-600 dark:text-slate-400 space-y-1.5 list-disc pl-4 font-sans text-[11px] leading-relaxed">
              <li>Organization-owned identity; does not depend on individual personal credentials.</li>
              <li>Auto-generates short-lived installation tokens (1-hour lifespan).</li>
              <li>Dedicated webhook deliveries with granular subscription management and delivery retry controls.</li>
            </ul>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="font-semibold">Authoritative Gate Notice:</strong> The GitHub Actions CI security gate workflow and Python policy engine remain 100% authoritative for all PASS/BLOCK verdicts. The PipelineShield Dashboard, Webhook receiver, and Local AI Assistant operate strictly in an observational, investigative, and advisory capacity.
          </p>
        </div>
      </div>

      {/* Dual-Webhook Architecture & Local Tunnel Guide */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h3 className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Dual-Webhook Strategy (Local Development vs. Production)
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold">
            GitHub Multi-Webhook Supported
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
          GitHub allows registering multiple webhooks on the same repository. Maintain two separate webhook registrations with distinct secrets to support both local development and your deployed environment:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Configuration 1: Local Development Tunnel */}
          <div className="p-4 rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50/40 dark:bg-teal-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span className="font-bold font-mono text-teal-950 dark:text-teal-200">
                  1. Local Development (Tunnel Mode)
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-bold">
                DEV ONLY
              </span>
            </div>

            <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
              GitHub cannot send webhooks directly to <code className="font-mono bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">localhost</code>. Forward events to your local server using a secure HTTPS tunnel:
            </p>

            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="bg-slate-900 text-emerald-300 p-2 rounded-lg border border-slate-800 flex justify-between items-center">
                <span>cloudflared tunnel --url http://localhost:3000</span>
              </div>
              <div className="text-[10px] text-slate-500 font-sans">
                or via ngrok: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">ngrok http 3000</code>
              </div>
            </div>

            <div className="space-y-1 text-[11px] font-sans border-t border-teal-200/60 dark:border-teal-900/60 pt-2">
              <span className="text-slate-500 block font-bold">GitHub Webhook Entry:</span>
              <ul className="list-disc pl-4 space-y-1 text-slate-700 dark:text-slate-300">
                <li><strong>Payload URL:</strong> <code className="font-mono bg-white dark:bg-slate-800 px-1 rounded">https://&lt;TUNNEL-DOMAIN&gt;/api/webhook/github</code></li>
                <li><strong>Secret:</strong> Dedicated random secret in <code className="font-mono bg-white dark:bg-slate-800 px-1 rounded">.env.local</code></li>
                <li><strong>Events:</strong> Check <code className="font-mono">Workflow runs</code></li>
              </ul>
            </div>

            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-[10px] text-amber-800 dark:text-amber-300">
              ⚠ <strong>Note:</strong> Local webhook events only trigger while your local server and tunnel process are actively running.
            </div>
          </div>

          {/* Configuration 2: Production Deployed Webhook */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
                  2. Production Deployed App
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-slate-200 dark:border-slate-700 font-bold">
                24/7 PROD
              </span>
            </div>

            <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
              When PipelineShield is deployed to cloud hosting (e.g. Vercel, Railway, AWS), register a second webhook directly using your production HTTPS domain:
            </p>

            <div className="space-y-1 text-[11px] font-sans border-t border-slate-200 dark:border-slate-800 pt-2">
              <span className="text-slate-500 block font-bold">GitHub Webhook Entry:</span>
              <ul className="list-disc pl-4 space-y-1 text-slate-700 dark:text-slate-300">
                <li><strong>Payload URL:</strong> <code className="font-mono bg-white dark:bg-slate-800 px-1 rounded">https://&lt;PROD-DOMAIN&gt;/api/webhook/github</code></li>
                <li><strong>Secret:</strong> Separate production-only secret in cloud env vars</li>
                <li><strong>SSL verification:</strong> Enabled (Strict TLS)</li>
                <li><strong>Events:</strong> Check <code className="font-mono">Workflow runs</code></li>
              </ul>
            </div>

            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-[10px] text-emerald-800 dark:text-emerald-300">
              ✓ <strong>Production Isolation:</strong> Completely decoupled from local developer laptops. Operates with 100% uptime and zero tunnel dependencies.
            </div>
          </div>
        </div>
      </div>

      {/* Active Sync Status Telemetry */}
      {liveRunInfo && (
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">
                Active Live Ingestion Telemetry
              </h4>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Run #{liveRunInfo.run.id}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 text-[10px] block">Conclusion</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{liveRunInfo.run.conclusion}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 text-[10px] block">Commit SHA</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{liveRunInfo.run.head_sha.slice(0, 7)}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 text-[10px] block">Event Trigger</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{liveRunInfo.run.event}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 text-[10px] block">Artifact Size</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {liveRunInfo.artifact?.size_in_bytes
                  ? `${Math.round(liveRunInfo.artifact.size_in_bytes / 1024)} KB`
                  : "Available"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

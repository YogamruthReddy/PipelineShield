"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  EvaluationResult,
  ProcessedFinding,
  LocalAIStatus,
  LocalAIResponse,
  LocalAIAction,
  LocalAIHistoryItem,
} from "@/types/dashboard";
import { SAMPLE_REPORTS } from "@/data/sample-reports";
import { ViewHeader } from "../common/ViewHeader";
import { CopyButton } from "../common/CopyButton";
import { SeverityBadge } from "../SeverityBadge";
import { AIResponseRenderer } from "../common/AIResponseRenderer";
import {
  Bot,
  Cpu,
  RefreshCw,
  XCircle,
  HelpCircle,
  Terminal,
  ShieldAlert,
  Sparkles,
  Lock,
  ChevronDown,
  Layers,
  Send,
  MessageSquare,
  History,
  Trash2,
  ShieldCheck,
  FileCheck2,
  Radio,
  SlidersHorizontal,
  FileText,
} from "lucide-react";

interface LocalAIViewProps {
  report: EvaluationResult;
  findings: ProcessedFinding[];
  isDemoActive?: boolean;
}

const AVAILABLE_MODELS = [
  { id: "qwen2.5:3b", name: "Qwen 2.5 (3B)", footprint: "~1.9 GB download / ~3.2 GB RAM", recommended: true },
  { id: "llama3.2:3b", name: "Llama 3.2 (3B)", footprint: "~2.0 GB download / ~3.4 GB RAM", recommended: false },
  { id: "mistral:7b", name: "Mistral (7B)", footprint: "~4.1 GB download / ~5.5 GB RAM", recommended: false },
];

const TASK_TEMPLATES: {
  id: LocalAIAction;
  label: string;
  badge: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    id: "explain_finding",
    label: "Finding Investigation",
    badge: "Explain",
    icon: <HelpCircle size={15} className="text-teal-600" />,
    description: "Plain-language root cause, evidence references, impact, and uncertainty disclosure.",
  },
  {
    id: "suggest_remediation",
    label: "Remediation Planner",
    badge: "Fix Steps",
    icon: <Terminal size={15} className="text-blue-600" />,
    description: "Prioritized step-by-step remediation plan with safe local validation commands.",
  },
  {
    id: "threat_context",
    label: "Threat Context",
    badge: "CVE / CWE",
    icon: <ShieldAlert size={15} className="text-amber-600" />,
    description: "Detailed vulnerability taxonomy and attack vectors grounded strictly in report facts.",
  },
  {
    id: "verify_fix",
    label: "Fix Verification Assistant",
    badge: "Comparison",
    icon: <FileCheck2 size={15} className="text-emerald-600" />,
    description: "Compares finding against a later CI report to assess if resolved, modified, or persistent.",
  },
  {
    id: "summarize_scan",
    label: "Scan Briefing",
    badge: "Executive",
    icon: <Layers size={15} className="text-purple-600" />,
    description: "High-level briefing summarizing severity distribution, gate outcome, and scanner health.",
  },
  {
    id: "ask_chat",
    label: "Interactive Chat",
    badge: "Q&A",
    icon: <MessageSquare size={15} className="text-indigo-600" />,
    description: "Ask custom follow-up questions grounded strictly in active report evidence.",
  },
];

export function LocalAIView({ report, findings, isDemoActive = false }: LocalAIViewProps) {
  // Runtime status state
  const [status, setStatus] = useState<LocalAIStatus | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>("qwen2.5:3b");
  const [customModelInput, setCustomModelInput] = useState<string>("");

  // Copilot interaction state
  const [activeAction, setActiveAction] = useState<LocalAIAction>("explain_finding");
  const [selectedFindingId, setSelectedFindingId] = useState<string>(findings[0]?.id || "");
  const [responseLength, setResponseLength] = useState<"concise" | "balanced" | "detailed">("balanced");
  const [customChatQuery, setCustomChatQuery] = useState<string>("");
  const [comparisonReportKey, setComparisonReportKey] = useState<string>("clean");

  // Execution feedback states
  const [isLoadingCopilot, setIsLoadingCopilot] = useState<boolean>(false);
  const [copilotResponse, setCopilotResponse] = useState<LocalAIResponse | null>(null);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [showGroundingPayload, setShowGroundingPayload] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"copilot" | "history" | "safety">("copilot");

  // Local History state (browser-only localStorage)
  const [historyItems, setHistoryItems] = useState<LocalAIHistoryItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("pipelineshield_ai_history");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Active selected finding
  const activeFinding = useMemo(() => {
    return findings.find((f) => f.id === selectedFindingId) || findings[0];
  }, [findings, selectedFindingId]);

  // Later report findings for comparison in fix verification
  const laterReportFindings = useMemo(() => {
    const sample = SAMPLE_REPORTS[comparisonReportKey];
    if (sample && sample.data && Array.isArray(sample.data.findings)) {
      return sample.data.findings;
    }
    return [];
  }, [comparisonReportKey]);

  // Manual connection test
  const checkConnection = useCallback(async () => {
    setIsCheckingStatus(true);
    try {
      const res = await fetch("/api/local-ai", { cache: "no-store" });
      const data = await res.json();
      setStatus(data);
      if (data.configuredModel) {
        setSelectedModel(data.configuredModel);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus({
        available: false,
        runtimeUrl: "http://127.0.0.1:11434",
        configuredModel: selectedModel,
        modelInstalled: false,
        installedModels: [],
        error: `Failed to probe local runtime: ${msg}`,
        requirements: {
          runtime: "Ollama v0.1.30+ running locally",
          recommendedModel: "qwen2.5:3b (3B parameter class)",
          diskFootprint: "~1.9 GB download / ~3.2 GB RAM",
        },
        setupGuide: {
          installCommand: "curl -fsSL https://ollama.com/install.sh | sh",
          pullCommand: `ollama pull ${selectedModel}`,
          serveCommand: "ollama serve",
        },
      });
    } finally {
      setIsCheckingStatus(false);
    }
  }, [selectedModel]);

  // Initial connection probe on mount
  useEffect(() => {
    let ignore = false;
    fetch("/api/local-ai", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) {
          setStatus(data);
          if (data.configuredModel) {
            setSelectedModel(data.configuredModel);
          }
        }
      })
      .catch((err) => {
        if (!ignore) {
          setStatus({
            available: false,
            runtimeUrl: "http://127.0.0.1:11434",
            configuredModel: "qwen2.5:3b",
            modelInstalled: false,
            installedModels: [],
            error: String(err),
            requirements: {
              runtime: "Ollama v0.1.30+ running locally",
              recommendedModel: "qwen2.5:3b (3B parameter class)",
              diskFootprint: "~1.9 GB download / ~3.2 GB RAM",
            },
            setupGuide: {
              installCommand: "curl -fsSL https://ollama.com/install.sh | sh",
              pullCommand: "ollama pull qwen2.5:3b",
              serveCommand: "ollama serve",
            },
          });
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Save item to history
  const saveToHistory = (item: LocalAIHistoryItem) => {
    setHistoryItems((prev) => {
      const updated = [item, ...prev.slice(0, 49)]; // Cap history to 50 items
      try {
        localStorage.setItem("pipelineshield_ai_history", JSON.stringify(updated));
      } catch {
        // quota exceeded or private mode
      }
      return updated;
    });
  };

  const handleClearHistory = () => {
    if (confirm("Clear all locally stored assistant interaction history?")) {
      setHistoryItems([]);
      try {
        localStorage.removeItem("pipelineshield_ai_history");
      } catch {
        // ignore
      }
    }
  };

  // Execute Grounded Copilot Action
  const handleExecuteAction = async (actionToRun: LocalAIAction = activeAction) => {
    setIsLoadingCopilot(true);
    setCopilotError(null);
    setCopilotResponse(null);

    const targetModel = customModelInput.trim() || selectedModel;

    let payload: Record<string, unknown> = {
      action: actionToRun,
      model: targetModel,
      responseLength,
    };

    if (
      actionToRun === "explain_finding" ||
      actionToRun === "suggest_remediation" ||
      actionToRun === "threat_context" ||
      actionToRun === "verify_fix"
    ) {
      if (!activeFinding) {
        setCopilotError("No finding selected for analysis.");
        setIsLoadingCopilot(false);
        return;
      }
      payload = {
        ...payload,
        finding: {
          id: activeFinding.id,
          scanner: activeFinding.scanner,
          title: activeFinding.title,
          description: activeFinding.description,
          severity: activeFinding.severity,
          file_path: activeFinding.file_path,
          line_number: activeFinding.line_number,
          package_name: activeFinding.package_name,
          installed_version: activeFinding.installed_version,
          fixed_version: activeFinding.fixed_version,
          cwe_ids: activeFinding.cwe_ids,
          remediation: activeFinding.remediation,
        },
      };

      if (actionToRun === "verify_fix") {
        payload.laterReportFindings = laterReportFindings;
      }
    } else if (actionToRun === "summarize_scan") {
      payload = {
        ...payload,
        reportSummary: {
          decision: report.decision,
          reasons: report.reasons,
          summary: report.summary,
          scanner_status: report.scanner_status,
          evaluated_at: report.evaluated_at,
        },
      };
    } else if (actionToRun === "ask_chat") {
      if (!customChatQuery.trim()) {
        setCopilotError("Please enter a question about the active security report.");
        setIsLoadingCopilot(false);
        return;
      }
      payload = {
        ...payload,
        customQuery: customChatQuery.trim(),
        finding: activeFinding ? {
          id: activeFinding.id,
          title: activeFinding.title,
          severity: activeFinding.severity,
          package_name: activeFinding.package_name,
          file_path: activeFinding.file_path,
        } : undefined,
        reportSummary: {
          decision: report.decision,
          summary: report.summary,
        },
      };
    }

    try {
      const res = await fetch("/api/local-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setCopilotError(data.error || `Error ${res.status}: Request failed.`);
      } else {
        setCopilotResponse(data);
        const timestamp = data.timestamp || "2026-11-01T00:00:00.000Z";
        saveToHistory({
          id: `hist-${actionToRun}-${timestamp}`,
          timestamp,
          action: actionToRun,
          model: targetModel,
          findingId: activeFinding?.id,
          query: actionToRun === "ask_chat" ? customChatQuery.trim() : undefined,
          response: data.response,
          confidence: data.confidence,
          uncertainties: data.uncertainties,
          evidenceReferences: data.evidenceReferences,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCopilotError(`Failed to reach /api/local-ai: ${msg}`);
    } finally {
      setIsLoadingCopilot(false);
    }
  };

  const handleExportJson = () => {
    if (!copilotResponse) return;
    const blob = new Blob([JSON.stringify(copilotResponse, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipelineshield-ai-${activeAction}-${copilotResponse.timestamp?.replace(/[:.]/g, "-") || "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isRuntimeOnline = status?.available;
  const currentModelInstalled = status?.modelInstalled;

  return (
    <div className="space-y-6">
      <ViewHeader
        title="Local AI Security Investigation Copilot"
        description="Grounded, evidence-backed security investigation assistant running entirely locally on your machine via Ollama. Advisory-only: zero authority over CI gate decisions."
        badge={
          <span className="text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
            {isDemoActive ? "Synthetic Demo Data" : "Workspace Advisory"}
          </span>
        }
      />

      {/* Advisory Guardrail Banner */}
      <div className="bg-teal-50/70 border border-teal-200/90 rounded-2xl p-4 flex items-start justify-between gap-3 shadow-2xs">
        <div className="flex items-start gap-3">
          <Sparkles size={18} className="text-teal-700 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-teal-900 leading-relaxed">
            <strong>Advisory Boundary &amp; Evidence Grounding:</strong> Local AI operates strictly as
            a non-authoritative investigation assistant. It <strong>cannot override CI gate verdicts</strong> (BLOCK/WARN/PASS),
            cannot execute shell commands, and cannot edit repository files. All statements are grounded
            in supplied scanner telemetry.
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setActiveTab("copilot")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              activeTab === "copilot"
                ? "bg-teal-700 text-white shadow-xs"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            Copilot
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              activeTab === "history"
                ? "bg-teal-700 text-white shadow-xs"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <History size={12} />
            History ({historyItems.length})
          </button>
          <button
            onClick={() => setActiveTab("safety")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              activeTab === "safety"
                ? "bg-teal-700 text-white shadow-xs"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Lock size={12} />
            Privacy &amp; Safety
          </button>
        </div>
      </div>

      {/* Top 3-Col Runtime & Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Runtime Status Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    isCheckingStatus
                      ? "bg-blue-500 animate-ping"
                      : isRuntimeOnline
                      ? "bg-emerald-500"
                      : "bg-red-500"
                  }`}
                />
                <span className="font-bold text-slate-800 text-sm">Ollama Runtime</span>
              </div>
              <button
                onClick={checkConnection}
                disabled={isCheckingStatus}
                className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={12} className={isCheckingStatus ? "animate-spin" : ""} />
                Test Connection
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Status</span>
                <span
                  className={`font-bold ${
                    isRuntimeOnline ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {isCheckingStatus
                    ? "Probing..."
                    : isRuntimeOnline
                    ? "Connected (Ollama Online)"
                    : "Unreachable (Offline)"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 font-mono">
                <span className="text-slate-500 font-sans">Endpoint</span>
                <span className="text-slate-700 text-[11px] truncate max-w-[170px]">
                  {status?.runtimeUrl || "http://127.0.0.1:11434"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Latency</span>
                <span className="text-slate-700 font-mono text-[11px]">
                  {status?.latencyMs !== undefined ? `${status.latencyMs} ms` : "—"}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Model Availability</span>
                <span
                  className={`font-bold ${
                    currentModelInstalled ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {currentModelInstalled ? "✓ Available Locally" : "✕ Not Installed (Pull required)"}
                </span>
              </div>
            </div>
          </div>

          {!isRuntimeOnline && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 leading-relaxed">
                <strong>Ollama not detected:</strong> Start Ollama on your machine with{" "}
                <code className="font-mono bg-white px-1 rounded">ollama serve</code>. Cloud
                deployments cannot reach local instances.
              </p>
            </div>
          )}
        </div>

        {/* Model Selection Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cpu size={17} className="text-teal-700" />
                <span className="font-bold text-slate-800 text-sm">Active Model Tag</span>
              </div>
              <span className="text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                3B Default
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Preset Model Choice
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    setCustomModelInput("");
                  }}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {AVAILABLE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.recommended ? "(Recommended)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Or Custom Model Tag
                </label>
                <input
                  type="text"
                  placeholder="e.g. phi3:mini or codellama:7b"
                  value={customModelInput}
                  onChange={(e) => setCustomModelInput(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 text-[11px] text-slate-600 space-y-1">
                <p>
                  <strong>Footprint:</strong>{" "}
                  {AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.footprint || "Variable"}
                </p>
                <p className="text-slate-500">
                  PipelineShield never auto-downloads multi-GB models.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Setup & Instructions Card */}
        <div className="bg-slate-900 border border-slate-800 text-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col justify-between font-mono text-xs">
          <div>
            <div className="flex items-center justify-between mb-3 text-slate-300">
              <div className="flex items-center gap-2">
                <Terminal size={15} className="text-teal-400" />
                <span className="font-bold text-xs uppercase tracking-wider">
                  Terminal Setup
                </span>
              </div>
              <span className="text-[10px] text-slate-400">Manual Pull</span>
            </div>

            <div className="space-y-2 text-[11px]">
              <div>
                <span className="text-slate-500 block text-[10px]"># 1. Start Local Daemon</span>
                <div className="bg-slate-950 p-2 rounded flex items-center justify-between text-green-400 border border-slate-800">
                  <span>ollama serve</span>
                  <CopyButton text="ollama serve" label="" />
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px]"># 2. Pull 3B Model</span>
                <div className="bg-slate-950 p-2 rounded flex items-center justify-between text-green-400 border border-slate-800">
                  <span>ollama pull {customModelInput.trim() || selectedModel}</span>
                  <CopyButton text={`ollama pull ${customModelInput.trim() || selectedModel}`} label="" />
                </div>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-800 font-sans">
            Explicit, user-initiated setup. Zero external API keys needed.
          </p>
        </div>
      </div>

      {/* ─── TAB 1: COPILOT WORKBENCH ────────────────────────────────────────── */}
      {activeTab === "copilot" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          {/* Controls Bar: Task Template & Output Depth */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Bot size={19} className="text-teal-700" />
                Grounded Security Copilot Workbench
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Target:{" "}
                <strong className="text-slate-800 font-mono">
                  {activeFinding ? activeFinding.id : "No finding selected"}
                </strong>{" "}
                | Active Report Decision:{" "}
                <span className="font-bold font-mono text-slate-800">{report.decision}</span>
              </p>
            </div>

            {/* Response Length & Parameters */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 p-1 rounded-lg border border-slate-200">
                <SlidersHorizontal size={13} className="text-slate-500 ml-1" />
                <span className="text-[11px] font-bold text-slate-500">Depth:</span>
                {(["concise", "balanced", "detailed"] as const).map((len) => (
                  <button
                    key={len}
                    onClick={() => setResponseLength(len)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold capitalize transition-all ${
                      responseLength === len
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {len}
                  </button>
                ))}
              </div>

              {/* Finding Picker Dropdown */}
              {findings.length > 0 && (
                <div className="w-72 sm:w-80 md:w-96 max-w-full">
                  <select
                    value={selectedFindingId}
                    onChange={(e) => setSelectedFindingId(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100 font-sans font-medium focus:outline-none focus:ring-2 focus:ring-teal-600 cursor-pointer shadow-2xs truncate"
                    title="Select finding to investigate"
                  >
                    {findings.map((f) => (
                      <option key={f.id} value={f.id}>
                        [{f.severity}] {f.title} ({f.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Task Template Grid (6 Purpose-Built Actions) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {TASK_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => {
                  setActiveAction(tmpl.id);
                  if (tmpl.id !== "ask_chat" && tmpl.id !== "verify_fix") {
                    handleExecuteAction(tmpl.id);
                  }
                }}
                disabled={isLoadingCopilot}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  activeAction === tmpl.id
                    ? "bg-teal-50 border-teal-300 ring-2 ring-teal-500/20 shadow-xs"
                    : "bg-slate-50/70 border-slate-200 hover:bg-slate-100"
                } disabled:opacity-50`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-white border border-slate-200 px-1.5 py-0.2 rounded">
                      {tmpl.badge}
                    </span>
                    {tmpl.icon}
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs mb-1 leading-snug">
                    {tmpl.label}
                  </h4>
                  <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                    {tmpl.description}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Conditional Sub-Panel: Fix Verification Options */}
          {activeAction === "verify_fix" && (
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck2 size={16} className="text-emerald-700" />
                  <span className="font-bold text-xs text-emerald-900">
                    Fix Verification Assistant Settings
                  </span>
                </div>
                <span className="text-[10px] text-emerald-700 bg-white border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                  CI Report is Authoritative
                </span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Select a later CI run baseline to evaluate if finding{" "}
                <code className="font-mono bg-white px-1 rounded">{activeFinding?.id}</code> appears
                resolved, modified, or persistent:
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={comparisonReportKey}
                  onChange={(e) => setComparisonReportKey(e.target.value)}
                  className="text-xs bg-white border border-emerald-300 rounded-lg p-2 font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="clean">Later Run: Clean Baseline (0 findings · PASS)</option>
                  <option value="warnings_only">Later Run: Advisory Warnings (2 findings · WARN)</option>
                  <option value="vulnerable">Original Run: Vulnerable PR (5 findings · BLOCK)</option>
                </select>
                <button
                  onClick={() => handleExecuteAction("verify_fix")}
                  disabled={isLoadingCopilot}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <FileCheck2 size={13} />
                  Run Fix Verification Analysis
                </button>
              </div>
            </div>
          )}

          {/* Conditional Sub-Panel: Interactive Chat Input */}
          {activeAction === "ask_chat" && (
            <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-4 space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-indigo-700" />
                <span className="font-bold text-xs text-indigo-900">
                  Ask a Question Grounded in Active Report Telemetry
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. How does this vulnerability affect production? Or what command tests the fix?"
                  value={customChatQuery}
                  onChange={(e) => setCustomChatQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleExecuteAction("ask_chat");
                    }
                  }}
                  className="flex-1 text-xs bg-white border border-indigo-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
                <button
                  onClick={() => handleExecuteAction("ask_chat")}
                  disabled={isLoadingCopilot || !customChatQuery.trim()}
                  className="px-4 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  <Send size={13} />
                  Ask Assistant
                </button>
              </div>
            </div>
          )}

          {/* Context Target Ribbon */}
          {activeFinding && (
            <div className="bg-gradient-to-r from-slate-50 to-teal-50/30 dark:from-slate-900/60 dark:to-teal-950/20 rounded-xl p-3 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={activeFinding.severity} />
                <span className="font-bold text-slate-900 dark:text-slate-100">{activeFinding.title}</span>
                <span className="text-slate-400 font-mono text-[11px]">({activeFinding.scanner})</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                {activeFinding.file_path && (
                  <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                    <FileText className="w-3 h-3 text-teal-600" />
                    {activeFinding.file_path}
                    {activeFinding.line_number ? `:${activeFinding.line_number}` : ""}
                  </span>
                )}
                {activeFinding.package_name && (
                  <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200">
                    pkg: {activeFinding.package_name} {activeFinding.installed_version ? `(${activeFinding.installed_version})` : ""}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowGroundingPayload(!showGroundingPayload)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/80 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 font-sans font-semibold hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors cursor-pointer text-[11px]"
                >
                  <span>{showGroundingPayload ? "Hide Evidence" : "Inspect Sanitized JSON"}</span>
                  <ChevronDown size={12} className={`transition-transform ${showGroundingPayload ? "rotate-180" : ""}`} />
                </button>
              </div>
            </div>
          )}

          {/* Collapsible Sanitized JSON Inspector */}
          {showGroundingPayload && activeFinding && (
            <div className="bg-slate-900 rounded-xl p-4 text-green-400 font-mono text-xs overflow-x-auto shadow-inner">
              <p className="text-slate-400 text-[10px] mb-2 font-sans font-bold uppercase tracking-wider">
                Sanitized report payload sent to Ollama (Redacted tokens &amp; bounded fields):
              </p>
              <pre>
                {JSON.stringify(
                  {
                    id: activeFinding.id,
                    scanner: activeFinding.scanner,
                    title: activeFinding.title,
                    severity: activeFinding.severity,
                    file_path: activeFinding.file_path,
                    line_number: activeFinding.line_number,
                    package_name: activeFinding.package_name,
                    installed_version: activeFinding.installed_version,
                    fixed_version: activeFinding.fixed_version,
                    cwe_ids: activeFinding.cwe_ids,
                    remediation: activeFinding.remediation,
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          )}

          {/* Copilot Response Panel */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/50 dark:bg-slate-900/30 min-h-[240px]">
            {isLoadingCopilot ? (
              <div className="py-14 flex flex-col items-center justify-center text-center space-y-3">
                <RefreshCw size={28} className="text-teal-600 animate-spin" />
                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  Analyzing via local {customModelInput.trim() || selectedModel}...
                </p>
                <p className="text-xs text-slate-500 max-w-sm">
                  Executing grounded inference on your local CPU/GPU. Output strictly bounded and
                  resistant to prompt injection.
                </p>
              </div>
            ) : copilotError ? (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-4 text-xs text-red-900 dark:text-red-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-red-800 dark:text-red-300">
                  <XCircle size={16} />
                  <span>Local AI Execution Failed</span>
                </div>
                <p className="leading-relaxed">{copilotError}</p>
                <div className="pt-2 text-[11px] text-slate-700 dark:text-slate-300">
                  <span>Ensure Ollama is running (<code>ollama serve</code>) and the model is pulled.</span>
                </div>
              </div>
            ) : copilotResponse ? (
              <AIResponseRenderer
                content={copilotResponse.response}
                confidence={copilotResponse.confidence}
                model={copilotResponse.model}
                verificationStatus={copilotResponse.verificationStatus}
                evidenceReferences={copilotResponse.evidenceReferences}
                uncertainties={copilotResponse.uncertainties}
                action={activeAction}
                onExportJson={handleExportJson}
                onAskFollowUp={(query) => {
                  setActiveAction("ask_chat");
                  setCustomChatQuery(query);
                }}
              />
            ) : (
              <div className="py-14 flex flex-col items-center justify-center text-center space-y-2">
                <Bot size={36} className="text-slate-300 dark:text-slate-700" />
                <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">No analysis generated yet</p>
                <p className="text-xs text-slate-500 max-w-sm">
                  Select a finding or template above to generate a grounded, evidence-backed
                  investigation briefing.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: LOCAL HISTORY ────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <History size={18} className="text-teal-700" />
                Local Copilot Interaction History
              </h3>
              <p className="text-xs text-slate-500">
                Stored exclusively in your browser&apos;s localStorage. Never sent to GitHub or external servers.
              </p>
            </div>
            {historyItems.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg flex items-center gap-1.5 font-bold transition-colors"
              >
                <Trash2 size={13} />
                Clear History
              </button>
            )}
          </div>

          {historyItems.length > 0 ? (
            <div className="space-y-3">
              {historyItems.map((item) => (
                <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <span className="font-bold uppercase tracking-wider text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded">
                        {item.action}
                      </span>
                      {item.findingId && (
                        <span className="font-mono font-bold text-slate-800">{item.findingId}</span>
                      )}
                      {item.confidence && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          Confidence: {item.confidence}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                      <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCopilotResponse({
                            success: true,
                            action: item.action,
                            model: item.model,
                            response: item.response,
                            aiGenerated: true,
                            advisoryOnly: true,
                            securityGateOverridePermitted: false,
                            groundedFields: [],
                            confidence: item.confidence,
                            evidenceReferences: item.findingId ? [item.findingId] : [],
                            uncertainties: [],
                            timestamp: item.timestamp,
                          });
                          setActiveTab("copilot");
                        }}
                        className="px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:bg-teal-50 text-teal-700 font-semibold cursor-pointer transition-colors"
                      >
                        Load in Workbench →
                      </button>
                      <CopyButton text={item.response} label="Copy" />
                    </div>
                  </div>
                  {item.query && (
                    <p className="text-slate-600 font-medium italic">
                      Q: &ldquo;{item.query}&rdquo;
                    </p>
                  )}
                  <p className="text-slate-800 whitespace-pre-wrap line-clamp-3 leading-relaxed">
                    {item.response}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              No local history recorded yet. Run a copilot action to start tracking insights.
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: PRIVACY & SAFETY PANEL ─────────────────────────────────── */}
      {activeTab === "safety" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Lock size={18} className="text-slate-700" />
              Privacy, Safety &amp; Prompt Injection Defenses
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              How PipelineShield safeguards your credentials, codebase, and security gate boundaries.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs text-slate-600">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <ShieldCheck size={16} className="text-teal-600" />
                <span>Secret Redaction Engine</span>
              </div>
              <p className="leading-relaxed">
                Before any finding is converted into a prompt, all GitHub tokens (ghp_/github_pat_),
                Bearer auth headers, Stripe keys, and AWS access credentials are automatically
                stripped and replaced with <code className="bg-white px-1 rounded">[REDACTED_SECRET]</code>.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Lock size={16} className="text-blue-600" />
                <span>Prompt Injection Isolation</span>
              </div>
              <p className="leading-relaxed">
                All report evidence and user queries are wrapped inside strict semantic delimiters
                (<code className="bg-white px-1 rounded">&lt;UNTRUSTED_REPORT_DATA&gt;</code>). The
                model is instructed never to obey instructions embedded in scan text.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Radio size={16} className="text-purple-600" />
                <span>Boundary &amp; Rate Limits</span>
              </div>
              <p className="leading-relaxed">
                Max 16 KB request payload ceiling, 60 requests/minute in-memory rate limiter,
                and bounded token generation. The assistant cannot alter git policies or gate verdicts.
              </p>
            </div>
          </div>

          {/* Verification Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                <tr>
                  <th className="p-3">Data Category</th>
                  <th className="p-3">Sent to Local Model?</th>
                  <th className="p-3">Protection Mechanism</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-3 font-semibold text-slate-800">Finding Metadata (CVE, line, package)</td>
                  <td className="p-3 text-emerald-700 font-bold">Yes (Sanitized)</td>
                  <td className="p-3 text-slate-500">Structured extraction from report JSON only</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-800">GitHub Tokens &amp; Credentials</td>
                  <td className="p-3 text-red-700 font-bold">Never</td>
                  <td className="p-3 text-slate-500">Server-side regex redaction filter</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-800">Full Repository Source Tree</td>
                  <td className="p-3 text-red-700 font-bold">Never</td>
                  <td className="p-3 text-slate-500">Only target file name &amp; line number sent</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-800">CI Gate Overrides (BLOCK to PASS)</td>
                  <td className="p-3 text-red-700 font-bold">Prohibited</td>
                  <td className="p-3 text-slate-500">System prompt security invariants &amp; UI boundary</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

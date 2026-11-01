"use client";

import React, { useState, useMemo } from "react";
import { SeverityBadge } from "../SeverityBadge";
import { ScannerBadge } from "../ScannerBadge";
import {
  FileText,
  ShieldCheck,
  Terminal,
  Zap,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Layers,
  HelpCircle,
  Code2,
  Copy,
  Check,
  Download,
  Eye,
  FileCode2,
  Cpu,
  Sparkles,
  ArrowRight,
  Database,
  Fingerprint,
} from "lucide-react";

interface AIResponseRendererProps {
  content: string;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  model?: string;
  verificationStatus?: "RESOLVED" | "PERSISTENT" | "MODIFIED" | "INCONCLUSIVE";
  evidenceReferences?: string[];
  uncertainties?: string[];
  action?: string;
  onExportJson?: () => void;
  onAskFollowUp?: (query: string) => void;
}

// Icon mapper based on section title keywords
function getSectionIcon(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("evidence") || lower.includes("factual") || lower.includes("report")) {
    return <Database className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
  }
  if (lower.includes("taxonomy") || lower.includes("cve") || lower.includes("cwe")) {
    return <Fingerprint className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
  }
  if (lower.includes("attack") || lower.includes("impact") || lower.includes("exploit")) {
    return <Zap className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
  }
  if (lower.includes("remediation") || lower.includes("fix") || lower.includes("step")) {
    return <Wrench className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
  }
  if (lower.includes("validation") || lower.includes("verify") || lower.includes("test")) {
    return <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
  }
  if (lower.includes("disclaimer") || lower.includes("uncertainty") || lower.includes("notice") || lower.includes("warning")) {
    return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
  }
  if (lower.includes("summary") || lower.includes("briefing") || lower.includes("overview")) {
    return <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
  }
  return <HelpCircle className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
}

// Render inline markdown: bold, code, links
function renderInlineMarkdown(text: string): React.ReactNode[] {
  // Regex splitting by bold (**...**) and inline code (`...`)
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      const boldText = token.slice(2, -2);
      // Check if it's a severity string
      if (["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].includes(boldText.toUpperCase())) {
        parts.push(
          <span key={match.index} className="inline-block align-middle mx-1">
            <SeverityBadge severity={boldText.toUpperCase() as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"} />
          </span>
        );
      } else {
        parts.push(
          <strong key={match.index} className="font-semibold text-slate-900 dark:text-slate-100">
            {boldText}
          </strong>
        );
      }
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={match.index}
          className="font-mono text-xs bg-slate-100 dark:bg-slate-800 text-teal-800 dark:text-teal-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 mx-0.5"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

// Key-value pair interface for structured facts
interface FactItem {
  key: string;
  value: string;
}

// Helper to parse key-value lines like "- **ID**: CVE-2022-42966"
function parseKeyValueLine(line: string): FactItem | null {
  const trimmed = line.trim().replace(/^[-*]\s+/, "");
  const kvMatch = /^(\*\*.*?\*\*|[^:]+):\s*(.*)$/.exec(trimmed);
  if (!kvMatch) return null;

  const rawKey = kvMatch[1].replace(/\*\*/g, "").trim();
  const value = kvMatch[2].trim();
  if (!rawKey || !value) return null;

  return { key: rawKey, value };
}

// Render structured Fact Grid
function FactGrid({ facts }: { facts: FactItem[] }) {
  // Extract key fields for custom cards
  const idFact = facts.find((f) => f.key.toLowerCase() === "id" || f.key.toLowerCase() === "cve");
  const severityFact = facts.find((f) => f.key.toLowerCase() === "severity");
  const scannerFact = facts.find((f) => f.key.toLowerCase() === "scanner");
  const pkgFact = facts.find((f) => f.key.toLowerCase().includes("package"));
  const installedFact = facts.find((f) => f.key.toLowerCase().includes("installed"));
  const fixedFact = facts.find((f) => f.key.toLowerCase().includes("fixed"));
  const fileFact = facts.find((f) => f.key.toLowerCase().includes("file") || f.key.toLowerCase().includes("path"));
  const cweFact = facts.find((f) => f.key.toLowerCase().includes("cwe"));
  const titleFact = facts.find((f) => f.key.toLowerCase() === "title");
  const descFact = facts.find((f) => f.key.toLowerCase() === "description");

  const otherFacts = facts.filter(
    (f) =>
      f !== idFact &&
      f !== severityFact &&
      f !== scannerFact &&
      f !== pkgFact &&
      f !== installedFact &&
      f !== fixedFact &&
      f !== fileFact &&
      f !== cweFact &&
      f !== titleFact &&
      f !== descFact
  );

  return (
    <div className="space-y-3.5 my-3">
      {/* Primary Fact Card Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Finding ID */}
        {idFact && (
          <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-2xs">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Vulnerability ID
            </span>
            <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              {idFact.value}
            </span>
          </div>
        )}

        {/* Severity */}
        {severityFact && (
          <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-2xs">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Authoritative Severity
            </span>
            <SeverityBadge
              severity={
                (severityFact.value.toUpperCase().replace(/\*\*/g, "") as
                  | "CRITICAL"
                  | "HIGH"
                  | "MEDIUM"
                  | "LOW"
                  | "INFO") || "MEDIUM"
              }
            />
          </div>
        )}

        {/* Scanner */}
        {scannerFact && (
          <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-2xs">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Detecting Scanner
            </span>
            <ScannerBadge
              scanner={
                (scannerFact.value.toLowerCase().replace(/\*\*/g, "") as
                  | "trivy"
                  | "semgrep"
                  | "dependency_review") || "trivy"
              }
            />
          </div>
        )}

        {/* Package & Versions */}
        {pkgFact && (
          <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-2xs">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Target Component
            </span>
            <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate">
              {pkgFact.value}
            </div>
            {installedFact && (
              <div className="text-[10px] font-mono text-slate-500 mt-0.5 flex items-center gap-1">
                <span>v{installedFact.value}</span>
                {fixedFact && (
                  <>
                    <ArrowRight className="w-2.5 h-2.5 text-emerald-600" />
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      v{fixedFact.value}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* File & CWE Strip */}
      {(fileFact || cweFact || titleFact || descFact) && (
        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 text-xs space-y-2">
          {titleFact && (
            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-start gap-1.5">
              <span className="text-slate-400 font-mono text-[11px] shrink-0">Title:</span>
              <span>{titleFact.value}</span>
            </div>
          )}

          {descFact && descFact.value !== titleFact?.value && (
            <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
              {descFact.value}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-200/60 dark:border-slate-800 text-[11px] font-mono">
            {fileFact && (
              <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                <FileCode2 className="w-3.5 h-3.5 text-teal-600" />
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {fileFact.value}
                </span>
              </div>
            )}

            {cweFact && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Taxonomy:</span>
                {cweFact.value.split(/[, ]+/).filter(Boolean).map((cwe, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 rounded bg-amber-100/70 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[10px] font-bold"
                  >
                    {cwe}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Any remaining fact list */}
      {otherFacts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
          {otherFacts.map((f, i) => (
            <div
              key={i}
              className="flex justify-between py-1 px-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#111827]"
            >
              <span className="text-slate-400">{f.key}:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                {f.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Styled Code Block with syntax styling & one-click copy
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-200 overflow-hidden shadow-md">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900 border-b border-slate-800 text-[11px] font-mono">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="text-slate-400 font-bold uppercase tracking-wider ml-1">
            {language || "TERMINAL"}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer px-2 py-0.5 rounded hover:bg-slate-800"
          title="Copy command to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-bold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code contents */}
      <pre className="p-4 text-xs font-mono overflow-x-auto text-emerald-300 leading-relaxed">
        <code>{code}</code>
      </pre>

      {/* Execution review warning */}
      <div className="px-3.5 py-1.5 bg-slate-900/60 border-t border-slate-900 text-[10px] font-mono text-amber-400/90 flex items-center gap-1.5">
        <AlertTriangle className="w-3 h-3 shrink-0" />
        <span>Review command carefully before executing in your terminal.</span>
      </div>
    </div>
  );
}

// Parses complete markdown response into visual SecOps nodes
function parseMarkdownToSecOps(content: string): React.ReactNode[] {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let currentKeyValues: FactItem[] = [];
  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBlockLines: string[] = [];

  const flushKeyValues = (idx: number) => {
    if (currentKeyValues.length > 0) {
      nodes.push(<FactGrid key={`facts-${idx}`} facts={[...currentKeyValues]} />);
      currentKeyValues = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code block fences
    if (line.trim().startsWith("```")) {
      flushKeyValues(i);
      if (inCodeBlock) {
        // End code block
        nodes.push(
          <CodeBlock
            key={`code-${i}`}
            code={codeBlockLines.join("\n")}
            language={codeBlockLang}
          />
        );
        inCodeBlock = false;
        codeBlockLines = [];
        codeBlockLang = "";
      } else {
        // Start code block
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Check if line is a header (### or ## or #)
    const headerMatch = /^(#{1,3})\s+(.*)$/.exec(line.trim());
    if (headerMatch) {
      flushKeyValues(i);
      const level = headerMatch[1].length;
      const rawTitle = headerMatch[2].trim();
      const icon = getSectionIcon(rawTitle);

      const isSub = level === 3;
      nodes.push(
        <div
          key={`header-${i}`}
          className={`flex items-center gap-2 pb-2 mt-5 mb-2.5 border-b ${
            isSub
              ? "border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
              : "border-teal-200 dark:border-teal-900 text-teal-950 dark:text-teal-200"
          }`}
        >
          <div className="p-1 rounded-md bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-900">
            {icon}
          </div>
          <h4
            className={`font-mono font-bold tracking-tight ${
              isSub ? "text-xs uppercase" : "text-sm"
            }`}
          >
            {rawTitle}
          </h4>
        </div>
      );
      continue;
    }

    // Check if line is a Key-Value fact (e.g. "- **ID**: CVE-2022-42966")
    const kv = parseKeyValueLine(line);
    if (kv) {
      currentKeyValues.push(kv);
      continue;
    } else {
      flushKeyValues(i);
    }

    // Check if line is a bullet item (- or * )
    const bulletMatch = /^[-*]\s+(.*)$/.exec(line.trim());
    if (bulletMatch) {
      const bulletContent = bulletMatch[1];
      nodes.push(
        <div key={`bullet-${i}`} className="flex items-start gap-2.5 my-1.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed pl-1">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:text-teal-400 mt-1.5 shrink-0" />
          <div className="flex-1">{renderInlineMarkdown(bulletContent)}</div>
        </div>
      );
      continue;
    }

    // Check if line is a numbered step (1. , 2. )
    const stepMatch = /^(\d+)\.\s+(.*)$/.exec(line.trim());
    if (stepMatch) {
      const stepNum = stepMatch[1];
      const stepContent = stepMatch[2];
      nodes.push(
        <div key={`step-${i}`} className="flex items-start gap-3 my-2 text-xs text-slate-800 dark:text-slate-200 leading-relaxed p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white/70 dark:bg-[#111827]">
          <span className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-mono font-bold text-[10px] flex items-center justify-center shrink-0 border border-teal-300 dark:border-teal-800">
            {stepNum}
          </span>
          <div className="flex-1">{renderInlineMarkdown(stepContent)}</div>
        </div>
      );
      continue;
    }

    // Check if line is a warning or review callout
    if (
      line.toLowerCase().includes("review before execution") ||
      line.toLowerCase().includes("disclaimer") ||
      line.toLowerCase().includes("advisory only")
    ) {
      nodes.push(
        <div key={`alert-${i}`} className="my-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-sans leading-relaxed">
            {renderInlineMarkdown(line)}
          </div>
        </div>
      );
      continue;
    }

    // Regular text paragraph
    if (line.trim().length > 0) {
      nodes.push(
        <p key={`p-${i}`} className="my-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
          {renderInlineMarkdown(line)}
        </p>
      );
    }
  }

  // Flush remaining facts
  flushKeyValues(lines.length);

  return nodes;
}

export function AIResponseRenderer({
  content,
  confidence = "HIGH",
  model = "qwen2.5:3b",
  verificationStatus,
  evidenceReferences = [],
  uncertainties = [],
  onExportJson,
  onAskFollowUp,
}: AIResponseRendererProps) {
  const [viewMode, setViewMode] = useState<"visual" | "markdown">("visual");
  const [copiedFull, setCopiedFull] = useState(false);

  const renderedContent = useMemo(() => {
    return parseMarkdownToSecOps(content);
  }, [content]);

  const handleCopyFull = () => {
    navigator.clipboard.writeText(content);
    setCopiedFull(true);
    setTimeout(() => setCopiedFull(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Elevated Output Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        {/* Left: Metadata Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Main Title Badge */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 text-xs font-bold shadow-2xs font-mono">
            <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            AI ADVISORY GUIDANCE
          </span>

          {/* Confidence Badge */}
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono border ${
              confidence === "HIGH"
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                : confidence === "MEDIUM"
                ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                confidence === "HIGH"
                  ? "bg-emerald-500"
                  : confidence === "MEDIUM"
                  ? "bg-amber-500"
                  : "bg-rose-500"
              }`}
            />
            Confidence: {confidence}
          </span>

          {/* Verification Status (if present) */}
          {verificationStatus && (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono border ${
                verificationStatus === "RESOLVED"
                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700"
                  : verificationStatus === "PERSISTENT"
                  ? "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700"
                  : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700"
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              Later Run: {verificationStatus}
            </span>
          )}

          {/* Model Pill */}
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-mono">
            <Cpu className="w-3 h-3 text-slate-500" />
            {model}
          </span>
        </div>

        {/* Right: View Switcher & Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Segmented View Toggle */}
          <div className="inline-flex p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-xs font-mono font-medium">
            <button
              onClick={() => setViewMode("visual")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === "visual"
                  ? "bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Visual</span>
            </button>
            <button
              onClick={() => setViewMode("markdown")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === "markdown"
                  ? "bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Code2 className="w-3 h-3" />
              <span>Raw</span>
            </button>
          </div>

          {/* Copy Analysis */}
          <button
            onClick={handleCopyFull}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer font-mono font-semibold ${
              copiedFull
                ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            {copiedFull ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Export JSON */}
          {onExportJson && (
            <button
              onClick={onExportJson}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer font-mono font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Evidence Cited Bar */}
      {evidenceReferences.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1 text-slate-500 font-bold font-mono text-[11px] mr-1">
            <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Telemetry Evidence Cited:</span>
          </div>
          {evidenceReferences.map((ref, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[11px] shadow-2xs font-semibold"
            >
              {ref}
            </span>
          ))}
        </div>
      )}

      {/* Uncertainty & Context Disclosure (if any) */}
      {uncertainties.length > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 space-y-1.5 shadow-2xs">
          <div className="flex items-center gap-1.5 font-bold font-mono">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Uncertainty &amp; Missing Context Disclosure:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-[11px] pl-1 font-sans">
            {uncertainties.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Content Area */}
      {viewMode === "visual" ? (
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-slate-800 dark:text-slate-200 shadow-sm transition-all space-y-2">
          {renderedContent}
        </div>
      ) : (
        <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-200 p-5 shadow-inner">
          <div className="text-[10px] font-mono text-slate-400 mb-2 font-bold uppercase tracking-wider flex justify-between">
            <span>Raw Model Output Markdown</span>
            <span>{content.length} characters</span>
          </div>
          <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed text-slate-300 overflow-x-auto max-h-[500px]">
            {content}
          </pre>
        </div>
      )}

      {/* Bottom Follow-Up Quick Action Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-gradient-to-r from-teal-50/60 to-blue-50/60 dark:from-teal-950/20 dark:to-blue-950/20 border border-teal-200/80 dark:border-teal-900/60 text-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <span className="text-slate-700 dark:text-slate-300 font-medium">
            Have questions about this analysis or need a tailored testing command?
          </span>
        </div>
        {onAskFollowUp && (
          <button
            onClick={() => onAskFollowUp("What local command verifies this fix without breaking dependencies?")}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
          >
            <span>Ask Follow-up</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

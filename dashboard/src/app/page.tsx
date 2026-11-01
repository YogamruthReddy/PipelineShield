"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Shield,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  GitBranch,
  Sliders,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  LayoutDashboard,
  Menu,
  X,
  FlaskConical,
  HelpCircle,
  Copy,
  Check,
  Sparkles,
  Zap,
  Bot,
  Lock,
  Terminal,
  ShieldCheck,
  Info,
  Mail,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type GateOutcomeKey = "BLOCK" | "WARN" | "PASS" | "ERROR";

interface WalkthroughStep {
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  content: string;
  preview: Record<string, unknown>;
}

interface FaqItem {
  q: string;
  a: string;
  category: "Policy" | "CI/CD" | "Security" | "Dashboard" | "Local AI" | "Webhooks";
}

// ─── Navigation Links ─────────────────────────────────────────────────────────
const NAV_LINKS = [
  { href: "#overview", label: "Overview" },
  { href: "#preview", label: "App Preview" },
  { href: "#workflow", label: "CI Workflow" },
  { href: "#verified-features", label: "Verified Features" },
  { href: "#invariants", label: "CI vs AI Boundary" },
  { href: "#setup", label: "Setup & Requirements" },
  { href: "#faq", label: "FAQ" },
  { href: "#builders", label: "Builders" },
];

// ─── Preset Scenarios for Interactive Hero Simulator ──────────────────────────
const PRESET_DEMOS: Record<
  "vulnerable" | "warnings" | "clean",
  {
    label: string;
    verdict: GateOutcomeKey;
    exitCode: number;
    profile: string;
    findingsTotal: number;
    critical: number;
    high: number;
    medium: number;
    violations: string[];
    actionLabel: string;
    branch: string;
  }
> = {
  vulnerable: {
    label: "Vulnerable PR",
    verdict: "BLOCK",
    exitCode: 1,
    profile: "Strict Gatekeeper",
    findingsTotal: 5,
    critical: 1,
    high: 2,
    medium: 1,
    violations: [
      "1 CRITICAL finding(s) violate threshold (tolerates: BLOCK)",
      "2 HIGH finding(s) violate threshold (tolerates: BLOCK)",
    ],
    actionLabel: "Inspect 3 Blockers in Dashboard →",
    branch: "feat/add-payment-module",
  },
  warnings: {
    label: "Advisory Warnings",
    verdict: "WARN",
    exitCode: 0,
    profile: "Strict Gatekeeper",
    findingsTotal: 2,
    critical: 0,
    high: 0,
    medium: 2,
    violations: [
      "2 MEDIUM finding(s) exceed advisory threshold (review recommended)",
    ],
    actionLabel: "Review Advisory Warnings →",
    branch: "fix/update-worker-deps",
  },
  clean: {
    label: "Clean Baseline",
    verdict: "PASS",
    exitCode: 0,
    profile: "Strict Gatekeeper",
    findingsTotal: 0,
    critical: 0,
    high: 0,
    medium: 0,
    violations: [],
    actionLabel: "View Clean Report →",
    branch: "main",
  },
};

// ─── Workflow Pipeline Stages ────────────────────────────────────────────────
const WORKFLOW_STAGES = [
  {
    step: "01",
    title: "Repository & CI Input",
    role: "Codebase Versioning & Event Trigger",
    inputs: "Git commit, Pull Request event, config/policy.yaml policy file",
    outputs: "GitHub Actions workflow run triggered with secure runner environment",
    command: "git push origin feat/security-hardening",
    icon: <GitBranch size={20} className="text-slate-700" />,
    bg: "bg-slate-100",
  },
  {
    step: "02",
    title: "Multi-Scanner Execution",
    role: "Automated Evidence Generation",
    inputs: "Source tree, package manifests (package.json, requirements.txt)",
    outputs: "Normalized JSON reports: Trivy (SCA/Secrets), Semgrep (SAST), DepReview",
    command: "trivy fs --scanners vuln,secret --format json -o reports/trivy.json .",
    icon: <Search size={20} className="text-purple-700" />,
    bg: "bg-purple-50",
  },
  {
    step: "03",
    title: "Deterministic Gate Evaluation",
    role: "Policy Decision Engine",
    inputs: "Aggregated finding objects + repository rules (config/policy.yaml)",
    outputs: "security-summary.json artifact + POSIX exit code (0, 1, or 2)",
    command: "python -m pipelineshield.cli --policy config/policy.yaml",
    icon: <Sliders size={20} className="text-teal-700" />,
    bg: "bg-teal-50",
  },
  {
    step: "04",
    title: "Authoritative CI Gate Exit",
    role: "Merge-Blocking Verdict",
    inputs: "Evaluation result: BLOCK (Exit 1), WARN (Exit 0), PASS (Exit 0), ERROR (Exit 2)",
    outputs: "GitHub pull request commit status check updated; runner halts on blocker",
    command: "echo \"Gate verdict: $VERDICT (Exit: $EXIT_CODE)\"",
    icon: <ShieldAlert size={20} className="text-red-700" />,
    bg: "bg-red-50",
  },
  {
    step: "05",
    title: "Console Review & Advisory AI",
    role: "Interactive Investigation & Safe Triage",
    inputs: "Webhook delivery or API fetch to /dashboard with local Ollama runtime",
    outputs: "Finding-to-code traceability, session triage, and advisory fix guidance",
    command: "npm run dev # Operational at http://localhost:3000",
    icon: <LayoutDashboard size={20} className="text-blue-700" />,
    bg: "bg-blue-50",
  },
];

// ─── Multi-Scanner Fleet Specifications ──────────────────────────────────────
const SCANNER_SPECS = [
  {
    id: "trivy-sca",
    name: "Trivy — Dependency Vulnerabilities (SCA)",
    badge: "SCA / CVE",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    description:
      "Scans manifest files (package-lock.json, requirements.txt, go.sum) for known public CVEs with CVSS scoring and target fix versions.",
    target: "engine/requirements.txt",
    finding: "CVE-2022-42966 (CRITICAL) — ReDoS in python-cryptography 3.4.8",
    remediation: "Upgrade cryptography>=41.0.0 in requirements.txt",
  },
  {
    id: "trivy-secrets",
    name: "Trivy — Secret Detection",
    badge: "SECRETS",
    badgeColor: "bg-red-50 text-red-700 border-red-200",
    description:
      "Scans the entire repository tree for accidental commits containing hardcoded private tokens, cloud credentials, or OAuth keys.",
    target: "services/billing/client.py:42",
    finding: "stripe-secret-key (CRITICAL) — Live Secret Key Token Detected",
    remediation: "Revoke token immediately in dashboard and move to environment variable.",
  },
  {
    id: "semgrep-sast",
    name: "Semgrep — Static Code Analysis (SAST)",
    badge: "SAST / OWASP",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
    description:
      "Analyzes source code AST for OWASP Top 10 vulnerabilities, unescaped user inputs, SQL injections, and unsafe deserialization.",
    target: "api/routes/users.py:114",
    finding: "CWE-89 (HIGH) — SQL Query Construction via f-string Formatting",
    remediation: "Use parameterized queries with SQLAlchemy cursor binding.",
  },
  {
    id: "dep-review",
    name: "GitHub Dependency Review",
    badge: "DIFF ANALYSIS",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
    description:
      "Analyzes PR diffs to detect newly added dependencies with vulnerable advisories, restrictive licenses, or supply chain flags.",
    target: "package.json diff",
    finding: "ghas-dep-advisory (HIGH) — New vulnerable package added: event-stream 3.3.5",
    remediation: "Reject PR dependency addition or pin safe upstream version.",
  },
];

// ─── Verified vs. Planned Capabilities Matrix ────────────────────────────────
const VERIFIED_CAPABILITIES = [
  {
    category: "CI/CD Gate Engine",
    status: "Verified in Codebase",
    statusColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
    items: [
      "Multi-scanner aggregation: Trivy (SCA/Secrets), Semgrep (SAST), GitHub Dependency Review",
      "Deterministic policy evaluation against configurable rules in config/policy.yaml",
      "Strict POSIX exit codes: Exit 1 (BLOCK), Exit 0 (PASS/WARN), Exit 2 (ENGINE ERROR)",
      "Immutable security-summary.json CI build artifact output",
    ],
  },
  {
    category: "Ingestion & Integration",
    status: "Verified in Codebase",
    statusColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
    items: [
      "Real-time GitHub Webhook receiver (/api/webhook/github) for workflow_run.completed",
      "Constant-time HMAC SHA-256 signature verification (crypto.timingSafeEqual)",
      "Replay prevention cache and resilient authenticated GitHub REST API polling fallback",
      "Server-side token isolation: GITHUB_TOKEN read exclusively server-side in .env.local",
    ],
  },
  {
    category: "Code Review & Traceability",
    status: "Verified in Codebase",
    statusColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
    items: [
      "Repository & branch tree navigation across connected GitHub account repositories",
      "Finding-to-code traceability: links findings to commit SHA, file, and exact line range",
      "Historical commit viewer: reloads exact file content at finding.commitSha",
      "Heuristic regression comparison categorized into New, Resolved, and Persistent debt",
    ],
  },
  {
    category: "Investigation & Advisory AI",
    status: "Verified in Codebase",
    statusColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
    items: [
      "11-view SecOps investigation console: Overview, Findings, Runs, Scanners, Policy, etc.",
      "Grounded Local AI Copilot running private Ollama models (qwen2.5:3b) via /api/local-ai",
      "Client-side credential sanitization: tokens and keys stripped before prompting",
      "Strict advisory invariant: AI insights and session triage cannot override CI gate verdicts",
    ],
  },
];

const PLANNED_LIMITATIONS = [
  {
    feature: "Shared Durable Policy Persistence",
    currentState: "In-memory simulation only",
    reason:
      "PipelineShield currently operates with single-instance local storage. Public policy mutation endpoints are disabled to prevent unauthenticated overrides in multi-instance environments.",
  },
  {
    feature: "Multi-Tenant Authenticated Identity",
    currentState: "Session-scoped triage (unauthenticated)",
    reason:
      "The app has no OAuth/RBAC user session provider. Triage status changes are tracked locally in session memory and labeled as non-authoritative.",
  },
  {
    feature: "Automated Autonomous Git Pushes",
    currentState: "Approval-gated patch proposal only",
    reason:
      "Write paths require explicit human operator confirmation to prevent unauthorized branch modifications or malicious code injection.",
  },
  {
    feature: "Remote Cloud AI Inference",
    currentState: "Local-only runtime (Ollama)",
    reason:
      "To prevent code and telemetry leakage to third-party APIs, AI review is restricted to private on-device models running at http://127.0.0.1:11434.",
  },
];

// ─── Step-by-Step Lifecycle Walkthrough Data ─────────────────────────────────
const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    title: "1. Scanner Detection in CI",
    subtitle: "Automated vulnerability and static analysis execution",
    badge: "CI SCAN",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    content:
      "GitHub Actions workflow triggers Trivy and Semgrep on pull request commit 7e43b12. Trivy identifies CVE-2022-42966 (CRITICAL) in python-cryptography within engine/requirements.txt.",
    preview: {
      step: "scan",
      scanner: "trivy",
      id: "CVE-2022-42966",
      severity: "CRITICAL",
      target: "engine/requirements.txt",
      installed: "3.4.8",
      fixed: "41.0.0",
      description: "Regular Expression Denial of Service (ReDoS) in X.509 certificate parsing.",
    },
  },
  {
    title: "2. Policy Gate BLOCK Verdict",
    subtitle: "Deterministic gate threshold comparison against repository policy",
    badge: "GATE ENGINE",
    badgeColor: "bg-red-50 text-red-700 border-red-200",
    content:
      "The PipelineShield engine loads config/policy.yaml. Because the strict profile tolerates 0 Critical findings, the security gate issues a BLOCK verdict with Exit Code 1, halting the CI pipeline.",
    preview: {
      step: "evaluate",
      decision: "BLOCK",
      exitCode: 1,
      profile: "strict",
      ruleViolations: [
        "1 CRITICAL finding(s) violate threshold (tolerates: BLOCK)",
        "2 HIGH finding(s) violate threshold (tolerates: BLOCK)",
      ],
      ciStatus: "Pull Request Check Failed",
    },
  },
  {
    title: "3. Workspace Triage in Dashboard",
    subtitle: "Investigate evidence, review diffs, and inspect line highlights",
    badge: "CONSOLE",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
    content:
      "The security reviewer opens the dashboard at /dashboard?view=findings. The finding is linked directly to commit 7e43b12 with highlighted code and candidate heuristic regression matching.",
    preview: {
      step: "triage",
      scope: "Session-scoped workspace (local, non-authoritative)",
      commitSha: "7e43b12",
      lineHighlight: "engine/requirements.txt#L14",
      authoritativeOverride: false,
    },
  },
  {
    title: "4. Authoritative CI PASS Clearance",
    subtitle: "Remediation commit pushed and verified in fresh GitHub Actions run",
    badge: "CI PASS",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    content:
      "Developer commits the updated requirements.txt (cryptography>=41.0.0) and pushes to the PR branch. GitHub Actions re-runs the scanners: verdict is PASS (Exit Code 0). The pull request is cleared for merge.",
    preview: {
      step: "verification",
      decision: "PASS",
      exitCode: 0,
      blockingViolations: 0,
      status: "PR Gate Satisfied — Merge Permitted",
    },
  },
];

// ─── Technical FAQs ──────────────────────────────────────────────────────────
const FAQS: FaqItem[] = [
  {
    q: "What does PipelineShield actually check?",
    a: "PipelineShield evaluates three distinct security dimensions inside your CI workflow: software composition analysis (known CVE vulnerabilities in dependencies via Trivy), secret detection (hardcoded credentials and keys via Trivy Secrets), and static application security testing (SAST code flaws via Semgrep). It aggregates findings into a unified model and enforces the rules declared in config/policy.yaml.",
    category: "Security",
  },
  {
    q: "How does the Grounded Local AI Copilot work and does it leak code or secrets?",
    a: "The Local AI Security Assistant runs completely on your local machine using an open runtime such as Ollama with lightweight models like Qwen 2.5 3B. PipelineShield performs aggressive client-side secret sanitization, stripping all GitHub tokens, private keys, and environment variables before prompting. Furthermore, the assistant operates strictly in an advisory role: it has zero authority to mutate policy, accept risks, or override CI gate decisions.",
    category: "Local AI",
  },
  {
    q: "How does the real-time GitHub Webhook receiver handle security and updates?",
    a: "PipelineShield provides a dedicated /api/webhook/github receiver that validates incoming workflow_run.completed events using constant-time HMAC SHA-256 signatures (crypto.timingSafeEqual). It supports a dual-webhook architecture: secure local tunnels (via ngrok or Cloudflare Tunnel) during active development, and direct HTTPS endpoints for production. It also caches deliveries to prevent replay attacks and provides a resilient polling fallback.",
    category: "Webhooks",
  },
  {
    q: "How does finding-to-code traceability work for historical findings?",
    a: "When you inspect a finding from a past review or historical workflow run, the code review workspace requests the repository file specifically at finding.commitSha—not from the current tip of the branch. This ensures that line highlights and code context accurately reflect the exact commit state where the finding was detected, even if the active branch has moved forward.",
    category: "CI/CD",
  },
  {
    q: "What do the gate outcomes mean for developers and CI runners?",
    a: "BLOCK (Exit Code 1) halts the CI build and flags the pull request as failing. WARN (Exit Code 0) allows the build to succeed while notifying reviewers of advisory issues. PASS (Exit Code 0) confirms all severity thresholds are satisfied. ERROR (Exit Code 2) signals that scanners failed or report schemas were invalid — preventing silent bypasses.",
    category: "Policy",
  },
  {
    q: "Does triage or accepting a risk in the dashboard bypass the CI gate?",
    a: "No. All triage notes, status updates, and risk assessments recorded in the dashboard are session-scoped workspace records stored in component memory. They never modify config/policy.yaml, never alter GitHub commit statuses, and cannot override CI gate decisions. True remediation requires a verified commit pushed to CI.",
    category: "Policy",
  },
  {
    q: "How are credentials and GitHub tokens protected?",
    a: "Your GITHUB_TOKEN or fine-grained Personal Access Token is stored exclusively on the server in dashboard/.env.local and is read only by server-side routes (/api/latest-report, /api/github/*). It is never included in client JavaScript bundles, network payloads sent to the browser, or client-side storage.",
    category: "Security",
  },
  {
    q: "How do I connect PipelineShield to my existing repository?",
    a: "Copy .github/workflows/security-gate.yml to your repository and ensure config/policy.yaml is present. In the dashboard directory, configure .env.local with GITHUB_TOKEN and GITHUB_REPO=owner/repo. The dashboard will automatically detect completed runs, receive webhooks, and ingest security artifacts.",
    category: "CI/CD",
  },
];

// ─── Helper Badge Components ──────────────────────────────────────────────────
function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/80 text-teal-800 text-xs font-semibold tracking-wide uppercase mb-3 shadow-2xs font-subheading">
      <Sparkles size={11} className="text-teal-600" />
      {children}
    </div>
  );
}

function SyntheticBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold tracking-wide shadow-2xs font-mono">
      <FlaskConical size={10} className="text-amber-600" />
      SYNTHETIC DEMO DATA
    </span>
  );
}

function VerdictBadge({ verdict }: { verdict: GateOutcomeKey }) {
  const map: Record<GateOutcomeKey, { cls: string; label: string }> = {
    BLOCK: { cls: "bg-red-600 text-white shadow-xs shadow-red-200", label: "BLOCK" },
    WARN: { cls: "bg-amber-500 text-white shadow-xs shadow-amber-200", label: "WARN" },
    PASS: { cls: "bg-emerald-600 text-white shadow-xs shadow-emerald-200", label: "PASS" },
    ERROR: { cls: "bg-slate-700 text-white shadow-xs shadow-slate-200", label: "ERROR" },
  };
  return (
    <span
      className={`inline-block px-3 py-1 rounded-md font-mono font-bold text-xs tracking-wider ${map[verdict].cls}`}
    >
      {map[verdict].label}
    </span>
  );
}

function BuilderAvatar({
  src,
  alt,
  initials,
}: {
  src?: string;
  alt: string;
  initials: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (src && !hasError) {
    return (
      <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-slate-200/90 shadow-2xs bg-slate-100 shrink-0">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="96px"
          className="object-cover"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  return (
    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-teal-50 to-slate-100 border border-teal-200/80 text-teal-800 font-heading font-extrabold text-2xl flex items-center justify-center shadow-2xs shrink-0">
      {initials}
    </div>
  );
}

// ─── Main Landing Page Component ─────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();

  // State
  const [heroPreset, setHeroPreset] = useState<"vulnerable" | "warnings" | "clean">("vulnerable");
  const [activeWorkflowStage, setActiveWorkflowStage] = useState<number>(2);
  const [activeScanner, setActiveScanner] = useState<number>(0);
  const [activePreviewTab, setActivePreviewTab] = useState<"overview" | "copilot">("overview");
  const [walkthroughStep, setWalkthroughStep] = useState<number>(0);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [faqFilter, setFaqFilter] = useState<string>("All");
  const [faqQuery, setFaqQuery] = useState<string>("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Builders Showcase Rail Ref & Navigation
  const buildersRailRef = React.useRef<HTMLDivElement>(null);
  const scrollBuildersRail = (direction: "left" | "right") => {
    if (buildersRailRef.current) {
      const scrollAmount = buildersRailRef.current.clientWidth * 0.75;
      buildersRailRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const handleRailKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollBuildersRail("left");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollBuildersRail("right");
    }
  };

  // Policy Simulator Interactive Playground State
  const [simCriticalLimit, setSimCriticalLimit] = useState<number>(0);
  const [simHighLimit, setSimHighLimit] = useState<number>(0);
  const [simMediumLimit, setSimMediumLimit] = useState<number>(3);

  // Keyboard shortcut listener: Press 'D' to open dashboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === "d" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        router.push("/dashboard");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  // Current Hero Preset Data
  const currentHero = PRESET_DEMOS[heroPreset];

  // Calculated Simulated Verdict
  const simulatedOutcome = useMemo(() => {
    const crits = 1;
    const highs = 2;
    const mediums = 1;

    if (crits > simCriticalLimit || highs > simHighLimit) {
      return {
        verdict: "BLOCK" as GateOutcomeKey,
        exit: 1,
        message: `${crits > simCriticalLimit ? `${crits} Critical ` : ""}${
          highs > simHighLimit ? `${highs} High ` : ""
        }finding(s) exceed configured policy threshold.`,
        color: "bg-red-50 text-red-800 border-red-200",
      };
    }

    if (mediums > simMediumLimit) {
      return {
        verdict: "WARN" as GateOutcomeKey,
        exit: 0,
        message: `${mediums} Medium finding(s) exceed advisory threshold (review recommended).`,
        color: "bg-amber-50 text-amber-800 border-amber-200",
      };
    }

    return {
      verdict: "PASS" as GateOutcomeKey,
      exit: 0,
      message: "All findings satisfy simulated repository policy thresholds.",
      color: "bg-emerald-50 text-emerald-800 border-emerald-200",
    };
  }, [simCriticalLimit, simHighLimit, simMediumLimit]);

  // Filtered FAQ Items
  const filteredFaqs = useMemo(() => {
    return FAQS.filter((f) => {
      const matchesCategory = faqFilter === "All" || f.category === faqFilter;
      const matchesSearch =
        faqQuery.trim() === "" ||
        f.q.toLowerCase().includes(faqQuery.toLowerCase()) ||
        f.a.toLowerCase().includes(faqQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [faqFilter, faqQuery]);

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#fafbfc] text-slate-800 font-sans selection:bg-teal-100 selection:text-teal-900">
      {/* ─── 1. Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2.5 text-slate-900 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-lg p-1 group"
            >
              <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-xs group-hover:bg-teal-700 transition-colors">
                <Shield size={19} className="stroke-[2.5]" aria-hidden="true" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-base tracking-tight leading-tight font-subheading">
                  PipelineShield
                </span>
                <span className="text-[10px] font-semibold text-teal-700 tracking-wider uppercase font-mono">
                  DevSecOps Gatekeeper
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav aria-label="Site navigation" className="hidden lg:flex items-center gap-6">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded transition-colors"
                >
                  {l.label}
                </a>
              ))}
              <div className="h-4 w-px bg-slate-200" aria-hidden="true" />
              <a
                href="https://github.com/YogamruthReddy/PipelineShield"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded transition-colors"
                aria-label="View PipelineShield on GitHub (opens in new tab)"
              >
                GitHub <ExternalLink size={12} aria-hidden="true" />
              </a>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-lg shadow-xs hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
              >
                Open Dashboard <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </nav>

            {/* Mobile hamburger */}
            <button
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

          {/* Mobile menu dropdown */}
          {mobileMenuOpen && (
            <nav
              id="mobile-nav"
              className="lg:hidden py-4 border-t border-slate-100 flex flex-col gap-2"
              aria-label="Mobile site navigation"
            >
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-md"
                >
                  {l.label}
                </a>
              ))}
              <a
                href="https://github.com/YogamruthReddy/PipelineShield"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-md flex items-center gap-1.5"
              >
                GitHub <ExternalLink size={13} />
              </a>
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 mx-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-700 text-white text-sm font-semibold rounded-lg shadow-sm"
              >
                Open Dashboard <ArrowRight size={14} />
              </Link>
            </nav>
          )}
        </div>
      </header>

      {/* ─── 2. Hero Section with Interactive Gate Preview ──────────────────── */}
      <section
        id="overview"
        className="relative pt-16 pb-20 px-4 sm:px-6 lg:px-8 border-b border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50 overflow-hidden"
        aria-labelledby="hero-heading"
      >
        <div
          className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-60 pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Left Hero Copy */}
          <div className="flex-1 max-w-2xl text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/90 text-teal-800 text-xs font-semibold mb-6 shadow-2xs font-mono">
              <Zap size={13} className="text-teal-600 fill-teal-600" />
              <span>PipelineShield · Verified DevSecOps Policy Gatekeeper</span>
            </div>

            <h1
              id="hero-heading"
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-[1.12] mb-6 font-heading"
            >
              Security checks that{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-700 to-teal-900 underline decoration-teal-300 decoration-wavy decoration-2">
                explain their decisions.
              </span>
            </h1>

            <p className="text-lg text-slate-600 leading-relaxed mb-6 font-body">
              PipelineShield evaluates multi-scanner security telemetry—Trivy (SCA &amp; Secrets),
              Semgrep (SAST), and GitHub Dependency Review—against repository policy to emit
              deterministic CI gate verdicts:{" "}
              <strong className="text-slate-900 font-semibold font-mono">BLOCK</strong>,{" "}
              <strong className="text-slate-900 font-semibold font-mono">WARN</strong>, or{" "}
              <strong className="text-slate-900 font-semibold font-mono">PASS</strong>.
              It couples authoritative CI enforcement with an 11-view investigation console and
              private, on-device local AI guidance.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 transform hover:-translate-y-0.5"
              >
                Open Dashboard <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <a
                href="#setup"
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
              >
                <Terminal size={16} className="text-slate-600" />
                <span>View Setup Requirements</span>
              </a>
            </div>

            {/* Invariant & Shortcut Notice */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-mono">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 bg-slate-100 text-slate-700">
                <Lock size={11} className="text-teal-700" />
                Authoritative CI Policy Engine
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded border border-slate-300 bg-slate-100 text-slate-700 font-bold">
                  D
                </span>
                <span>Press D anywhere to jump to dashboard</span>
              </span>
            </div>
          </div>

          {/* Right Hero: Interactive Gate Verdict Live Preview */}
          <div className="w-full max-w-md flex-shrink-0">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden transition-all">
              {/* Card top bar with scenario switcher */}
              <div className="px-5 py-3.5 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600 animate-pulse" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                    Deterministic Gate Engine
                  </span>
                </div>
                <SyntheticBadge />
              </div>

              {/* Scenario Toggle Tabs */}
              <div className="grid grid-cols-3 p-1.5 bg-slate-100/70 border-b border-slate-200 text-xs font-semibold text-center font-subheading">
                {(["vulnerable", "warnings", "clean"] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => setHeroPreset(key)}
                    className={`py-1.5 rounded-md transition-all cursor-pointer ${
                      heroPreset === key
                        ? "bg-white text-slate-900 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {PRESET_DEMOS[key].label}
                  </button>
                ))}
              </div>

              {/* Card Body */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        currentHero.verdict === "BLOCK"
                          ? "bg-red-50 text-red-600"
                          : currentHero.verdict === "WARN"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-emerald-50 text-emerald-600"
                      }`}
                    >
                      {currentHero.verdict === "BLOCK" ? (
                        <ShieldAlert size={22} />
                      ) : currentHero.verdict === "WARN" ? (
                        <AlertTriangle size={22} />
                      ) : (
                        <CheckCircle2 size={22} />
                      )}
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 font-subheading">
                        PR Gate: {currentHero.verdict}
                      </h2>
                      <p className="text-xs text-slate-500 font-mono">
                        Exit Code {currentHero.exitCode} · {currentHero.branch}
                      </p>
                    </div>
                  </div>
                  <VerdictBadge verdict={currentHero.verdict} />
                </div>

                {/* Violation / Rationale Box */}
                <div
                  className={`rounded-xl p-3.5 text-xs mb-5 border ${
                    currentHero.verdict === "BLOCK"
                      ? "bg-red-50/70 text-red-900 border-red-200"
                      : currentHero.verdict === "WARN"
                      ? "bg-amber-50/70 text-amber-900 border-amber-200"
                      : "bg-emerald-50/70 text-emerald-900 border-emerald-200"
                  }`}
                >
                  <p className="font-bold mb-1.5 flex items-center gap-1.5 font-subheading">
                    {currentHero.violations.length > 0 ? (
                      <>
                        <ShieldAlert size={13} className="text-red-600" />
                        <span>Policy Gate Violations ({currentHero.violations.length})</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        <span>Policy Evaluation Rationale</span>
                      </>
                    )}
                  </p>
                  {currentHero.violations.length > 0 ? (
                    currentHero.violations.map((v, i) => (
                      <p key={i} className="font-mono text-[11px] leading-relaxed">
                        ✕ {v}
                      </p>
                    ))
                  ) : (
                    <p className="font-mono text-[11px] leading-relaxed">
                      ✓ 0 blocking or advisory violations. Strict profile satisfied.
                    </p>
                  )}
                </div>

                {/* Metrics 4-Col Grid */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs mb-5">
                  <div className="bg-slate-50 border border-slate-100 rounded-lg py-2">
                    <p className="text-[10px] text-slate-500 font-medium">Critical</p>
                    <p className="text-sm font-bold text-red-600 font-metric">{currentHero.critical}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-lg py-2">
                    <p className="text-[10px] text-slate-500 font-medium">High</p>
                    <p className="text-sm font-bold text-red-600 font-metric">{currentHero.high}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-lg py-2">
                    <p className="text-[10px] text-slate-500 font-medium">Medium</p>
                    <p className="text-sm font-bold text-amber-600 font-metric">{currentHero.medium}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-lg py-2">
                    <p className="text-[10px] text-slate-500 font-medium">Total</p>
                    <p className="text-sm font-bold text-slate-800 font-metric">
                      {currentHero.findingsTotal}
                    </p>
                  </div>
                </div>

                {/* Quick Interactive Deep-Link Button */}
                <Link
                  href={`/dashboard?view=${
                    currentHero.verdict === "BLOCK"
                      ? "findings"
                      : currentHero.verdict === "WARN"
                      ? "policy"
                      : "runs"
                  }`}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors font-subheading"
                >
                  {currentHero.actionLabel}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 3. Real Application Preview (Captured Screenshots) ─────────────── */}
      <section
        id="preview"
        className="py-20 px-4 sm:px-6 lg:px-8 border-b border-slate-200/80 bg-white"
        aria-labelledby="preview-heading"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <SectionBadge>Live Interface Preview</SectionBadge>
            <h2
              id="preview-heading"
              className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4 font-heading"
            >
              Captured from the running application
            </h2>
            <p className="text-base text-slate-600 leading-relaxed font-body">
              These previews are real screenshots captured from PipelineShield running locally at{" "}
              <code className="font-mono text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded">
                localhost:3000/dashboard
              </code>
              . No mockups or theoretical designs.
            </p>
          </div>

          {/* Screenshot Switcher Tabs */}
          <div className="max-w-5xl mx-auto mb-6 flex items-center justify-center gap-3">
            <button
              onClick={() => setActivePreviewTab("overview")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activePreviewTab === "overview"
                  ? "bg-teal-700 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <LayoutDashboard size={14} />
              <span>Security Operations Overview</span>
            </button>
            <button
              onClick={() => setActivePreviewTab("copilot")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activePreviewTab === "copilot"
                  ? "bg-teal-700 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Bot size={14} />
              <span>Grounded Security Copilot Workbench</span>
            </button>
          </div>

          {/* Image Display Frame */}
          <div className="max-w-5xl mx-auto rounded-2xl border border-slate-300/80 bg-slate-900 p-2 shadow-2xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-800 rounded-t-xl flex items-center justify-between text-xs text-slate-400 font-mono">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                <span className="ml-2 text-slate-300">
                  {activePreviewTab === "overview"
                    ? "http://localhost:3000/dashboard?view=overview"
                    : "http://localhost:3000/dashboard?view=local-ai"}
                </span>
              </div>
              <span className="text-[11px] text-teal-400 font-semibold">
                Captured Live Instance
              </span>
            </div>

            <div className="relative bg-slate-950 aspect-[16/10] overflow-hidden rounded-b-xl border-t border-slate-800">
              {activePreviewTab === "overview" ? (
                <Image
                  src="/dashboard-preview.jpg"
                  alt="PipelineShield Security Operations Overview Dashboard displaying gate verdict, finding breakdown, and scanner health"
                  fill
                  className="object-contain"
                  priority
                />
              ) : (
                <Image
                  src="/copilot-preview.jpg"
                  alt="PipelineShield Grounded Security Copilot Workbench displaying plain-language root cause, safe remediation recipe, and threat taxonomy"
                  fill
                  className="object-contain"
                />
              )}
            </div>

            {/* Bottom metadata strip */}
            <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  <span>Role-based typography system active (Georgia headings, Inter body, Courier New code)</span>
                </span>
              </div>
              <Link
                href={`/dashboard?view=${activePreviewTab === "overview" ? "overview" : "local-ai"}`}
                className="text-teal-400 hover:text-teal-300 font-bold flex items-center gap-1"
              >
                Launch This View in Live App <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 4. The 5-Stage Verification Workflow ────────────────────────────── */}
      <section
        id="workflow"
        className="py-20 px-4 sm:px-6 lg:px-8 border-b border-slate-200/80 bg-[#fafbfc]"
        aria-labelledby="workflow-heading"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <SectionBadge>Execution Architecture</SectionBadge>
            <h2
              id="workflow-heading"
              className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4 font-heading"
            >
              5 steps from commit to verified clearance
            </h2>
            <p className="text-base text-slate-600 leading-relaxed font-body">
              How PipelineShield integrates natively with GitHub Actions to inspect code,
              enforce policy, issue authoritative exit codes, and sync telemetry.
            </p>
          </div>

          {/* Stepper Tabs */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 mb-8 overflow-x-auto">
            <div className="flex items-center justify-between min-w-[760px] gap-2">
              {WORKFLOW_STAGES.map((st, idx) => (
                <React.Fragment key={st.step}>
                  <button
                    onClick={() => setActiveWorkflowStage(idx)}
                    className={`flex-1 p-3 rounded-xl border text-left transition-all flex flex-col items-center gap-2 cursor-pointer ${
                      activeWorkflowStage === idx
                        ? "border-teal-600 bg-teal-50/50 shadow-xs ring-2 ring-teal-600/20"
                        : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${st.bg}`}>
                      {st.icon}
                    </div>
                    <span className="font-mono text-[10px] font-bold text-slate-400">
                      STEP {st.step}
                    </span>
                    <span
                      className={`text-xs font-bold text-center font-subheading ${
                        activeWorkflowStage === idx ? "text-teal-900" : "text-slate-800"
                      }`}
                    >
                      {st.title}
                    </span>
                  </button>
                  {idx < WORKFLOW_STAGES.length - 1 && (
                    <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Active Stage Inspector Detail */}
          {WORKFLOW_STAGES[activeWorkflowStage] && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-md p-6 sm:p-8 animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${WORKFLOW_STAGES[activeWorkflowStage].bg}`}
                  >
                    {WORKFLOW_STAGES[activeWorkflowStage].icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-900 font-heading">
                        {WORKFLOW_STAGES[activeWorkflowStage].title}
                      </h3>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-mono">
                        Step {WORKFLOW_STAGES[activeWorkflowStage].step} of {WORKFLOW_STAGES.length}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      {WORKFLOW_STAGES[activeWorkflowStage].role}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1 font-mono">
                    Inputs &amp; Context
                  </span>
                  <p className="text-slate-800 font-medium text-xs leading-relaxed font-body">
                    {WORKFLOW_STAGES[activeWorkflowStage].inputs}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1 font-mono">
                    Outputs &amp; Artifacts
                  </span>
                  <p className="text-slate-800 font-medium text-xs leading-relaxed font-body">
                    {WORKFLOW_STAGES[activeWorkflowStage].outputs}
                  </p>
                </div>
                <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 text-green-400 font-mono text-xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1 font-mono">
                      Associated Command / Runner Step
                    </span>
                    <p className="break-all">{WORKFLOW_STAGES[activeWorkflowStage].command}</p>
                  </div>
                  <button
                    onClick={() => handleCopyCode(WORKFLOW_STAGES[activeWorkflowStage].command)}
                    className="self-end mt-2 text-[10px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedCode ? <Check size={11} /> : <Copy size={11} />}
                    {copiedCode ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─── 5. Multi-Scanner Evidence Fleet ─────────────────────────────────── */}
      <section
        id="scanners"
        className="py-20 px-4 sm:px-6 lg:px-8 border-b border-slate-200/80 bg-white"
        aria-labelledby="scanners-heading"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <SectionBadge>Scanner Fleet</SectionBadge>
            <h2
              id="scanners-heading"
              className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4 font-heading"
            >
              Unified multi-scanner telemetry
            </h2>
            <p className="text-base text-slate-600 leading-relaxed font-body">
              PipelineShield normalizes disparate findings from SAST, SCA, Secrets, and Dependency Review
              into an authoritative common schema.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Scanner Selector Tabs */}
            <div className="lg:col-span-5 space-y-3">
              {SCANNER_SPECS.map((scanner, idx) => (
                <button
                  key={scanner.id}
                  onClick={() => setActiveScanner(idx)}
                  className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                    activeScanner === idx
                      ? "bg-white border-teal-600 shadow-sm ring-1 ring-teal-600"
                      : "bg-white/60 hover:bg-white border-slate-200 text-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-slate-900 font-subheading">
                      {scanner.name}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${scanner.badgeColor}`}
                    >
                      {scanner.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 font-body">
                    {scanner.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Right Active Scanner Finding Inspector */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-md p-6 sm:p-7">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                    Schema Finding Output
                  </span>
                </div>
                <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                  Scanner: {SCANNER_SPECS[activeScanner].id}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider block">
                    Target Resource
                  </span>
                  <p className="font-mono text-sm font-bold text-slate-900 mt-0.5">
                    {SCANNER_SPECS[activeScanner].target}
                  </p>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2 text-xs">
                  <span className="text-slate-500 text-[10px] block uppercase font-bold tracking-wider font-mono">
                    Normalized Finding
                  </span>
                  <p className="font-mono text-slate-800 font-bold">
                    {SCANNER_SPECS[activeScanner].finding}
                  </p>
                </div>

                <div className="bg-slate-900 rounded-xl p-4 text-slate-200 text-xs font-mono">
                  <span className="text-slate-400 text-[10px] block mb-1 uppercase font-bold tracking-wider font-mono">
                    Remediation Guidance
                  </span>
                  <p className="text-green-400">
                    {SCANNER_SPECS[activeScanner].remediation}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 6. Verified Capabilities vs. Planned Limitations Matrix ─────────── */}
      <section
        id="verified-features"
        className="py-20 px-4 sm:px-6 lg:px-8 border-b border-slate-200/80 bg-[#fafbfc]"
        aria-labelledby="verified-heading"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <SectionBadge>Codebase Audit</SectionBadge>
            <h2
              id="verified-heading"
              className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4 font-heading"
            >
              Verified capabilities vs. planned scope
            </h2>
            <p className="text-base text-slate-600 leading-relaxed font-body">
              An honest, precise breakdown of features implemented and tested in the current repository,
              distinguished from future architecture plans.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Verified Column */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <h3 className="text-lg font-bold text-slate-900 font-heading">
                  Verified in Current Codebase (100% Tested)
                </h3>
              </div>

              {VERIFIED_CAPABILITIES.map((cat, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-slate-900 text-sm font-subheading">
                      {cat.category}
                    </h4>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${cat.statusColor}`}
                    >
                      {cat.status}
                    </span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600 font-body">
                    {cat.items.map((it, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Planned & Limitations Column */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
                <Info size={18} className="text-amber-600" />
                <h3 className="text-lg font-bold text-slate-900 font-heading">
                  Architecture Boundaries &amp; Planned Work
                </h3>
              </div>

              {PLANNED_LIMITATIONS.map((lim, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-slate-900 text-sm font-subheading">
                      {lim.feature}
                    </h4>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      {lim.currentState}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-body">
                    {lim.reason}
                  </p>
                </div>
              ))}

              <div className="p-4 rounded-xl bg-teal-50/80 border border-teal-200 text-xs text-teal-900 space-y-1.5 font-body">
                <p className="font-bold flex items-center gap-1.5 font-subheading">
                  <ShieldCheck size={14} className="text-teal-700" />
                  Engineering Standard
                </p>
                <p>
                  PipelineShield adheres to zero-trust principles: features that lack authenticated
                  identity or durable multi-instance storage are intentionally kept read-only or session-local
                  to ensure safety.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 7. The Gatekeeper Sovereignty Invariant: CI vs. Advisory AI ─────── */}
      <section
        id="invariants"
        className="py-20 px-4 sm:px-6 lg:px-8 border-b border-slate-200/80 bg-white"
        aria-labelledby="invariants-heading"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <SectionBadge>Separation of Powers</SectionBadge>
            <h2
              id="invariants-heading"
              className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4 font-heading"
            >
              Authoritative CI engine vs. advisory AI assistant
            </h2>
            <p className="text-base text-slate-600 leading-relaxed font-body">
              How PipelineShield safeguards CI integrity by maintaining a strict, non-negotiable boundary
              between authoritative gate decisions and exploratory AI assistance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Left: Authoritative CI */}
            <div className="bg-slate-50/80 rounded-2xl border-2 border-teal-600 p-6 sm:p-7 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-teal-100">
                <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold font-mono">
                  CI
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base font-heading">
                    Authoritative CI Gatekeeper
                  </h3>
                  <span className="text-[11px] font-mono text-teal-800 font-bold uppercase">
                    GitOps Enforced · Binding Result
                  </span>
                </div>
              </div>

              <ul className="space-y-3 text-xs text-slate-700 font-body">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-teal-600 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Declared in Git:</strong> Enforced strictly through{" "}
                    <code className="font-mono text-slate-800 bg-white px-1 py-0.5 rounded border border-slate-200">
                      config/policy.yaml
                    </code>{" "}
                    versioned alongside your source code.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-teal-600 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Authoritative Exit Codes:</strong> Issues exact POSIX status codes (Exit 1 = BLOCK, Exit 0 = PASS/WARN) that gate pull request merging.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-teal-600 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Immutable Verification:</strong> A gate BLOCK can only be cleared by a verified commit that eliminates the offending vulnerability.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-teal-600 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Zero Bypass:</strong> Dashboard status changes or accepted risks cannot silence an authoritative scanner failure.
                  </span>
                </li>
              </ul>
            </div>

            {/* Right: Advisory AI & Workspace */}
            <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-2xs">
              <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-200">
                <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center">
                  <Bot size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base font-heading">
                    Advisory AI &amp; Local Workspace
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500 font-bold uppercase">
                    Operator Assistance · Non-Authoritative
                  </span>
                </div>
              </div>

              <ul className="space-y-3 text-xs text-slate-700 font-body">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-slate-500 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Private On-Device AI:</strong> Runs locally via Ollama (
                    <code className="font-mono text-slate-800 bg-white px-1 py-0.5 rounded border border-slate-200">
                      qwen2.5:3b
                    </code>
                    ) with client-side credential and token stripping.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-slate-500 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Root Cause &amp; Remediation:</strong> Explains complex vulnerabilities in plain language and provides copy-paste shell fix recipes.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-slate-500 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Session-Scoped Triage:</strong> Triage states (e.g. In Triage, Accepted Risk) are session-local notes for human collaboration only.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-slate-500 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>In-Memory Simulator:</strong> Allows testing &ldquo;what-if&rdquo; policy threshold changes without altering CI execution.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 8. Setup, Prerequisites & Requirements ─────────────────────────── */}
      <section
        id="setup"
        className="py-20 px-4 sm:px-6 lg:px-8 border-b border-slate-200/80 bg-[#fafbfc]"
        aria-labelledby="setup-heading"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <SectionBadge>Operational Readiness</SectionBadge>
            <h2
              id="setup-heading"
              className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4 font-heading"
            >
              Setup prerequisites &amp; requirements
            </h2>
            <p className="text-base text-slate-600 leading-relaxed font-body">
              Everything required to run PipelineShield locally, connect your repository, and enable
              automated CI gate enforcement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {/* Step 1 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center font-bold font-mono mb-4">
                  1
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-2 font-subheading">
                  Dashboard Runtime
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4 font-body">
                  Node.js 20+ required. Run the Next.js console locally on port 3000.
                </p>
              </div>
              <div className="bg-slate-900 rounded-lg p-3 text-green-400 font-mono text-[11px]">
                <code>npm run dev</code>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 flex items-center justify-center font-bold font-mono mb-4">
                  2
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-2 font-subheading">
                  GitHub Connectivity
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4 font-body">
                  Configure server-side environment variables in <code className="font-mono">dashboard/.env.local</code>.
                </p>
              </div>
              <div className="bg-slate-900 rounded-lg p-3 text-green-400 font-mono text-[11px] leading-tight">
                <code>GITHUB_TOKEN=ghp_...<br />GITHUB_REPO=user/repo</code>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 flex items-center justify-center font-bold font-mono mb-4">
                  3
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-2 font-subheading">
                  CI Actions Workflow
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4 font-body">
                  Version <code className="font-mono">config/policy.yaml</code> and the security-gate workflow in your repository.
                </p>
              </div>
              <div className="bg-slate-900 rounded-lg p-3 text-green-400 font-mono text-[11px]">
                <code>config/policy.yaml</code>
              </div>
            </div>

            {/* Step 4 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center font-bold font-mono mb-4">
                  4
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-2 font-subheading">
                  Local AI Copilot (Opt.)
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4 font-body">
                  Install Ollama and pull Qwen 2.5 3B for private, on-device analysis.
                </p>
              </div>
              <div className="bg-slate-900 rounded-lg p-3 text-green-400 font-mono text-[11px]">
                <code>ollama run qwen2.5:3b</code>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 9. Interactive Policy Simulator Playground ──────────────────────── */}
      <section
        id="simulator"
        className="py-20 px-4 sm:px-6 lg:px-8 border-b border-slate-200/80 bg-white"
        aria-labelledby="sim-heading"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <SectionBadge>Dry-Run Sandbox</SectionBadge>
            <h2
              id="sim-heading"
              className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4 font-heading"
            >
              Interactive policy simulator playground
            </h2>
            <p className="text-base text-slate-600 leading-relaxed font-body">
              Adjust severity thresholds in real-time to preview how gate decisions would change
              without modifying your repository&apos;s actual <code className="font-mono text-xs">config/policy.yaml</code>.
            </p>
          </div>

          <div className="bg-slate-50/60 rounded-2xl border border-slate-200 shadow-md p-6 sm:p-8 max-w-3xl mx-auto">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Sliders size={18} className="text-teal-700" />
                <span className="font-bold text-slate-900 text-sm font-subheading">
                  Simulated Threshold Controls
                </span>
              </div>
              <SyntheticBadge />
            </div>

            {/* Simulated Sliders / Counter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-red-700 font-subheading">Critical Allowed</span>
                  <span className="font-mono font-bold text-sm font-metric">{simCriticalLimit}</span>
                </div>
                <div className="flex gap-2">
                  {[0, 1].map((val) => (
                    <button
                      key={val}
                      onClick={() => setSimCriticalLimit(val)}
                      className={`flex-1 py-1 rounded text-xs font-bold transition-all cursor-pointer font-mono ${
                        simCriticalLimit === val
                          ? "bg-red-600 text-white shadow-xs"
                          : "bg-slate-50 text-slate-700 border hover:bg-slate-100"
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-red-700 font-subheading">High Allowed</span>
                  <span className="font-mono font-bold text-sm font-metric">{simHighLimit}</span>
                </div>
                <div className="flex gap-2">
                  {[0, 2].map((val) => (
                    <button
                      key={val}
                      onClick={() => setSimHighLimit(val)}
                      className={`flex-1 py-1 rounded text-xs font-bold transition-all cursor-pointer font-mono ${
                        simHighLimit === val
                          ? "bg-red-600 text-white shadow-xs"
                          : "bg-slate-50 text-slate-700 border hover:bg-slate-100"
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-700 font-subheading">Medium Allowed</span>
                  <span className="font-mono font-bold text-sm font-metric">{simMediumLimit}</span>
                </div>
                <div className="flex gap-2">
                  {[1, 3].map((val) => (
                    <button
                      key={val}
                      onClick={() => setSimMediumLimit(val)}
                      className={`flex-1 py-1 rounded text-xs font-bold transition-all cursor-pointer font-mono ${
                        simMediumLimit === val
                          ? "bg-amber-600 text-white shadow-xs"
                          : "bg-slate-50 text-slate-700 border hover:bg-slate-100"
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Calculated Simulated Verdict Display */}
            <div className={`rounded-xl border p-5 ${simulatedOutcome.color}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider font-mono">
                    Simulated Verdict
                  </span>
                  <VerdictBadge verdict={simulatedOutcome.verdict} />
                </div>
                <span className="font-mono text-xs font-bold">
                  Exit Code {simulatedOutcome.exit}
                </span>
              </div>
              <p className="text-xs font-mono leading-relaxed">{simulatedOutcome.message}</p>
            </div>

            <div className="mt-6 flex justify-end">
              <Link
                href="/dashboard?view=policy"
                className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 font-subheading"
              >
                Open Full Policy Simulator in Dashboard <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 10. Interactive Walkthrough ─────────────────────────────────────── */}
      <section
        className="py-20 px-4 sm:px-6 lg:px-8 border-b border-slate-200/80 bg-[#fafbfc]"
        aria-labelledby="walkthrough-heading"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <SectionBadge>Step-By-Step Walkthrough</SectionBadge>
            <h2
              id="walkthrough-heading"
              className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4 font-heading"
            >
              Interactive gate lifecycle simulation
            </h2>
            <p className="text-base text-slate-600 leading-relaxed font-body">
              Step through the complete progression of a simulated vulnerability from detection to
              resolution.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 sm:p-8 max-w-4xl mx-auto">
            {/* Stepper progress dots */}
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
              {WALKTHROUGH_STEPS.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => setWalkthroughStep(idx)}
                  className={`flex items-center gap-2 text-xs font-bold transition-colors cursor-pointer ${
                    walkthroughStep === idx ? "text-teal-700" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono ${
                      walkthroughStep === idx
                        ? "bg-teal-700 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="hidden sm:inline font-subheading">{s.badge}</span>
                </button>
              ))}
            </div>

            {/* Step Detail Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center mb-8">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-bold border font-mono ${WALKTHROUGH_STEPS[walkthroughStep].badgeColor}`}
                  >
                    {WALKTHROUGH_STEPS[walkthroughStep].badge}
                  </span>
                  <SyntheticBadge />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2 font-heading">
                  {WALKTHROUGH_STEPS[walkthroughStep].title}
                </h3>
                <p className="text-xs text-slate-500 font-medium mb-4 font-subheading">
                  {WALKTHROUGH_STEPS[walkthroughStep].subtitle}
                </p>
                <p className="text-sm text-slate-700 leading-relaxed font-body">
                  {WALKTHROUGH_STEPS[walkthroughStep].content}
                </p>
              </div>

              <div className="bg-slate-900 rounded-xl p-5 text-green-400 font-mono text-xs overflow-x-auto shadow-inner">
                <pre>
                  {JSON.stringify(WALKTHROUGH_STEPS[walkthroughStep].preview, null, 2)}
                </pre>
              </div>
            </div>

            {/* Stepper Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                onClick={() => setWalkthroughStep(Math.max(0, walkthroughStep - 1))}
                disabled={walkthroughStep === 0}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-subheading"
              >
                ← Previous Step
              </button>
              <button
                onClick={() =>
                  setWalkthroughStep(
                    Math.min(WALKTHROUGH_STEPS.length - 1, walkthroughStep + 1)
                  )
                }
                disabled={walkthroughStep === WALKTHROUGH_STEPS.length - 1}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-subheading"
              >
                Next Step →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 11. Searchable and Filterable FAQ ───────────────────────────────── */}
      <section
        id="faq"
        className="py-20 px-4 sm:px-6 lg:px-8 border-b border-slate-200/80 bg-white"
        aria-labelledby="faq-heading"
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <SectionBadge>Technical &amp; Operational FAQ</SectionBadge>
            <h2
              id="faq-heading"
              className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4 font-heading"
            >
              Frequently asked questions
            </h2>
            <p className="text-base text-slate-600 font-body">
              Authoritative answers regarding policy enforcement, CI integration, webhooks, and local AI copilot.
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
            <div className="relative w-full sm:w-72">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={faqQuery}
                onChange={(e) => setFaqQuery(e.target.value)}
                placeholder="Search questions..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {(["All", "Policy", "CI/CD", "Security", "Local AI", "Webhooks"] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFaqFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer font-subheading ${
                    faqFilter === cat
                      ? "bg-slate-900 text-white"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* FAQ Accordion List */}
          <div className="space-y-3">
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50/70 rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <HelpCircle size={16} className="text-teal-700 flex-shrink-0" />
                      <span className="font-bold text-slate-900 text-sm font-subheading">
                        {item.q}
                      </span>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 transition-transform duration-200 flex-shrink-0 ${
                        openFaq === idx ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {openFaq === idx && (
                    <div className="px-5 pb-5 pt-1 text-xs text-slate-600 leading-relaxed border-t border-slate-100 font-body">
                      {item.a}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-sm text-slate-500 py-8">
                No matching questions found.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ─── 12. Builders Section ──────────────────────────────────────────── */}
      <section
        id="builders"
        className="py-24 sm:py-28 px-4 sm:px-6 lg:px-8 border-b border-slate-200/80 bg-slate-50/30 overflow-hidden"
        aria-labelledby="builders-heading"
      >
        <div className="max-w-[1440px] mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between max-w-7xl mx-auto mb-10 sm:mb-12 gap-6">
            <div className="text-center sm:text-left max-w-2xl">
              <SectionBadge>Project Team</SectionBadge>
              <h2
                id="builders-heading"
                className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3 font-heading"
              >
                Builders
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-body">
                The engineering team behind PipelineShield&apos;s DevSecOps policy engine, automated scanner pipeline, and security console.
              </p>
            </div>

            {/* Rail navigation buttons for keyboard/mouse convenience */}
            <div className="flex items-center justify-center sm:justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => scrollBuildersRail("left")}
                aria-label="Scroll builders rail left"
                className="p-2.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-all shadow-2xs hover:border-teal-500/30 focus:outline-none focus:ring-2 focus:ring-teal-600 cursor-pointer"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => scrollBuildersRail("right")}
                aria-label="Scroll builders rail right"
                className="p-2.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-all shadow-2xs hover:border-teal-500/30 focus:outline-none focus:ring-2 focus:ring-teal-600 cursor-pointer"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Single horizontal row card rail */}
          <div
            ref={buildersRailRef}
            tabIndex={0}
            role="region"
            aria-label="Builders team showcase rail"
            onKeyDown={handleRailKeyDown}
            className="flex flex-nowrap items-stretch gap-4 xl:gap-5 overflow-x-auto pb-6 pt-2 px-1 scroll-smooth snap-x snap-mandatory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-2xl builders-rail"
          >
            {/* Member 1 */}
            <div className="w-[84vw] max-w-[340px] sm:w-[320px] md:w-[280px] lg:w-[calc((100%-4*1rem)/5)] lg:min-w-[220px] xl:w-auto xl:flex-1 shrink-0 snap-start bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 flex flex-col justify-between shadow-2xs hover:shadow-md hover:border-teal-500/30 transition-all duration-300 hover:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none">
              <div>
                <div className="flex items-start justify-between gap-4 mb-5">
                  <BuilderAvatar
                    src="/images/builders/rishvin-reddy.png"
                    alt="Rishvin Reddy portrait"
                    initials="RR"
                  />
                  <span className="text-[11px] font-mono font-medium tracking-wider text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/70 shrink-0">
                    Member 01
                  </span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 font-heading tracking-tight leading-snug break-words">
                    Rishvin Reddy
                  </h3>
                  <a
                    href="mailto:rishvinreddy@gmail.com"
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-teal-700 transition-colors font-mono break-all leading-relaxed"
                    aria-label="Email Rishvin Reddy"
                  >
                    <Mail size={13} className="text-slate-400 shrink-0" aria-hidden="true" />
                    <span>rishvinreddy@gmail.com</span>
                  </a>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-5 mt-6 border-t border-slate-100 text-xs">
                <a
                  href="https://www.linkedin.com/in/rishvinreddy/?isSelfProfile=false"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-teal-700 transition-colors"
                  aria-label="Rishvin Reddy on LinkedIn"
                >
                  <span>LinkedIn</span>
                  <ExternalLink size={12} className="text-slate-400" aria-hidden="true" />
                </a>
                <a
                  href="https://rishvinreddy.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-teal-700 transition-colors"
                  aria-label="Rishvin Reddy Portfolio"
                >
                  <span>Portfolio</span>
                  <ExternalLink size={12} className="text-slate-400" aria-hidden="true" />
                </a>
                <a
                  href="https://github.com/RishvinReddy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-teal-700 transition-colors"
                  aria-label="Rishvin Reddy on GitHub"
                >
                  <span>GitHub</span>
                  <ExternalLink size={12} className="text-slate-400" aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* Member 2 */}
            <div className="w-[84vw] max-w-[340px] sm:w-[320px] md:w-[280px] lg:w-[calc((100%-4*1rem)/5)] lg:min-w-[220px] xl:w-auto xl:flex-1 shrink-0 snap-start bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 flex flex-col justify-between shadow-2xs hover:shadow-md hover:border-teal-500/30 transition-all duration-300 hover:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none">
              <div>
                <div className="flex items-start justify-between gap-4 mb-5">
                  <BuilderAvatar
                    src="/images/builders/yogamruth-reddy.jpg"
                    alt="Guggilla Yogamruth Reddy portrait"
                    initials="YR"
                  />
                  <span className="text-[11px] font-mono font-medium tracking-wider text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/70 shrink-0">
                    Member 02
                  </span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 font-heading tracking-tight leading-snug break-words">
                    Guggilla Yogamruth Reddy
                  </h3>
                  <a
                    href="mailto:guggilla.yogamruthreddy4422@gmail.com"
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-teal-700 transition-colors font-mono break-all leading-relaxed"
                    aria-label="Email Guggilla Yogamruth Reddy"
                  >
                    <Mail size={13} className="text-slate-400 shrink-0" aria-hidden="true" />
                    <span>guggilla.yogamruthreddy4422@gmail.com</span>
                  </a>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-5 mt-6 border-t border-slate-100 text-xs">
                <a
                  href="https://www.linkedin.com/in/yogamruthreddy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-teal-700 transition-colors"
                  aria-label="Guggilla Yogamruth Reddy on LinkedIn"
                >
                  <span>LinkedIn</span>
                  <ExternalLink size={12} className="text-slate-400" aria-hidden="true" />
                </a>
                <a
                  href="https://github.com/YogamruthReddy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-teal-700 transition-colors"
                  aria-label="Guggilla Yogamruth Reddy on GitHub"
                >
                  <span>GitHub</span>
                  <ExternalLink size={12} className="text-slate-400" aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* Member 3 (Quiet Placeholder) */}
            <div className="w-[84vw] max-w-[340px] sm:w-[320px] md:w-[280px] lg:w-[calc((100%-4*1rem)/5)] lg:min-w-[220px] xl:w-auto xl:flex-1 shrink-0 snap-start bg-slate-50/50 rounded-2xl border border-dashed border-slate-200/90 p-5 sm:p-6 flex flex-col justify-between shadow-2xs">
              <div>
                <div className="flex items-start justify-end mb-5">
                  <span className="text-[11px] font-mono font-medium tracking-wider text-slate-400 bg-white/80 px-2.5 py-1 rounded-md border border-slate-200/60 shrink-0">
                    Member 03
                  </span>
                </div>
                <div className="space-y-1.5 pt-6">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-400 font-heading tracking-tight leading-snug">
                    Member 3
                  </h3>
                  <p className="text-xs text-slate-400 font-body">
                    Details coming soon
                  </p>
                </div>
              </div>

              <div className="pt-5 mt-6 border-t border-dashed border-slate-200/60 text-xs text-slate-300">
                {/* Intentionally quiet placeholder */}
              </div>
            </div>

            {/* Member 4 */}
            <div className="w-[84vw] max-w-[340px] sm:w-[320px] md:w-[280px] lg:w-[calc((100%-4*1rem)/5)] lg:min-w-[220px] xl:w-auto xl:flex-1 shrink-0 snap-start bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 flex flex-col justify-between shadow-2xs hover:shadow-md hover:border-teal-500/30 transition-all duration-300 hover:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none">
              <div>
                <div className="flex items-start justify-between gap-4 mb-5">
                  <BuilderAvatar
                    alt="Bhavi Mahnot portrait"
                    initials="BM"
                  />
                  <span className="text-[11px] font-mono font-medium tracking-wider text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/70 shrink-0">
                    Member 04
                  </span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 font-heading tracking-tight leading-snug break-words">
                    Bhavi Mahnot
                  </h3>
                  <a
                    href="mailto:bhavimahnot@gmail.com"
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-teal-700 transition-colors font-mono break-all leading-relaxed"
                    aria-label="Email Bhavi Mahnot"
                  >
                    <Mail size={13} className="text-slate-400 shrink-0" aria-hidden="true" />
                    <span>bhavimahnot@gmail.com</span>
                  </a>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-5 mt-6 border-t border-slate-100 text-xs">
                <a
                  href="https://www.linkedin.com/in/bhavi-mahnot-994a14321?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=ios_app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-teal-700 transition-colors"
                  aria-label="Bhavi Mahnot on LinkedIn"
                >
                  <span>LinkedIn</span>
                  <ExternalLink size={12} className="text-slate-400" aria-hidden="true" />
                </a>
                <a
                  href="https://github.com/bhavimahnot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-teal-700 transition-colors"
                  aria-label="Bhavi Mahnot on GitHub"
                >
                  <span>GitHub</span>
                  <ExternalLink size={12} className="text-slate-400" aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* Member 5 */}
            <div className="w-[84vw] max-w-[340px] sm:w-[320px] md:w-[280px] lg:w-[calc((100%-4*1rem)/5)] lg:min-w-[220px] xl:w-auto xl:flex-1 shrink-0 snap-start bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 flex flex-col justify-between shadow-2xs hover:shadow-md hover:border-teal-500/30 transition-all duration-300 hover:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none">
              <div>
                <div className="flex items-start justify-between gap-4 mb-5">
                  <BuilderAvatar
                    src="/images/builders/chakradhar-muppuri.jpg"
                    alt="Chakradhar Muppuri portrait"
                    initials="CM"
                  />
                  <span className="text-[11px] font-mono font-medium tracking-wider text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/70 shrink-0">
                    Member 05
                  </span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 font-heading tracking-tight leading-snug break-words">
                    Chakradhar Muppuri
                  </h3>
                  <a
                    href="mailto:chakradharmuppuri027@gmail.com"
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-teal-700 transition-colors font-mono break-all leading-relaxed"
                    aria-label="Email Chakradhar Muppuri"
                  >
                    <Mail size={13} className="text-slate-400 shrink-0" aria-hidden="true" />
                    <span>chakradharmuppuri027@gmail.com</span>
                  </a>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-5 mt-6 border-t border-slate-100 text-xs">
                <a
                  href="https://www.linkedin.com/in/chakradhar-muppuri-063b2633a?utm_source=share_via&utm_content=profile&utm_medium=member_ios"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-teal-700 transition-colors"
                  aria-label="Chakradhar Muppuri on LinkedIn"
                >
                  <span>LinkedIn</span>
                  <ExternalLink size={12} className="text-slate-400" aria-hidden="true" />
                </a>
                <a
                  href="https://chakradhar-portfolio-snowy.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-teal-700 transition-colors"
                  aria-label="Chakradhar Muppuri Portfolio"
                >
                  <span>Portfolio</span>
                  <ExternalLink size={12} className="text-slate-400" aria-hidden="true" />
                </a>
                <a
                  href="https://github.com/chakradhar027"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-teal-700 transition-colors"
                  aria-label="Chakradhar Muppuri on GitHub"
                >
                  <span>GitHub</span>
                  <ExternalLink size={12} className="text-slate-400" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 13. Final CTA & Footer ──────────────────────────────────────────── */}
      <footer className="bg-white" role="contentinfo">
        {/* Conversion banner */}
        <div className="border-b border-slate-200/80 py-16 px-4 sm:px-6 lg:px-8 text-center bg-gradient-to-b from-white to-slate-50">
          <div className="max-w-2xl mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center mx-auto mb-5 shadow-sm">
              <Shield size={24} className="stroke-[2.5]" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3 tracking-tight font-heading">
              Ready to explore your security gate decisions?
            </h2>
            <p className="text-sm text-slate-600 mb-8 leading-relaxed font-body">
              Open the live operational dashboard to evaluate findings, test the policy simulator,
              review repository code with local AI, and inspect your DevSecOps pipelines.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm rounded-xl shadow-sm hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 font-subheading"
              >
                Launch Dashboard <ArrowRight size={15} />
              </Link>
              <a
                href="https://github.com/YogamruthReddy/PipelineShield"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all font-subheading"
              >
                GitHub Repository <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>

        {/* Footer info bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2 text-slate-700">
            <Shield size={16} className="text-teal-700" />
            <span className="font-extrabold font-subheading">PipelineShield</span>
            <span className="text-slate-400 font-mono">— DevSecOps Policy Gatekeeper</span>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <Link href="/dashboard" className="hover:text-slate-900 transition-colors">
              Console
            </Link>
            <a href="#builders" className="hover:text-slate-900 transition-colors">
              Builders
            </a>
            <a
              href="https://github.com/YogamruthReddy/PipelineShield"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 transition-colors"
            >
              GitHub
            </a>
            <span className="flex items-center gap-1 text-slate-400 font-mono">
              <FlaskConical size={11} className="text-amber-600" />
              Demo scenarios are synthetic
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

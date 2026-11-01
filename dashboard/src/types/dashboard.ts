export interface Finding {
  id: string;
  scanner: "trivy" | "semgrep" | "dependency_review" | "manual";
  title: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  file_path?: string | null;
  line_number?: number | null;
  package_name?: string | null;
  installed_version?: string | null;
  fixed_version?: string | null;
  cwe_ids?: string[];
  remediation?: string | null;
}

export type TriageStatus =
  | "open"
  | "unreviewed"
  | "investigating"
  | "in_triage"
  | "assigned"
  | "remediation_in_progress"
  | "fixed"
  | "verified_resolved"
  | "accepted_risk";

export type TriagePriority = "P0" | "P1" | "P2" | "P3";

export interface TriageHistoryEntry {
  status: TriageStatus;
  assignee?: string;
  priority?: TriagePriority;
  note?: string;
  timestamp: string;
  actor: string;
}

export interface TriageRecord {
  findingId?: string;
  status: TriageStatus;
  assignee?: string;
  priority?: TriagePriority;
  targetDate?: string;
  note?: string;
  updatedAt: string;
  updatedBy?: string;
  history?: TriageHistoryEntry[];
}

export interface EvaluationSummary {
  total_findings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  exempted: number;
  blocking_count: number;
  warning_count: number;
}

export interface EvaluationResult {
  decision: "PASS" | "WARN" | "BLOCK" | "ERROR";
  reasons: string[];
  summary: EvaluationSummary;
  findings?: Finding[];
  blocking_findings: Finding[];
  warning_findings: Finding[];
  advisory_findings?: Finding[];
  exempted_findings: Finding[];
  evaluated_at?: string;
  policy_metadata?: Record<string, string>;
  scanner_status?: Record<string, string>;
  errors?: string[];
  branch?: string;
  commit_sha?: string;
}

export interface ProcessedFinding extends Finding {
  gateCategory: "blocking" | "warning" | "advisory" | "exempted";
  triage?: TriageRecord;
  occurrenceCount?: number;
}

export type DashboardView =
  // Workspace
  | "overview"
  | "findings"
  | "runs"
  | "github"
  | "code-review"
  // Investigate
  | "assets"
  | "scanners"
  | "remediation"
  | "exceptions"
  | "local-ai"
  // Governance
  | "policy"
  | "audit"
  | "reports"
  // Insights
  | "trends"
  // Administration
  | "integrations"
  | "settings";

export type LocalAIAction =
  | "explain_finding"
  | "summarize_scan"
  | "suggest_remediation"
  | "threat_context"
  | "verify_fix"
  | "ask_chat"
  | "explain_verdict"
  | "summarize_run_diff"
  | "draft_pr_review"
  | "test_connection"
  | "review_code"
  | "suggest_patch"
  | "verify_guidance"
  | "explain_code"
  | "find_security_risks";

export type PatchLifecycleStatus =
  | "draft"
  | "validated"
  | "unverified"
  | "stale"
  | "approved"
  | "applied_preview"
  | "tests_passed"
  | "tests_failed"
  | "pushed"
  | "abandoned";

export interface GitHubTreeItem {
  path: string;
  name: string;
  type: "file" | "dir";
  size?: number;
  sha: string;
  htmlUrl?: string;
}

export interface GitHubBranchSummary {
  name: string;
  commitSha: string;
  protected: boolean;
}

export interface CodeReviewFinding {
  id: string;
  repoFullName: string;
  branch: string;
  commitSha: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  filePath: string;
  startLine: number;
  endLine: number;
  evidence: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  explanation?: string;
  rationale: string;
  suggestedFix?: string;
  verificationCommand?: string;
  status?: "active" | "stale_commit" | "file_not_found" | "resolved";
}

export interface CodeReviewSessionItem {
  id: string;
  repoFullName: string;
  ref: string;
  commitSha?: string;
  filePath: string;
  selectedLines?: [number, number];
  action: LocalAIAction;
  model: string;
  timestamp: string;
  findingsCount: number;
  responsePreview: string;
  findings?: CodeReviewFinding[];
}

export interface GitHubPermissionScope {
  hasWritePermission: boolean;
  grantedScopes: string[];
  missingScopes: string[];
  reason: string;
}

export interface LocalAIStatus {
  available: boolean;
  runtimeUrl: string;
  configuredModel: string;
  modelInstalled: boolean;
  installedModels: string[];
  latencyMs?: number;
  error?: string;
  requirements: {
    runtime: string;
    recommendedModel: string;
    diskFootprint: string;
  };
  setupGuide: {
    installCommand: string;
    pullCommand: string;
    serveCommand: string;
  };
}

export interface LocalAIResponse {
  success: boolean;
  action: LocalAIAction;
  model: string;
  response: string;
  aiGenerated: boolean;
  advisoryOnly: boolean;
  securityGateOverridePermitted: boolean;
  groundedFields: string[];
  insufficientEvidenceWarning?: boolean;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  uncertainties?: string[];
  evidenceReferences?: string[];
  redactedSecretsCount?: number;
  verificationStatus?: "RESOLVED" | "PERSISTENT" | "MODIFIED" | "INCONCLUSIVE";
  patchValidation?: Record<string, unknown> | null;
  reviewFindings?: CodeReviewFinding[];
  timestamp?: string;
  error?: string;
}

export interface LocalAIHistoryItem {
  id: string;
  timestamp: string;
  action: LocalAIAction;
  model: string;
  findingId?: string;
  query?: string;
  response: string;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  uncertainties?: string[];
  evidenceReferences?: string[];
}

export interface FixCampaign {
  id: string;
  name: string;
  targetPackage?: string;
  scanner: string;
  highestSeverity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  findings: ProcessedFinding[];
  suggestedCommand?: string | null;
  targetVersion?: string | null;
  remediationGuidance: string;
  blockingCount: number;
}

export interface RiskException {
  id: string;
  findingId: string;
  target: string;
  owner: string;
  rationale: string;
  expiryDate: string;
  status: "active" | "under_review" | "expired";
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  type: "ingestion" | "gate_decision" | "triage_update" | "risk_exception" | "report_export";
  source: "github_actions" | "local_workspace" | "security_engine";
  title: string;
  details: string;
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  metadata?: Record<string, string>;
}

export interface AssetItem {
  id: string;
  type: "package" | "source_file" | "repository";
  name: string;
  version?: string;
  fixedVersion?: string;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  scanners: string[];
  findings: ProcessedFinding[];
}

export interface SampleReportItem {
  label: string;
  tag: string;
  isDemo: boolean;
  data: EvaluationResult;
}

export interface LiveRunInfo {
  run: {
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    html_url: string;
    head_sha: string;
    head_branch: string;
    event: string;
    created_at: string;
    updated_at: string;
  };
  artifact?: {
    id?: number;
    name: string;
    size_in_bytes?: number;
    expired: boolean;
    created_at?: string;
  };
  fetchedAt: string;
}

export interface RunHistoryItem {
  id: string;
  runNumber?: number;
  label: string;
  source: "live" | "demo" | "custom";
  timestamp: string;
  decision: "PASS" | "WARN" | "BLOCK" | "ERROR";
  totalFindings: number;
  blockingCount: number;
  branch: string;
  commitSha: string;
  report: EvaluationResult;
  liveRunInfo?: LiveRunInfo | null;
}

export interface RunComparisonResult {
  baseLabel: string;
  targetLabel: string;
  newFindings: ProcessedFinding[];
  fixedFindings: ProcessedFinding[];
  persistentFindings: ProcessedFinding[];
}


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
}

export type DashboardView =
  | "overview"
  | "findings"
  | "scanners"
  | "policy"
  | "reports"
  | "runs"
  | "settings";

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


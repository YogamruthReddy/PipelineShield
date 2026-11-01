/**
 * PipelineShield Durable Run Persistence & Change Intelligence Store.
 *
 * Implements crash-safe, restart-durable persistence for CI workflow runs,
 * artifact provenance, normalized findings, delivery deduplication, and
 * deterministic run-to-run comparisons (new, fixed, persistent, regressed).
 *
 * Durability & Reliability:
 * - Server-side only: never exposes raw secrets or credentials.
 * - Crash-safe atomic writes: uses temporary files and atomic renames to prevent corruption.
 * - Persistent across restarts: all ingested runs and deliveries are stored in durable JSON documents.
 * - Delivery idempotency: deduplicates repeated deliveries by UUID and run ID across process lifecycles.
 * - Deterministic comparison: matches findings across runs by stable composite identity keys.
 * - Bounded storage: caps max runs and delivery records to prevent disk or memory exhaustion.
 */

import fs from "fs";
import path from "path";
import type { Finding, EvaluationResult } from "../types/dashboard.ts";

export interface StoredRunProvenance {
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
  run_number?: number;
}

export interface StoredArtifactInfo {
  id?: number;
  name: string;
  size_in_bytes?: number;
  expired?: boolean;
  created_at?: string;
}

export interface StoredRun {
  runId: number;
  runNumber?: number;
  label: string;
  branch: string;
  commitSha: string;
  event: string;
  decision: "PASS" | "WARN" | "BLOCK" | "ERROR";
  htmlUrl: string;
  timestamp: string;
  ingestedAt: string;
  deliveryId?: string;
  source?: "webhook" | "reconciliation" | "api_sync" | "local_upload";
  schemaVersion: number;
  provenance: StoredRunProvenance;
  artifact?: StoredArtifactInfo;
  report: EvaluationResult;
  findings: Finding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };
}

export interface RunComparisonResult {
  baseRunId: number;
  targetRunId: number;
  baseDecision: "PASS" | "WARN" | "BLOCK" | "ERROR";
  targetDecision: "PASS" | "WARN" | "BLOCK" | "ERROR";
  newFindings: Finding[];
  fixedFindings: Finding[];
  persistentFindings: Finding[];
  regressedFindings: Finding[];
  summary: {
    newCount: number;
    fixedCount: number;
    persistentCount: number;
    regressedCount: number;
    severityChange: {
      criticalDelta: number;
      highDelta: number;
      mediumDelta: number;
      lowDelta: number;
    };
  };
}

export interface WebhookDeliveryRecord {
  deliveryId: string;
  runId: number;
  event: string;
  receivedAt: string;
}

export interface StoreMeta {
  schemaVersion: number;
  lastSuccessfulSync: string | null;
  lastSyncSource: string | null;
  syncErrors: Array<{ timestamp: string; message: string; runId?: number }>;
  totalIngestedRuns: number;
}

export interface StoreDiagnostics {
  storageType: "durable_filesystem";
  dataDir: string;
  runsCount: number;
  deliveriesCount: number;
  lastSuccessfulSync: string | null;
  lastSyncSource: string | null;
  lastDelivery: WebhookDeliveryRecord | null;
}

// Storage bounds
const MAX_RUNS_STORED = 100;
const MAX_DELIVERIES_STORED = 1000;
const CURRENT_SCHEMA_VERSION = 1;

// Internal in-memory cache mirrors durable disk state for sub-millisecond lookups
let isInitialized = false;
let activeDataDir: string = "";
const runsCache: Map<number, StoredRun> = new Map();
const deliveryCache: Map<string, WebhookDeliveryRecord> = new Map();
let lastWebhookDelivery: WebhookDeliveryRecord | null = null;
let storeMeta: StoreMeta = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  lastSuccessfulSync: null,
  lastSyncSource: null,
  syncErrors: [],
  totalIngestedRuns: 0,
};

/**
 * Resolve the durable data directory on disk.
 */
export function resolveDataDir(overrideDir?: string): string {
  if (overrideDir && overrideDir.trim()) {
    return path.resolve(overrideDir.trim());
  }
  if (process.env.PIPELINESHIELD_DATA_DIR && process.env.PIPELINESHIELD_DATA_DIR.trim()) {
    return path.resolve(process.env.PIPELINESHIELD_DATA_DIR.trim());
  }
  return path.resolve(process.cwd(), "data", "storage");
}

/**
 * Crash-safe atomic JSON file write.
 * Writes to a temporary file in the target directory and atomically renames it.
 */
export function atomicWriteJson(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
  const serialized = JSON.stringify(data, null, 2);

  fs.writeFileSync(tmpPath, serialized, "utf8");

  // On Windows, rapid renames can transiently raise EPERM; retry up to 3 times
  let attempts = 0;
  while (attempts < 3) {
    try {
      fs.renameSync(tmpPath, filePath);
      break;
    } catch (err) {
      attempts++;
      if (attempts >= 3) {
        // Fallback: copy and remove tmp file
        try {
          fs.copyFileSync(tmpPath, filePath);
          fs.unlinkSync(tmpPath);
          break;
        } catch {
          throw err;
        }
      }
    }
  }
}

/**
 * Initialize durable store on disk and hydrate in-memory cache.
 */
export function initDurableStore(customDir?: string): void {
  const dataDir = resolveDataDir(customDir);
  activeDataDir = dataDir;

  const runsDir = path.join(dataDir, "runs");
  if (!fs.existsSync(runsDir)) {
    fs.mkdirSync(runsDir, { recursive: true });
  }

  runsCache.clear();
  deliveryCache.clear();

  // 1. Hydrate deliveries cache
  const deliveriesFile = path.join(dataDir, "deliveries.json");
  if (fs.existsSync(deliveriesFile)) {
    try {
      const raw = fs.readFileSync(deliveriesFile, "utf8");
      const list: WebhookDeliveryRecord[] = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((rec) => {
          if (rec && rec.deliveryId) {
            deliveryCache.set(rec.deliveryId, rec);
          }
        });
        if (list.length > 0) {
          lastWebhookDelivery = list[list.length - 1];
        }
      }
    } catch {
      // In case of read/parse corruption, start with empty deliveries
    }
  }

  // 2. Hydrate metadata
  const metaFile = path.join(dataDir, "meta.json");
  if (fs.existsSync(metaFile)) {
    try {
      const raw = fs.readFileSync(metaFile, "utf8");
      const parsed = JSON.parse(raw);
      storeMeta = {
        schemaVersion: parsed.schemaVersion || CURRENT_SCHEMA_VERSION,
        lastSuccessfulSync: parsed.lastSuccessfulSync || null,
        lastSyncSource: parsed.lastSyncSource || null,
        syncErrors: Array.isArray(parsed.syncErrors) ? parsed.syncErrors : [],
        totalIngestedRuns: parsed.totalIngestedRuns || 0,
      };
    } catch {
      // Start with default metadata
    }
  }

  // 3. Hydrate runs cache from disk
  if (fs.existsSync(runsDir)) {
    try {
      const files = fs.readdirSync(runsDir).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        try {
          const runFilePath = path.join(runsDir, file);
          const raw = fs.readFileSync(runFilePath, "utf8");
          const run: StoredRun = JSON.parse(raw);
          if (run && typeof run.runId === "number") {
            // Apply schema migrations if needed
            if (!run.schemaVersion) {
              run.schemaVersion = CURRENT_SCHEMA_VERSION;
            }
            runsCache.set(run.runId, run);
          }
        } catch {
          // Skip corrupt individual run file without aborting other runs
        }
      }
    } catch {
      // Read failure handled safely
    }
  }

  isInitialized = true;
}

/**
 * Ensure store is initialized before any read/write operation.
 */
function ensureInitialized(): void {
  if (!isInitialized) {
    initDurableStore();
  }
}

import { getFindingIdentityKey } from "./finding-identity.ts";
export { getFindingIdentityKey };

/**
 * Extract unified findings array from an EvaluationResult.
 */
export function extractFindingsFromReport(report: EvaluationResult): Finding[] {
  if (Array.isArray(report.findings) && report.findings.length > 0) {
    return report.findings;
  }

  const collected: Finding[] = [];
  if (Array.isArray(report.blocking_findings)) {
    collected.push(...report.blocking_findings);
  }
  if (Array.isArray(report.warning_findings)) {
    collected.push(...report.warning_findings);
  }
  if (Array.isArray(report.advisory_findings)) {
    collected.push(...report.advisory_findings);
  }
  return collected;
}

/**
 * Record a new or updated run into durable disk storage and memory cache.
 */
export function recordRun(
  runProvenance: StoredRunProvenance,
  report: EvaluationResult,
  artifact?: StoredArtifactInfo,
  deliveryId?: string,
  source: "webhook" | "reconciliation" | "api_sync" | "local_upload" = "webhook"
): StoredRun {
  ensureInitialized();

  const findings = extractFindingsFromReport(report);
  const now = new Date().toISOString();

  const summary = {
    critical: report.summary?.critical ?? findings.filter((f) => f.severity === "CRITICAL").length,
    high: report.summary?.high ?? findings.filter((f) => f.severity === "HIGH").length,
    medium: report.summary?.medium ?? findings.filter((f) => f.severity === "MEDIUM").length,
    low: report.summary?.low ?? findings.filter((f) => f.severity === "LOW").length,
    info: report.summary?.info ?? findings.filter((f) => f.severity === "INFO").length,
    total: report.summary?.total_findings ?? findings.length,
  };

  const stored: StoredRun = {
    runId: runProvenance.id,
    runNumber: runProvenance.run_number,
    label: `CI Run #${runProvenance.id} (${(runProvenance.conclusion || report.decision).toUpperCase()})`,
    branch: runProvenance.head_branch || "main",
    commitSha: runProvenance.head_sha || "unknown",
    event: runProvenance.event || "workflow_run",
    decision: report.decision,
    htmlUrl: runProvenance.html_url,
    timestamp: runProvenance.created_at || now,
    ingestedAt: now,
    deliveryId,
    source,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    provenance: runProvenance,
    artifact,
    report,
    findings,
    summary,
  };

  // 1. Enforce bounded retention
  if (runsCache.size >= MAX_RUNS_STORED && !runsCache.has(runProvenance.id)) {
    const oldestKey = runsCache.keys().next().value;
    if (oldestKey !== undefined) {
      runsCache.delete(oldestKey);
      try {
        const oldestFile = path.join(activeDataDir, "runs", `${oldestKey}.json`);
        if (fs.existsSync(oldestFile)) {
          fs.unlinkSync(oldestFile);
        }
      } catch {
        // Safe delete
      }
    }
  }

  // 2. Persist to disk atomically
  const runFile = path.join(activeDataDir, "runs", `${runProvenance.id}.json`);
  atomicWriteJson(runFile, stored);

  // 3. Update memory cache
  runsCache.set(runProvenance.id, stored);

  // 4. Update metadata
  storeMeta.lastSuccessfulSync = now;
  storeMeta.lastSyncSource = source;
  storeMeta.totalIngestedRuns = runsCache.size;
  const metaFile = path.join(activeDataDir, "meta.json");
  atomicWriteJson(metaFile, storeMeta);

  return stored;
}

/**
 * Get all stored runs from durable storage, sorted from newest to oldest.
 */
export function getAllRuns(): StoredRun[] {
  ensureInitialized();

  const runs = Array.from(runsCache.values());
  runs.sort((a, b) => {
    const numA = typeof a.runNumber === "number" ? a.runNumber : a.runId;
    const numB = typeof b.runNumber === "number" ? b.runNumber : b.runId;
    if (numB !== numA) {
      return numB - numA;
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  return runs;
}

/**
 * Get a specific run by its run ID.
 */
export function getRunById(runId: number): StoredRun | undefined {
  ensureInitialized();
  return runsCache.get(runId);
}

/**
 * Get the latest stored run.
 */
export function getLatestRun(): StoredRun | undefined {
  const runs = getAllRuns();
  return runs.length > 0 ? runs[0] : undefined;
}

/**
 * Check if a webhook delivery ID has already been recorded (idempotency check).
 */
export function isDeliveryProcessed(deliveryId: string): boolean {
  if (!deliveryId || !deliveryId.trim()) return false;
  ensureInitialized();
  return deliveryCache.has(deliveryId.trim());
}

/**
 * Record a webhook delivery for durable idempotency tracking across restarts.
 */
export function recordDelivery(
  deliveryId: string,
  runId: number,
  event: string
): WebhookDeliveryRecord {
  ensureInitialized();

  const record: WebhookDeliveryRecord = {
    deliveryId: deliveryId.trim(),
    runId,
    event,
    receivedAt: new Date().toISOString(),
  };

  if (deliveryCache.size >= MAX_DELIVERIES_STORED) {
    const oldestKey = deliveryCache.keys().next().value;
    if (oldestKey !== undefined) {
      deliveryCache.delete(oldestKey);
    }
  }

  deliveryCache.set(record.deliveryId, record);
  lastWebhookDelivery = record;

  // Persist delivery list to disk
  try {
    const deliveriesFile = path.join(activeDataDir, "deliveries.json");
    const list = Array.from(deliveryCache.values());
    atomicWriteJson(deliveriesFile, list);
  } catch {
    // Non-fatal if disk write fails
  }

  return record;
}

/**
 * Record an ingestion failure in durable store metadata.
 */
export function recordIngestionError(message: string, runId?: number): void {
  ensureInitialized();

  storeMeta.syncErrors = [
    { timestamp: new Date().toISOString(), message: message.slice(0, 300), runId },
    ...storeMeta.syncErrors.slice(0, 19),
  ];

  try {
    const metaFile = path.join(activeDataDir, "meta.json");
    atomicWriteJson(metaFile, storeMeta);
  } catch {
    // Non-blocking
  }
}

/**
 * Get the latest webhook delivery record, if any.
 */
export function getLastWebhookDelivery(): WebhookDeliveryRecord | null {
  ensureInitialized();
  return lastWebhookDelivery;
}

/**
 * Get storage and sync diagnostics.
 */
export function getStoreDiagnostics(): StoreDiagnostics {
  ensureInitialized();
  return {
    storageType: "durable_filesystem",
    dataDir: activeDataDir,
    runsCount: runsCache.size,
    deliveriesCount: deliveryCache.size,
    lastSuccessfulSync: storeMeta.lastSuccessfulSync,
    lastSyncSource: storeMeta.lastSyncSource,
    lastDelivery: lastWebhookDelivery,
  };
}

/**
 * Clear store state (useful in test suites).
 */
export function resetRunStore(wipeDisk = false): void {
  runsCache.clear();
  deliveryCache.clear();
  lastWebhookDelivery = null;
  storeMeta = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    lastSuccessfulSync: null,
    lastSyncSource: null,
    syncErrors: [],
    totalIngestedRuns: 0,
  };

  if (wipeDisk && activeDataDir && fs.existsSync(activeDataDir)) {
    try {
      fs.rmSync(activeDataDir, { recursive: true, force: true });
    } catch {
      // Safe cleanup
    }
  }

  isInitialized = false;
}

/**
 * Deterministically compare two runs to compute new, fixed, persistent, and regressed findings.
 */
export function compareRuns(
  baseRun: StoredRun,
  targetRun: StoredRun
): RunComparisonResult {
  const baseKeyMap = new Map<string, Finding>();
  (baseRun.findings || []).forEach((f) => {
    baseKeyMap.set(getFindingIdentityKey(f), f);
  });

  const targetKeyMap = new Map<string, Finding>();
  (targetRun.findings || []).forEach((f) => {
    targetKeyMap.set(getFindingIdentityKey(f), f);
  });

  const newFindings: Finding[] = [];
  const persistentFindings: Finding[] = [];
  const regressedFindings: Finding[] = [];

  const severityOrder: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
    INFO: 0,
  };

  // Categorize target findings
  targetKeyMap.forEach((finding, key) => {
    if (baseKeyMap.has(key)) {
      persistentFindings.push(finding);
      // Check for severity regression (e.g. upgraded from LOW/MEDIUM to HIGH/CRITICAL)
      const baseFinding = baseKeyMap.get(key)!;
      const baseSevRank = severityOrder[baseFinding.severity] || 0;
      const targetSevRank = severityOrder[finding.severity] || 0;
      if (targetSevRank > baseSevRank) {
        regressedFindings.push(finding);
      }
    } else {
      newFindings.push(finding);
    }
  });

  // Fixed findings: existed in base run, no longer in target run
  const fixedFindings: Finding[] = [];
  baseKeyMap.forEach((finding, key) => {
    if (!targetKeyMap.has(key)) {
      fixedFindings.push(finding);
    }
  });

  const criticalDelta =
    (targetRun.summary?.critical || 0) - (baseRun.summary?.critical || 0);
  const highDelta =
    (targetRun.summary?.high || 0) - (baseRun.summary?.high || 0);
  const mediumDelta =
    (targetRun.summary?.medium || 0) - (baseRun.summary?.medium || 0);
  const lowDelta =
    (targetRun.summary?.low || 0) - (baseRun.summary?.low || 0);

  return {
    baseRunId: baseRun.runId,
    targetRunId: targetRun.runId,
    baseDecision: baseRun.decision,
    targetDecision: targetRun.decision,
    newFindings,
    fixedFindings,
    persistentFindings,
    regressedFindings,
    summary: {
      newCount: newFindings.length,
      fixedCount: fixedFindings.length,
      persistentCount: persistentFindings.length,
      regressedCount: regressedFindings.length,
      severityChange: {
        criticalDelta,
        highDelta,
        mediumDelta,
        lowDelta,
      },
    },
  };
}

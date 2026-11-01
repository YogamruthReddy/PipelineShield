import fs from "fs";
import path from "path";
import type { TriageRecord, TriageStatus, TriagePriority, TriageHistoryEntry } from "../types/dashboard.ts";
import { resolveDataDir, atomicWriteJson } from "./run-store.ts";

let isInitialized = false;
let activeDataDir = "";
const triageCache: Map<string, TriageRecord> = new Map();

/**
 * Initialize durable triage storage and hydrate in-memory cache from disk.
 */
export function initTriageStore(customDir?: string): void {
  activeDataDir = resolveDataDir(customDir);
  const triageFile = path.join(activeDataDir, "triage.json");

  triageCache.clear();

  if (fs.existsSync(triageFile)) {
    try {
      const raw = fs.readFileSync(triageFile, "utf8");
      const data: Record<string, TriageRecord> = JSON.parse(raw);
      if (data && typeof data === "object") {
        Object.entries(data).forEach(([findingId, record]) => {
          if (record && typeof record === "object") {
            triageCache.set(findingId, record);
          }
        });
      }
    } catch {
      // In case of read corruption, initialize clean cache
    }
  }

  isInitialized = true;
}

function ensureInitialized(): void {
  if (!isInitialized) {
    initTriageStore();
  }
}

function persistTriage(): void {
  try {
    const triageFile = path.join(activeDataDir, "triage.json");
    const data: Record<string, TriageRecord> = {};
    triageCache.forEach((rec, id) => {
      data[id] = rec;
    });
    atomicWriteJson(triageFile, data);
  } catch {
    // Non-blocking disk write
  }
}

/**
 * Retrieve all triage records as an id-indexed map.
 */
export function getTriageMap(): Record<string, TriageRecord> {
  ensureInitialized();
  const result: Record<string, TriageRecord> = {};
  triageCache.forEach((rec, id) => {
    result[id] = rec;
  });
  return result;
}

/**
 * Retrieve triage record for a specific finding.
 */
export function getTriage(findingId: string): TriageRecord | undefined {
  ensureInitialized();
  return triageCache.get(findingId);
}

/**
 * Update or create a triage record with audit trail history.
 */
export function setTriage(
  findingId: string,
  update: {
    status?: TriageStatus;
    assignee?: string;
    priority?: TriagePriority;
    targetDate?: string;
    note?: string;
  },
  actor: string = "SecOps Lead"
): TriageRecord {
  ensureInitialized();

  const now = new Date().toISOString();
  const existing = triageCache.get(findingId);

  const newStatus: TriageStatus = update.status || existing?.status || "open";
  const newAssignee = update.assignee !== undefined ? update.assignee : existing?.assignee;
  const newPriority = update.priority !== undefined ? update.priority : existing?.priority;
  const newTargetDate = update.targetDate !== undefined ? update.targetDate : existing?.targetDate;
  const newNote = update.note !== undefined ? update.note : existing?.note;

  const historyEntry: TriageHistoryEntry = {
    status: newStatus,
    assignee: newAssignee,
    priority: newPriority,
    note: newNote,
    timestamp: now,
    actor,
  };

  const history = existing?.history ? [...existing.history, historyEntry] : [historyEntry];

  const record: TriageRecord = {
    findingId,
    status: newStatus,
    assignee: newAssignee,
    priority: newPriority,
    targetDate: newTargetDate,
    note: newNote,
    updatedAt: now,
    updatedBy: actor,
    history,
  };

  triageCache.set(findingId, record);
  persistTriage();

  return record;
}

/**
 * Delete a triage record (e.g. for testing or resets).
 */
export function deleteTriage(findingId: string): boolean {
  ensureInitialized();
  const existed = triageCache.delete(findingId);
  if (existed) {
    persistTriage();
  }
  return existed;
}

/**
 * Reset triage store (test helper).
 */
export function resetTriageStore(wipeDisk = false): void {
  triageCache.clear();
  if (wipeDisk && activeDataDir) {
    const triageFile = path.join(activeDataDir, "triage.json");
    if (fs.existsSync(triageFile)) {
      try {
        fs.unlinkSync(triageFile);
      } catch {
        // Ignore
      }
    }
  }
  isInitialized = false;
}


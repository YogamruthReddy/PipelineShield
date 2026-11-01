/**
 * PipelineShield GitHub Webhook Ingestion & Cryptographic Verification Core.
 *
 * Handles incoming GitHub Webhook events (primarily `workflow_run.completed`),
 * verifies HMAC SHA-256 signatures using `crypto.timingSafeEqual`, enforces delivery
 * idempotency, strictly validates target repository and workflow boundaries, and
 * triggers authoritative report ingestion into the run store.
 *
 * Hard security boundaries:
 * - Constant-time comparison: avoids timing attacks on HMAC signature verification.
 * - Server-side only: GITHUB_WEBHOOK_SECRET and GITHUB_TOKEN never leave server memory.
 * - Idempotency guarantee: duplicate deliveries with identical delivery UUIDs or run IDs
 *   are safely deduplicated without redundant network or CPU load.
 * - Strict targeting: drops runs from non-matching repositories or unrelated workflows.
 */

import crypto from "crypto";
import {
  fetchGitHubRunReport,
  DEFAULT_REPO,
  TARGET_WORKFLOW_FILE,
  TARGET_WORKFLOW_NAME,
  type FetchReportOptions,
} from "./github-ingestion.ts";
import {
  isDeliveryProcessed,
  recordDelivery,
  getRunById,
  getAllRuns,
  compareRuns,
  type RunComparisonResult,
  type StoredRun,
} from "./run-store.ts";
import type { EvaluationResult } from "../types/dashboard.ts";

export interface GitHubWebhookHeaders {
  signature?: string | null;
  event?: string | null;
  delivery?: string | null;
}

export interface WebhookVerificationResult {
  valid: boolean;
  statusCode: number;
  error?: string;
}

export interface WebhookValidationResult {
  valid: boolean;
  statusCode: number;
  isPing: boolean;
  shouldProcess: boolean;
  reason?: string;
  runId?: number;
  deliveryId?: string;
  repoFullName?: string;
  workflowName?: string;
  workflowPath?: string;
}

export interface WebhookProcessingResult {
  status: "ingested" | "already_processed" | "ignored" | "failed";
  statusCode: number;
  message: string;
  runId?: number;
  deliveryId?: string;
  decision?: "PASS" | "WARN" | "BLOCK" | "ERROR";
  comparison?: RunComparisonResult | null;
  error?: string;
}

/**
 * Verify GitHub webhook HMAC SHA-256 signature against raw request payload.
 *
 * Uses crypto.timingSafeEqual to prevent side-channel timing attacks.
 */
export function verifyGitHubWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  secret: string | undefined = process.env.GITHUB_WEBHOOK_SECRET
): WebhookVerificationResult {
  if (!secret || !secret.trim()) {
    return {
      valid: false,
      statusCode: 500,
      error:
        "GITHUB_WEBHOOK_SECRET is not configured on the server. Webhook verification requires a configured secret.",
    };
  }

  if (!signatureHeader || !signatureHeader.trim()) {
    return {
      valid: false,
      statusCode: 401,
      error: "Missing required 'X-Hub-Signature-256' header on webhook delivery.",
    };
  }

  const prefix = "sha256=";
  if (!signatureHeader.startsWith(prefix)) {
    return {
      valid: false,
      statusCode: 401,
      error: "Malformed 'X-Hub-Signature-256' header; expected format 'sha256=<hex>'.",
    };
  }

  const providedHex = signatureHeader.slice(prefix.length).trim();
  const hmac = crypto.createHmac("sha256", secret.trim());
  hmac.update(rawBody);
  const calculatedHex = hmac.digest("hex");

  const providedBuffer = Buffer.from(providedHex, "utf8");
  const calculatedBuffer = Buffer.from(calculatedHex, "utf8");

  if (providedBuffer.length !== calculatedBuffer.length) {
    return {
      valid: false,
      statusCode: 401,
      error: "Invalid webhook HMAC SHA-256 signature: digest length mismatch.",
    };
  }

  const isMatch = crypto.timingSafeEqual(providedBuffer, calculatedBuffer);
  if (!isMatch) {
    return {
      valid: false,
      statusCode: 401,
      error: "Invalid webhook HMAC SHA-256 signature.",
    };
  }

  return {
    valid: true,
    statusCode: 200,
  };
}

/**
 * Validates the parsed webhook event payload and headers against repository and workflow gates.
 */
export function validateWebhookEvent(
  headers: GitHubWebhookHeaders,
  payload: Record<string, unknown>,
  targetRepo = process.env.GITHUB_REPOSITORY || DEFAULT_REPO,
  targetWorkflowFile = TARGET_WORKFLOW_FILE,
  targetWorkflowName = TARGET_WORKFLOW_NAME
): WebhookValidationResult {
  const event = headers.event;
  const deliveryId = headers.delivery || undefined;

  // Handle ping event (GitHub initial webhook creation test)
  if (event === "ping") {
    return {
      valid: true,
      statusCode: 200,
      isPing: true,
      shouldProcess: false,
      deliveryId,
      reason: "GitHub ping hook acknowledged.",
    };
  }

  if (event !== "workflow_run") {
    return {
      valid: true,
      statusCode: 202,
      isPing: false,
      shouldProcess: false,
      deliveryId,
      reason: `Event '${event}' is ignored. PipelineShield exclusively processes 'workflow_run' events.`,
    };
  }

  const action = payload.action as string | undefined;
  if (action !== "completed") {
    return {
      valid: true,
      statusCode: 202,
      isPing: false,
      shouldProcess: false,
      deliveryId,
      reason: `Workflow run action '${action || "unknown"}' is ignored. Ingestion triggers strictly on 'completed'.`,
    };
  }

  const repo = payload.repository as { full_name?: string } | undefined;
  const repoFullName = repo?.full_name || "";
  if (
    repoFullName.toLowerCase().trim() !== targetRepo.toLowerCase().trim()
  ) {
    return {
      valid: true,
      statusCode: 202,
      isPing: false,
      shouldProcess: false,
      deliveryId,
      repoFullName,
      reason: `Ignored workflow run from repository '${repoFullName}'; expected '${targetRepo}'.`,
    };
  }

  const workflowRun = payload.workflow_run as
    | { id?: number; name?: string; path?: string }
    | undefined;
  const workflow = payload.workflow as
    | { id?: number; name?: string; path?: string }
    | undefined;

  if (!workflowRun || typeof workflowRun.id !== "number") {
    return {
      valid: false,
      statusCode: 400,
      isPing: false,
      shouldProcess: false,
      deliveryId,
      reason: "Webhook payload is missing valid workflow_run.id object.",
    };
  }

  const runName = (workflowRun.name || workflow?.name || "").trim();
  const runPath = (workflowRun.path || workflow?.path || "").trim();
  const targetWorkflowPath = `.github/workflows/${targetWorkflowFile}`;

  const matchesPath =
    Boolean(runPath) &&
    (runPath === targetWorkflowPath ||
      runPath.endsWith(`/${targetWorkflowFile}`) ||
      runPath === targetWorkflowFile);

  const matchesName =
    runName === targetWorkflowName ||
    runName.toLowerCase() === targetWorkflowName.toLowerCase() ||
    runName === "DevSecOps Policy Enforcement Gate" ||
    runName.toLowerCase() === "devsecops policy enforcement gate" ||
    runName === "Security Gate" ||
    runName.toLowerCase() === "security gate";

  if (!matchesPath && !matchesName) {
    return {
      valid: true,
      statusCode: 202,
      isPing: false,
      shouldProcess: false,
      deliveryId,
      runId: workflowRun.id,
      workflowName: runName,
      workflowPath: runPath,
      reason: `Workflow '${runName}' (${runPath}) does not match target security gate workflow ('${targetWorkflowFile}' / '${targetWorkflowName}').`,
    };
  }

  return {
    valid: true,
    statusCode: 200,
    isPing: false,
    shouldProcess: true,
    runId: workflowRun.id,
    deliveryId,
    repoFullName,
    workflowName: runName,
    workflowPath: runPath,
  };
}

/**
 * Execute end-to-end processing of a validated workflow_run.completed event.
 * Enforces delivery idempotency, fetches the run artifact, validates contract,
 * and updates the RunStore with comparison intelligence.
 */
export async function processWebhookWorkflowRun(
  validation: WebhookValidationResult,
  options: FetchReportOptions = {}
): Promise<WebhookProcessingResult> {
  const { runId, deliveryId } = validation;

  if (!runId) {
    return {
      status: "failed",
      statusCode: 400,
      message: "Cannot process webhook: missing workflow run ID.",
    };
  }

  // Idempotency check 1: Delivery UUID already processed
  if (deliveryId && isDeliveryProcessed(deliveryId)) {
    const existing = getRunById(runId);
    return {
      status: "already_processed",
      statusCode: 200,
      message: `Delivery ${deliveryId} was already processed. Idempotent skip.`,
      runId,
      deliveryId,
      decision: existing?.decision,
    };
  }

  // Idempotency check 2: Run ID already stored in memory
  const existingRun = getRunById(runId);
  if (existingRun) {
    if (deliveryId) {
      recordDelivery(deliveryId, runId, "workflow_run");
    }
    return {
      status: "already_processed",
      statusCode: 200,
      message: `Run #${runId} is already ingested in RunStore. Idempotent skip.`,
      runId,
      deliveryId,
      decision: existingRun.decision,
    };
  }

  // Previous run for comparison
  const runsBefore = getAllRuns();
  const previousRun: StoredRun | undefined = runsBefore.length > 0 ? runsBefore[0] : undefined;

  // Ingest authoritative report from GitHub Actions artifact
  const result = await fetchGitHubRunReport(runId, options);

  if (result.status !== 200 || !result.body.success || !result.body.report) {
    return {
      status: "failed",
      statusCode: result.status >= 500 ? 502 : result.status,
      message: `Failed to ingest report artifact for run #${runId}: ${result.body.error || "Unknown error"}`,
      runId,
      deliveryId,
      error: result.body.error,
    };
  }

  // Record delivery in idempotency cache
  if (deliveryId) {
    recordDelivery(deliveryId, runId, "workflow_run");
  }

  // Retrieve stored run
  const storedRun = getRunById(runId);
  const decision = (result.body.report as EvaluationResult).decision;

  let comparison: RunComparisonResult | null = null;
  if (storedRun && previousRun && previousRun.runId !== storedRun.runId) {
    comparison = compareRuns(previousRun, storedRun);
  }

  return {
    status: "ingested",
    statusCode: 200,
    message: `Run #${runId} successfully ingested via webhook. Gate decision: ${decision}.`,
    runId,
    deliveryId,
    decision,
    comparison,
  };
}

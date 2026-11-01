/**
 * PipelineShield Live GitHub Webhook Endpoint.
 *
 * POST /api/webhook/github
 * Handles real-time GitHub webhook notifications (`workflow_run.completed`),
 * verifies HMAC SHA-256 signatures, deduplicates deliveries, downloads the
 * authoritative security report artifact, and updates the Run Store.
 *
 * GET /api/webhook/github
 * Returns webhook endpoint readiness, repository configuration, delivery status,
 * and safe integration setup guidance without exposing secrets.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  verifyGitHubWebhookSignature,
  validateWebhookEvent,
  processWebhookWorkflowRun,
} from "@/lib/github-webhook";
import {
  getAllRuns,
  getLastWebhookDelivery,
  getStoreDiagnostics,
} from "@/lib/run-store";
import { formatDataFreshness } from "@/lib/reconciliation";
import {
  DEFAULT_REPO,
  TARGET_WORKFLOW_FILE,
  TARGET_WORKFLOW_NAME,
} from "@/lib/github-ingestion";

export async function POST(request: NextRequest) {
  try {
    const rawBuffer = Buffer.from(await request.arrayBuffer());

    // Payload size sanity check (max 5MB)
    if (rawBuffer.length > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Payload too large (exceeds 5MB limit)." },
        { status: 413 }
      );
    }

    const signature = request.headers.get("x-hub-signature-256");
    const event = request.headers.get("x-github-event");
    const delivery = request.headers.get("x-github-delivery");

    // Cryptographic HMAC SHA-256 verification
    const verification = verifyGitHubWebhookSignature(
      rawBuffer,
      signature,
      process.env.GITHUB_WEBHOOK_SECRET
    );

    if (!verification.valid) {
      return NextResponse.json(
        {
          success: false,
          error: verification.error,
        },
        { status: verification.statusCode }
      );
    }

    // Parse JSON body
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBuffer.toString("utf8"));
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in webhook payload." },
        { status: 400 }
      );
    }

    // Validate event and boundaries
    const validation = validateWebhookEvent(
      { signature, event, delivery },
      payload,
      process.env.GITHUB_REPOSITORY || DEFAULT_REPO,
      TARGET_WORKFLOW_FILE,
      TARGET_WORKFLOW_NAME
    );

    if (validation.isPing) {
      return NextResponse.json(
        {
          success: true,
          message: "PipelineShield webhook connection verified (ping acknowledged).",
          deliveryId: validation.deliveryId,
          repo: process.env.GITHUB_REPOSITORY || DEFAULT_REPO,
        },
        { status: 200 }
      );
    }

    if (!validation.shouldProcess) {
      return NextResponse.json(
        {
          success: true,
          ignored: true,
          reason: validation.reason,
          deliveryId: validation.deliveryId,
        },
        { status: validation.statusCode }
      );
    }

    // Ingest authoritative report artifact for this workflow run
    const result = await processWebhookWorkflowRun(validation, {
      token: process.env.GITHUB_TOKEN,
      repo: process.env.GITHUB_REPOSITORY || DEFAULT_REPO,
    });

    return NextResponse.json(
      {
        success: result.status === "ingested" || result.status === "already_processed",
        status: result.status,
        message: result.message,
        runId: result.runId,
        deliveryId: result.deliveryId,
        decision: result.decision,
        comparison: result.comparison,
        error: result.error,
      },
      { status: result.statusCode }
    );
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error: `Unexpected error during webhook handling: ${errorMsg}`,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const hasSecret = Boolean(process.env.GITHUB_WEBHOOK_SECRET?.trim());
  const hasToken = Boolean(process.env.GITHUB_TOKEN?.trim());
  const repo = process.env.GITHUB_REPOSITORY || DEFAULT_REPO;
  const runs = getAllRuns();
  const lastDelivery = getLastWebhookDelivery();
  const diagnostics = getStoreDiagnostics();

  return NextResponse.json({
    status: hasSecret ? "ready" : "unconfigured",
    configured: hasSecret,
    hasGitHubToken: hasToken,
    targetRepository: repo,
    targetWorkflow: TARGET_WORKFLOW_FILE,
    targetWorkflowName: TARGET_WORKFLOW_NAME,
    totalIngestedRuns: runs.length,
    storage: {
      storageType: diagnostics.storageType,
      dataDir: diagnostics.dataDir,
      totalRuns: runs.length,
      deliveriesCount: diagnostics.deliveriesCount,
      lastSuccessfulSync: diagnostics.lastSuccessfulSync,
      lastSyncSource: diagnostics.lastSyncSource,
      dataFreshness: formatDataFreshness(diagnostics.lastSuccessfulSync),
    },
    latestRun: runs.length > 0 ? {
      runId: runs[0].runId,
      label: runs[0].label,
      decision: runs[0].decision,
      branch: runs[0].branch,
      commitSha: runs[0].commitSha,
      timestamp: runs[0].timestamp,
      findingsCount: runs[0].findings.length,
    } : null,
    lastDelivery: lastDelivery ? {
      deliveryId: lastDelivery.deliveryId,
      runId: lastDelivery.runId,
      event: lastDelivery.event,
      receivedAt: lastDelivery.receivedAt,
    } : null,
    setupGuide: {
      endpointUrl: "/api/webhook/github",
      contentType: "application/json",
      secretVariable: "GITHUB_WEBHOOK_SECRET",
      events: ["Workflow runs"],
      authoritativeBoundary:
        "The security gate CI workflow and policy engine remain 100% authoritative. Webhooks provide prompt ingestion for live dashboard observation and Local AI investigation.",
      dualConfiguration: {
        localDevelopment: {
          receiverPath: "/api/webhook/github",
          tunnelGuidance: "Expose local port 3000 via Cloudflare Tunnel or ngrok to receive GitHub webhooks locally.",
          payloadUrlExample: "https://YOUR-TUNNEL-DOMAIN/api/webhook/github",
          secretGuidance: "Use a dedicated random secret in .env.local (never share or commit).",
          caveat: "Only active while the local development server and tunnel daemon are running.",
        },
        productionDeployed: {
          receiverPath: "/api/webhook/github",
          payloadUrlExample: "https://YOUR-DEPLOYED-APP.DOMAIN/api/webhook/github",
          secretGuidance: "Configure a separate, distinct production secret in your hosting provider environment variables.",
          caveat: "Independent webhook registration in GitHub ensures seamless zero-tunnel 24/7 delivery.",
        },
      },
    },
  });
}


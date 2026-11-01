/**
 * PipelineShield Ingested Runs, Reconciliation & Change Intelligence Endpoint.
 *
 * GET /api/runs
 * Returns list of all durably stored runs with provenance, latest comparisons,
 * and change metrics (new, fixed, persistent, regressed findings).
 *
 * Query parameters:
 * - ?id=<runId>: Get detailed stored run by ID
 * - ?base=<baseRunId>&target=<targetRunId>: Compare two specific runs
 * - ?reconcile=true: Discover and reconcile missing runs from GitHub Actions
 * - ?full=true: Include full findings collections in response
 *
 * POST /api/runs
 * Trigger explicit run reconciliation or manual run registration.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getAllRuns,
  getRunById,
  compareRuns,
  getStoreDiagnostics,
} from "@/lib/run-store";
import {
  reconcileRecentRuns,
  formatDataFreshness,
  type ReconciliationResult,
} from "@/lib/reconciliation";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const idParam = url.searchParams.get("id");
  const baseParam = url.searchParams.get("base");
  const targetParam = url.searchParams.get("target");
  const shouldReconcile = url.searchParams.get("reconcile") === "true";

  // 1. Single run lookup
  if (idParam) {
    const runId = parseInt(idParam, 10);
    if (isNaN(runId)) {
      return NextResponse.json(
        { success: false, error: "Invalid run ID parameter." },
        { status: 400 }
      );
    }
    const run = getRunById(runId);
    if (!run) {
      return NextResponse.json(
        { success: false, error: `Run #${runId} not found in store.` },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, run });
  }

  // 2. Trigger reconciliation if requested
  let reconciliationSummary: ReconciliationResult | null = null;
  if (shouldReconcile) {
    reconciliationSummary = await reconcileRecentRuns();
  }

  const allRuns = getAllRuns();

  // 3. Run comparison query
  if (baseParam && targetParam) {
    const baseId = parseInt(baseParam, 10);
    const targetId = parseInt(targetParam, 10);
    if (isNaN(baseId) || isNaN(targetId)) {
      return NextResponse.json(
        { success: false, error: "Invalid comparison run ID parameters." },
        { status: 400 }
      );
    }
    const baseRun = getRunById(baseId);
    const targetRun = getRunById(targetId);

    if (!baseRun || !targetRun) {
      return NextResponse.json(
        {
          success: false,
          error: `One or both runs (${baseId}, ${targetId}) not found in store for comparison.`,
        },
        { status: 404 }
      );
    }

    const comparison = compareRuns(baseRun, targetRun);
    return NextResponse.json({ success: true, comparison });
  }

  // 4. Default: Return list of runs and latest comparison (if >= 2 runs exist)
  let latestComparison = null;
  if (allRuns.length >= 2) {
    latestComparison = compareRuns(allRuns[1], allRuns[0]);
  }

  const includeFull = url.searchParams.get("full") === "true";

  const runsSummary = allRuns.map((r) => ({
    runId: r.runId,
    runNumber: r.runNumber,
    label: r.label,
    branch: r.branch,
    commitSha: r.commitSha,
    event: r.event,
    decision: r.decision,
    htmlUrl: r.htmlUrl,
    timestamp: r.timestamp,
    ingestedAt: r.ingestedAt,
    deliveryId: r.deliveryId,
    source: r.source || "webhook",
    findingsCount: r.findings.length,
    findings: includeFull ? r.findings : undefined,
    summary: r.summary,
  }));

  const diagnostics = getStoreDiagnostics();

  return NextResponse.json({
    success: true,
    totalRuns: allRuns.length,
    runs: runsSummary,
    latestComparison,
    reconciliation: reconciliationSummary,
    diagnostics: {
      storageType: diagnostics.storageType,
      dataDir: diagnostics.dataDir,
      runsCount: diagnostics.runsCount,
      deliveriesCount: diagnostics.deliveriesCount,
      lastSuccessfulSync: diagnostics.lastSuccessfulSync,
      lastSyncSource: diagnostics.lastSyncSource,
      dataFreshness: formatDataFreshness(diagnostics.lastSuccessfulSync),
      lastDelivery: diagnostics.lastDelivery,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.action === "reconcile") {
      const result = await reconcileRecentRuns();
      return NextResponse.json({ success: true, reconciliation: result });
    }
    return NextResponse.json(
      { success: false, error: `Unsupported action '${body.action}'. Supported: 'reconcile'.` },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: `Invalid request payload: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 }
    );
  }
}

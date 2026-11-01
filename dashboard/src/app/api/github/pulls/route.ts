/**
 * GET /api/github/pulls
 * Fetches pull request details, changed files with diff patches, and commit check-runs.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPullRequestDetails } from "@/lib/github-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repo = searchParams.get("repo") || process.env.GITHUB_REPOSITORY || "YogamruthReddy/PipelineShield";
    const pullNumberStr = searchParams.get("pull_number");

    if (!pullNumberStr) {
      return NextResponse.json(
        { success: false, error: "Missing required 'pull_number' query parameter." },
        { status: 400 }
      );
    }

    const pullNumber = parseInt(pullNumberStr, 10);
    if (isNaN(pullNumber) || pullNumber <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid 'pull_number' query parameter." },
        { status: 400 }
      );
    }

    const result = await getPullRequestDetails(repo, pullNumber);

    const response = NextResponse.json(
      {
        success: result.success,
        pullRequest: result.pullRequest,
        files: result.files,
        checkRuns: result.checkRuns,
        error: result.error,
      },
      { status: result.statusCode }
    );

    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Internal server error inspecting pull request: ${msg}` },
      { status: 500 }
    );
  }
}


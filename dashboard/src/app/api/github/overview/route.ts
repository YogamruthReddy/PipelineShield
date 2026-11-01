/**
 * GET /api/github/overview
 * Fetches repository overview, recent workflow runs, recent PRs, and security posture.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRepositoryOverview } from "@/lib/github-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repo = searchParams.get("repo") || process.env.GITHUB_REPOSITORY || "YogamruthReddy/PipelineShield";

    const result = await getRepositoryOverview(repo);

    const response = NextResponse.json(
      {
        success: result.success,
        overview: result.overview,
        error: result.error,
      },
      { status: result.statusCode }
    );

    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Internal server error fetching repository overview: ${msg}` },
      { status: 500 }
    );
  }
}


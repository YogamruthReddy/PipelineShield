/**
 * GET /api/github/branches
 * Lists branches for a repository and checks token permission scopes.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRepositoryBranches, checkTokenScopes } from "@/lib/github-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repo = searchParams.get("repo") || process.env.GITHUB_REPOSITORY || "YogamruthReddy/PipelineShield";

    const [branchResult, scopes] = await Promise.all([
      getRepositoryBranches(repo),
      checkTokenScopes(),
    ]);

    const response = NextResponse.json(
      {
        success: branchResult.success,
        branches: branchResult.branches,
        rateLimit: branchResult.rateLimit,
        scopes,
        error: branchResult.error,
      },
      { status: branchResult.statusCode }
    );

    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Internal server error fetching branches: ${msg}` },
      { status: 500 }
    );
  }
}


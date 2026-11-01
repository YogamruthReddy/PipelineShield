/**
 * GET /api/github/tree
 * Loads repository directory contents on-demand path-by-path.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRepositoryDirectoryContents } from "@/lib/github-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repo = searchParams.get("repo") || process.env.GITHUB_REPOSITORY || "YogamruthReddy/PipelineShield";
    const path = searchParams.get("path") || "";
    const ref = searchParams.get("ref") || "main";

    const result = await getRepositoryDirectoryContents(repo, path, ref);

    const response = NextResponse.json(
      {
        success: result.success,
        items: result.items,
        rateLimit: result.rateLimit,
        error: result.error,
      },
      { status: result.statusCode }
    );

    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Internal server error fetching directory tree: ${msg}` },
      { status: 500 }
    );
  }
}


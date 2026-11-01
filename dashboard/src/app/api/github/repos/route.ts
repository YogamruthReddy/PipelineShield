/**
 * GET /api/github/repos
 * Lists repositories accessible by the configured GITHUB_TOKEN.
 * Supports pagination (page, per_page), search, and visibility filters.
 */

import { NextRequest, NextResponse } from "next/server";
import { listAccountRepositories } from "@/lib/github-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const perPage = parseInt(searchParams.get("per_page") || "30", 10);
    const search = searchParams.get("search") || undefined;
    const visibility = (searchParams.get("visibility") as "all" | "public" | "private") || undefined;

    const result = await listAccountRepositories({
      page,
      perPage,
      search,
      visibility,
    });

    const response = NextResponse.json(
      {
        success: result.success,
        repositories: result.repositories,
        page: result.page,
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
      { success: false, error: `Internal server error discovering repositories: ${msg}` },
      { status: 500 }
    );
  }
}


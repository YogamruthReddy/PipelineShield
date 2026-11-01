/**
 * GET /api/github/file
 * Retrieves file content at a specified Git ref for diff and patch validation.
 */

import { NextRequest, NextResponse } from "next/server";
import { getFileContentAtRef } from "@/lib/github-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repo = searchParams.get("repo") || process.env.GITHUB_REPOSITORY || "YogamruthReddy/PipelineShield";
    const path = searchParams.get("path");
    const ref = searchParams.get("ref") || "main";

    if (!path || !path.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing required 'path' query parameter." },
        { status: 400 }
      );
    }

    const result = await getFileContentAtRef(repo, path.trim(), ref.trim());

    const response = NextResponse.json(
      {
        success: result.success,
        content: result.content,
        error: result.error,
      },
      { status: result.statusCode }
    );

    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Internal server error reading file content: ${msg}` },
      { status: 500 }
    );
  }
}


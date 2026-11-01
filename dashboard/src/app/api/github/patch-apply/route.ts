/**
 * POST /api/github/patch-apply
 *
 * Gated patch apply and pull request creation.
 * Strict invariants:
 * - Requires explicit user approval flag.
 * - Read-only tokens are rejected cleanly with scope explanation.
 * - Stale base branch commits trigger HTTP 409 conflict.
 * - Always creates an isolated branch (patch/pipelineshield-<timestamp>) and opens a PR.
 * - Never pushes directly to default or protected branches.
 */

import { NextRequest, NextResponse } from "next/server";
import { createPatchBranchAndPullRequest } from "@/lib/github-service";

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF / Same-Origin Verification
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host) {
      try {
        const originUrl = new URL(origin);
        const hostName = host.split(":")[0];
        if (
          originUrl.hostname !== hostName &&
          originUrl.hostname !== "localhost" &&
          originUrl.hostname !== "127.0.0.1"
        ) {
          return NextResponse.json(
            { success: false, error: "Cross-Origin patch application request rejected (CSRF protection)." },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { success: false, error: "Malformed Origin header in request." },
          { status: 403 }
        );
      }
    }

    const body = await request.json();

    const {
      repo = process.env.GITHUB_REPOSITORY || "YogamruthReddy/PipelineShield",
      baseBranch,
      expectedBaseSha,
      targetFilePath,
      unifiedDiff,
      patchedContent,
      commitMessage,
      prTitle,
      prBody,
      userConfirmedApproval,
    } = body;

    // 2. Explicit User Approval Invariant
    if (!userConfirmedApproval) {
      return NextResponse.json(
        {
          success: false,
          error: "Explicit user approval is required before applying and pushing patches to GitHub.",
        },
        { status: 403 }
      );
    }

    // 3. Mandatory Parameters & Strict Path Traversal Defense
    if (!baseBranch || !expectedBaseSha || !targetFilePath) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameters: baseBranch, expectedBaseSha, and targetFilePath are mandatory.",
        },
        { status: 400 }
      );
    }

    const cleanPath = String(targetFilePath).replace(/^\/+|\/+$/g, "");
    if (
      cleanPath.includes("..") ||
      cleanPath.includes("\\") ||
      cleanPath.includes("\0") ||
      String(targetFilePath).startsWith("/")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Path traversal or illegal characters detected in targetFilePath.",
        },
        { status: 400 }
      );
    }

    if (!unifiedDiff && typeof patchedContent !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Either unifiedDiff or patchedContent must be supplied.",
        },
        { status: 400 }
      );
    }

    const result = await createPatchBranchAndPullRequest({
      repoFullName: repo,
      baseBranch,
      expectedBaseSha,
      targetFilePath: cleanPath,
      unifiedDiff,
      patchedContent,
      commitMessage: commitMessage || `fix(security): apply patch to ${cleanPath}`,
      prTitle: prTitle || `[Security Patch] Fix in ${cleanPath}`,
      prBody: prBody || "Automated patch proposal from PipelineShield Security Workspace.",
      userConfirmedApproval: true,
    });

    const response = NextResponse.json(
      {
        success: result.success,
        prUrl: result.prUrl,
        prNumber: result.prNumber,
        branchName: result.branchName,
        error: result.error,
      },
      { status: result.statusCode }
    );

    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Internal server error during patch workflow: ${msg}` },
      { status: 500 }
    );
  }
}


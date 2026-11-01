/**
 * PipelineShield Local AI Advisory Assistant Route Handler
 *
 * GET  /api/local-ai -> Query local runtime (Ollama) status and installed models
 * POST /api/local-ai -> Execute grounded security copilot action
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRuntimeStatus, executeLocalAIAction } from "@/lib/local-ai";

export async function GET() {
  const runtimeUrl = process.env.LOCAL_AI_URL;
  const configuredModel = process.env.LOCAL_AI_MODEL;

  const status = await checkRuntimeStatus(runtimeUrl, configuredModel);

  return NextResponse.json(status);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const runtimeUrl = process.env.LOCAL_AI_URL;
  const defaultModel = process.env.LOCAL_AI_MODEL;
  const timeoutMs = process.env.LOCAL_AI_TIMEOUT_MS ? parseInt(process.env.LOCAL_AI_TIMEOUT_MS, 10) : undefined;

  const result = await executeLocalAIAction(rawBody, {
    runtimeUrl,
    defaultModel,
    timeoutMs,
  });

  return NextResponse.json(result.data, { status: result.status });
}

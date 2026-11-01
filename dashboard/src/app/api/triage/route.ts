import { NextRequest, NextResponse } from "next/server";
import { getTriageMap, getTriage } from "@/lib/triage-store";


export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const findingId = searchParams.get("findingId");

  if (findingId) {
    const record = getTriage(findingId);
    if (!record) {
      return NextResponse.json({ success: false, error: "Finding not found in triage store" }, { status: 404 });
    }
    return NextResponse.json({ success: true, triage: record });
  }

  const allRecords = getTriageMap();
  return NextResponse.json({
    success: true,
    count: Object.keys(allRecords).length,
    triageMap: allRecords,
  });
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "Public durable triage mutation is disabled. PipelineShield operates in session-scoped triage mode until authenticated identity and shared storage are configured.",
      isSessionOnly: true,
    },
    { status: 403 }
  );
}


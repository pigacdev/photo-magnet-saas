import { NextResponse } from "next/server";
import { requirePlatformOwnerResponse } from "@/lib/platformAuth";
import { fetchPlatformOverview } from "../../../../../server/src/lib/platformMetrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requirePlatformOwnerResponse();
  if (denied) return denied;

  try {
    const overview = await fetchPlatformOverview();
    return NextResponse.json(overview);
  } catch (err) {
    console.error("[GET /api/platform/overview]", err);
    return NextResponse.json(
      { error: "Failed to load platform overview" },
      { status: 500 },
    );
  }
}

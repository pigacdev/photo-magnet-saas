import { NextResponse } from "next/server";
import { requirePlatformOwnerResponse } from "@/lib/platformAuth";
import { fetchPlatformEarlyAccess } from "../../../../../server/src/lib/platformEarlyAccess";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requirePlatformOwnerResponse();
  if (denied) return denied;

  try {
    const result = await fetchPlatformEarlyAccess();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/platform/early-access]", err);
    return NextResponse.json(
      { error: "Failed to load early access data" },
      { status: 500 },
    );
  }
}

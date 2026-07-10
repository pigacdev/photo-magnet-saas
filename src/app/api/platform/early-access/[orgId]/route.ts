import { NextResponse } from "next/server";
import { requirePlatformOwnerResponse } from "@/lib/platformAuth";
import { setGrantLifetimeDiscount } from "../../../../../../server/src/lib/platformEarlyAccess";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await requirePlatformOwnerResponse();
  if (denied) return denied;

  const { orgId } = await context.params;
  let body: { grantLifetimeDiscount?: unknown };
  try {
    body = (await request.json()) as { grantLifetimeDiscount?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.grantLifetimeDiscount !== "boolean") {
    return NextResponse.json(
      { error: "grantLifetimeDiscount must be a boolean" },
      { status: 400 },
    );
  }

  try {
    const ok = await setGrantLifetimeDiscount(orgId, body.grantLifetimeDiscount);
    if (!ok) {
      return NextResponse.json(
        { error: "Early-access organization not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ok: true,
      grantLifetimeDiscount: body.grantLifetimeDiscount,
    });
  } catch (err) {
    console.error("[PATCH /api/platform/early-access/:orgId]", err);
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 },
    );
  }
}

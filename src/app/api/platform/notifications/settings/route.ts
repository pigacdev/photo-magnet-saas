import { NextResponse } from "next/server";
import { requirePlatformOwnerResponse } from "@/lib/platformAuth";
import {
  getPlatformAlertSettings,
  updatePlatformAlertSettings,
} from "../../../../../../server/src/lib/platformAlertSettings";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requirePlatformOwnerResponse();
  if (denied) return denied;

  try {
    const settings = await getPlatformAlertSettings();
    return NextResponse.json({
      newUserAlertsEnabled: settings.newUserAlertsEnabled,
      planChangeAlertsEnabled: settings.planChangeAlertsEnabled,
      updatedAt: settings.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error("[GET /api/platform/notifications/settings]", err);
    return NextResponse.json(
      { error: "Failed to load notification settings" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const denied = await requirePlatformOwnerResponse();
  if (denied) return denied;

  let body: {
    newUserAlertsEnabled?: unknown;
    planChangeAlertsEnabled?: unknown;
  };
  try {
    body = (await request.json()) as {
      newUserAlertsEnabled?: unknown;
      planChangeAlertsEnabled?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const hasNewUser = typeof body.newUserAlertsEnabled === "boolean";
  const hasPlanChange = typeof body.planChangeAlertsEnabled === "boolean";
  if (!hasNewUser && !hasPlanChange) {
    return NextResponse.json(
      {
        error:
          "Provide newUserAlertsEnabled and/or planChangeAlertsEnabled as boolean",
      },
      { status: 400 },
    );
  }
  if (
    body.newUserAlertsEnabled !== undefined &&
    typeof body.newUserAlertsEnabled !== "boolean"
  ) {
    return NextResponse.json(
      { error: "newUserAlertsEnabled must be a boolean" },
      { status: 400 },
    );
  }
  if (
    body.planChangeAlertsEnabled !== undefined &&
    typeof body.planChangeAlertsEnabled !== "boolean"
  ) {
    return NextResponse.json(
      { error: "planChangeAlertsEnabled must be a boolean" },
      { status: 400 },
    );
  }

  try {
    const settings = await updatePlatformAlertSettings({
      ...(hasNewUser
        ? { newUserAlertsEnabled: body.newUserAlertsEnabled as boolean }
        : {}),
      ...(hasPlanChange
        ? { planChangeAlertsEnabled: body.planChangeAlertsEnabled as boolean }
        : {}),
    });
    return NextResponse.json({
      newUserAlertsEnabled: settings.newUserAlertsEnabled,
      planChangeAlertsEnabled: settings.planChangeAlertsEnabled,
      updatedAt: settings.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error("[PATCH /api/platform/notifications/settings]", err);
    return NextResponse.json(
      { error: "Failed to update notification settings" },
      { status: 500 },
    );
  }
}

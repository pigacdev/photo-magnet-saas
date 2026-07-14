import { NextResponse } from "next/server";
import {
  requirePlatformOwnerResponse,
  resolvePlatformOwnerEmail,
} from "@/lib/platformAuth";
import {
  PlatformNotificationError,
  sendPlatformNotifications,
  type PlatformNotificationSelection,
} from "../../../../../../server/src/lib/platformNotifications";

export const dynamic = "force-dynamic";

function parseNotificationSelection(
  raw: unknown,
): PlatformNotificationSelection | null {
  if (!raw || typeof raw !== "object") return null;
  const sel = raw as Record<string, unknown>;
  const mode = sel.mode;
  if (mode === "explicit") {
    if (!Array.isArray(sel.userIds)) return null;
    const userIds = sel.userIds.filter((id) => typeof id === "string") as string[];
    return { mode: "explicit", userIds };
  }
  if (mode === "all_matching") {
    const filters =
      sel.filters && typeof sel.filters === "object"
        ? (sel.filters as Record<string, unknown>)
        : {};
    const excludeUserIds = Array.isArray(sel.excludeUserIds)
      ? (sel.excludeUserIds.filter((id) => typeof id === "string") as string[])
      : undefined;
    return {
      mode: "all_matching",
      filters: {
        search: typeof filters.search === "string" ? filters.search : undefined,
        usageFilter:
          typeof filters.usageFilter === "string"
            ? filters.usageFilter
            : undefined,
        sort: typeof filters.sort === "string" ? filters.sort : undefined,
        order: typeof filters.order === "string" ? filters.order : undefined,
      },
      excludeUserIds,
    };
  }
  return null;
}

export async function POST(request: Request) {
  const denied = await requirePlatformOwnerResponse();
  if (denied) return denied;

  const ownerEmail = await resolvePlatformOwnerEmail();
  if (!ownerEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = body as {
    subject?: unknown;
    html?: unknown;
    includeOptedOut?: unknown;
    selection?: unknown;
  };

  if (typeof payload.subject !== "string" || typeof payload.html !== "string") {
    return NextResponse.json(
      { error: "subject and html are required" },
      { status: 400 },
    );
  }
  if (typeof payload.includeOptedOut !== "boolean") {
    return NextResponse.json(
      { error: "includeOptedOut must be a boolean" },
      { status: 400 },
    );
  }

  const selection = parseNotificationSelection(payload.selection);
  if (!selection) {
    return NextResponse.json({ error: "Invalid selection" }, { status: 400 });
  }

  try {
    const result = await sendPlatformNotifications({
      subject: payload.subject,
      html: payload.html,
      includeOptedOut: payload.includeOptedOut,
      selection,
      sentByEmail: ownerEmail,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PlatformNotificationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[POST /api/platform/notifications/send]", err);
    return NextResponse.json(
      { error: "Failed to send notifications" },
      { status: 500 },
    );
  }
}

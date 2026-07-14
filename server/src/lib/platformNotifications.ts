import {
  resolveAllFilteredPlatformTenants,
  type PlatformTenantFilters,
  type PlatformTenantUsageFilter,
} from "./platformMetrics";
import {
  buildPlatformNotificationHtml,
  isResendConfigured,
  sendPlatformNotificationEmail,
} from "./email";
import {
  plainTextLengthFromHtml,
  sanitizeEmailHtml,
} from "./sanitizeEmailHtml";
import { prisma } from "./prisma";
import type { Prisma } from "../../../src/generated/prisma/client";

export const PLATFORM_NOTIFICATION_MAX_RECIPIENTS = 500;
export const PLATFORM_NOTIFICATION_MAX_SUBJECT_CHARS = 200;
export const PLATFORM_NOTIFICATION_MIN_MESSAGE_CHARS = 10;

const USAGE_FILTERS: PlatformTenantUsageFilter[] = [
  "nearOrderLimit",
  "nearEventLimit",
  "orderLimitReached",
  "eventLimitReached",
  "onboardingIncomplete",
  "erasurePending",
];

export type PlatformNotificationSelection =
  | { mode: "explicit"; userIds: string[] }
  | {
      mode: "all_matching";
      filters: {
        search?: string;
        usageFilter?: string;
        sort?: string;
        order?: string;
      };
      excludeUserIds?: string[];
    };

export type SendPlatformNotificationsInput = {
  subject: string;
  html: string;
  includeOptedOut: boolean;
  selection: PlatformNotificationSelection;
  sentByEmail: string;
};

export type SendPlatformNotificationsResult = {
  sent: number;
  skippedOptOut: number;
  failed: number;
  errors: string[];
};

function parseTenantFilters(raw: {
  search?: string;
  usageFilter?: string;
  sort?: string;
  order?: string;
}): PlatformTenantFilters {
  const sortRaw = raw.sort ?? "createdAt";
  const sort =
    sortRaw === "ordersThisMonth" || sortRaw === "settledRevenue"
      ? sortRaw
      : "createdAt";
  const orderRaw = raw.order ?? "desc";
  const order = orderRaw === "asc" ? "asc" : "desc";
  const usageFilter = USAGE_FILTERS.includes(
    raw.usageFilter as PlatformTenantUsageFilter,
  )
    ? (raw.usageFilter as PlatformTenantUsageFilter)
    : undefined;

  return {
    search: raw.search?.trim() || undefined,
    sort,
    order,
    usageFilter,
  };
}

async function resolveRecipientIds(
  selection: PlatformNotificationSelection,
): Promise<{ ids: string[]; filterSnapshot: Record<string, unknown> | null }> {
  if (selection.mode === "explicit") {
    const userIds = [
      ...new Set(
        selection.userIds.map((id) => id.trim()).filter(Boolean),
      ),
    ];
    if (userIds.length === 0) {
      return { ids: [], filterSnapshot: null };
    }

    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        OR: [{ deletedAt: null }, { erasureScheduledAt: { not: null } }],
      },
      select: { id: true },
    });
    return { ids: users.map((u) => u.id), filterSnapshot: null };
  }

  const filters = parseTenantFilters(selection.filters);
  const rows = await resolveAllFilteredPlatformTenants(filters);
  const exclude = new Set(selection.excludeUserIds ?? []);
  const ids = rows.map((r) => r.id).filter((id) => !exclude.has(id));
  return {
    ids,
    filterSnapshot: {
      search: filters.search ?? null,
      usageFilter: filters.usageFilter ?? null,
      sort: filters.sort,
      order: filters.order,
    },
  };
}

export async function sendPlatformNotifications(
  input: SendPlatformNotificationsInput,
): Promise<SendPlatformNotificationsResult> {
  if (!isResendConfigured()) {
    throw new PlatformNotificationError(
      "Email is not configured (RESEND_API_KEY missing)",
      503,
    );
  }

  const subject = input.subject.trim();
  if (!subject || subject.length > PLATFORM_NOTIFICATION_MAX_SUBJECT_CHARS) {
    throw new PlatformNotificationError("Invalid subject", 400);
  }

  const sanitizedBody = sanitizeEmailHtml(input.html);
  const plainLen = plainTextLengthFromHtml(sanitizedBody);
  if (plainLen < PLATFORM_NOTIFICATION_MIN_MESSAGE_CHARS) {
    throw new PlatformNotificationError(
      `Message must be at least ${PLATFORM_NOTIFICATION_MIN_MESSAGE_CHARS} characters`,
      400,
    );
  }

  const { ids, filterSnapshot } = await resolveRecipientIds(input.selection);
  if (ids.length === 0) {
    throw new PlatformNotificationError("No recipients selected", 400);
  }
  if (ids.length > PLATFORM_NOTIFICATION_MAX_RECIPIENTS) {
    throw new PlatformNotificationError(
      `Too many recipients (max ${PLATFORM_NOTIFICATION_MAX_RECIPIENTS})`,
      400,
    );
  }

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      email: true,
      name: true,
      marketingEmailsOptOut: true,
    },
  });

  let skippedOptOut = 0;
  const toSend = users.filter((u) => {
    if (!input.includeOptedOut && u.marketingEmailsOptOut) {
      skippedOptOut += 1;
      return false;
    }
    return true;
  });

  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  for (const user of toSend) {
    try {
      const html = buildPlatformNotificationHtml({
        bodyHtml: sanitizedBody,
        recipientName: user.name,
      });
      await sendPlatformNotificationEmail({
        to: user.email,
        subject,
        html,
        includeOptedOut: input.includeOptedOut,
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      if (errors.length < 5) {
        const msg = err instanceof Error ? err.message : "Send failed";
        errors.push(`${user.email}: ${msg}`);
      }
    }
  }

  await logPlatformNotificationSend({
    sentByEmail: input.sentByEmail,
    subject,
    recipientCount: sent,
    skippedOptOutCount: skippedOptOut,
    includeOptedOut: input.includeOptedOut,
    selectionMode: input.selection.mode,
    filterSnapshot,
  });

  return { sent, skippedOptOut, failed, errors };
}

async function logPlatformNotificationSend(data: {
  sentByEmail: string;
  subject: string;
  recipientCount: number;
  skippedOptOutCount: number;
  includeOptedOut: boolean;
  selectionMode: string;
  filterSnapshot: Record<string, unknown> | null;
}): Promise<void> {
  const delegate = (
    prisma as { platformNotificationLog?: { create: (args: unknown) => Promise<unknown> } }
  ).platformNotificationLog;
  if (!delegate?.create) {
    console.warn(
      "[platformNotifications] platformNotificationLog unavailable — run `npx prisma generate` and restart the dev server",
    );
    return;
  }

  try {
    await delegate.create({
      data: {
        sentByEmail: data.sentByEmail,
        subject: data.subject,
        recipientCount: data.recipientCount,
        skippedOptOutCount: data.skippedOptOutCount,
        includeOptedOut: data.includeOptedOut,
        selectionMode: data.selectionMode,
        filterSnapshot: (data.filterSnapshot ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      },
    });
  } catch (err) {
    console.error("[platformNotifications] audit log write failed:", err);
  }
}

export class PlatformNotificationError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "PlatformNotificationError";
  }
}

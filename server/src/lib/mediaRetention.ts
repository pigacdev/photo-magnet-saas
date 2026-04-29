import type { OrderCommitStatus, OrderSessionStatus } from "../../../src/generated/prisma/client";
import {
  ABANDONED_SESSION_MEDIA_RETENTION_HOURS,
  EVENT_MEDIA_RETENTION_HOURS_AFTER_END,
  ORDER_MEDIA_RETENTION_DAYS,
} from "../config/mediaRetention";

// Abandoned session file cleanup: `server/src/lib/mediaCleanup.ts` + admin POST `/api/admin/media-cleanup/abandoned-sessions/global`.

/** Merge into `prisma.orderSession.findMany({ select: { ... } })` for retention scans. */
export const prismaOrderSessionSelectForMediaRetention = {
  status: true,
  expiresAt: true,
  lastActiveAt: true,
} as const;

/** Merge into `prisma.order.findMany({ select: { ... } })` for retention scans. */
export const prismaOrderSelectForMediaRetention = {
  createdAt: true,
  status: true,
} as const;

/** Merge into `prisma.event.findMany({ select: { ... } })` when scoping by event end. */
export const prismaEventSelectForMediaRetention = {
  endDate: true,
} as const;

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Fields a Phase 2 job should select for session-scoped retention checks. */
export type SessionForMediaRetention = {
  status: OrderSessionStatus;
  expiresAt: Date;
  /**
   * Used as the retention anchor for early `ABANDONED` sessions when `expiresAt` is still in the future
   * (e.g. context closed before TTL). Omit only if callers truly lack it; prefer passing from Prisma.
   */
  lastActiveAt?: Date;
};

function sessionMediaRetentionAnchorMs(session: SessionForMediaRetention): number {
  if (session.status === "EXPIRED") {
    return session.expiresAt.getTime();
  }
  if (session.status === "ABANDONED") {
    return session.lastActiveAt?.getTime() ?? session.expiresAt.getTime();
  }
  return session.expiresAt.getTime();
}

/**
 * Whether non-converted session uploads are past the abandoned-session retention window.
 * Does not consider storage paths or `SessionImage` rows — time/status only.
 *
 * - `ACTIVE` and `CONVERTED` → always false (not eligible under this rule).
 * - `ABANDONED` / `EXPIRED` → true when `now` is at or after anchor + {@link ABANDONED_SESSION_MEDIA_RETENTION_HOURS}.
 */
export function isSessionExpiredForMediaCleanup(
  session: SessionForMediaRetention,
  now: Date = new Date(),
): boolean {
  if (session.status === "ACTIVE" || session.status === "CONVERTED") {
    return false;
  }
  if (session.status !== "ABANDONED" && session.status !== "EXPIRED") {
    return false;
  }
  const anchorMs = sessionMediaRetentionAnchorMs(session);
  const cutoffMs = anchorMs + ABANDONED_SESSION_MEDIA_RETENTION_HOURS * MS_PER_HOUR;
  return now.getTime() >= cutoffMs;
}

/** Fields a Phase 2 job should select for order-scoped retention checks. */
export type OrderForMediaRetention = {
  createdAt: Date;
  status: OrderCommitStatus;
};

/**
 * Whether order-scoped image assets are past the configured age-based retention window.
 * `order.status` is part of the expected query shape for Phase 2 rules (e.g. stricter retention while unpaid).
 */
export function isOrderMediaExpired(
  order: OrderForMediaRetention,
  now: Date = new Date(),
): boolean {
  const cutoffMs = order.createdAt.getTime() + ORDER_MEDIA_RETENTION_DAYS * MS_PER_DAY;
  return now.getTime() >= cutoffMs;
}

/**
 * Event rows always have `endDate` in the current schema.
 * // TODO(Phase 2): `ContextType.STOREFRONT` has no event-style `endDate`; define EVENT_MEDIA policy before cleanup.
 */
export type EventForMediaRetention = {
  endDate: Date;
};

/**
 * Whether event-context media is past `endDate` plus {@link EVENT_MEDIA_RETENTION_HOURS_AFTER_END}.
 */
export function isEventMediaExpired(
  event: EventForMediaRetention,
  now: Date = new Date(),
): boolean {
  const cutoffMs =
    event.endDate.getTime() + EVENT_MEDIA_RETENTION_HOURS_AFTER_END * MS_PER_HOUR;
  return now.getTime() >= cutoffMs;
}

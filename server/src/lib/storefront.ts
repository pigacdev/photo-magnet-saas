import type { Plan } from "../../../src/generated/prisma/client";
import type { StructuredShippingAddress } from "../../../src/lib/shippingAddress";
import { planHasFeature } from "./planCatalog";
import { storedPickupAddressFromJson } from "./parsePickupAddressInput";
import { prisma } from "./prisma";

const VACATION_NOTE_MAX = 500;

type StorefrontRecord = {
  isActive: boolean;
  deletedAt: Date | null;
  vacationFrom: Date | null;
  vacationTo: Date | null;
  vacationNote: string | null;
};

export type VacationDateRange = {
  from: Date;
  to: Date;
};

export type ParseVacationModeResult =
  | { ok: true; from: Date | null; to: Date | null; note: string | null }
  | { ok: false; error: string };

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function utcDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function parseDateOnlyInput(value: unknown): Date | null | "invalid" {
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim()) return "invalid";
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "invalid";
  const from = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(from.getTime())) return "invalid";
  return from;
}

function endOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999),
  );
}

export function parseVacationDateRange(
  fromInput: unknown,
  toInput: unknown,
): { ok: true; from: Date; to: Date } | { ok: false; error: string } {
  const fromParsed = parseDateOnlyInput(fromInput);
  const toParsed = parseDateOnlyInput(toInput);
  if (fromParsed === "invalid" || fromParsed === null) {
    return { ok: false, error: "Vacation start date is required" };
  }
  if (toParsed === "invalid" || toParsed === null) {
    return { ok: false, error: "Vacation end date is required" };
  }
  const todayKey = utcDateKey(new Date());
  const toKey = utcDateKey(toParsed);
  if (toKey < todayKey) {
    return { ok: false, error: "Vacation end date cannot be in the past" };
  }
  const to = endOfUtcDay(toParsed);
  if (fromParsed.getTime() > to.getTime()) {
    return { ok: false, error: "Vacation end date must be on or after the start date" };
  }
  return { ok: true, from: fromParsed, to };
}

export function parseVacationModeInput(body: {
  vacationFrom?: unknown;
  vacationTo?: unknown;
  vacationNote?: unknown;
}): ParseVacationModeResult {
  const hasFrom = "vacationFrom" in body;
  const hasTo = "vacationTo" in body;
  const hasNote = "vacationNote" in body;
  if (!hasFrom && !hasTo && !hasNote) {
    return { ok: false, error: "No vacation fields provided" };
  }

  if (hasFrom && body.vacationFrom === null && hasTo && body.vacationTo === null) {
    return { ok: true, from: null, to: null, note: null };
  }

  if (!hasFrom || !hasTo) {
    return { ok: false, error: "Vacation start and end dates are required" };
  }

  const range = parseVacationDateRange(body.vacationFrom, body.vacationTo);
  if (!range.ok) return range;

  let note: string | null = null;
  if (hasNote) {
    if (body.vacationNote !== null && body.vacationNote !== undefined && typeof body.vacationNote !== "string") {
      return { ok: false, error: "Vacation note must be a string or null" };
    }
    if (typeof body.vacationNote === "string") {
      const trimmed = body.vacationNote.trim();
      note = trimmed || null;
      if (trimmed.length > VACATION_NOTE_MAX) {
        return { ok: false, error: `Vacation note must be at most ${VACATION_NOTE_MAX} characters` };
      }
    }
  }

  return { ok: true, from: range.from, to: range.to, note };
}

export async function loadStorefrontPickupAddress(
  storefrontId: string,
): Promise<StructuredShippingAddress | null> {
  const sf = await prisma.storefront.findFirst({
    where: { id: storefrontId, deletedAt: null },
    select: { pickupAddress: true },
  });
  if (!sf) return null;
  return storedPickupAddressFromJson(sf.pickupAddress);
}

export function isStorefrontOpen(storefront: Pick<StorefrontRecord, "deletedAt" | "isActive">): boolean {
  if (storefront.deletedAt !== null) return false;
  return storefront.isActive;
}

export function isVacationScheduled(
  storefront: Pick<StorefrontRecord, "vacationFrom" | "vacationTo">,
): boolean {
  return storefront.vacationFrom !== null && storefront.vacationTo !== null;
}

export function isVacationActive(
  storefront: Pick<StorefrontRecord, "vacationFrom" | "vacationTo">,
  plan: Plan,
): boolean {
  if (!planHasFeature(plan, "vacation_mode")) return false;
  if (!isVacationScheduled(storefront)) return false;
  const todayKey = utcDateKey(new Date());
  const fromKey = utcDateKey(storefront.vacationFrom!);
  const toKey = utcDateKey(storefront.vacationTo!);
  return todayKey >= fromKey && todayKey <= toKey;
}

export function enrichStorefront(
  storefront: StorefrontRecord,
  plan: Plan,
) {
  const canUseVacationMode = planHasFeature(plan, "vacation_mode");
  const vacationScheduled =
    canUseVacationMode && isVacationScheduled(storefront);
  const isVacationMode = isVacationActive(storefront, plan);

  return {
    isOpen: isStorefrontOpen(storefront),
    canUseVacationMode,
    vacationScheduled,
    isVacationMode,
    vacationFrom: storefront.vacationFrom?.toISOString() ?? null,
    vacationTo: storefront.vacationTo?.toISOString() ?? null,
    vacationNote: storefront.vacationNote,
  };
}

/**
 * Storefront must be loadable with `deletedAt: null` by the caller.
 * Enforces: not soft-deleted, `isActive === true`, at least one shape, and pricing rows.
 */
export function getStorefrontConfigurationIssues(
  shapeCount: number,
  pricingCount: number,
): string[] {
  const issues: string[] = [];
  if (shapeCount === 0) {
    issues.push("At least one magnet shape is required");
  }
  if (pricingCount === 0) {
    issues.push("Pricing is required");
  }
  return issues;
}

export function isStorefrontConfigurationComplete(
  shapeCount: number,
  pricingCount: number,
): boolean {
  return getStorefrontConfigurationIssues(shapeCount, pricingCount).length === 0;
}

export const STOREFRONT_VACATION_UNAVAILABLE_REASON =
  "Storefront is not accepting orders right now";
export const VACATION_MODE_CODE = "VACATION_MODE";

export function canStorefrontAcceptOrders(
  storefront: StorefrontRecord,
  pricingCount: number,
  shapeCount: number,
  plan: Plan,
): { ok: true } | { ok: false; reason: string } {
  if (!isStorefrontOpen(storefront)) {
    return { ok: false, reason: "Storefront is not open" };
  }
  if (isVacationActive(storefront, plan)) {
    return { ok: false, reason: STOREFRONT_VACATION_UNAVAILABLE_REASON };
  }
  const configIssues = getStorefrontConfigurationIssues(shapeCount, pricingCount);
  if (configIssues.length > 0) {
    return { ok: false, reason: configIssues[0]! };
  }
  return { ok: true };
}

export function vacationPublicPayload(
  storefront: Pick<StorefrontRecord, "vacationFrom" | "vacationTo" | "vacationNote">,
) {
  if (!isVacationScheduled(storefront)) return null;
  return {
    from: storefront.vacationFrom!.toISOString(),
    to: storefront.vacationTo!.toISOString(),
    note: storefront.vacationNote,
  };
}

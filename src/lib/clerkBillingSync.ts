import type { WebhookEvent } from "@clerk/backend/webhooks";
import { prisma } from "./prisma";
import {
  isFreeClerkPlanSlug,
  resolvePlanEntitlements,
} from "./planCatalog";
import { defaultBillingPeriodEnd } from "./billingPeriod";

type BillingPayer = {
  user_id?: string;
  organization_id?: string;
};

type BillingPlanRef = {
  slug?: string;
};

type SubscriptionItem = {
  plan?: BillingPlanRef;
  status?: string;
};

type SubscriptionPayload = {
  id?: string;
  payer?: BillingPayer;
  items?: SubscriptionItem[];
  status?: string;
  current_period_start?: number;
  current_period_end?: number;
};

type SubscriptionItemPayload = {
  payer?: BillingPayer;
  plan?: BillingPlanRef;
  status?: string;
};

type ClerkBillingSubscriptionResponse = {
  id?: string;
  status?: string;
  current_period_start?: number;
  current_period_end?: number;
  items?: SubscriptionItem[];
  subscription_items?: SubscriptionItem[];
};

const SUBSCRIPTION_UPSERT_TYPES = new Set([
  "subscription.created",
  "subscription.active",
  "subscription.updated",
  "subscriptionItem.active",
  "subscriptionItem.updated",
]);

const SUBSCRIPTION_DOWNGRADE_TYPES = new Set([
  "subscriptionItem.canceled",
  "subscriptionItem.ended",
  "subscriptionItem.expired",
]);

function clerkUserIdFromPayer(payer: BillingPayer | undefined): string | null {
  if (!payer) return null;
  return payer.user_id ?? null;
}

async function organizationIdForClerkUser(clerkUserId: string): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { clerkId: clerkUserId, deletedAt: null },
    select: { id: true },
  });
  return user?.id ?? null;
}

function periodDatesFromPayload(data: {
  current_period_start?: number;
  current_period_end?: number;
}): {
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
} {
  const startSec = data.current_period_start;
  const endSec = data.current_period_end;
  if (typeof startSec === "number" && typeof endSec === "number") {
    return {
      currentPeriodStart: new Date(startSec * 1000),
      currentPeriodEnd: new Date(endSec * 1000),
    };
  }
  const now = new Date();
  return {
    currentPeriodStart: now,
    currentPeriodEnd: defaultBillingPeriodEnd(now),
  };
}

function subscriptionItems(
  sub: ClerkBillingSubscriptionResponse,
): SubscriptionItem[] {
  return sub.items ?? sub.subscription_items ?? [];
}

/** Parse `pla` session claim (`u:pro`, `u:free_user,o:pro`, …). */
export function pickPlanSlugFromSessionClaims(
  sessionClaims: Record<string, unknown>,
): string | null {
  const pla = sessionClaims.pla;
  if (typeof pla !== "string" || !pla.trim()) return null;

  const userPlans: string[] = [];
  for (const part of pla.split(",")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith("u:")) continue;
    const slug = trimmed.slice(2).trim();
    if (slug) userPlans.push(slug);
  }

  for (const slug of userPlans) {
    if (!isFreeClerkPlanSlug(slug)) return slug;
  }

  return userPlans[0] ?? null;
}

/** Prefer paid plan slug when multiple items exist (e.g. free + pro). */
export function pickActivePlanSlugFromItems(
  items: SubscriptionItem[],
): string | null {
  const activeItems = items.filter((item) => {
    const status = item.status?.toLowerCase();
    return !status || status === "active" || status === "upcoming";
  });

  for (const item of activeItems) {
    const slug = item.plan?.slug;
    if (slug && !isFreeClerkPlanSlug(slug)) return slug;
  }

  for (const item of activeItems) {
    const slug = item.plan?.slug;
    if (slug) return slug;
  }

  return null;
}

async function applyPaidPlan(
  orgId: string,
  clerkPlanSlug: string,
  clerkSubscriptionId: string | null,
  period?: { currentPeriodStart?: Date; currentPeriodEnd?: Date },
): Promise<void> {
  const limits = resolvePlanEntitlements(clerkPlanSlug);
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      plan: limits.plan,
      orderLimit: limits.orderLimit,
      eventLimit: limits.eventLimit,
      clerkPlanSlug: clerkPlanSlug.toLowerCase(),
      clerkSubscriptionId,
      ...(period?.currentPeriodStart
        ? { currentPeriodStart: period.currentPeriodStart }
        : {}),
      ...(period?.currentPeriodEnd
        ? { currentPeriodEnd: period.currentPeriodEnd }
        : {}),
    },
  });
}

async function revertToFreePlan(orgId: string): Promise<void> {
  const limits = resolvePlanEntitlements("free_user");
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      plan: limits.plan,
      orderLimit: limits.orderLimit,
      eventLimit: limits.eventLimit,
      clerkPlanSlug: "free_user",
      clerkSubscriptionId: null,
    },
  });
}

function getClerkSecretKey(): string | undefined {
  return process.env.CLERK_SECRET_KEY?.trim();
}

async function fetchClerkUserBillingSubscription(
  clerkUserId: string,
): Promise<ClerkBillingSubscriptionResponse | null> {
  const secretKey = getClerkSecretKey();
  if (!secretKey) return null;

  try {
    const res = await fetch(
      `https://api.clerk.com/v1/users/${encodeURIComponent(clerkUserId)}/billing/subscription`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      },
    );

    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(
        "[clerk.billing] subscription fetch failed",
        clerkUserId,
        res.status,
      );
      return null;
    }

    return (await res.json()) as ClerkBillingSubscriptionResponse;
  } catch (err) {
    console.warn("[clerk.billing] subscription fetch error", err);
    return null;
  }
}

/**
 * Pull active Clerk User Billing subscription into Organization (fallback when
 * webhooks are delayed or missing in local dev).
 */
export async function syncOrganizationBillingFromClerk(
  orgId: string,
  clerkUserId: string,
  sessionClaims?: Record<string, unknown> | null,
): Promise<void> {
  const sub = await fetchClerkUserBillingSubscription(clerkUserId);

  if (sub?.id) {
    const status = sub.status?.toLowerCase();
    if (status === "canceled" || status === "ended") {
      await revertToFreePlan(orgId);
      return;
    }

    const slug = pickActivePlanSlugFromItems(subscriptionItems(sub));
    if (!slug || isFreeClerkPlanSlug(slug)) {
      await revertToFreePlan(orgId);
      return;
    }

    await applyPaidPlan(
      orgId,
      slug,
      sub.id,
      periodDatesFromPayload(sub),
    );
    return;
  }

  if (sessionClaims) {
    const slug = pickPlanSlugFromSessionClaims(sessionClaims);
    if (slug && !isFreeClerkPlanSlug(slug)) {
      await applyPaidPlan(orgId, slug, null);
      return;
    }
    if (slug && isFreeClerkPlanSlug(slug)) {
      await revertToFreePlan(orgId);
    }
  }
}

export async function applyClerkBillingEvent(evt: WebhookEvent): Promise<void> {
  if (SUBSCRIPTION_UPSERT_TYPES.has(evt.type)) {
    if (evt.type.startsWith("subscriptionItem.")) {
      const data = evt.data as SubscriptionItemPayload;
      const clerkUserId = clerkUserIdFromPayer(data.payer);
      if (!clerkUserId) return;

      const orgId = await organizationIdForClerkUser(clerkUserId);
      if (!orgId) return;

      const slug = data.plan?.slug;
      if (!slug) return;

      const status = data.status?.toLowerCase();
      if (
        status === "canceled" ||
        status === "ended" ||
        status === "expired"
      ) {
        await revertToFreePlan(orgId);
        return;
      }

      if (isFreeClerkPlanSlug(slug)) {
        await revertToFreePlan(orgId);
        return;
      }

      await applyPaidPlan(orgId, slug, null);
      return;
    }

    const data = evt.data as SubscriptionPayload;
    const clerkUserId = clerkUserIdFromPayer(data.payer);
    if (!clerkUserId) return;

    const orgId = await organizationIdForClerkUser(clerkUserId);
    if (!orgId) return;

    const slug =
      pickActivePlanSlugFromItems(data.items ?? []) ?? data.items?.[0]?.plan?.slug;
    if (!slug) return;

    if (isFreeClerkPlanSlug(slug)) {
      await revertToFreePlan(orgId);
      return;
    }

    await applyPaidPlan(
      orgId,
      slug,
      data.id ?? null,
      periodDatesFromPayload(data),
    );
    return;
  }

  if (evt.type === "subscription.pastDue") {
    return;
  }

  if (SUBSCRIPTION_DOWNGRADE_TYPES.has(evt.type)) {
    const data = evt.data as SubscriptionItemPayload;
    const clerkUserId = clerkUserIdFromPayer(data.payer);
    if (!clerkUserId) return;

    const orgId = await organizationIdForClerkUser(clerkUserId);
    if (!orgId) return;

    await revertToFreePlan(orgId);
  }
}

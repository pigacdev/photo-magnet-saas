import type { WebhookEvent } from "@clerk/backend/webhooks";
import { prisma } from "./prisma";
import {
  clerkBillingPeriodFields,
  isActiveBillingItemStatus,
  isValidBillingPeriodDate,
  type ClerkBillingPeriodSource,
} from "./clerkBillingPeriod";
import {
  isFreeClerkPlanSlug,
  resolvePlanEntitlements,
} from "./planCatalog";

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
  period_start?: number;
  period_end?: number | null;
};

type SubscriptionPayload = SubscriptionItem & {
  id?: string;
  payer?: BillingPayer;
  items?: SubscriptionItem[];
  status?: string;
  current_period_start?: number;
  current_period_end?: number;
};

type SubscriptionItemPayload = SubscriptionItem & {
  payer?: BillingPayer;
};

type ClerkBillingSubscriptionResponse = ClerkBillingPeriodSource & {
  id?: string;
  status?: string;
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
  const activeItems = items.filter((item) =>
    isActiveBillingItemStatus(item.status),
  );

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

function resolvePaidPlanSlug(
  sub: ClerkBillingSubscriptionResponse,
  sessionClaims?: Record<string, unknown> | null,
): string | null {
  const itemSlug = pickActivePlanSlugFromItems(subscriptionItems(sub));
  if (itemSlug && !isFreeClerkPlanSlug(itemSlug)) return itemSlug;

  if (sessionClaims) {
    const claimSlug = pickPlanSlugFromSessionClaims(sessionClaims);
    if (claimSlug && !isFreeClerkPlanSlug(claimSlug)) return claimSlug;
  }

  return itemSlug;
}

function periodFieldsFromSource(
  source: ClerkBillingPeriodSource,
  options?: { preferPaidPlan?: boolean },
) {
  return clerkBillingPeriodFields(source, {
    ...options,
    isFreePlanSlug: isFreeClerkPlanSlug,
  });
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
      ...(period?.currentPeriodStart &&
      isValidBillingPeriodDate(period.currentPeriodStart)
        ? { currentPeriodStart: period.currentPeriodStart }
        : {}),
      ...(period?.currentPeriodEnd &&
      isValidBillingPeriodDate(period.currentPeriodEnd)
        ? { currentPeriodEnd: period.currentPeriodEnd }
        : {}),
    },
  });
}

async function revertToFreePlan(
  orgId: string,
  period?: { currentPeriodStart?: Date; currentPeriodEnd?: Date },
): Promise<void> {
  const limits = resolvePlanEntitlements("free_user");
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      plan: limits.plan,
      orderLimit: limits.orderLimit,
      eventLimit: limits.eventLimit,
      clerkPlanSlug: "free_user",
      clerkSubscriptionId: null,
      ...(period?.currentPeriodStart &&
      isValidBillingPeriodDate(period.currentPeriodStart)
        ? { currentPeriodStart: period.currentPeriodStart }
        : {}),
      ...(period?.currentPeriodEnd &&
      isValidBillingPeriodDate(period.currentPeriodEnd)
        ? { currentPeriodEnd: period.currentPeriodEnd }
        : {}),
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
    const period = periodFieldsFromSource(sub);

    if (status === "canceled" || status === "ended") {
      await revertToFreePlan(orgId, period);
      return;
    }

    const slug = resolvePaidPlanSlug(sub, sessionClaims);
    if (!slug || isFreeClerkPlanSlug(slug)) {
      await revertToFreePlan(
        orgId,
        periodFieldsFromSource(sub, { preferPaidPlan: false }),
      );
      return;
    }

    await applyPaidPlan(orgId, slug, sub.id, period);
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

      const period = periodFieldsFromSource(data, {
        preferPaidPlan: !isFreeClerkPlanSlug(slug),
      });

      const status = data.status?.toLowerCase();
      if (
        status === "canceled" ||
        status === "ended" ||
        status === "expired"
      ) {
        await revertToFreePlan(orgId, period);
        return;
      }

      if (isFreeClerkPlanSlug(slug)) {
        await revertToFreePlan(orgId, period);
        return;
      }

      await applyPaidPlan(orgId, slug, null, period);
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
      await revertToFreePlan(
        orgId,
        periodFieldsFromSource(data, { preferPaidPlan: false }),
      );
      return;
    }

    await applyPaidPlan(
      orgId,
      slug,
      data.id ?? null,
      periodFieldsFromSource(data),
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

    await revertToFreePlan(
      orgId,
      periodFieldsFromSource(data, { preferPaidPlan: false }),
    );
  }
}

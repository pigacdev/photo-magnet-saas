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
import { applyEarlyAccessSignup, getEarlyAccessStatus } from "./earlyAccessDb";
import {
  isEarlyAccessEligiblePlanSlug,
  isTrialSubscriptionItem,
} from "./earlyAccess";
import { maybeApplyUsagePeriodAnchor } from "./usagePeriodAnchor";

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
  is_free_trial?: boolean;
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
  subscriptionPeriod?: {
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
  },
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
      ...(subscriptionPeriod?.currentPeriodStart &&
      isValidBillingPeriodDate(subscriptionPeriod.currentPeriodStart)
        ? { subscriptionPeriodStart: subscriptionPeriod.currentPeriodStart }
        : {}),
      ...(subscriptionPeriod?.currentPeriodEnd &&
      isValidBillingPeriodDate(subscriptionPeriod.currentPeriodEnd)
        ? { subscriptionPeriodEnd: subscriptionPeriod.currentPeriodEnd }
        : {}),
    },
  });
  await maybeApplyUsagePeriodAnchor(
    orgId,
    subscriptionPeriod?.currentPeriodStart,
  );
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
      subscriptionPeriodStart: null,
      subscriptionPeriodEnd: null,
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
      await revertToFreePlan(orgId);
      return;
    }

    const slug = resolvePaidPlanSlug(sub, sessionClaims);
    if (!slug || isFreeClerkPlanSlug(slug)) {
      await revertToFreePlan(orgId);
      return;
    }

    const items = subscriptionItems(sub);
    await maybeApplyEarlyAccessTrialSignup(
      orgId,
      slug,
      sub.id ?? null,
      items,
    );
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

function findSubscriptionItemForSlug(
  items: SubscriptionItem[],
  slug: string,
): SubscriptionItem | null {
  const normalized = slug.toLowerCase();
  for (const item of items) {
    if (item.plan?.slug?.toLowerCase() === normalized) return item;
  }
  return items[0] ?? null;
}

async function maybeApplyEarlyAccessTrialSignup(
  orgId: string,
  slug: string,
  clerkSubscriptionId: string | null,
  items: SubscriptionItem[],
): Promise<void> {
  const earlyAccessStatus = await getEarlyAccessStatus();
  if (!earlyAccessStatus.isOpen) return;
  if (!isEarlyAccessEligiblePlanSlug(slug)) return;

  const item = findSubscriptionItemForSlug(items, slug);
  if (!isTrialSubscriptionItem(item ?? undefined)) return;

  const period = item
    ? periodFieldsFromSource(item, { preferPaidPlan: true })
    : undefined;

  await applyEarlyAccessSignup({
    orgId,
    clerkPlanSlug: slug,
    clerkSubscriptionId,
    trialEndsAt: period?.currentPeriodEnd,
  });
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
        await revertToFreePlan(orgId);
        return;
      }

      if (isFreeClerkPlanSlug(slug)) {
        await revertToFreePlan(orgId);
        return;
      }

      await applyPaidPlan(orgId, slug, null, period);

      if (
        evt.type === "subscriptionItem.active" ||
        evt.type === "subscriptionItem.updated"
      ) {
        await maybeApplyEarlyAccessTrialSignup(orgId, slug, null, [data]);
      }
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

    const period = periodFieldsFromSource(data);

    if (
      evt.type === "subscription.created" ||
      evt.type === "subscription.active" ||
      evt.type === "subscription.updated"
    ) {
      await maybeApplyEarlyAccessTrialSignup(
        orgId,
        slug,
        data.id ?? null,
        data.items ?? [],
      );
    }

    await applyPaidPlan(orgId, slug, data.id ?? null, period);
    return;
  }

  if (evt.type === "subscription.pastDue") {
    return;
  }

  if (evt.type === "subscriptionItem.freeTrialEnding") {
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

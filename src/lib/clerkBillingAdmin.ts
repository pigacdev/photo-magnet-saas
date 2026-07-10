import fs from "node:fs";
import path from "node:path";
import type { Plan } from "@/generated/prisma/client";

export type ClerkPriceSlug = "hobby" | "pro" | "hobby_loyalty" | "pro_loyalty";

const PRICE_ENV_KEYS: Record<ClerkPriceSlug, string> = {
  hobby: "CLERK_PRICE_HOBBY",
  pro: "CLERK_PRICE_PRO",
  hobby_loyalty: "CLERK_PRICE_HOBBY_LOYALTY",
  pro_loyalty: "CLERK_PRICE_PRO_LOYALTY",
};

function getClerkSecretKey(): string | undefined {
  return process.env.CLERK_SECRET_KEY?.trim();
}

export function getClerkPriceId(slug: ClerkPriceSlug): string | null {
  const key = PRICE_ENV_KEYS[slug];
  const value = process.env[key]?.trim();
  return value || null;
}

export type EarlyAccessTransitionTarget = {
  planSlug: ClerkPriceSlug;
  priceId: string;
};

export function resolveEarlyAccessTransitionTarget(input: {
  plan: Plan;
  grantLifetimeDiscount: boolean;
  currentClerkPlanSlug: string | null;
}): EarlyAccessTransitionTarget | null {
  const { plan, grantLifetimeDiscount } = input;

  let planSlug: ClerkPriceSlug;
  if (grantLifetimeDiscount) {
    planSlug = plan === "PRO" ? "pro_loyalty" : "hobby_loyalty";
  } else {
    planSlug = plan === "PRO" ? "pro" : "hobby";
  }

  const priceId = getClerkPriceId(planSlug);
  if (!priceId) {
    console.warn(
      "[clerk.billing.admin] missing price id for transition target",
      planSlug,
    );
    return null;
  }

  return { planSlug, priceId };
}

export function resolveCurrentPriceIdFromSlug(
  clerkPlanSlug: string | null,
): string | null {
  if (!clerkPlanSlug) return null;
  const normalized = clerkPlanSlug.toLowerCase() as ClerkPriceSlug;
  if (normalized in PRICE_ENV_KEYS) {
    return getClerkPriceId(normalized);
  }
  return null;
}

export type ActiveSubscriptionItem = {
  subscriptionItemId: string;
  planSlug: string;
  priceId: string | null;
};

type BillingSubscriptionItemResponse = {
  id?: string;
  status?: string;
  plan?: { slug?: string };
  price?: { id?: string };
  price_id?: string;
};

type BillingSubscriptionResponse = {
  items?: BillingSubscriptionItemResponse[];
  subscription_items?: BillingSubscriptionItemResponse[];
};

export async function fetchActiveSubscriptionItem(
  clerkUserId: string,
): Promise<ActiveSubscriptionItem | null> {
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

    if (res.status === 404 || !res.ok) return null;

    const sub = (await res.json()) as BillingSubscriptionResponse;
    const items = sub.items ?? sub.subscription_items ?? [];
    const active = items.find((item) => {
      const status = item.status?.toLowerCase();
      return status === "active" || status === "past_due";
    });

    if (!active?.id || !active.plan?.slug) return null;

    const priceId =
      active.price?.id ??
      active.price_id ??
      resolveCurrentPriceIdFromSlug(active.plan.slug);

    return {
      subscriptionItemId: active.id,
      planSlug: active.plan.slug,
      priceId,
    };
  } catch (err) {
    console.warn("[clerk.billing.admin] fetch subscription item failed", err);
    return null;
  }
}

export async function transitionSubscriptionPrice(
  subscriptionItemId: string,
  fromPriceId: string,
  toPriceId: string,
): Promise<boolean> {
  const secretKey = getClerkSecretKey();
  if (!secretKey) return false;

  try {
    const res = await fetch(
      `https://api.clerk.com/v1/billing/subscription_items/${encodeURIComponent(subscriptionItemId)}/price_transition`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from_price_id: fromPriceId,
          to_price_id: toPriceId,
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(
        "[clerk.billing.admin] price_transition failed",
        res.status,
        body,
      );
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[clerk.billing.admin] price_transition error", err);
    return false;
  }
}

type BillingJsonPlan = {
  publicly_visible?: boolean;
  free_trial_enabled?: boolean;
  [key: string]: unknown;
};

type BillingJson = {
  billing: {
    plans: Record<string, BillingJsonPlan>;
    [key: string]: unknown;
  };
};

function loadBillingJson(): BillingJson | null {
  const filePath = path.join(process.cwd(), "billing.json");
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as BillingJson;
  } catch (err) {
    console.warn("[clerk.billing.admin] failed to read billing.json", err);
    return null;
  }
}

function billingConfigWithEarlyAccessClosed(
  config: BillingJson,
): BillingJson {
  const plans = { ...config.billing.plans };
  for (const slug of ["hobby", "pro"] as const) {
    const plan = plans[slug];
    if (!plan) continue;
    plans[slug] = {
      ...plan,
      publicly_visible: true,
      free_trial_enabled: false,
    };
  }
  return { billing: { ...config.billing, plans } };
}

/**
 * Disable 60-day free trials on hobby/pro after early-access seats are full.
 * Plans stay publicly available at full price. Requires CLERK_APP_ID + CLERK_INSTANCE_ID.
 */
export async function setEarlyAccessPlansClosed(): Promise<boolean> {
  const appId = process.env.CLERK_APP_ID?.trim();
  const instanceId = process.env.CLERK_INSTANCE_ID?.trim();
  const secretKey = getClerkSecretKey();

  if (!appId || !instanceId || !secretKey) {
    console.warn(
      "[clerk.billing.admin] setEarlyAccessPlansClosed skipped — missing CLERK_APP_ID, CLERK_INSTANCE_ID, or CLERK_SECRET_KEY",
    );
    return false;
  }

  const base = loadBillingJson();
  if (!base) return false;

  const config = billingConfigWithEarlyAccessClosed(base);

  try {
    const res = await fetch(
      `https://api.clerk.com/v1/platform/applications/${encodeURIComponent(appId)}/instances/${encodeURIComponent(instanceId)}/config`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ billing: config.billing }),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(
        "[clerk.billing.admin] plan visibility patch failed",
        res.status,
        body,
      );
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[clerk.billing.admin] plan visibility patch error", err);
    return false;
  }
}

import { api } from "./api";
import type { EarlyAccessStatus } from "./earlyAccessUi";
import {
  DEFAULT_DATE_FORMAT,
  type DateFormat,
} from "./dateFormat";
import {
  DEFAULT_SIZE_UNIT,
  type SizeUnit,
} from "./magnetSize";

export type User = {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "STAFF";
  legalAcceptedAt?: string | null;
  legalVersion?: string | null;
  needsLegalReconsent?: boolean;
  erasureScheduledAt?: string | null;
};

export type OrganizationUsage = {
  plan: "FREE" | "HOBBY" | "PRO";
  planLabel?: string;
  ordersThisMonth: number;
  orderLimit: number;
  eventsCreatedThisMonth: number;
  eventLimit: number;
  currentPeriodEnd: string;
  /** Clerk subscription payment renewal (ISO); null on Free or when not synced. */
  subscriptionRenewsAt: string | null;
  clerkPlanSlug?: string | null;
  /** Active early-access free trial (Hobby/Pro before earlyAccessExpiresAt). */
  isOnFreeTrial?: boolean;
  /** ISO end of early-access trial; present only while on free trial. */
  freeTrialEndsAt?: string | null;
  currency: string | null;
  initialSetupAt: string | null;
  dateFormat: DateFormat;
  sizeUnit: SizeUnit;
  name: string | null;
};

export type DisplayPreferences = {
  dateFormat: DateFormat;
  sizeUnit: SizeUnit;
};

export function getDisplayPreferences(): DisplayPreferences {
  const u = getCachedOrganizationUsage();
  return {
    dateFormat: u?.dateFormat ?? DEFAULT_DATE_FORMAT,
    sizeUnit: u?.sizeUnit ?? DEFAULT_SIZE_UNIT,
  };
}

type AuthResponse = {
  user: User;
  organization: OrganizationUsage | null;
  earlyAccess?: EarlyAccessStatus | null;
  isPlatformOwner?: boolean;
};

let cachedUser: User | null | undefined;
let cachedOrganization: OrganizationUsage | null | undefined;
let cachedEarlyAccess: EarlyAccessStatus | null | undefined;
let cachedIsPlatformOwner: boolean | undefined;
const usageListeners = new Set<() => void>();

function setCache(
  user: User | null,
  organization?: OrganizationUsage | null,
  isPlatformOwner?: boolean,
  earlyAccess?: EarlyAccessStatus | null,
) {
  cachedUser = user;
  if (organization !== undefined) {
    cachedOrganization = organization;
  } else if (user === null) {
    cachedOrganization = null;
  }
  if (earlyAccess !== undefined) {
    cachedEarlyAccess = earlyAccess;
  } else if (user === null) {
    cachedEarlyAccess = null;
  }
  if (isPlatformOwner !== undefined) {
    cachedIsPlatformOwner = isPlatformOwner;
  } else if (user === null) {
    cachedIsPlatformOwner = false;
  }
  usageListeners.forEach((listener) => listener());
}

/** Subscribe to usage cache updates (e.g. sidebar after billing sync). */
export function subscribeOrganizationUsage(listener: () => void): () => void {
  usageListeners.add(listener);
  return () => usageListeners.delete(listener);
}

/** Call after subscription or profile changes so the next `getMe()` refetches. */
export function invalidateAuthCache(): void {
  cachedUser = undefined;
  cachedOrganization = undefined;
  cachedEarlyAccess = undefined;
  cachedIsPlatformOwner = undefined;
}

export function getCachedIsPlatformOwner(): boolean {
  return cachedIsPlatformOwner ?? false;
}

/** Merge fields into cached org usage and notify subscribers (no network round-trip). */
export function mergeCachedOrganizationUsage(
  patch: Partial<OrganizationUsage>,
): void {
  if (cachedOrganization == null) return;
  cachedOrganization = { ...cachedOrganization, ...patch };
  usageListeners.forEach((listener) => listener());
}

/** Bump cached monthly order usage when new orders are detected client-side. */
export function incrementCachedOrderUsage(delta = 1): void {
  const usage = getCachedOrganizationUsage();
  if (!usage || delta <= 0) return;
  mergeCachedOrganizationUsage({
    ordersThisMonth: usage.ordersThisMonth + delta,
  });
}

export function getCachedOrganizationUsage(): OrganizationUsage | null {
  return cachedOrganization ?? null;
}

export function getCachedEarlyAccessStatus(): EarlyAccessStatus | null {
  return cachedEarlyAccess ?? null;
}

export function getCachedUser(): User | null {
  return cachedUser ?? null;
}

export async function getMe(): Promise<User | null> {
  if (cachedUser !== undefined) return cachedUser;

  try {
    const data = await api<AuthResponse>("/api/auth/me");
    setCache(
      data.user,
      data.organization ?? null,
      data.isPlatformOwner ?? false,
      data.earlyAccess ?? null,
    );
    return data.user;
  } catch {
    setCache(null, null);
    return null;
  }
}

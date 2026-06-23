import { api } from "./api";
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
};

export type OrganizationUsage = {
  plan: "FREE" | "HOBBY" | "PRO";
  planLabel?: string;
  ordersThisMonth: number;
  orderLimit: number;
  eventsCreatedThisMonth: number;
  eventLimit: number;
  currentPeriodEnd: string;
  clerkPlanSlug?: string | null;
  currency: string | null;
  initialSetupAt: string | null;
  dateFormat: DateFormat;
  sizeUnit: SizeUnit;
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
};

let cachedUser: User | null | undefined;
let cachedOrganization: OrganizationUsage | null | undefined;
const usageListeners = new Set<() => void>();

function setCache(user: User | null, organization?: OrganizationUsage | null) {
  cachedUser = user;
  if (organization !== undefined) {
    cachedOrganization = organization;
  } else if (user === null) {
    cachedOrganization = null;
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
}

/** Merge fields into cached org usage and notify subscribers (no network round-trip). */
export function mergeCachedOrganizationUsage(
  patch: Partial<OrganizationUsage>,
): void {
  if (cachedOrganization == null) return;
  cachedOrganization = { ...cachedOrganization, ...patch };
  usageListeners.forEach((listener) => listener());
}

export function getCachedOrganizationUsage(): OrganizationUsage | null {
  return cachedOrganization ?? null;
}

export function getCachedUser(): User | null {
  return cachedUser ?? null;
}

export async function getMe(): Promise<User | null> {
  if (cachedUser !== undefined) return cachedUser;

  try {
    const data = await api<AuthResponse>("/api/auth/me");
    setCache(data.user, data.organization ?? null);
    return data.user;
  } catch {
    setCache(null, null);
    return null;
  }
}

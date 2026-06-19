import { api } from "./api";

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
};

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

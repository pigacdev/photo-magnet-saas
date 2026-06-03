import { api } from "./api";

export type User = {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "STAFF";
};

export type OrganizationUsage = {
  plan: "FREE" | "PRO";
  ordersThisMonth: number;
  orderLimit: number;
  currentPeriodEnd: string;
  cancelAtPeriodEnd?: boolean;
};

type AuthResponse = {
  user: User;
  organization: OrganizationUsage | null;
};

let cachedUser: User | null | undefined;
let cachedOrganization: OrganizationUsage | null | undefined;

function setCache(user: User | null, organization?: OrganizationUsage | null) {
  cachedUser = user;
  if (organization !== undefined) {
    cachedOrganization = organization;
  } else if (user === null) {
    cachedOrganization = null;
  }
}

/** Call after subscription or profile changes so the next `getMe()` refetches. */
export function invalidateAuthCache(): void {
  cachedUser = undefined;
  cachedOrganization = undefined;
}

export function getCachedOrganizationUsage(): OrganizationUsage | null {
  return cachedOrganization ?? null;
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

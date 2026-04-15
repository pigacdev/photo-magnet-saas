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

function clearCache() {
  cachedUser = undefined;
  cachedOrganization = undefined;
}

/** Call after subscription or profile changes so the next `getMe()` refetches. */
export function invalidateAuthCache(): void {
  clearCache();
}

export function getCachedOrganizationUsage(): OrganizationUsage | null {
  return cachedOrganization ?? null;
}

export async function signup(
  email: string,
  password: string,
  name?: string,
): Promise<User> {
  const data = await api<AuthResponse>("/api/auth/signup", {
    method: "POST",
    body: { email, password, name },
  });
  clearCache();
  setCache(data.user, data.organization ?? null);
  return data.user;
}

export async function login(
  email: string,
  password: string,
): Promise<User> {
  const data = await api<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  clearCache();
  setCache(data.user, data.organization ?? null);
  return data.user;
}

export async function logout(): Promise<void> {
  await api("/api/auth/logout", { method: "POST" });
  clearCache();
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

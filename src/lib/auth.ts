import { api } from "./api";

export type User = {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "STAFF";
};

type AuthResponse = { user: User };

let cachedUser: User | null | undefined;

function setCache(user: User | null) {
  cachedUser = user;
}

function clearCache() {
  cachedUser = undefined;
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
  setCache(data.user);
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
  setCache(data.user);
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
    setCache(data.user);
    return data.user;
  } catch {
    setCache(null);
    return null;
  }
}

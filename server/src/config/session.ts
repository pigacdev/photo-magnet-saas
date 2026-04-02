const isProduction = process.env.NODE_ENV === "production";

/**
 * Options for `res.cookie(sessionId, value, opts)` — same name + same path/domain
 * overwrites the previous cookie (no duplicate `sessionId` cookies).
 */
export const sessionConfig = {
  cookieName: "sessionId" as const,
  /** 30 minutes */
  ttlMs: 30 * 60 * 1000,
  /** Milliseconds for Set-Cookie Max-Age */
  maxAgeMs: 30 * 60 * 1000,
};

/** Used for both setting and clearing so the browser updates one cookie, not two. */
export const sessionCookieFlags = {
  httpOnly: true,
  sameSite: "lax" as const,
  /** HTTPS only in production (matches auth cookie pattern). */
  secure: isProduction,
  path: "/",
};

export function getSessionCookieSetOptions() {
  return {
    ...sessionCookieFlags,
    maxAge: sessionConfig.maxAgeMs,
  };
}

/** Options must match `getSessionCookieSetOptions` (except maxAge) or clear may not remove the cookie. */
export function getSessionCookieClearOptions() {
  return { ...sessionCookieFlags };
}

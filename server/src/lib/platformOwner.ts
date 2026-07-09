/** SaaS platform owner allowlist (comma-separated emails in env). */
export function getPlatformOwnerEmails(): string[] {
  const raw = process.env.PLATFORM_OWNER_EMAILS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

export function isPlatformOwnerEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  const normalized = email.trim().toLowerCase();
  return getPlatformOwnerEmails().includes(normalized);
}

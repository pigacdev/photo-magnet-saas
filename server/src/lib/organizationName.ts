import { prisma } from "./prisma";

/** Max length for seller shop/business display name. */
export const ORGANIZATION_NAME_MAX_LEN = 80;

export type OrganizationNameInputResult =
  | { kind: "ok"; value: string }
  | { kind: "error"; error: string };

export function normalizeOrganizationName(raw: unknown): OrganizationNameInputResult {
  if (typeof raw !== "string") {
    return { kind: "error", error: "name must be a string" };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { kind: "error", error: "name is required" };
  }
  if (trimmed.length > ORGANIZATION_NAME_MAX_LEN) {
    return {
      kind: "error",
      error: `name must be at most ${ORGANIZATION_NAME_MAX_LEN} characters`,
    };
  }
  return { kind: "ok", value: trimmed };
}

export async function getOrganizationName(orgId: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });
  return org?.name?.trim() || null;
}

export async function patchOrganizationName(
  orgId: string,
  name: unknown,
): Promise<
  | { ok: true; name: string }
  | { ok: false; status: number; error: string }
> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  });

  if (!org) {
    return { ok: false, status: 404, error: "Organization not found" };
  }

  const parsed = normalizeOrganizationName(name);
  if (parsed.kind === "error") {
    return { ok: false, status: 400, error: parsed.error };
  }

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: { name: parsed.value },
    select: { name: true },
  });

  return { ok: true, name: updated.name!.trim() };
}

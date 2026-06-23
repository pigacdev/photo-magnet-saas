import { prisma } from "./prisma";

export const DATE_FORMATS = ["DMY", "MDY", "YMD"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export const SIZE_UNITS = ["mm", "cm", "in"] as const;
export type SizeUnit = (typeof SIZE_UNITS)[number];

export const DEFAULT_DATE_FORMAT: DateFormat = "DMY";
export const DEFAULT_SIZE_UNIT: SizeUnit = "mm";

export const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string }[] = [
  { value: "DMY", label: "DD/MM/YYYY" },
  { value: "MDY", label: "MM/DD/YYYY" },
  { value: "YMD", label: "YYYY-MM-DD" },
];

export const SIZE_UNIT_OPTIONS: { value: SizeUnit; label: string }[] = [
  { value: "mm", label: "Millimeters (mm)" },
  { value: "cm", label: "Centimeters (cm)" },
  { value: "in", label: "Inches (in)" },
];

export function normalizeDateFormat(raw: unknown): DateFormat | null {
  if (typeof raw !== "string") return null;
  const upper = raw.trim().toUpperCase();
  return DATE_FORMATS.includes(upper as DateFormat) ? (upper as DateFormat) : null;
}

export function normalizeSizeUnit(raw: unknown): SizeUnit | null {
  if (typeof raw !== "string") return null;
  const lower = raw.trim().toLowerCase();
  return SIZE_UNITS.includes(lower as SizeUnit) ? (lower as SizeUnit) : null;
}

export type DisplayPreferences = {
  dateFormat: DateFormat;
  sizeUnit: SizeUnit;
};

export async function getOrganizationDisplayPreferences(
  orgId: string,
): Promise<DisplayPreferences> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { dateFormat: true, sizeUnit: true },
  });
  return {
    dateFormat:
      normalizeDateFormat(org?.dateFormat) ?? DEFAULT_DATE_FORMAT,
    sizeUnit: normalizeSizeUnit(org?.sizeUnit) ?? DEFAULT_SIZE_UNIT,
  };
}

export async function patchOrganizationDisplayPreferences(
  orgId: string,
  input: { dateFormat?: unknown; sizeUnit?: unknown },
): Promise<
  | { ok: true; dateFormat: DateFormat; sizeUnit: SizeUnit }
  | { ok: false; status: number; error: string }
> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { dateFormat: true, sizeUnit: true },
  });

  if (!org) {
    return { ok: false, status: 404, error: "Organization not found" };
  }

  const data: { dateFormat?: DateFormat; sizeUnit?: SizeUnit } = {};

  if (input.dateFormat !== undefined) {
    const dateFormat = normalizeDateFormat(input.dateFormat);
    if (!dateFormat) {
      return { ok: false, status: 400, error: "Invalid date format" };
    }
    data.dateFormat = dateFormat;
  }

  if (input.sizeUnit !== undefined) {
    const sizeUnit = normalizeSizeUnit(input.sizeUnit);
    if (!sizeUnit) {
      return { ok: false, status: 400, error: "Invalid size unit" };
    }
    data.sizeUnit = sizeUnit;
  }

  if (Object.keys(data).length === 0) {
    return {
      ok: true,
      dateFormat: normalizeDateFormat(org.dateFormat) ?? DEFAULT_DATE_FORMAT,
      sizeUnit: normalizeSizeUnit(org.sizeUnit) ?? DEFAULT_SIZE_UNIT,
    };
  }

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data,
    select: { dateFormat: true, sizeUnit: true },
  });

  return {
    ok: true,
    dateFormat: normalizeDateFormat(updated.dateFormat) ?? DEFAULT_DATE_FORMAT,
    sizeUnit: normalizeSizeUnit(updated.sizeUnit) ?? DEFAULT_SIZE_UNIT,
  };
}

export async function getDisplayPreferencesForOrderContext(
  contextType: "EVENT" | "STOREFRONT",
  contextId: string,
): Promise<DisplayPreferences> {
  if (contextType === "EVENT") {
    const event = await prisma.event.findFirst({
      where: { id: contextId, deletedAt: null },
      select: { userId: true },
    });
    if (!event) {
      return {
        dateFormat: DEFAULT_DATE_FORMAT,
        sizeUnit: DEFAULT_SIZE_UNIT,
      };
    }
    return getOrganizationDisplayPreferences(event.userId);
  }

  const storefront = await prisma.storefront.findFirst({
    where: { id: contextId, deletedAt: null },
    select: { userId: true },
  });
  if (!storefront) {
    return {
      dateFormat: DEFAULT_DATE_FORMAT,
      sizeUnit: DEFAULT_SIZE_UNIT,
    };
  }
  return getOrganizationDisplayPreferences(storefront.userId);
}

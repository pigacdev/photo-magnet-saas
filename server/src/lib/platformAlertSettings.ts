import { prisma } from "../../../src/lib/prisma";

export type PlatformAlertSettingsRow = {
  newUserAlertsEnabled: boolean;
  planChangeAlertsEnabled: boolean;
  updatedAt: Date;
};

/** Parse comma-separated PLATFORM_ALERT_EMAILS (no fallback to PLATFORM_OWNER_EMAILS). */
export function getPlatformAlertEmails(): string[] {
  const raw = process.env.PLATFORM_ALERT_EMAILS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

/** Ensure singleton row exists and return toggles. */
export async function getPlatformAlertSettings(): Promise<PlatformAlertSettingsRow> {
  const row = await prisma.platformAlertSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
    select: {
      newUserAlertsEnabled: true,
      planChangeAlertsEnabled: true,
      updatedAt: true,
    },
  });
  return row;
}

export async function updatePlatformAlertSettings(input: {
  newUserAlertsEnabled?: boolean;
  planChangeAlertsEnabled?: boolean;
}): Promise<PlatformAlertSettingsRow> {
  await getPlatformAlertSettings();
  return prisma.platformAlertSettings.update({
    where: { id: 1 },
    data: {
      ...(typeof input.newUserAlertsEnabled === "boolean"
        ? { newUserAlertsEnabled: input.newUserAlertsEnabled }
        : {}),
      ...(typeof input.planChangeAlertsEnabled === "boolean"
        ? { planChangeAlertsEnabled: input.planChangeAlertsEnabled }
        : {}),
    },
    select: {
      newUserAlertsEnabled: true,
      planChangeAlertsEnabled: true,
      updatedAt: true,
    },
  });
}

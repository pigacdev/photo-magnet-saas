import type { Plan } from "../../../src/generated/prisma/client";
import { planDisplayName } from "../../../src/lib/planCatalog";
import {
  sendPlatformNewUserAlert,
  sendPlatformPlanChangeAlert,
} from "./email";
import {
  getPlatformAlertEmails,
  getPlatformAlertSettings,
} from "./platformAlertSettings";

async function resolveAlertRecipients(
  kind: "new_user" | "plan_change",
): Promise<string[]> {
  const settings = await getPlatformAlertSettings();
  const enabled =
    kind === "new_user"
      ? settings.newUserAlertsEnabled
      : settings.planChangeAlertsEnabled;
  if (!enabled) return [];

  const recipients = getPlatformAlertEmails();
  if (recipients.length === 0) {
    console.warn(
      `[platform.alerts] PLATFORM_ALERT_EMAILS is empty; skipping ${kind} alert`,
    );
  }
  return recipients;
}

/** Fail-soft: never throws to callers. */
export async function notifyPlatformNewUser(data: {
  userId: string;
  email: string;
  name: string | null;
}): Promise<void> {
  try {
    const recipients = await resolveAlertRecipients("new_user");
    for (const to of recipients) {
      await sendPlatformNewUserAlert({
        to,
        sellerName: data.name,
        sellerEmail: data.email,
        userId: data.userId,
      });
    }
  } catch (err) {
    console.warn("[platform.alerts] new user alert failed", data.userId, err);
  }
}

/** Fail-soft: never throws to callers. No-op when fromPlan === toPlan. */
export async function notifyPlatformPlanChange(data: {
  userId: string;
  email: string;
  name: string | null;
  fromPlan: Plan;
  toPlan: Plan;
}): Promise<void> {
  if (data.fromPlan === data.toPlan) return;

  try {
    const recipients = await resolveAlertRecipients("plan_change");
    for (const to of recipients) {
      await sendPlatformPlanChangeAlert({
        to,
        sellerName: data.name,
        sellerEmail: data.email,
        userId: data.userId,
        fromPlanLabel: planDisplayName(data.fromPlan),
        toPlanLabel: planDisplayName(data.toPlan),
      });
    }
  } catch (err) {
    console.warn(
      "[platform.alerts] plan change alert failed",
      data.userId,
      err,
    );
  }
}

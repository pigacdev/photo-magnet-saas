import { createClerkClient } from "@clerk/backend";
import { prisma } from "./prisma";
import { ACCOUNT_ERASURE_GRACE_DAYS } from "./legalConstants";
import { logAuditEvent } from "./privacyAuditLog";
import {
  collectOrderImageMediaUrls,
  deleteOrderMediaBlob,
  isDeletableOrderMediaUrl,
} from "./orderMediaCleanup";
import { deleteSessionImageObject } from "./sessionImageStorage";
import { deleteEventBannerObject } from "./eventBannerStorage";

function graceMs(): number {
  return ACCOUNT_ERASURE_GRACE_DAYS * 24 * 60 * 60 * 1000;
}

async function deleteBlobSafe(url: string): Promise<void> {
  try {
    if (url.includes("order-images")) {
      if (isDeletableOrderMediaUrl(url)) {
        await deleteOrderMediaBlob(url);
      }
    } else {
      await deleteSessionImageObject(url);
    }
  } catch {
    /* best effort */
  }
}

async function purgeOrganizationStorage(orgId: string): Promise<void> {
  const orders = await prisma.order.findMany({
    where: { organizationId: orgId },
    select: {
      orderImages: {
        select: { originalUrl: true, croppedUrl: true, renderedUrl: true },
      },
    },
  });
  for (const order of orders) {
    for (const img of order.orderImages) {
      for (const url of collectOrderImageMediaUrls(img)) {
        await deleteBlobSafe(url);
      }
    }
  }

  const events = await prisma.event.findMany({
    where: { userId: orgId },
    select: { id: true, bannerUrl: true },
  });
  for (const ev of events) {
    if (ev.bannerUrl) {
      await deleteEventBannerObject(ev.bannerUrl, ev.id).catch(() => undefined);
    }
  }

  const sessions = await prisma.orderSession.findMany({
    where: {
      OR: [
        { contextType: "EVENT", contextId: { in: events.map((e) => e.id) } },
        {
          contextType: "STOREFRONT",
          contextId: {
            in: (
              await prisma.storefront.findMany({
                where: { userId: orgId },
                select: { id: true },
              })
            ).map((s) => s.id),
          },
        },
      ],
    },
    include: { sessionImages: { select: { originalUrl: true } } },
  });
  for (const session of sessions) {
    for (const img of session.sessionImages) {
      await deleteBlobSafe(img.originalUrl);
    }
  }
}

/** Hard-delete all DB rows and storage for a seller org. */
export async function hardPurgeSellerAccount(userId: string): Promise<void> {
  await purgeOrganizationStorage(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      clerkId: true,
      organization: { select: { stripeCustomerId: true } },
    },
  });

  const [events, storefronts] = await Promise.all([
    prisma.event.findMany({ where: { userId }, select: { id: true } }),
    prisma.storefront.findMany({ where: { userId }, select: { id: true } }),
  ]);
  const eventIds = events.map((e) => e.id);
  const storefrontIds = storefronts.map((s) => s.id);

  await prisma.$transaction(async (tx) => {
    await tx.order.deleteMany({ where: { organizationId: userId } });
    if (eventIds.length > 0 || storefrontIds.length > 0) {
      await tx.orderSession.deleteMany({
        where: {
          OR: [
            ...(eventIds.length > 0
              ? [{ contextType: "EVENT" as const, contextId: { in: eventIds } }]
              : []),
            ...(storefrontIds.length > 0
              ? [{ contextType: "STOREFRONT" as const, contextId: { in: storefrontIds } }]
              : []),
          ],
        },
      });
      await tx.pricing.deleteMany({
        where: {
          OR: [
            ...(eventIds.length > 0
              ? [{ contextType: "EVENT" as const, contextId: { in: eventIds } }]
              : []),
            ...(storefrontIds.length > 0
              ? [{ contextType: "STOREFRONT" as const, contextId: { in: storefrontIds } }]
              : []),
          ],
        },
      });
      await tx.allowedShape.deleteMany({
        where: {
          OR: [
            ...(eventIds.length > 0
              ? [{ contextType: "EVENT" as const, contextId: { in: eventIds } }]
              : []),
            ...(storefrontIds.length > 0
              ? [{ contextType: "STOREFRONT" as const, contextId: { in: storefrontIds } }]
              : []),
          ],
        },
      });
    }
    await tx.user.delete({ where: { id: userId } });
  });

  const clerkId = user?.clerkId;
  if (clerkId && process.env.CLERK_SECRET_KEY?.trim()) {
    try {
      const client = createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY.trim(),
      });
      await client.users.deleteUser(clerkId);
    } catch (err) {
      console.warn("[accountErasure] Clerk delete failed", clerkId, err);
    }
  }

  const stripeCustomerId = user?.organization?.stripeCustomerId ?? null;
  if (stripeCustomerId && process.env.STRIPE_SECRET_KEY?.trim()) {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY.trim());
      await stripe.customers.del(stripeCustomerId);
    } catch (err) {
      console.warn("[accountErasure] Stripe customer delete failed", err);
    }
  }
}

/** Schedule soft-delete + hard purge after grace period. */
export async function scheduleSellerAccountErasure(params: {
  userId: string;
  actorEmail?: string | null;
  reason?: string;
}): Promise<{ erasureScheduledAt: Date }> {
  const scheduledAt = new Date(Date.now() + graceMs());
  await prisma.user.update({
    where: { id: params.userId, deletedAt: null },
    data: {
      deletedAt: new Date(),
      erasureScheduledAt: scheduledAt,
    },
  });

  await logAuditEvent({
    action: "account_erasure_scheduled",
    actorEmail: params.actorEmail,
    organizationId: params.userId,
    targetType: "user",
    targetId: params.userId,
    metadata: {
      erasureScheduledAt: scheduledAt.toISOString(),
      reason: params.reason ?? "requested",
    },
  });

  return { erasureScheduledAt: scheduledAt };
}

export async function cancelScheduledAccountErasure(params: {
  userId: string;
  actorEmail?: string | null;
}): Promise<void> {
  await prisma.user.update({
    where: { id: params.userId },
    data: {
      deletedAt: null,
      erasureScheduledAt: null,
    },
  });

  await logAuditEvent({
    action: "account_erasure_cancelled",
    actorEmail: params.actorEmail,
    organizationId: params.userId,
    targetType: "user",
    targetId: params.userId,
  });
}

/** Run hard purge for accounts past erasureScheduledAt. */
export async function runScheduledAccountErasurePurge(): Promise<{
  purged: number;
  errors: string[];
}> {
  const now = new Date();
  const due = await prisma.user.findMany({
    where: {
      erasureScheduledAt: { lte: now },
      deletedAt: { not: null },
    },
    select: { id: true, email: true },
  });

  let purged = 0;
  const errors: string[] = [];
  for (const user of due) {
    try {
      await hardPurgeSellerAccount(user.id);
      purged += 1;
      await logAuditEvent({
        action: "account_erasure_completed",
        organizationId: user.id,
        targetType: "user",
        targetId: user.id,
        metadata: { email: user.email },
      });
    } catch (e) {
      errors.push(
        `${user.id}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  return { purged, errors };
}

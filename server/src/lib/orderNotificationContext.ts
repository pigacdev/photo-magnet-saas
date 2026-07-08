import type { StructuredShippingAddress } from "../../../src/lib/shippingAddress";
import { prisma } from "./prisma";
import { storedPickupAddressFromJson } from "./parsePickupAddressInput";

/**
 * Loads event/storefront display name and seller notification settings for an order.
 */
export async function loadOrderNotificationContext(order: {
  contextType: "EVENT" | "STOREFRONT";
  contextId: string;
}): Promise<{
  contextName: string;
  sendOrderEmails: boolean;
  notificationEmail: string | null;
  storefrontPickupAddress: StructuredShippingAddress | null;
  brandText: string | null;
  bannerUrl: string | null;
}> {
  if (order.contextType === "EVENT") {
    const ev = await prisma.event.findFirst({
      where: { id: order.contextId, deletedAt: null },
      select: {
        name: true,
        sendOrderEmails: true,
        notificationEmail: true,
        brandText: true,
        bannerUrl: true,
      },
    });
    if (!ev) {
      return {
        contextName: "Event",
        sendOrderEmails: false,
        notificationEmail: null,
        storefrontPickupAddress: null,
        brandText: null,
        bannerUrl: null,
      };
    }
    return {
      contextName: ev.name,
      sendOrderEmails: ev.sendOrderEmails,
      notificationEmail: ev.notificationEmail?.trim() || null,
      storefrontPickupAddress: null,
      brandText: ev.brandText?.trim() || null,
      bannerUrl: ev.bannerUrl?.trim() || null,
    };
  }

  const sf = await prisma.storefront.findFirst({
    where: { id: order.contextId, deletedAt: null },
    select: {
      name: true,
      sendOrderEmails: true,
      notificationEmail: true,
      pickupAddress: true,
      brandText: true,
    },
  });
  if (!sf) {
    return {
      contextName: "Storefront",
      sendOrderEmails: false,
      notificationEmail: null,
      storefrontPickupAddress: null,
      brandText: null,
      bannerUrl: null,
    };
  }
  return {
    contextName: sf.name,
    sendOrderEmails: sf.sendOrderEmails,
    notificationEmail: sf.notificationEmail?.trim() || null,
    storefrontPickupAddress: storedPickupAddressFromJson(sf.pickupAddress),
    brandText: sf.brandText?.trim() || null,
    bannerUrl: null,
  };
}

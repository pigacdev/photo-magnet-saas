import { prisma } from "./prisma";

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
}> {
  if (order.contextType === "EVENT") {
    const ev = await prisma.event.findFirst({
      where: { id: order.contextId, deletedAt: null },
      select: {
        name: true,
        sendOrderEmails: true,
        notificationEmail: true,
      },
    });
    if (!ev) {
      return {
        contextName: "Event",
        sendOrderEmails: false,
        notificationEmail: null,
      };
    }
    return {
      contextName: ev.name,
      sendOrderEmails: ev.sendOrderEmails,
      notificationEmail: ev.notificationEmail?.trim() || null,
    };
  }

  const sf = await prisma.storefront.findFirst({
    where: { id: order.contextId, deletedAt: null },
    select: {
      name: true,
      sendOrderEmails: true,
      notificationEmail: true,
    },
  });
  if (!sf) {
    return {
      contextName: "Storefront",
      sendOrderEmails: false,
      notificationEmail: null,
    };
  }
  return {
    contextName: sf.name,
    sendOrderEmails: sf.sendOrderEmails,
    notificationEmail: sf.notificationEmail?.trim() || null,
  };
}

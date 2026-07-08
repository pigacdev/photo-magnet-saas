import {
  buildBuyerConfirmationHtml,
  buildBuyerConfirmationSubject,
} from "./email";
import { shapeLabel } from "./eventAnalytics";
import { loadOrderEmailContext } from "./orderEmailBranding";
import { sendBuyerContextEmail } from "./orderContextEmailSend";
import { prisma } from "./prisma";

/**
 * Sends buyer order confirmation once per order when the buyer email is available.
 */
export async function sendBuyerOrderConfirmationIfNeeded(
  orderId: string,
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      orderImages: {
        select: { shapeId: true, copies: true },
      },
    },
  });
  if (!order) return;
  if (order.buyerConfirmationEmailSentAt != null) return;

  const buyerEmail = order.customerEmail?.trim();
  if (!buyerEmail) {
    console.warn("[email] buyer confirmation skipped: missing customerEmail", {
      orderId,
    });
    return;
  }

  const org = await prisma.organization.findUnique({
    where: { id: order.organizationId },
    select: { plan: true },
  });
  const plan = org?.plan ?? "FREE";

  const { contextName, notificationEmail, storefrontPickupAddress, branding } =
    await loadOrderEmailContext(
      { contextType: order.contextType, contextId: order.contextId },
      plan,
    );

  const firstShapeId = order.orderImages[0]?.shapeId;
  let shapeLabelText = "—";
  if (firstShapeId) {
    const shape = await prisma.allowedShape.findUnique({
      where: { id: firstShapeId },
      select: { shapeType: true, widthMm: true, heightMm: true },
    });
    if (shape) {
      shapeLabelText = shapeLabel(shape);
    }
  }

  const html = buildBuyerConfirmationHtml(
    {
      id: order.id,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      shippingType: order.shippingType,
      shippingAddress: order.shippingAddress,
      totalPrice: order.totalPrice,
      currency: order.currency,
      orderImages: order.orderImages,
      pricingType: order.pricingType,
      quantity: order.quantity,
      contextType: order.contextType,
    },
    contextName,
    shapeLabelText,
    { storefrontPickupAddress, branding },
  );

  const sent = await sendBuyerContextEmail({
    to: buyerEmail,
    subject: buildBuyerConfirmationSubject(),
    html,
    notificationEmail,
  });
  if (!sent) {
    console.warn("[email] buyer confirmation skipped: no email transport", {
      orderId,
    });
    return;
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { buyerConfirmationEmailSentAt: new Date() },
  });
}

/**
 * Optional Stripe safety net: persist checkout email when order has none yet.
 */
export async function enrichOrderCustomerEmailFromStripe(
  orderId: string,
  stripeEmail: string | null | undefined,
): Promise<void> {
  const email = stripeEmail?.trim();
  if (!email) return;

  await prisma.order.updateMany({
    where: {
      id: orderId,
      OR: [{ customerEmail: null }, { customerEmail: "" }],
    },
    data: { customerEmail: email },
  });
}

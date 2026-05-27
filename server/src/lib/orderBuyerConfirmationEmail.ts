import {
  buildBuyerConfirmationHtml,
  buildBuyerConfirmationSubject,
  sendEmail,
  TEST_EMAIL_FROM,
} from "./email";
import { shapeLabel } from "./eventAnalytics";
import { loadOrderNotificationContext } from "./orderNotificationContext";
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

  const { contextName, notificationEmail } =
    await loadOrderNotificationContext(order);

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
  );

  await sendEmail({
    to: buyerEmail,
    from: TEST_EMAIL_FROM,
    ...(notificationEmail ? { replyTo: notificationEmail } : {}),
    subject: buildBuyerConfirmationSubject(),
    html,
  });

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

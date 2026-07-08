import { sendEmailWithTransport, sendNewOrderEmail } from "./email";
import { resolvePlatformEmailTransport } from "./organizationEmailTransport";

export async function sendOrderContextEmail(data: {
  to: string;
  subject: string;
  html: string;
  notificationEmail: string | null;
}): Promise<boolean> {
  const transport = resolvePlatformEmailTransport({
    notificationEmail: data.notificationEmail,
  });
  if (!transport) return false;

  await sendNewOrderEmail(transport, {
    to: data.to,
    subject: data.subject,
    html: data.html,
  });
  return true;
}

export async function sendBuyerContextEmail(data: {
  to: string;
  subject: string;
  html: string;
  notificationEmail: string | null;
  attachments?: { filename: string; content: Buffer }[];
}): Promise<boolean> {
  const transport = resolvePlatformEmailTransport({
    notificationEmail: data.notificationEmail,
  });
  if (!transport) return false;

  await sendEmailWithTransport(transport, {
    to: data.to,
    subject: data.subject,
    html: data.html,
    attachments: data.attachments,
  });
  return true;
}

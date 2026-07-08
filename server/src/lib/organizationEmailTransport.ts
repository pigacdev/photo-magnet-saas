import { isResendConfigured, platformFromAddress } from "./email";

export type OrganizationEmailTransport = {
  resendApiKey: string;
  from: string;
  replyTo?: string;
};

export function resolvePlatformEmailTransport(context?: {
  notificationEmail: string | null;
}): OrganizationEmailTransport | null {
  const platformKey = process.env.RESEND_API_KEY?.trim();
  if (!platformKey) return null;

  const replyTo = context?.notificationEmail?.trim() || undefined;

  return {
    resendApiKey: platformKey,
    from: platformFromAddress(),
    replyTo,
  };
}

export function isPlatformEmailSendReady(): boolean {
  return isResendConfigured();
}

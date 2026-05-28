const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EventConfigurationInput = {
  selectedShapeCount: number;
  hasPricing: boolean;
  sendOrderEmails: boolean;
  notificationEmail: string;
};

export function getEventConfigurationIssues(
  input: EventConfigurationInput,
): string[] {
  const issues: string[] = [];

  if (input.selectedShapeCount === 0) {
    issues.push("Select at least one magnet shape");
  }
  if (!input.hasPricing) {
    issues.push("Set pricing (price per magnet or bundles)");
  }
  if (input.sendOrderEmails) {
    const email = input.notificationEmail.trim();
    if (!email) {
      issues.push("Notification email is required when order emails are enabled");
    } else if (!EMAIL_RE.test(email)) {
      issues.push("Enter a valid notification email");
    }
  }

  return issues;
}

export function isEventConfigurationComplete(input: {
  shapeCount: number;
  pricingCount: number;
}): boolean {
  return input.shapeCount > 0 && input.pricingCount > 0;
}

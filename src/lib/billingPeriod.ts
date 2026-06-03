/** Next monthly billing boundary from `from` (default: now + 1 calendar month). */
export function defaultBillingPeriodEnd(from: Date = new Date()): Date {
  const end = new Date(from);
  end.setMonth(end.getMonth() + 1);
  return end;
}

"use client";

import { getCurrencyLabel } from "@/lib/currency";

type UserProfileOrderCurrencyContentProps = {
  currencyCode: string;
};

/** Shown inside Clerk Manage account → Order currency. */
export function UserProfileOrderCurrencyContent({
  currencyCode,
}: UserProfileOrderCurrencyContentProps) {
  return (
    <div>
      <h1 className="text-lg font-semibold text-foreground">Order currency</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This currency applies to magnet pricing, customer orders, and your
        revenue analytics.
      </p>
      <dl className="mt-6 space-y-1 text-sm">
        <dt className="text-muted-foreground">Selected currency</dt>
        <dd className="text-base font-medium text-foreground">
          {getCurrencyLabel(currencyCode)}
        </dd>
      </dl>
      <p className="mt-4 text-sm text-muted-foreground">
        Set during initial setup and cannot be changed afterward. SaaS
        subscription billing stays in EUR.
      </p>
    </div>
  );
}

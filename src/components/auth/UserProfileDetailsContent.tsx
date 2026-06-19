"use client";

import { CopyableAccountId } from "@/components/dashboard/CopyableAccountId";
import { getCurrencyLabel } from "@/lib/currency";

type UserProfileDetailsContentProps = {
  accountId: string | null;
  currencyCode: string | null;
};

/** Shown inside Clerk Manage account → Details. */
export function UserProfileDetailsContent({
  accountId,
  currencyCode,
}: UserProfileDetailsContentProps) {
  return (
    <div>
      <h1 className="text-lg font-semibold text-foreground">Details</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Account and order settings for your Magnetoo seller account.
      </p>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-foreground">Order currency</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Applies to magnet pricing, customer orders, and your revenue analytics.
        </p>
        {currencyCode ? (
          <>
            <dl className="mt-4 space-y-1 text-sm">
              <dt className="text-muted-foreground">Selected currency</dt>
              <dd className="text-base font-medium text-foreground">
                {getCurrencyLabel(currencyCode)}
              </dd>
            </dl>
            <p className="mt-4 text-sm text-muted-foreground">
              Set during initial setup and cannot be changed afterward. SaaS
              subscription billing stays in EUR.
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Not set yet — you will choose your order currency during initial
            setup.
          </p>
        )}
      </section>

      {accountId ? (
        <section className="mt-8 border-t border-border pt-6">
          <h2 className="text-sm font-semibold text-foreground">Account ID</h2>
          <div className="mt-4">
            <CopyableAccountId accountId={accountId} showLabel={false} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

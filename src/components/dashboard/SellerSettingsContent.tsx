"use client";

import { CopyableAccountId } from "@/components/dashboard/CopyableAccountId";
import { DisplayPreferencesForm } from "@/components/dashboard/DisplayPreferencesForm";
import { OrganizationNameForm } from "@/components/dashboard/OrganizationNameForm";
import type { DisplayPreferences } from "@/lib/auth";
import { getCurrencyLabel } from "@/lib/currency";

type SellerSettingsContentProps = {
  accountId: string;
  currency: string | null;
  organizationName: string | null;
  displayPreferences: DisplayPreferences;
};

export function SellerSettingsContent({
  accountId,
  currency,
  organizationName,
  displayPreferences,
}: SellerSettingsContentProps) {
  return (
    <div className="space-y-6">
      <section className="dashboard-card">
        <h2 className="text-sm font-semibold text-foreground">Shop name</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your business name as customers see it in emails and future branding.
        </p>
        <OrganizationNameForm
          initialName={organizationName}
          showHint={organizationName == null && currency != null}
        />
      </section>

      <section className="dashboard-card">
        <h2 className="text-sm font-semibold text-foreground">
          Display preferences
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          How dates and magnet sizes appear in your dashboard and customer order
          pages. Display only — stored dates and print sizes stay unchanged.
        </p>
        <DisplayPreferencesForm initial={displayPreferences} />
      </section>

      <section className="dashboard-card">
        <h2 className="text-sm font-semibold text-foreground">Order currency</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Applies to magnet pricing, customer orders, and your revenue analytics.
          Subscription billing stays in EUR.
        </p>
        {currency ? (
          <>
            <dl className="mt-4 space-y-1 text-sm">
              <dt className="text-muted-foreground">Selected currency</dt>
              <dd className="text-base font-medium text-foreground">
                {getCurrencyLabel(currency)}
              </dd>
            </dl>
            <p className="mt-4 text-sm text-muted-foreground">
              Set during initial setup and cannot be changed afterward.
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Not set yet — you will choose your order currency during initial
            setup.
          </p>
        )}
      </section>

      <section className="dashboard-card">
        <h2 className="text-sm font-semibold text-foreground">Account ID</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your Magnetoo seller account identifier.
        </p>
        <div className="mt-4">
          <CopyableAccountId accountId={accountId} showLabel={false} />
        </div>
      </section>
    </div>
  );
}

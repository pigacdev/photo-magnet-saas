"use client";

import { useEffect, useState, type ReactNode } from "react";
import { UserButton } from "@clerk/nextjs";
import {
  getCachedOrganizationUsage,
  getCachedUser,
  getMe,
  subscribeOrganizationUsage,
} from "@/lib/auth";
import { UserProfileDetailsContent } from "@/components/auth/UserProfileDetailsContent";

function MenuIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-4 shrink-0 [&>svg]:size-4">{children}</span>
  );
}

function BillingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path strokeLinecap="round" d="M2 10h20" />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        strokeLinecap="round"
        d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
      />
    </svg>
  );
}

function DetailsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

export type AppUserButtonProps = {
  showAppLinks?: boolean;
};

export function AppUserButton({ showAppLinks = false }: AppUserButtonProps) {
  const [orderCurrency, setOrderCurrency] = useState<string | null>(
    () => getCachedOrganizationUsage()?.currency ?? null,
  );
  const [accountId, setAccountId] = useState<string | null>(
    () => getCachedUser()?.id ?? null,
  );

  useEffect(() => {
    if (!getCachedUser()) {
      void getMe();
    }
    return subscribeOrganizationUsage(() => {
      setOrderCurrency(getCachedOrganizationUsage()?.currency ?? null);
      setAccountId(getCachedUser()?.id ?? null);
    });
  }, []);

  return (
    <UserButton>
      {showAppLinks ? (
        <UserButton.MenuItems>
          <UserButton.Action label="manageAccount" />
          <UserButton.Link
            label="Billing & plan"
            labelIcon={
              <MenuIcon>
                <BillingIcon />
              </MenuIcon>
            }
            href="/dashboard/billing"
          />
          <UserButton.Link
            label="Contact support"
            labelIcon={
              <MenuIcon>
                <SupportIcon />
              </MenuIcon>
            }
            href="/dashboard/support"
          />
          <UserButton.Action label="signOut" />
        </UserButton.MenuItems>
      ) : (
        <UserButton.MenuItems>
          <UserButton.Action label="manageAccount" />
          <UserButton.Action label="signOut" />
        </UserButton.MenuItems>
      )}
      <UserButton.UserProfilePage label="account" />
      <UserButton.UserProfilePage label="billing" />
      <UserButton.UserProfilePage
        label="Details"
        url="details"
        labelIcon={
          <MenuIcon>
            <DetailsIcon />
          </MenuIcon>
        }
      >
        <UserProfileDetailsContent
          accountId={accountId}
          currencyCode={orderCurrency}
        />
      </UserButton.UserProfilePage>
      <UserButton.UserProfilePage label="security" />
    </UserButton>
  );
}

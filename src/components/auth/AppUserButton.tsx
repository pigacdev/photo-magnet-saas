"use client";

import { type ReactNode } from "react";
import { UserButton } from "@clerk/nextjs";

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

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
      />
    </svg>
  );
}

export type AppUserButtonProps = {
  showAppLinks?: boolean;
};

export function AppUserButton({ showAppLinks = false }: AppUserButtonProps) {
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
          <UserButton.Link
            label="Settings"
            labelIcon={
              <MenuIcon>
                <SettingsIcon />
              </MenuIcon>
            }
            href="/dashboard/settings"
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
      <UserButton.UserProfilePage label="security" />
    </UserButton>
  );
}

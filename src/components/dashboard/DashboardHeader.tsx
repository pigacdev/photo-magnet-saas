"use client";

import type { OrganizationUsage, User } from "@/lib/auth";
import { UserMenu } from "./UserMenu";

export type DashboardHeaderProps = {
  user: User;
  usage: OrganizationUsage | null;
  onUsageRefresh?: () => void;
  onMenuToggle: () => void;
};

export function DashboardHeader({
  user,
  usage,
  onUsageRefresh,
  onMenuToggle,
}: DashboardHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
      <button
        type="button"
        onClick={onMenuToggle}
        className="flex size-10 items-center justify-center rounded-lg text-[#374151] transition-colors hover:bg-[#F9FAFB] lg:hidden"
        aria-label="Open menu"
      >
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <div className="hidden lg:block" aria-hidden />

      <UserMenu user={user} usage={usage} onUsageRefresh={onUsageRefresh} />
    </header>
  );
}

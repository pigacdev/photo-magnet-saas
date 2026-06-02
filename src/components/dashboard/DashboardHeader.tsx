"use client";

import type { OrganizationUsage, User } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 lg:px-6">
      <button
        type="button"
        onClick={onMenuToggle}
        className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface lg:hidden"
        aria-label="Open menu"
      >
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <div className="hidden lg:block" aria-hidden />

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UserMenu user={user} usage={usage} onUsageRefresh={onUsageRefresh} />
      </div>
    </header>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import type { OrganizationUsage, User } from "@/lib/auth";
import { invalidateAuthCache } from "@/lib/auth";
import { UserProfileSummary, userInitials } from "./UserProfileSummary";

export type UserMenuProps = {
  user: User;
  usage: OrganizationUsage | null;
  onUsageRefresh?: () => void;
};

export function UserMenu({ user, usage, onUsageRefresh }: UserMenuProps) {
  const router = useRouter();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  async function handleLogout() {
    close();
    invalidateAuthCache();
    await signOut();
    router.replace("/");
  }

  const displayName = user.name || user.email;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-surface"
      >
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-medium text-muted-foreground"
          aria-hidden
        >
          {userInitials(user)}
        </span>
        <span className="hidden max-w-[160px] truncate font-medium text-foreground sm:inline">
          {displayName}
        </span>
        <svg
          className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-lg border border-border bg-card py-2 shadow-lg"
        >
          <UserProfileSummary
            user={user}
            usage={usage}
            variant="compact"
            onSubscriptionChange={onUsageRefresh}
          />

          <div className="my-2 border-t border-border" />

          <nav className="flex flex-col px-1">
            <Link
              href="/dashboard/account"
              role="menuitem"
              onClick={close}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              Account
            </Link>
            <Link
              href="/dashboard/billing"
              role="menuitem"
              onClick={close}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              Billing &amp; plan
            </Link>
            <Link
              href="/dashboard/support"
              role="menuitem"
              onClick={close}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              Contact support
              {usage?.plan !== "PRO" && (
                <span className="inline-flex rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900">
                  PRO
                </span>
              )}
            </Link>
          </nav>

          <div className="my-2 border-t border-border" />

          <div className="px-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleLogout()}
              className="w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

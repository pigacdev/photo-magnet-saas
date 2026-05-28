"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrganizationUsage, User } from "@/lib/auth";
import { logout } from "@/lib/auth";
import { UserProfileSummary, userInitials } from "./UserProfileSummary";

export type UserMenuProps = {
  user: User;
  usage: OrganizationUsage | null;
  onUsageRefresh?: () => void;
};

export function UserMenu({ user, usage, onUsageRefresh }: UserMenuProps) {
  const router = useRouter();
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
    await logout();
    router.replace("/login");
  }

  const displayName = user.name || user.email;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-[#F9FAFB]"
      >
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-xs font-medium text-[#374151]"
          aria-hidden
        >
          {userInitials(user)}
        </span>
        <span className="hidden max-w-[160px] truncate font-medium text-[#111111] sm:inline">
          {displayName}
        </span>
        <svg
          className={`size-4 text-[#6B7280] transition-transform ${open ? "rotate-180" : ""}`}
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
          className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-lg border border-gray-200 bg-white py-2 shadow-lg"
        >
          <UserProfileSummary
            user={user}
            usage={usage}
            variant="compact"
            onSubscriptionChange={onUsageRefresh}
          />

          <div className="my-2 border-t border-gray-100" />

          <nav className="flex flex-col px-1">
            <Link
              href="/dashboard/account"
              role="menuitem"
              onClick={close}
              className="rounded-md px-3 py-2 text-sm text-[#374151] transition-colors hover:bg-[#F9FAFB] hover:text-[#111111]"
            >
              Account
            </Link>
            <Link
              href="/dashboard/billing"
              role="menuitem"
              onClick={close}
              className="rounded-md px-3 py-2 text-sm text-[#374151] transition-colors hover:bg-[#F9FAFB] hover:text-[#111111]"
            >
              Billing &amp; plan
            </Link>
          </nav>

          <div className="my-2 border-t border-gray-100" />

          <div className="px-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleLogout()}
              className="w-full rounded-md px-3 py-2 text-left text-sm text-[#374151] transition-colors hover:bg-[#F9FAFB] hover:text-[#111111]"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

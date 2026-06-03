"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrganizationUsage, User } from "@/lib/auth";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardSidebar } from "./DashboardSidebar";

export type DashboardShellProps = {
  user: User;
  usage: OrganizationUsage | null;
  children: React.ReactNode;
};

export function DashboardShell({
  user,
  usage,
  children,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (!mobileOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMobile();
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileOpen, closeMobile]);

  return (
    <div className="flex min-h-full flex-1">
      <div className="hidden lg:flex">
        <DashboardSidebar user={user} usage={usage} />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={closeMobile}
          />
          <div className="relative z-50 h-full w-60 shadow-xl">
            <DashboardSidebar user={user} usage={usage} onNavigate={closeMobile} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        <DashboardHeader onMenuToggle={() => setMobileOpen((v) => !v)} />
        <main className="flex-1 px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}

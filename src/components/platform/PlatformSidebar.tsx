"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardNavIcon } from "@/components/dashboard/dashboardNavIcons";
import {
  PLATFORM_NAV_ITEMS,
  PLATFORM_SELLER_DASHBOARD_LINK,
  isPlatformNavActive,
} from "./platformNav";

function BackIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5 6 10l5 5" />
      <path strokeLinecap="round" d="M6 10h9" />
    </svg>
  );
}

export type PlatformSidebarProps = {
  onNavigate?: () => void;
  className?: string;
};

export function PlatformSidebar({
  onNavigate,
  className = "",
}: PlatformSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`flex h-full w-60 shrink-0 flex-col border-r border-border bg-background ${className}`}
    >
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4">
        <Link
          href="/platform"
          onClick={onNavigate}
          className="flex min-w-0 items-center"
        >
          <img
            src="/logo-light.png"
            alt="Magnetoo"
            className="block h-8 w-auto max-w-[200px] object-contain dark:hidden"
          />
          <img
            src="/logo-dark.png"
            alt="Magnetoo"
            className="hidden h-8 w-auto max-w-[200px] object-contain dark:block"
          />
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-3">
        <nav className="flex flex-col gap-0.5">
          <Link
            href={PLATFORM_SELLER_DASHBOARD_LINK.href}
            onClick={onNavigate}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-50 hover:text-green-800 dark:text-green-400 dark:hover:bg-green-950/30 dark:hover:text-green-300"
          >
            <BackIcon className="size-5 shrink-0 text-green-700 dark:text-green-400" />
            <span className="min-w-0 flex-1 truncate">
              {PLATFORM_SELLER_DASHBOARD_LINK.label}
            </span>
          </Link>

          <div
            className="my-2 border-t border-border"
            role="separator"
            aria-hidden
          />

          {PLATFORM_NAV_ITEMS.map((item) => {
            const isActive = isPlatformNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-foreground dark:bg-blue-950/40"
                    : "text-muted-foreground hover:bg-surface hover:text-foreground"
                }`}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                    aria-hidden
                  />
                )}
                <DashboardNavIcon
                  name={item.icon}
                  className={`size-5 shrink-0 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

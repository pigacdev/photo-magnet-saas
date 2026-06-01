"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { OrganizationUsage, User } from "@/lib/auth";
import { SidebarPlanBadge } from "./SidebarPlanBadge";
import {
  DASHBOARD_NAV_ITEMS,
  DASHBOARD_STOREFRONT_NAV_BASE,
  isDashboardNavActive,
  storefrontNavHref,
} from "./dashboardNav";
import { DashboardNavIcon } from "./dashboardNavIcons";
import { useSellerStorefront } from "@/hooks/useSellerStorefront";

function LogoMark() {
  return (
    <svg
      className="size-8 shrink-0 text-[#2563EB]"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="currentColor" fillOpacity="0.1" />
      <rect x="8" y="8" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="14" r="3" fill="currentColor" />
      <path
        d="M10 22c1.5-2.5 4-4 6-4s4.5 1.5 6 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export type DashboardSidebarProps = {
  user: User;
  usage: OrganizationUsage | null;
  onNavigate?: () => void;
  className?: string;
};

export function DashboardSidebar({
  user,
  usage,
  onNavigate,
  className = "",
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const { storefront } = useSellerStorefront();

  return (
    <aside
      className={`flex h-full w-60 shrink-0 flex-col border-r border-gray-200 bg-white ${className}`}
    >
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-gray-200 px-4">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2.5"
        >
          <LogoMark />
          <span className="truncate text-sm font-semibold text-[#111111]">
            Photo Magnet
          </span>
        </Link>
      </div>

      <div className="p-3">
        <nav className="flex flex-col gap-0.5">
          {DASHBOARD_NAV_ITEMS.map((item) => {
            const href =
              item.href === DASHBOARD_STOREFRONT_NAV_BASE
                ? storefrontNavHref(storefront?.id ?? null)
                : item.href;
            const isActive = isDashboardNavActive(pathname, href);
            return (
              <Link
                key={item.href}
                href={href}
                onClick={onNavigate}
                className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-[#111111]"
                    : "text-gray-700 hover:bg-gray-50 hover:text-[#111111]"
                }`}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[#2563EB]"
                    aria-hidden
                  />
                )}
                <DashboardNavIcon
                  name={item.icon}
                  className={`size-5 shrink-0 ${
                    isActive ? "text-[#2563EB]" : "text-[#6B7280]"
                  }`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-3">
          <SidebarPlanBadge user={user} usage={usage} />
        </div>
      </div>
    </aside>
  );
}

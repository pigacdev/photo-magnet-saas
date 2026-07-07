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
import { useNewOrdersCount } from "@/hooks/useNewOrdersCount";
import { usageHasFeature } from "@/lib/planFeatures";

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
  const { count: newOrdersCount } = useNewOrdersCount();

  return (
    <aside
      className={`flex h-full w-60 shrink-0 flex-col border-r border-border bg-background ${className}`}
    >
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4">
        <Link
          href="/dashboard"
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

      <div className="p-3">
        <nav className="flex flex-col gap-0.5">
          {DASHBOARD_NAV_ITEMS.filter((item) => {
            if (item.href === "/dashboard/calendar") {
              return usageHasFeature(usage, "calendar");
            }
            if (item.href === "/dashboard/customers") {
              return usageHasFeature(usage, "customers");
            }
            return true;
          }).map((item) => {
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
                {item.href === "/dashboard/orders" && newOrdersCount > 0 && (
                  <span
                    className="ml-auto inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-[#16A34A] px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white"
                    aria-label={`${newOrdersCount} new orders`}
                  >
                    {newOrdersCount > 99 ? "99+" : newOrdersCount}
                  </span>
                )}
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

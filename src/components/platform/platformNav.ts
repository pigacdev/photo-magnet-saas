import type { DashboardNavIconName } from "@/components/dashboard/dashboardNavIcons";

export const PLATFORM_SELLER_DASHBOARD_LINK = {
  href: "/dashboard",
  label: "Seller dashboard",
} as const;

export const PLATFORM_NAV_ITEMS: ReadonlyArray<{
  href: string;
  label: string;
  icon: DashboardNavIconName;
}> = [{ href: "/platform", label: "Overview", icon: "home" }];

export function isPlatformNavActive(pathname: string, href: string): boolean {
  if (href === "/platform") {
    return pathname === "/platform" || pathname.startsWith("/platform/");
  }
  return pathname.startsWith(href);
}

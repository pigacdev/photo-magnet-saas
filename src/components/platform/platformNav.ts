import type { DashboardNavIconName } from "@/components/dashboard/dashboardNavIcons";

export const PLATFORM_SELLER_DASHBOARD_LINK = {
  href: "/dashboard",
  label: "Seller dashboard",
} as const;

export const PLATFORM_NAV_ITEMS: ReadonlyArray<{
  href: string;
  label: string;
  icon: DashboardNavIconName;
}> = [
  { href: "/platform", label: "Overview", icon: "home" },
  { href: "/platform/early-access", label: "Early access", icon: "orders" },
  {
    href: "/platform/notifications",
    label: "Notifications",
    icon: "notifications",
  },
];

export function isPlatformNavActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;

  if (href === "/platform") {
    if (!pathname.startsWith("/platform/")) return false;
    return !PLATFORM_NAV_ITEMS.some(
      (item) =>
        item.href !== href &&
        (pathname === item.href || pathname.startsWith(`${item.href}/`)),
    );
  }

  return pathname.startsWith(`${href}/`);
}

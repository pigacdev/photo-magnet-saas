import type { DashboardNavIconName } from "./dashboardNavIcons";

export const DASHBOARD_NAV_ITEMS: ReadonlyArray<{
  href: string;
  label: string;
  icon: DashboardNavIconName;
}> = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/dashboard/orders", label: "Orders", icon: "orders" },
  { href: "/dashboard/events", label: "Events", icon: "events" },
  { href: "/dashboard/storefronts", label: "Storefront", icon: "storefront" },
];

export function isDashboardNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname.startsWith(href);
}

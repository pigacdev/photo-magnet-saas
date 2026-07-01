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
  { href: "/dashboard/calendar", label: "Calendar", icon: "calendar" },
  { href: "/dashboard/customers", label: "Customers", icon: "customers" },
];

export const DASHBOARD_STOREFRONT_NAV_BASE = "/dashboard/storefronts";

export function storefrontNavHref(storefrontId: string | null): string {
  return storefrontId
    ? `${DASHBOARD_STOREFRONT_NAV_BASE}/${storefrontId}`
    : DASHBOARD_STOREFRONT_NAV_BASE;
}

export function isStorefrontNavHref(href: string): boolean {
  return (
    href === DASHBOARD_STOREFRONT_NAV_BASE ||
    href.startsWith(`${DASHBOARD_STOREFRONT_NAV_BASE}/`)
  );
}

export function isDashboardNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  if (isStorefrontNavHref(href)) {
    return (
      pathname === DASHBOARD_STOREFRONT_NAV_BASE ||
      pathname.startsWith(`${DASHBOARD_STOREFRONT_NAV_BASE}/`)
    );
  }
  return pathname.startsWith(href);
}

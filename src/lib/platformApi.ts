import { api } from "./api";

export type PlatformPlanBreakdown = {
  FREE: number;
  HOBBY: number;
  PRO: number;
};

export type SignupMonthPoint = {
  month: string;
  label: string;
  signups: number;
};

export type SignupYearPoint = {
  year: string;
  signups: number;
};

export type PlatformOverview = {
  totalSellers: number;
  planBreakdown: PlatformPlanBreakdown;
  signupsLast30Days: { date: string; signups: number }[];
  signupsByMonth: SignupMonthPoint[];
  signupsByYear: SignupYearPoint[];
  gmvThisMonth: number;
  gmvLastMonth: number;
  ordersThisMonth: number;
  activeSellersLast30Days: number;
  nearOrderLimit: number;
  nearEventLimit: number;
  orderLimitReached: number;
  eventLimitReached: number;
  onboardingIncomplete: number;
  pendingErasure: number;
};

export type PlatformTenant = {
  id: string;
  email: string;
  name: string | null;
  businessName: string | null;
  plan: "FREE" | "HOBBY" | "PRO";
  clerkPlanSlug: string | null;
  createdAt: string;
  ordersThisMonth: number;
  orderLimit: number;
  eventsThisMonth: number;
  eventLimit: number;
  totalSettledOrders: number;
  settledRevenue: number;
  eventCount: number;
  storefrontCount: number;
  lastOrderAt: string | null;
  onboardingComplete: boolean;
  erasureScheduledAt: string | null;
};

export type PlatformTenantsResponse = {
  tenants: PlatformTenant[];
  total: number;
  page: number;
  pageSize: number;
};

export type TenantSort = "createdAt" | "ordersThisMonth" | "settledRevenue";
export type TenantOrder = "asc" | "desc";

export type PlatformTenantUsageFilter =
  | "nearOrderLimit"
  | "nearEventLimit"
  | "orderLimitReached"
  | "eventLimitReached"
  | "onboardingIncomplete"
  | "erasurePending";

export const USAGE_FILTER_LABELS: Record<PlatformTenantUsageFilter, string> = {
  nearOrderLimit: "Near order limit",
  nearEventLimit: "Near event limit",
  orderLimitReached: "Order limit reached",
  eventLimitReached: "Event limit reached",
  onboardingIncomplete: "Onboarding incomplete",
  erasurePending: "Pending deletion",
};

export type PlatformEarlyAccessRow = {
  id: string;
  email: string;
  name: string | null;
  plan: "FREE" | "HOBBY" | "PRO";
  clerkPlanSlug: string | null;
  earlyAccessExpiresAt: string | null;
  grantLifetimeDiscount: boolean;
  eventCount: number;
  orderCount: number;
  lastOrderAt: string | null;
};

export type PlatformEarlyAccessResponse = {
  rows: PlatformEarlyAccessRow[];
  seatsTaken: number;
  seatLimit: number;
  plansFlippedAt: string | null;
};

export function fetchPlatformOverview(): Promise<PlatformOverview> {
  return api<PlatformOverview>("/api/platform/overview");
}

export function fetchPlatformTenants(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: TenantSort;
  order?: TenantOrder;
  usageFilter?: PlatformTenantUsageFilter | null;
}): Promise<PlatformTenantsResponse> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.pageSize != null) q.set("pageSize", String(params.pageSize));
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.sort) q.set("sort", params.sort);
  if (params.order) q.set("order", params.order);
  if (params.usageFilter) q.set("usageFilter", params.usageFilter);
  const qs = q.toString();
  return api<PlatformTenantsResponse>(
    `/api/platform/tenants${qs ? `?${qs}` : ""}`,
  );
}

export function fetchPlatformEarlyAccess(): Promise<PlatformEarlyAccessResponse> {
  return api<PlatformEarlyAccessResponse>("/api/platform/early-access");
}

export function patchPlatformEarlyAccessDiscount(
  orgId: string,
  grantLifetimeDiscount: boolean,
): Promise<{ ok: boolean; grantLifetimeDiscount: boolean }> {
  return api(`/api/platform/early-access/${orgId}`, {
    method: "PATCH",
    body: { grantLifetimeDiscount },
  });
}

export type PlatformNotificationSelection =
  | { mode: "explicit"; userIds: string[] }
  | {
      mode: "all_matching";
      filters: {
        search?: string;
        usageFilter?: string;
        sort?: string;
        order?: string;
      };
      excludeUserIds?: string[];
    };

export type PlatformNotificationSendResult = {
  sent: number;
  skippedOptOut: number;
  failed: number;
  errors: string[];
};

export function sendPlatformNotification(body: {
  subject: string;
  html: string;
  includeOptedOut: boolean;
  selection: PlatformNotificationSelection;
}): Promise<PlatformNotificationSendResult> {
  return api<PlatformNotificationSendResult>("/api/platform/notifications/send", {
    method: "POST",
    body,
  });
}

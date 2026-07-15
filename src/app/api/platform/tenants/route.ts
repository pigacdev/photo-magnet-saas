import { NextResponse } from "next/server";
import { requirePlatformOwnerResponse } from "@/lib/platformAuth";
import { fetchPlatformTenants } from "../../../../../server/src/lib/platformMetrics";
import type { PlatformTenantUsageFilter } from "../../../../../server/src/lib/platformMetrics";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requirePlatformOwnerResponse();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "25", 10) || 25),
  );
  const search = searchParams.get("search") ?? undefined;
  const sortRaw = searchParams.get("sort") ?? "createdAt";
  const sort =
    sortRaw === "ordersThisMonth" || sortRaw === "settledRevenue"
      ? sortRaw
      : "createdAt";
  const orderRaw = searchParams.get("order") ?? "desc";
  const order = orderRaw === "asc" ? "asc" : "desc";
  const usageFilterRaw = searchParams.get("usageFilter");
  const usageFilters: PlatformTenantUsageFilter[] = [
    "nearOrderLimit",
    "nearEventLimit",
    "orderLimitReached",
    "eventLimitReached",
    "onboardingIncomplete",
    "erasurePending",
  ];
  const usageFilter = usageFilters.includes(
    usageFilterRaw as PlatformTenantUsageFilter,
  )
    ? (usageFilterRaw as PlatformTenantUsageFilter)
    : undefined;

  try {
    const result = await fetchPlatformTenants({
      page,
      pageSize,
      search: search || undefined,
      sort,
      order,
      usageFilter,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/platform/tenants]", err);
    return NextResponse.json(
      { error: "Failed to load platform tenants" },
      { status: 500 },
    );
  }
}

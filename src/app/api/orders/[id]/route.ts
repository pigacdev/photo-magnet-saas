import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Proxies GET /api/orders/:id to Express with cookies forwarded.
 * Builds the Cookie header from `cookies()` so httpOnly `token` is included
 * (raw `request.headers.get("cookie")` is unreliable in Route Handlers).
 */
const apiBase = (
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:4000"
).replace(/\/$/, "");

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const orderId = String(id ?? "").trim();
  if (!orderId) {
    return NextResponse.json({ error: "Order id required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const cookieHeader =
    allCookies.length > 0
      ? allCookies.map((c) => `${c.name}=${c.value}`).join("; ")
      : undefined;

  const url = `${apiBase}/api/orders/${encodeURIComponent(orderId)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
    },
  });
}

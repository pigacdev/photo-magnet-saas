import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSafeOrderReturnTo } from "@/lib/orderReturnTo";

/** Fail fast if the API is slow or unreachable (avoids hanging middleware). */
const SESSION_CHECK_TIMEOUT_MS = 2500;

function noSessionRedirect(request: NextRequest): NextResponse {
  const raw = request.nextUrl.searchParams.get("returnTo");
  const path = getSafeOrderReturnTo(raw);
  return NextResponse.redirect(new URL(path ?? "/", request.url));
}

/**
 * Validates the order session cookie via GET /api/session (marks expired as abandoned,
 * clears cookie). Forwards Set-Cookie from the API so cleared cookies reach the browser.
 *
 * Fail-safe: any API failure (timeout, non-OK, bad JSON, thrown error) → redirect via
 * `noSessionRedirect` (entry page from `returnTo` when valid, else `/`).
 *
 * After commit, session is CONVERTED — payment / success / confirmation must still load.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const isPaymentRoute = pathname.startsWith("/order/payment");
  const isSuccessRoute = pathname.startsWith("/order/success");
  /** After commit, session is converted — confirmation must still load without session API. */
  const isConfirmationRoute =
    pathname === "/order/confirmation" ||
    pathname.startsWith("/order/confirmation/");

  if (isPaymentRoute || isSuccessRoute || isConfirmationRoute) {
    if (isPaymentRoute) {
      const orderId = request.nextUrl.searchParams.get("orderId")?.trim();
      if (!orderId) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
    return NextResponse.next();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    SESSION_CHECK_TIMEOUT_MS,
  );

  try {
    const sessionRes = await fetch(new URL("/api/session", request.url), {
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!sessionRes.ok) {
      return noSessionRedirect(request);
    }

    let data: { session: unknown };
    try {
      data = (await sessionRes.json()) as { session: unknown };
    } catch {
      return noSessionRedirect(request);
    }

    const response = data.session
      ? NextResponse.next()
      : noSessionRedirect(request);

    sessionRes.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") {
        response.headers.append("Set-Cookie", value);
      }
    });

    return response;
  } catch {
    return noSessionRedirect(request);
  } finally {
    clearTimeout(timeoutId);
  }
}

export const config = {
  matcher: ["/order/:path*"],
};

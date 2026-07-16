import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSafeOrderReturnTo } from "@/lib/orderReturnTo";

/** Fail fast if the API is slow or unreachable (avoids hanging middleware). */
const SESSION_CHECK_TIMEOUT_MS = 8000;

const apiBase = (
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:4000"
).replace(/\/$/, "");

type BounceReason =
  | "timeout"
  | "http_status"
  | "bad_json"
  | "no_session"
  | "fetch_error";

function warnBounce(reason: BounceReason, detail?: string): void {
  const suffix = detail ? ` ${detail}` : "";
  console.warn(`[order-session] bounce reason=${reason}${suffix}`);
}

function noSessionRedirect(
  request: NextRequest,
  reason: BounceReason,
  detail?: string,
): NextResponse {
  warnBounce(reason, detail);
  const raw = request.nextUrl.searchParams.get("returnTo");
  const path = getSafeOrderReturnTo(raw);
  return NextResponse.redirect(new URL(path ?? "/", request.url));
}

/** Forward upstream Set-Cookie headers without collapsing multiples (Undici). */
function appendSetCookieHeaders(
  from: Response,
  to: NextResponse,
): void {
  const getSetCookie = (
    from.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie;
  if (typeof getSetCookie === "function") {
    for (const value of getSetCookie.call(from.headers)) {
      to.headers.append("Set-Cookie", value);
    }
    return;
  }
  const single = from.headers.get("set-cookie");
  if (single) {
    to.headers.append("Set-Cookie", single);
  }
}

/**
 * Validates the order session cookie via GET /api/session (marks expired as abandoned,
 * clears cookie). Forwards Set-Cookie from the API so cleared cookies reach the browser.
 *
 * Calls Express over `INTERNAL_API_URL` (private network on Railway) — not the public
 * app URL — so middleware does not hairpin through the edge (timeouts → silent bounce).
 *
 * Fail-safe: any API failure (timeout, non-OK, bad JSON, thrown error) → redirect via
 * `noSessionRedirect` (entry page from `returnTo` when valid, else `/`).
 *
 * After commit, session is CONVERTED — payment / success / confirmation must still load.
 */
export async function handleOrderSession(
  request: NextRequest,
): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/order")) {
    return null;
  }

  const isSuccessRoute = pathname.startsWith("/order/success");
  const isConfirmationRoute =
    pathname === "/order/confirmation" ||
    pathname.startsWith("/order/confirmation/");

  if (isSuccessRoute || isConfirmationRoute) {
    if (isConfirmationRoute) {
      const orderId = request.nextUrl.searchParams.get("orderId")?.trim();
      const url = orderId
        ? `/order/success?orderId=${encodeURIComponent(orderId)}`
        : "/order/success";
      return NextResponse.redirect(new URL(url, request.url));
    }
    return NextResponse.next();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    SESSION_CHECK_TIMEOUT_MS,
  );

  try {
    // String URL + cache: "no-store" — Next can ignore cache when given a Request object.
    const sessionRes = await fetch(`${apiBase}/api/session`, {
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!sessionRes.ok) {
      return noSessionRedirect(
        request,
        "http_status",
        `status=${sessionRes.status}`,
      );
    }

    let data: { session: unknown };
    try {
      data = (await sessionRes.json()) as { session: unknown };
    } catch {
      return noSessionRedirect(request, "bad_json");
    }

    if (!data.session) {
      return noSessionRedirect(request, "no_session");
    }

    const response = NextResponse.next();
    appendSetCookieHeaders(sessionRes, response);
    return response;
  } catch (err) {
    const isAbort =
      (err instanceof Error && err.name === "AbortError") ||
      (typeof err === "object" &&
        err !== null &&
        "name" in err &&
        (err as { name: string }).name === "AbortError");
    return noSessionRedirect(
      request,
      isAbort ? "timeout" : "fetch_error",
      isAbort
        ? `ms=${SESSION_CHECK_TIMEOUT_MS}`
        : err instanceof Error
          ? err.message
          : undefined,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

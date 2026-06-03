/** Browser: same-origin `/api/*` (rewrites to Express) so cookies work. Server: direct to API. */
function getApiBase(): string {
  if (typeof window === "undefined") {
    return (
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:4000"
    );
  }
  return "";
}

let clerkTokenGetter: (() => Promise<string | null>) | null = null;

/** Set by ClerkTokenBridge so Express can verify auth via Authorization header. */
export function registerClerkTokenGetter(
  getter: (() => Promise<string | null>) | null,
): void {
  clerkTokenGetter = getter;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
};

function throwIfNotOk(res: Response, data: unknown): void {
  if (res.ok) return;
  const d = data as Record<string, unknown>;
  const msg =
    (typeof d.message === "string" && d.message) ||
    (typeof d.error === "string" && d.error) ||
    "Something went wrong";
  const err = new Error(msg) as Error & { code?: string };
  if (typeof d.code === "string") err.code = d.code;
  throw err;
}

async function buildRequestHeaders(
  body?: unknown,
): Promise<HeadersInit | undefined> {
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";

  if (typeof window !== "undefined" && clerkTokenGetter) {
    try {
      const token = await clerkTokenGetter();
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch {
      /* Clerk not ready yet */
    }
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}

export async function api<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body } = options;

  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: await buildRequestHeaders(body),
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
    /** Avoid stale JSON (e.g. session images list after POST). */
    cache: method === "GET" ? "no-store" : undefined,
  });

  const data = await res.json();
  throwIfNotOk(res, data);

  return data as T;
}

/** Multipart upload (e.g. session images). Do not set Content-Type — browser sets boundary. */
export async function apiFormData<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    headers: await buildRequestHeaders(),
    body: formData,
    credentials: "include",
    cache: "no-store",
  });

  const data = await res.json();
  throwIfNotOk(res, data);

  return data as T;
}

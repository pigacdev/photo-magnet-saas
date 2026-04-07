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

type RequestOptions = {
  method?: string;
  body?: unknown;
};

export async function api<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body } = options;

  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
    /** Avoid stale JSON (e.g. session images list after POST). */
    cache: method === "GET" ? "no-store" : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data as T;
}

/** Multipart upload (e.g. session images). Do not set Content-Type — browser sets boundary. */
export async function apiFormData<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    body: formData,
    credentials: "include",
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data as T;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type RequestOptions = {
  method?: string;
  body?: unknown;
};

export async function api<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body } = options;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data as T;
}

import type { ApiError, ErrorCode } from "@one/contracts";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode | "NETWORK",
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/**
 * Fetch JSON from the api. Frontends proxy `/v1/*` to the api (next.config rewrites),
 * so paths are same-origin and cookies just work.
 */
export async function apiFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: "include",
      cache: "no-store",
      ...rest,
      headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiClientError(0, "NETWORK", "Something went wrong. Check your connection and try again.");
  }
  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) {
    const err = (body as ApiError | null)?.error;
    throw new ApiClientError(res.status, err?.code ?? "INTERNAL", err?.message ?? `Request failed (${res.status})`, err?.details);
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Thin wrapper around fetch for the /api proxy. Throws ApiError with the server's message. */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
  ) {
    super(message);
  }
}

async function parse(res: Response) {
  const text = await res.text();
  let data: unknown = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const body = data as { message?: string | string[] } | undefined;
    const raw = body?.message ?? 'Something went wrong. Please try again.';
    throw new ApiError(Array.isArray(raw) ? raw.join(', ') : raw, res.status, data);
  }
  return data;
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...rest,
    headers: { ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  return parse(res) as Promise<T>;
}

/** SWR fetcher. */
export const fetcher = <T,>(path: string) => api<T>(path);

/** API photo paths come as /photos/:id; the browser loads them via the proxy. */
export function mediaUrl(path: string | null | undefined) {
  return path ? `/api${path}` : null;
}

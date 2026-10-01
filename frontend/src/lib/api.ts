/**
 * Thin fetch wrapper used by every page.
 *
 * All requests go to same-origin `/api/...` which Next.js proxies to the Express backend
 * (see next.config.ts), so the signed session cookie is always sent.
 *
 * Conventions (see docs/API_CONTRACT.md):
 *  - Page data:         GET  /api/pages/<page>              -> the same variables the Flask/Jinja template received
 *  - Form-style action: POST /api/actions/<old flask path>  -> { ok, flash?: [{category,message}], redirect?: '/frontend/path' }
 *  - Pure JSON APIs keep their original /api/... path and their original response shape.
 */

export type FlashMsg = { category: string; message: string };

export type ActionResult = {
  ok?: boolean;
  error?: string;
  flash?: FlashMsg[];
  redirect?: string;
  [key: string]: any;
};

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super((body && (body.error || body.message)) || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

/** Hooks registered by <AppShell/> so that plain modules can trigger navigation / flash. */
export const apiHandlers: {
  onUnauthorized?: () => void;
  onResult?: (r: ActionResult) => void;
} = {};

async function parse(res: Response): Promise<any> {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  return null;
}

function handleSideEffects(status: number, body: any) {
  if (status === 401) {
    apiHandlers.onUnauthorized?.();
  } else if (status >= 400 && body && (body.redirect || body.flash)) {
    // e.g. 403 "Admin only." or 404 "Not found." -> flash + redirect exactly like Flask did
    apiHandlers.onResult?.(body);
  }
}

/** GET JSON. Throws ApiError on non-2xx. */
export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
  let body = await parse(res);
  if (!res.ok) {
    // pure-JSON admin routes (e.g. /api/users) answer a bare 403; Flask's admin_required page flashed + redirected
    if (res.status === 403 && body && body.error === 'Forbidden' && !body.flash) {
      body = { ...body, flash: [{ category: 'danger', message: 'Admin only.' }], redirect: '/dashboard' };
    }
    handleSideEffects(res.status, body);
    throw new ApiError(res.status, body);
  }
  return body as T;
}

export type SendBody = FormData | URLSearchParams | Record<string, any> | undefined | null;

/**
 * Send POST/PUT/DELETE. Never throws for HTTP errors: returns the parsed JSON body
 * (or `{ ok:false, error }`) - the same way the original pages used `fetch(...).then(r => r.json())`.
 * The HTTP status is available as `result.status`.
 */
export async function apiSend(
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  path: string,
  data?: SendBody
): Promise<ActionResult> {
  const init: RequestInit = { method, credentials: 'same-origin', cache: 'no-store' };
  if (data instanceof FormData || data instanceof URLSearchParams) {
    init.body = data;
  } else if (data !== undefined && data !== null) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(data);
  }
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error', status: 0 };
  }
  const body = (await parse(res)) ?? {};
  handleSideEffects(res.status, body);
  const out: ActionResult = { ...(body as object), status: res.status };
  if (!('ok' in out)) out.ok = res.ok;
  return out;
}

export const apiPost = (path: string, data?: SendBody) => apiSend('POST', path, data);
export const apiDelete = (path: string, data?: SendBody) => apiSend('DELETE', path, data);

/** Build a query string, skipping empty values. Returns '' or '?a=b&c=d'. */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

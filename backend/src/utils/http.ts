import { NextFunction, Request, RequestHandler, Response } from 'express';
import { fmtPyDateTime } from './pyDates';

export type FlashMsg = { category: 'success' | 'danger' | 'warning' | 'info'; message: string };

/** Wrap async handlers so rejected promises reach the Express error handler. */
export const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any> | any): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * Deep-serialize a value for JSON like the original `to_d()`/`jsonify`:
 *  - Dates become Python-style strings ('YYYY-MM-DD HH:MM:SS[.ffffff]')
 *  - Mongo internals (_id, __v) are dropped
 *  - a `password` key is NEVER emitted (passwords must not leave the server)
 */
export function ser(value: any): any {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return fmtPyDateTime(value);
  if (Array.isArray(value)) return value.map(ser);
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return undefined; // ObjectId
    if (typeof value.toObject === 'function') value = value.toObject();
    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === '_id' || k === '__v' || k === 'password') continue;
      const sv = ser(v);
      if (sv !== undefined) out[k] = sv;
    }
    return out;
  }
  return value;
}

/** Install a res.json that always serializes through ser(). */
export function jsonSerializer(_req: Request, res: Response, next: NextFunction) {
  const orig = res.json.bind(res);
  res.json = (body?: any) => orig(ser(body));
  next();
}

/** Read a single form/JSON field as a trimmed-or-raw string (like request.form.get(name, default)). */
export function field(req: Request, name: string, def = ''): string {
  const b: any = req.body || {};
  const v = b[name];
  if (v === undefined || v === null) return def;
  if (Array.isArray(v)) return String(v[v.length - 1] ?? def);
  return String(v);
}

/** request.form.getlist(name) */
export function fieldList(req: Request, name: string): string[] {
  const b: any = req.body || {};
  let v = b[name] ?? b[name + '[]'];
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) v = [v];
  return v.map((x: any) => String(x));
}

/** Result of a form-style action (Flask flash + redirect). */
export function action(res: Response, opts: { ok?: boolean; flash?: FlashMsg[]; redirect?: string; [k: string]: any } = {}) {
  const { ok = true, flash, redirect, ...rest } = opts;
  const body: any = { ok, ...rest };
  if (flash && flash.length) body.flash = flash;
  if (redirect) body.redirect = redirect;
  return res.json(body);
}

export const flash = (category: FlashMsg['category'], message: string): FlashMsg => ({ category, message });

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive "contains" (LOWER(col) LIKE '%q%') */
export const contains = (q: string): RegExp => new RegExp(escapeRegex(q.toLowerCase()), 'i');

/** Case-insensitive exact (LOWER(col) = LOWER(x)) */
export const equalsCI = (q: string): RegExp => new RegExp('^' + escapeRegex(q) + '$', 'i');

export function isDuplicateKey(e: any): boolean {
  return !!e && (e.code === 11000 || e.code === 11001);
}

/** request.args.get(name, default) - first value as string */
export function qstr(req: Request, name: string, def = ''): string {
  const v: any = (req.query as any)[name];
  if (v === undefined || v === null) return def;
  if (Array.isArray(v)) return String(v[0] ?? def);
  if (typeof v === 'object') return def;
  return String(v);
}

/** Express 5 wildcard params come back as arrays of segments */
export function wildcard(v: any): string {
  return Array.isArray(v) ? v.join('/') : String(v ?? '');
}

/** psycopg2-style loose int cast for ids arriving as strings */
export function toInt(v: any): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

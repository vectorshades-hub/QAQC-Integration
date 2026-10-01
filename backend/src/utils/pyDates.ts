/**
 * Date helpers that reproduce the Python `datetime` / `calendar` behaviour the original app relied on.
 * All "dates" are plain `YYYY-MM-DD` strings; local server time is used for "today" (like date.today()).
 */
const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_ABBR = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** date.today().isoformat() */
export const todayIso = (): string => fmtDate(new Date());

/** Parse 'YYYY-MM-DD' as a local (noon-anchored, DST-safe) Date; returns null if invalid (like date.fromisoformat raising). */
export function parseIso(s: string | undefined | null): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  r.setDate(r.getDate() + n);
  return r;
}

/** Monday=0 ... Sunday=6 (Python date.weekday()) */
export const weekday = (d: Date): number => (d.getDay() + 6) % 7;

/** [isoYear, isoWeek, isoWeekday(1-7)] like date.isocalendar() */
export function isocalendar(d: Date): [number, number, number] {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return [t.getUTCFullYear(), week, d.getDay() === 0 ? 7 : d.getDay()];
}

/** date.fromisocalendar(year, week, day) - throws ValueError-like Error for invalid input */
export function fromIsoCalendar(year: number, week: number, day: number): Date {
  const maxWeek = isocalendar(new Date(year, 11, 28, 12))[1];
  if (!(week >= 1 && week <= maxWeek) || !(day >= 1 && day <= 7)) throw new Error('Invalid week: ' + week);
  const jan4 = new Date(year, 0, 4, 12);
  const week1Monday = addDays(jan4, -weekday(jan4));
  return addDays(week1Monday, (week - 1) * 7 + (day - 1));
}

/** calendar.monthrange(year, month)[1] */
export const daysInMonth = (year: number, month: number): number => new Date(year, month, 0).getDate();

/** calendar.Calendar(firstweekday=0).monthdatescalendar(year, month) -> weeks of Date */
export function monthDatesCalendar(year: number, month: number): Date[][] {
  const first = new Date(year, month - 1, 1, 12);
  const start = addDays(first, -weekday(first));
  const last = new Date(year, month - 1, daysInMonth(year, month), 12);
  const end = addDays(last, 6 - weekday(last));
  const weeks: Date[][] = [];
  let cur = start;
  while (cur.getTime() <= end.getTime()) {
    const wk: Date[] = [];
    for (let i = 0; i < 7; i++) {
      wk.push(cur);
      cur = addDays(cur, 1);
    }
    weeks.push(wk);
  }
  return weeks;
}

/** strftime('%d %b') */
export const fmtDayMon = (d: Date): string => `${pad(d.getDate())} ${MONTH_ABBR[d.getMonth() + 1]}`;
/** strftime('%d %b %Y') */
export const fmtDayMonYear = (d: Date): string => `${fmtDayMon(d)} ${d.getFullYear()}`;

/** str(datetime) e.g. '2026-04-21 15:19:45.123456' (fraction omitted when zero) */
export function fmtPyDateTime(d: Date): string {
  const ms = d.getMilliseconds();
  const base = `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return ms ? `${base}.${pad(ms * 1000, 6)}` : base;
}

/** datetime.now().strftime('%Y-%m-%d %H:%M') */
export function nowMinute(): string {
  const d = new Date();
  return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse int query arg like flask request.args.get(name, default, type=int) */
export function argInt(v: any, def: number): number {
  if (v === undefined || v === null || v === '') return def;
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) return def;
  return parseInt(s, 10);
}

// ─── IST helpers (UTC+05:30) ──────────────────────────────────────────────────
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** Returns a Date whose UTC getters read as IST wall-clock. */
export const istNow = (): Date => new Date(Date.now() + IST_OFFSET_MS);

export function fmtIst(d: Date, withSeconds = false): string {
  // d already shifted (UTC getters == IST wall clock)
  const base = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return withSeconds ? `${base}:${pad(d.getUTCSeconds())}` : base;
}

export function istDay(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** ms until the next occurrence of hh:mm IST (strictly in the future) */
export function msUntilNextIst(h: number, m: number): { delay: number; nextRun: Date } {
  const now = istNow();
  let next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m, 0));
  if (next.getTime() <= now.getTime()) next = new Date(next.getTime() + 86400000);
  return { delay: next.getTime() - now.getTime(), nextRun: next };
}

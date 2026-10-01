import { Request, Response } from 'express';
import { DailyPlanEntry, User } from '../models';
import { activeMembers, genId } from '../services/lists';
import { action, field, flash, toInt } from '../utils/http';
import { MONTH_NAMES, argInt, daysInMonth, fmtDate, monthDatesCalendar, parseIso, todayIso } from '../utils/pyDates';

const LEAVE_STATUSES = ['LEAVE', 'TRAINING', 'HALF_DAY_AM', 'HALF_DAY_PM'];

/**
 * Cutoff date: non-admins cannot edit leave data before this date.
 * From the 3rd of each month, the entire previous month becomes read-only.
 */
function leaveLockBefore(): string {
  const today = new Date();
  if (today.getDate() >= 3) return fmtDate(new Date(today.getFullYear(), today.getMonth(), 1, 12));
  const pm = today.getMonth() || 12; // getMonth() is 0-based: previous month number
  const py = today.getMonth() > 0 ? today.getFullYear() : today.getFullYear() - 1;
  return fmtDate(new Date(py, pm - 1, 1, 12));
}

const isAdminReq = (req: Request) => (req.session as any)?.role === 'admin';
const redirectYM = (plan_date: string) => {
  const d = parseIso(plan_date);
  return d ? `/leave-calendar?year=${d.getFullYear()}&month=${d.getMonth() + 1}` : '/leave-calendar';
};

export async function leaveCalendarPage(req: Request, res: Response) {
  const today = new Date();
  const year = argInt(req.query.year, today.getFullYear());
  const month = argInt(req.query.month, today.getMonth() + 1);
  if (month < 1 || month > 12) throw new Error('bad month');

  const weeks = monthDatesCalendar(year, month).map((w) => w.map(fmtDate));
  const last_day = daysInMonth(year, month);
  const pm = (n: number) => String(n).padStart(2, '0');
  const rows: any[] = await DailyPlanEntry.find(
    {
      plan_date: { $gte: `${String(year).padStart(4, '0')}-${pm(month)}-01`, $lte: `${String(year).padStart(4, '0')}-${pm(month)}-${pm(last_day)}` },
      status: { $in: LEAVE_STATUSES },
    },
    'user_name status plan_date user_id -_id'
  ).lean();

  const leave_data: Record<string, Record<string, { name: string; status: string }>> = {};
  for (const r of rows) (leave_data[r.plan_date] ||= {})[String(r.user_id)] = { name: r.user_name, status: r.status };

  const leave_counts: Record<string, any> = {};
  for (const r of rows) {
    const uid = String(r.user_id);
    const c = (leave_counts[uid] ||= { name: r.user_name, leave: 0, training: 0, half_day: 0 });
    if (r.status === 'LEAVE') c.leave++;
    else if (r.status === 'TRAINING') c.training++;
    else if (r.status === 'HALF_DAY_AM' || r.status === 'HALF_DAY_PM') c.half_day++;
  }
  for (const c of Object.values(leave_counts)) {
    const t = c.leave + c.training + c.half_day * 0.5;
    c.total = Number.isInteger(t) ? t : t;
  }
  const leave_counts_list = Object.entries(leave_counts)
    .map(([uid, c]) => ({ uid, ...c }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const all_users = await activeMembers('id full_name');

  const lock_before = leaveLockBefore();
  const is_admin = isAdminReq(req);
  const viewing_locked_month = !is_admin && `${String(year).padStart(4, '0')}-${pm(month)}-${pm(last_day)}` < lock_before;

  res.json({
    today: todayIso(),
    year,
    month,
    month_name: MONTH_NAMES[month],
    weeks,
    leave_data,
    all_users,
    leave_counts,
    leave_counts_list,
    prev_year: month > 1 ? year : year - 1,
    prev_month: month - 1 || 12,
    next_year: month < 12 ? year : year + 1,
    next_month: month < 12 ? month + 1 : 1,
    lock_before,
    is_admin,
    viewing_locked_month,
  });
}

export async function leaveSetAction(req: Request, res: Response) {
  const plan_date = field(req, 'plan_date');
  const user_id = field(req, 'user_id');
  const status = field(req, 'status', 'LEAVE');
  const urow: any = await User.findOne({ id: toInt(user_id) }, 'full_name').lean();
  if (!urow || !plan_date) return action(res, { ok: false, flash: [flash('danger', 'Invalid request.')], redirect: '/leave-calendar' });
  if (!isAdminReq(req)) {
    const pd = parseIso(plan_date);
    if (pd && plan_date < leaveLockBefore()) {
      return action(res, {
        ok: false,
        flash: [flash('warning', 'This period is locked. Please contact the administrator to make changes.')],
        redirect: `/leave-calendar?year=${pd.getFullYear()}&month=${pd.getMonth() + 1}`,
      });
    }
  }
  const uid = toInt(user_id);
  await DailyPlanEntry.deleteMany({ plan_date, user_id: uid });
  await DailyPlanEntry.create({ id: genId(), plan_date, user_id: uid, user_name: urow.full_name, project_name: status, status });
  return action(res, { flash: [flash('success', `${urow.full_name} marked as ${status} on ${plan_date}.`)], redirect: redirectYM(plan_date) });
}

export async function leaveClearAction(req: Request, res: Response) {
  const plan_date = field(req, 'plan_date');
  const user_id = field(req, 'user_id');
  const urow: any = await User.findOne({ id: toInt(user_id) }, 'full_name').lean();
  if (!urow || !plan_date) return action(res, { ok: false, flash: [flash('danger', 'Invalid request.')], redirect: '/leave-calendar' });
  if (!isAdminReq(req)) {
    const pd = parseIso(plan_date);
    if (pd && plan_date < leaveLockBefore()) {
      return action(res, {
        ok: false,
        flash: [flash('warning', 'This period is locked. Please contact the administrator to make changes.')],
        redirect: `/leave-calendar?year=${pd.getFullYear()}&month=${pd.getMonth() + 1}`,
      });
    }
  }
  await DailyPlanEntry.deleteMany({ plan_date, user_id: toInt(user_id), status: { $in: LEAVE_STATUSES } });
  return action(res, { flash: [flash('success', `${urow.full_name} leave cleared on ${plan_date}.`)], redirect: redirectYM(plan_date) });
}

// ─── JSON API ─────────────────────────────────────────────────────────────────
export async function apiLeaveCal(req: Request, res: Response) {
  const today = new Date();
  const yr = argInt(req.query.year, today.getFullYear());
  const mo = argInt(req.query.month, today.getMonth() + 1);
  if (mo < 1 || mo > 12) throw new Error('bad month');
  const pm = (n: number) => String(n).padStart(2, '0');
  const weeks = monthDatesCalendar(yr, mo).map((w) => w.map(fmtDate));
  const rows: any[] = await DailyPlanEntry.find(
    {
      plan_date: { $gte: `${String(yr).padStart(4, '0')}-${pm(mo)}-01`, $lte: `${String(yr).padStart(4, '0')}-${pm(mo)}-31` },
      status: { $in: LEAVE_STATUSES },
    },
    'user_name status plan_date user_id -_id'
  ).lean();
  const ld: Record<string, Record<string, any>> = {};
  for (const r of rows) (ld[r.plan_date] ||= {})[String(r.user_id)] = { name: r.user_name, status: r.status };
  const users = await activeMembers('id full_name');
  res.json({
    year: yr,
    month: mo,
    month_name: MONTH_NAMES[mo],
    weeks,
    leave_data: ld,
    users,
    today: todayIso(),
    prev_year: mo > 1 ? yr : yr - 1,
    prev_month: mo - 1 || 12,
    next_year: mo < 12 ? yr : yr + 1,
    next_month: mo < 12 ? mo + 1 : 1,
  });
}

export async function apiSetLeave(req: Request, res: Response) {
  const d: any = req.body || {};
  const pd = d.plan_date;
  const uid = d.user_id;
  const st = d.status ?? 'LEAVE';
  if (!isAdminReq(req) && parseIso(pd) && pd < leaveLockBefore()) return res.status(403).json({ error: 'Period locked. Contact administrator.' });
  const urow: any = await User.findOne({ id: toInt(uid) }, 'full_name').lean();
  if (!urow) return res.status(404).json({ error: 'Not found' });
  await DailyPlanEntry.deleteMany({ plan_date: pd, user_id: toInt(uid) });
  await DailyPlanEntry.create({ id: genId(), plan_date: pd, user_id: toInt(uid), user_name: urow.full_name, project_name: st, status: st });
  res.json({ ok: true });
}

export async function apiClearLeave(req: Request, res: Response) {
  const d: any = req.body || {};
  if (!isAdminReq(req) && parseIso(d.plan_date) && d.plan_date < leaveLockBefore()) return res.status(403).json({ error: 'Period locked. Contact administrator.' });
  await DailyPlanEntry.deleteMany({ plan_date: d.plan_date, user_id: toInt(d.user_id), status: { $in: LEAVE_STATUSES } });
  res.json({ ok: true });
}

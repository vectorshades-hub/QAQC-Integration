import { Request, Response } from 'express';
import { DailyPlanEntry, MasterSet, Submission, User } from '../models';
import { passwordMatches } from '../services/passwords';
import { action, field, flash } from '../utils/http';
import { todayIso } from '../utils/pyDates';

const collate = { locale: 'en' } as const;

/** GET /api/auth/session - never 401, the shell uses it to know who is logged in */
export function getSession(req: Request, res: Response) {
  const s: any = req.session || {};
  if (!s.user_id) return res.json({ authenticated: false });
  res.json({
    authenticated: true,
    user: { user_id: String(s.user_id), full_name: s.full_name, role: s.role },
  });
}

/** login.html context */
export async function loginPage(_req: Request, res: Response) {
  const all_users = await User.find({ is_active: true }, 'id full_name -_id').collation(collate).sort({ full_name: 1 }).lean();
  res.json({ all_users });
}

export async function login(req: Request, res: Response) {
  const uid = parseInt(field(req, 'user_id'), 10);
  const pw = field(req, 'password').trim();
  const row: any = await User.findOne({ id: uid, is_active: true }).select('+password').lean();
  if (row && passwordMatches(pw, row.password)) {
    (req.session as any).user_id = String(row.id);
    (req.session as any).full_name = row.full_name;
    (req.session as any).role = row.role;
    return action(res, { ok: true, flash: [flash('success', `Welcome back, ${row.full_name}!`)], redirect: '/dashboard' });
  }
  return action(res, { ok: false, flash: [flash('danger', 'Invalid credentials or account inactive.')] });
}

export function logout(req: Request, res: Response) {
  req.session = null;
  res.json({ ok: true, redirect: '/login' });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export async function dashboardPage(_req: Request, res: Response) {
  const today = todayIso();
  const leave_rows: any[] = await DailyPlanEntry.find({ plan_date: today, status: { $in: ['LEAVE', 'TRAINING'] } }, 'user_name status').lean();
  const leave_today = leave_rows.map((r) => ({ name: r.user_name, status: r.status }));
  res.json({ today, on_leave: leave_today.length, leave_today });
}

export async function apiDashboard(_req: Request, res: Response) {
  const today = todayIso();
  const [total, completed, in_progress, on_leave] = await Promise.all([
    DailyPlanEntry.countDocuments({ plan_date: today }),
    DailyPlanEntry.countDocuments({ plan_date: today, status: 'COMPLETED' }),
    DailyPlanEntry.countDocuments({ plan_date: today, status: 'IN PROGRESS' }),
    DailyPlanEntry.countDocuments({ plan_date: today, status: 'LEAVE' }),
  ]);
  const leave = await DailyPlanEntry.find({ plan_date: today, status: { $in: ['LEAVE', 'TRAINING'] } }, 'user_name status -_id').lean();
  const recent_subs = await Submission.find({}, 'id submission_name client team rating submission_date -_id').sort({ id: -1 }).limit(5).lean();
  const ms_recent = await MasterSet.find({}, 'id job_name client team received_date -_id').sort({ id: -1 }).limit(5).lean();
  res.json({ stats: { total, completed, in_progress, on_leave }, leave, recent_subs, ms_recent });
}

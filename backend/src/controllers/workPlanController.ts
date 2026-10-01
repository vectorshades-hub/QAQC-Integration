import { Request, Response } from 'express';
import path from 'path';
import { paths } from '../config/env';
import { Team, User, UserWpTheme, WorkPlan, WorkPlanUserAssignment } from '../models';
import { auditDailyPlan } from '../services/audit';
import { saveWorkbook, wpExcelWb } from '../services/excelExports';
import { activeMembers, activeTeams, masterLists } from '../services/lists';
import { runScheduleTrackImport } from '../services/scheduleTrack';
import { copyWpToDaily } from '../services/workPlanCopy';
import { action, field, flash, qstr, toInt } from '../utils/http';
import {
  MONTH_NAMES,
  addDays,
  argInt,
  daysInMonth,
  fmtDate,
  fmtDayMon,
  fmtDayMonYear,
  fromIsoCalendar,
  isocalendar,
  parseIso,
  todayIso,
  weekday,
} from '../utils/pyDates';

const collate = { locale: 'en' } as const;
const FORM_CONFIRMED = ['confirmed', 'post_ofa', 'schedule_imported', 'qc_not_required'];
const API_CONFIRMED = ['confirmed', 'unconfirmed', 'post_ofa', 'schedule_imported', 'qc_not_required'];

const byDateTeam = (a: any, b: any) =>
  a.plan_date < b.plan_date ? -1 : a.plan_date > b.plan_date ? 1 : String(a.team_name).localeCompare(String(b.team_name), 'en');

async function plansBetween(start: string, end: string): Promise<any[]> {
  const rows = await WorkPlan.find({ plan_date: { $gte: start, $lte: end } }).lean();
  return rows.sort(byDateTeam);
}

const redirectForDate = (plan_date: string) => {
  const d = parseIso(plan_date);
  return d ? `/work-plan?year=${d.getFullYear()}&month=${d.getMonth() + 1}` : '/work-plan';
};

// ─── Page data ────────────────────────────────────────────────────────────────
export async function workPlanPage(req: Request, res: Response) {
  const view = qstr(req, 'view', 'week');
  const today = parseIso(todayIso())!;
  const [tIsoYear, tIsoWeek] = isocalendar(today);

  let ws: Date, we: Date, all_dates: string[];
  let year: number, month: number;
  let prev_year: any = null, prev_month: any = null, next_year: any = null, next_month: any = null;
  let iso_year: any = null, iso_week: any = null, prev_wy: any = null, prev_ww: any = null, next_wy: any = null, next_ww: any = null;

  if (view === 'week') {
    const wy = argInt(req.query.wy, tIsoYear);
    const ww = argInt(req.query.ww, tIsoWeek);
    ws = fromIsoCalendar(wy, ww, 1);
    we = addDays(ws, 6);
    all_dates = Array.from({ length: 7 }, (_, i) => fmtDate(addDays(ws, i)));
    year = ws.getFullYear();
    month = ws.getMonth() + 1;
    [prev_wy, prev_ww] = isocalendar(addDays(ws, -7));
    [next_wy, next_ww] = isocalendar(addDays(ws, 7));
    iso_year = wy;
    iso_week = ww;
  } else {
    year = argInt(req.query.year, today.getFullYear());
    month = argInt(req.query.month, today.getMonth() + 1);
    if (month < 1 || month > 12) throw new Error('bad month');
    const ms = new Date(year, month - 1, 1, 12);
    const me = new Date(year, month - 1, daysInMonth(year, month), 12);
    ws = addDays(ms, -weekday(ms));
    we = addDays(me, 6 - weekday(me));
    all_dates = [];
    for (let d = ws; d.getTime() <= we.getTime(); d = addDays(d, 1)) all_dates.push(fmtDate(d));
    prev_month = month - 1 || 12;
    prev_year = month > 1 ? year : year - 1;
    next_month = month < 12 ? month + 1 : 1;
    next_year = month < 12 ? year : year + 1;
  }
  const plans = await plansBetween(fmtDate(ws), fmtDate(we));

  const team_names = (await activeTeams()).map((t) => t.name);
  for (const p of plans) if (!team_names.includes(p.team_name)) team_names.push(p.team_name);
  const plans_dict: Record<string, Record<string, any[]>> = {};
  for (const p of plans) ((plans_dict[p.team_name] ||= {})[String(p.plan_date)] ||= []).push(p);

  const [, projects] = await masterLists();
  const all_teams_data = await Team.find({}).collation(collate).sort({ name: 1 }).lean();

  const uid = toInt((req.session as any)?.user_id);
  const theme: any = uid !== null ? await UserWpTheme.findOne({ user_id: uid }).lean() : null;

  res.json({
    view,
    all_dates,
    team_names,
    all_teams_data,
    plans_dict,
    year,
    month,
    projects,
    today_iso: todayIso(),
    today_year: today.getFullYear(),
    today_month: today.getMonth() + 1,
    today_wy: tIsoYear,
    today_ww: tIsoWeek,
    prev_year,
    prev_month,
    next_year,
    next_month,
    iso_year,
    iso_week,
    prev_wy,
    prev_ww,
    next_wy,
    next_ww,
    wp_color_even: theme ? theme.row_even : '#ffffff',
    wp_color_odd: theme ? theme.row_odd : '#f5f7ff',
  });
}

// ─── Form actions ─────────────────────────────────────────────────────────────
export async function addWorkPlanAction(req: Request, res: Response) {
  const plan_date = field(req, 'plan_date');
  let confirmed = field(req, 'date_confirmed', 'confirmed');
  if (!FORM_CONFIRMED.includes(confirmed)) confirmed = 'confirmed';
  const new_wp: any = await WorkPlan.create({
    team_name: field(req, 'team_name'),
    plan_date,
    project_name: field(req, 'project_name'),
    date_confirmed: confirmed,
    notes: field(req, 'notes'),
  });
  if (new_wp && confirmed === 'confirmed') await copyWpToDaily(req, new_wp.toObject());
  return action(res, { flash: [flash('success', 'Added.')], redirect: redirectForDate(plan_date) });
}

export async function deleteWorkPlanAction(req: Request, res: Response) {
  const wp_id = toInt(req.params.wp_id);
  const wp: any = await WorkPlan.findOne({ id: wp_id }, 'plan_date').lean();
  await WorkPlan.deleteOne({ id: wp_id });
  return action(res, { flash: [flash('success', 'Deleted.')], redirect: wp ? redirectForDate(String(wp.plan_date)) : '/work-plan' });
}

export async function editWorkPlanAction(req: Request, res: Response) {
  const wp_id = toInt(req.params.wp_id);
  const plan_date = field(req, 'plan_date');
  let confirmed = field(req, 'date_confirmed', 'confirmed');
  if (!FORM_CONFIRMED.includes(confirmed)) confirmed = 'confirmed';
  const old: any = await WorkPlan.findOne({ id: wp_id }, 'date_confirmed').lean();
  await WorkPlan.updateOne(
    { id: wp_id },
    { $set: { team_name: field(req, 'team_name'), plan_date, project_name: field(req, 'project_name'), date_confirmed: confirmed, notes: field(req, 'notes') } }
  );
  if (confirmed === 'confirmed' && (!old || old.date_confirmed !== 'confirmed')) {
    const wp: any = await WorkPlan.findOne({ id: wp_id }).lean();
    if (wp) await copyWpToDaily(req, wp);
  }
  await auditDailyPlan(req, 'WP_EDIT', {
    wp_id: wp_id!,
    details: { date_confirmed: confirmed, team: field(req, 'team_name'), project: field(req, 'project_name'), plan_date },
  });
  return action(res, { flash: [flash('success', 'Updated.')], redirect: redirectForDate(plan_date) });
}

export async function refreshWorkPlanExcel(_req: Request, res: Response) {
  const records = await WorkPlan.find({}).sort({ plan_date: 1 }).lean();
  await saveWorkbook(wpExcelWb(records), path.join(paths.DATA_DIR, 'work_plans.xlsx'));
  return action(res, { flash: [flash('success', 'work_plans.xlsx refreshed.')] });
}

// ─── JSON API ─────────────────────────────────────────────────────────────────
export async function apiWorkPlan(req: Request, res: Response) {
  const view = qstr(req, 'view', 'week');
  const today = parseIso(todayIso())!;
  const [tIsoYear, tIsoWeek] = isocalendar(today);
  let entries: any[], dates: string[], nav: any;
  if (view === 'week') {
    const wy = argInt(req.query.wy, tIsoYear);
    const ww = argInt(req.query.ww, tIsoWeek);
    const ws = fromIsoCalendar(wy, ww, 1);
    const we = addDays(ws, 6);
    entries = await plansBetween(fmtDate(ws), fmtDate(we));
    dates = Array.from({ length: 7 }, (_, i) => fmtDate(addDays(ws, i)));
    const pr = addDays(ws, -7);
    const nx = addDays(ws, 7);
    nav = {
      prev_wy: isocalendar(pr)[0],
      prev_ww: isocalendar(pr)[1],
      next_wy: isocalendar(nx)[0],
      next_ww: isocalendar(nx)[1],
      label: `Week ${ww} · ${fmtDayMon(ws)} - ${fmtDayMonYear(we)}`,
    };
  } else {
    const yr = argInt(req.query.year, today.getFullYear());
    const mo = argInt(req.query.month, today.getMonth() + 1);
    if (mo < 1 || mo > 12) throw new Error('bad month');
    const ms = new Date(yr, mo - 1, 1, 12);
    const me = new Date(yr, mo - 1, daysInMonth(yr, mo), 12);
    const ws = addDays(ms, -weekday(ms));
    const we = addDays(me, 6 - weekday(me));
    entries = await plansBetween(fmtDate(ws), fmtDate(we));
    dates = [];
    for (let d = ws; d.getTime() <= we.getTime(); d = addDays(d, 1)) dates.push(fmtDate(d));
    nav = {
      prev_year: mo > 1 ? yr : yr - 1,
      prev_month: mo - 1 || 12,
      next_year: mo < 12 ? yr : yr + 1,
      next_month: mo < 12 ? mo + 1 : 1,
      month: mo,
      year: yr,
      label: `${MONTH_NAMES[mo]} ${yr}`,
    };
  }
  const teams = (await activeTeams()).map((t) => t.name);
  for (const e of entries) if (!teams.includes(e.team_name)) teams.push(e.team_name);
  res.json({ dates, entries, teams, nav, view, today_wy: tIsoYear, today_ww: tIsoWeek, today_year: today.getFullYear(), today_month: today.getMonth() + 1 });
}

export async function apiAddWp(req: Request, res: Response) {
  const d: any = req.body || {};
  let dc = d.date_confirmed ?? 'confirmed';
  if (!API_CONFIRMED.includes(dc)) dc = 'confirmed';
  const row: any = await WorkPlan.create({ team_name: d.team_name, plan_date: d.plan_date, project_name: d.project_name, date_confirmed: dc, notes: d.notes ?? '' });
  if (row && dc === 'confirmed') await copyWpToDaily(req, row.toObject());
  res.json(row.toObject());
}

export async function apiEditWp(req: Request, res: Response) {
  const wid = toInt(req.params.wid);
  const d: any = req.body || {};
  let dc = d.date_confirmed ?? 'confirmed';
  if (!API_CONFIRMED.includes(dc)) dc = 'confirmed';
  const old: any = await WorkPlan.findOne({ id: wid }, 'date_confirmed').lean();
  const row: any = await WorkPlan.findOneAndUpdate(
    { id: wid },
    { $set: { team_name: d.team_name, plan_date: d.plan_date, project_name: d.project_name, date_confirmed: dc, notes: d.notes ?? '' } },
    { returnDocument: 'after' }
  ).lean();
  if (row && dc === 'confirmed' && (!old || old.date_confirmed !== 'confirmed')) await copyWpToDaily(req, row);
  await auditDailyPlan(req, 'WP_EDIT', {
    wp_id: wid!,
    details: { date_confirmed: dc, team: d.team_name ?? '', project: d.project_name ?? '', plan_date: d.plan_date ?? '' },
  });
  res.json(row);
}

export async function apiDeleteWp(req: Request, res: Response) {
  await WorkPlan.deleteOne({ id: toInt(req.params.wid) });
  res.json({ ok: true });
}

/** Load upcoming records (today .. today+30d) from Schedule Track into work_plans. */
export async function loadFromScheduleTrack(_req: Request, res: Response) {
  const out = await runScheduleTrackImport();
  if (out.kind === 'connect_error') return res.status(503).json({ ok: false, error: `Cannot connect to Schedule Track DB: ${out.error}` });
  if (out.kind === 'query_error') return res.status(500).json({ ok: false, error: `Query failed on Schedule Track DB: ${out.error}` });
  if (out.empty) return res.json({ ok: true, inserted: 0, skipped: 0, message: 'No upcoming records found in Schedule Track for the next month.' });
  const parts = [`${out.inserted} record(s) imported from Schedule Track`];
  if (out.skipped) parts.push(`${out.skipped} skipped (already exist or invalid)`);
  if (out.errors.length) parts.push(`${out.errors.length} error(s): ${out.errors.slice(0, 3).join('; ')}`);
  res.json({ ok: true, inserted: out.inserted, skipped: out.skipped, message: parts.join('. ') + '.', date_range: `${out.start} to ${out.end}` });
}

// ─── Work plan user assignments ───────────────────────────────────────────────
async function assignmentRows(): Promise<any[]> {
  const rows: any[] = await WorkPlanUserAssignment.find({}).lean();
  const users: any[] = await User.find({ id: { $in: rows.map((r) => r.user_id) } }, 'id full_name').lean();
  const nm = new Map(users.map((u) => [u.id, u.full_name]));
  return rows
    .filter((r) => nm.has(r.user_id))
    .map((r) => ({ id: r.id, team_name: r.team_name, user_id: r.user_id, is_default: !!r.is_default, user_name: nm.get(r.user_id) }))
    .sort(
      (a, b) =>
        a.team_name.localeCompare(b.team_name, 'en') ||
        Number(b.is_default) - Number(a.is_default) ||
        String(a.user_name).localeCompare(String(b.user_name), 'en')
    );
}

export async function workPlanAssignmentPage(_req: Request, res: Response) {
  const teams = await activeTeams();
  const users = await activeMembers();
  const assignments = await assignmentRows();
  const assign_map: Record<string, any[]> = {};
  for (const a of assignments) (assign_map[a.team_name] ||= []).push(a);
  res.json({ teams, users, assign_map });
}

export async function apiGetWpAssignments(_req: Request, res: Response) {
  res.json({ assignments: await assignmentRows() });
}

/** Replace all assignments for a team; also copies confirmed work plans (today onward) to assigned users' daily plans. */
export async function apiSaveWpAssignment(req: Request, res: Response) {
  const d: any = req.body || {};
  const team_name = String(d.team_name ?? '').trim();
  const user_ids: any[] = d.user_ids || [];
  const default_id = d.default_user_id;
  if (!team_name) return res.status(400).json({ ok: false, error: 'team_name required' });
  await WorkPlanUserAssignment.deleteMany({ team_name });
  for (const uid of user_ids) {
    await WorkPlanUserAssignment.create({ team_name, user_id: toInt(uid), is_default: String(uid) === String(default_id) });
  }
  const confirmed: any[] = await WorkPlan.find({ team_name, date_confirmed: { $in: ['confirmed', 'schedule_imported'] }, plan_date: { $gte: todayIso() } }).lean();
  confirmed.sort((a, b) => (a.plan_date < b.plan_date ? -1 : a.plan_date > b.plan_date ? 1 : 0));
  let copied = 0;
  for (const wp of confirmed) {
    await copyWpToDaily(req, wp);
    copied++;
  }
  res.json({ ok: true, copied });
}

export async function apiDeleteWpAssignment(req: Request, res: Response) {
  await WorkPlanUserAssignment.deleteOne({ id: toInt(req.params.aid) });
  res.json({ ok: true });
}


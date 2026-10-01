import { Request, Response } from 'express';
import { DailyPlanEntry, User } from '../models';
import { auditDailyPlan } from '../services/audit';
import { dailyExcel } from '../services/excelExports';
import { activeMembers, genId, masterLists } from '../services/lists';
import { updateScheduleTrackQaqc } from '../services/scheduleTrack';
import { action, field, fieldList, flash, qstr, toInt } from '../utils/http';
import { addDays, fmtDate, nowMinute, parseIso, todayIso } from '../utils/pyDates';
import { XLSX_MIME } from '../utils/files';

const sortEntries = (rows: any[]) =>
  rows.sort(
    (a, b) =>
      String(a.user_name).localeCompare(String(b.user_name), 'en') || new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

const userName = async (uid: any): Promise<string> => {
  const n = toInt(uid);
  if (n === null) return '';
  const u: any = await User.findOne({ id: n }, 'full_name').lean();
  return u ? u.full_name : '';
};


/** Mirror COMPLETED (Yes) / reverted (No) onto the Schedule Track record's QA Done flag. */
async function syncQaDone(project_name: string, plan_date: string, st_id: string | null | undefined, value: 'Yes' | 'No') {
  if (!project_name) return;
  await updateScheduleTrackQaqc(project_name, plan_date, st_id, value);
}

/** Cascade a status to the user's other entries for the same project, syncing Schedule Track for each. */
async function cascadeStatus(user_id: number | null, project_name: string, status: string, submitted: string | null) {
  const others: any[] = await DailyPlanEntry.find({ user_id, project_name, status: { $ne: status } }, 'id plan_date status schedule_track_id').lean();
  if (!others.length) return;
  await DailyPlanEntry.updateMany({ id: { $in: others.map((o) => o.id) } }, { $set: { status, submitted_date: status === 'COMPLETED' ? submitted : null } });
  for (const o of others) {
    if (status === 'COMPLETED') await syncQaDone(project_name, String(o.plan_date), o.schedule_track_id, 'Yes');
    else if (o.status === 'COMPLETED') await syncQaDone(project_name, String(o.plan_date), o.schedule_track_id, 'No');
  }
}

// ─── Pages ────────────────────────────────────────────────────────────────────
export async function dailyWorkPlanPage(req: Request, res: Response) {
  const sel_str = qstr(req, 'date', todayIso());
  const sel = parseIso(sel_str) ? sel_str : todayIso();
  const users = await activeMembers();
  const entries = sortEntries(await DailyPlanEntry.find({ plan_date: sel }).lean());
  const day_data: Record<string, { user_name: string; entries: any[] }> = {};
  for (const e of entries) {
    const uid = String(e.user_id);
    (day_data[uid] ||= { user_name: e.user_name, entries: [] }).entries.push(e);
  }
  const [clients, projects] = await masterLists();
  res.json({ selected_date: sel, today_iso: todayIso(), users, day_data, clients, projects });
}

export async function addEntryPage(req: Request, res: Response) {
  const users = await activeMembers();
  res.json({ pre_date: qstr(req, 'date', todayIso()), pre_user: qstr(req, 'user_id', ''), users });
}

// ─── Legacy form actions ──────────────────────────────────────────────────────
export async function addEntryAction(req: Request, res: Response) {
  // If this is replacing an existing entry, delete it first
  const orig_entry_id = field(req, '_orig_entry_id');
  if (orig_entry_id) {
    const orig: any = await DailyPlanEntry.findOne({ id: orig_entry_id }, 'user_id user_name project_name plan_date').lean();
    if (orig) {
      await auditDailyPlan(req, 'DELETE', {
        plan_date: String(orig.plan_date),
        entry_id: orig_entry_id,
        target_user_id: orig.user_id,
        target_user_name: orig.user_name,
        details: { project: orig.project_name, reason: 'replaced by edit' },
      });
    }
    await DailyPlanEntry.deleteOne({ id: orig_entry_id });
  }
  const user_ids = fieldList(req, 'user_id');
  if (!user_ids.length) {
    return action(res, { ok: false, flash: [flash('danger', 'Please select at least one team member.')], redirect: '/daily-work-plan' });
  }
  const d_from_str = field(req, 'plan_date_from') || field(req, 'plan_date', todayIso());
  const d_to_str = field(req, 'plan_date_to') || d_from_str;
  let d_from = parseIso(d_from_str);
  let d_to = parseIso(d_to_str);
  if (!d_from || !d_to) {
    d_from = d_to = parseIso(todayIso());
  }
  if (d_to!.getTime() < d_from!.getTime()) d_to = d_from;
  const plan_dates: string[] = [];
  for (let cur = d_from!; cur.getTime() <= d_to!.getTime(); cur = addDays(cur, 1)) plan_dates.push(fmtDate(cur));

  const status = field(req, 'status', 'IN PROGRESS');
  const project_name = field(req, 'project_name');
  const client_name = field(req, 'client_name');
  const sub_date = field(req, 'submission_date');
  const rec_date = field(req, 'received_date');
  const notes = field(req, 'notes');
  const exp_complete = field(req, 'expected_completion');
  const subdt_raw = field(req, 'submitted_date');
  const completed_at = subdt_raw || (status === 'COMPLETED' ? nowMinute() : '');
  let count = 0;
  for (const uid of user_ids) {
    const uname = await userName(uid);
    const uidNum = toInt(uid);
    for (const pd_str of plan_dates) {
      const subdt = status === 'COMPLETED' ? completed_at : subdt_raw;
      if (status === 'LEAVE' || status === 'TRAINING') {
        await DailyPlanEntry.deleteMany({ plan_date: pd_str, user_id: uidNum });
      }
      const eid = genId();
      await DailyPlanEntry.create({
        id: eid,
        plan_date: pd_str,
        user_id: uidNum,
        user_name: uname,
        project_name,
        client_name,
        submission_date: sub_date,
        received_date: rec_date,
        submitted_date: subdt,
        status,
        notes,
        expected_completion: exp_complete,
      });
      await auditDailyPlan(req, 'ADD', { plan_date: pd_str, entry_id: eid, target_user_id: uid, target_user_name: uname, details: { status, project: project_name } });
      if (status === 'COMPLETED') await syncQaDone(project_name, pd_str, null, 'Yes');
      count++;
    }
    // Cascade status change to all entries for the same user + project (any date)
    if (project_name) await cascadeStatus(uidNum, project_name, status, completed_at);
  }
  return action(res, { flash: [flash('success', `${count} entr${count === 1 ? 'y' : 'ies'} added.`)], redirect: `/daily-work-plan?date=${d_from_str}` });
}

export async function addProjectAction(req: Request, res: Response) {
  const plan_date = String(req.params.plan_date);
  const user_id = String(req.params.user_id);
  const status = field(req, 'status', 'IN PROGRESS');
  const uname = await userName(user_id);
  let subdt = field(req, 'submitted_date');
  if (status === 'COMPLETED' && !subdt) subdt = nowMinute();
  const uidNum = toInt(user_id);
  if (status === 'LEAVE' || status === 'TRAINING') await DailyPlanEntry.deleteMany({ plan_date, user_id: uidNum });
  const eid = genId();
  await DailyPlanEntry.create({
    id: eid,
    plan_date,
    user_id: uidNum,
    user_name: uname,
    project_name: field(req, 'project_name'),
    client_name: field(req, 'client_name'),
    submission_date: field(req, 'submission_date'),
    received_date: field(req, 'received_date'),
    submitted_date: subdt,
    status,
    notes: field(req, 'notes'),
    expected_completion: field(req, 'expected_completion'),
  });
  await auditDailyPlan(req, 'ADD', { plan_date, entry_id: eid, target_user_id: user_id, target_user_name: uname, details: { status, project: field(req, 'project_name') } });
  if (status === 'COMPLETED') await syncQaDone(field(req, 'project_name'), plan_date, null, 'Yes');
  return action(res, { flash: [flash('success', 'Row added.')], redirect: `/daily-work-plan?date=${plan_date}` });
}

export async function editEntryAction(req: Request, res: Response) {
  const plan_date = String(req.params.plan_date);
  const user_id = String(req.params.user_id);
  const entry_id = String(req.params.entry_id);
  const status = field(req, 'status', 'IN PROGRESS');
  const new_uid = field(req, 'user_id', user_id) || user_id;
  const new_uname = await userName(new_uid);
  let subdt = field(req, 'submitted_date');
  if (status === 'COMPLETED' && !subdt) subdt = nowMinute();
  const old_row: any = await DailyPlanEntry.findOne({ id: entry_id }, 'status project_name schedule_track_id').lean();
  const old_status = old_row ? old_row.status : null;
  const entry_st_id = old_row ? old_row.schedule_track_id : null;
  const project_name = field(req, 'project_name') || status;
  const newUidNum = toInt(new_uid);
  await DailyPlanEntry.updateOne(
    { id: entry_id },
    {
      $set: {
        user_id: newUidNum,
        user_name: new_uname,
        project_name,
        client_name: field(req, 'client_name'),
        submission_date: field(req, 'submission_date'),
        received_date: field(req, 'received_date'),
        submitted_date: subdt,
        status,
        notes: field(req, 'notes'),
        expected_completion: field(req, 'expected_completion'),
      },
    }
  );
  await auditDailyPlan(req, 'EDIT', {
    plan_date,
    entry_id,
    target_user_id: new_uid,
    target_user_name: new_uname,
    details: { status, project: project_name, reassigned_to: String(new_uid) !== String(user_id) ? new_uname : '' },
  });
  if (old_status && old_status !== status) {
    let st_updated = 0;
    let st_err: string | null = null;
    if (status === 'COMPLETED') [st_updated, st_err] = await updateScheduleTrackQaqc(project_name, plan_date, entry_st_id, 'Yes');
    else if (old_status === 'COMPLETED') [st_updated, st_err] = await updateScheduleTrackQaqc(project_name, plan_date, entry_st_id, 'No');
    await auditDailyPlan(req, 'STATUS_CHANGE', {
      plan_date,
      entry_id,
      target_user_id: new_uid,
      target_user_name: new_uname,
      details: { old_status, new_status: status, project: project_name, st_updated: st_updated || null, st_error: st_err || null },
    });
  }
  // Cascade status change to all entries for the same user + project (any date)
  if (project_name) await cascadeStatus(newUidNum, project_name, status, subdt);
  return action(res, { flash: [flash('success', 'Entry updated.')], redirect: `/daily-work-plan?date=${plan_date}` });
}

export async function deleteEntryAction(req: Request, res: Response) {
  const plan_date = String(req.params.plan_date);
  const entry_id = String(req.params.entry_id);
  const erow: any = await DailyPlanEntry.findOne({ id: entry_id }, 'user_id user_name project_name').lean();
  await auditDailyPlan(req, 'DELETE', {
    plan_date,
    entry_id,
    target_user_id: erow ? erow.user_id : null,
    target_user_name: erow ? erow.user_name : null,
    details: { project: erow ? erow.project_name : '' },
  });
  await DailyPlanEntry.deleteOne({ id: entry_id });
  return action(res, { flash: [flash('success', 'Entry deleted.')], redirect: `/daily-work-plan?date=${plan_date}` });
}

export async function exportDailyPlan(req: Request, res: Response) {
  const plan_date = String(req.params.plan_date);
  const wb = await dailyExcel(plan_date);
  const buf = await wb.xlsx.writeBuffer();
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="Daily_${plan_date}.xlsx"`);
  res.send(Buffer.from(buf as ArrayBuffer));
}

// ─── JSON API ─────────────────────────────────────────────────────────────────
export async function apiDailyPlan(req: Request, res: Response) {
  const sel = qstr(req, 'date', todayIso());
  const users = (await User.find({ is_active: true, role: { $ne: 'admin' }, created_at: { $lte: sel } }, 'id full_name team -_id')
    .collation({ locale: 'en' })
    .sort({ full_name: 1 })
    .lean()) as any[];
  const entries = sortEntries(await DailyPlanEntry.find({ plan_date: sel }).lean());
  const entry_map: Record<string, any[]> = {};
  for (const e of entries) (entry_map[String(e.user_id)] ||= []).push(e);
  const [clients, projects] = await masterLists();
  res.json({ users, entry_map, clients, projects });
}

export async function apiAddEntry(req: Request, res: Response) {
  const d: any = req.body || {};
  const uid = d.user_id;
  const status = d.status ?? 'IN PROGRESS';
  const uname = await userName(uid);
  let subdt = d.submitted_date ?? '';
  if (status === 'COMPLETED' && !subdt) subdt = nowMinute();
  const pd = d.plan_date ?? todayIso();
  const uidNum = toInt(uid);
  if (status === 'LEAVE' || status === 'TRAINING') await DailyPlanEntry.deleteMany({ plan_date: pd, user_id: uidNum });
  const eid = genId();
  const row = await DailyPlanEntry.create({
    id: eid,
    plan_date: pd,
    user_id: uidNum,
    user_name: uname,
    project_name: d.project_name ?? '',
    client_name: d.client_name ?? '',
    submission_date: d.submission_date ?? '',
    received_date: d.received_date ?? '',
    submitted_date: subdt,
    status,
    notes: d.notes ?? '',
    expected_completion: d.expected_completion ?? '',
  });
  await auditDailyPlan(req, 'ADD', { plan_date: pd, entry_id: eid, target_user_id: uid, target_user_name: uname, details: { status, project: d.project_name ?? '' } });
  if (status === 'COMPLETED') await syncQaDone(d.project_name ?? '', pd, null, 'Yes');
  res.json(row.toObject());
}

export async function apiEditEntry(req: Request, res: Response) {
  const eid = String(req.params.eid);
  const d: any = req.body || {};
  const status = d.status ?? 'IN PROGRESS';
  let subdt = d.submitted_date ?? '';
  if (status === 'COMPLETED' && !subdt) subdt = nowMinute();
  const old_row: any = await DailyPlanEntry.findOne({ id: eid }, 'status project_name').lean();
  const old_status = old_row ? old_row.status : null;
  const set: any = {
    project_name: d.project_name ?? '',
    client_name: d.client_name ?? '',
    submission_date: d.submission_date ?? '',
    received_date: d.received_date ?? '',
    submitted_date: subdt,
    status,
    notes: d.notes ?? '',
    expected_completion: d.expected_completion ?? '',
  };
  const new_uid = d.user_id;
  if (new_uid) {
    set.user_id = toInt(new_uid);
    set.user_name = await userName(new_uid);
  }
  const row: any = await DailyPlanEntry.findOneAndUpdate({ id: eid }, { $set: set }, { returnDocument: 'after' }).lean();
  if (row) {
    const plan_date = String(row.plan_date || '');
    const project_name = row.project_name || '';
    const entry_st_id = row.schedule_track_id;
    await auditDailyPlan(req, 'EDIT', { plan_date, entry_id: eid, target_user_id: row.user_id, target_user_name: row.user_name, details: { status, project: project_name } });
    if (old_status && old_status !== status) {
      let st_updated = 0;
      let st_err: string | null = null;
      if (status === 'COMPLETED') [st_updated, st_err] = await updateScheduleTrackQaqc(project_name, plan_date, entry_st_id, 'Yes');
      else if (old_status === 'COMPLETED') [st_updated, st_err] = await updateScheduleTrackQaqc(project_name, plan_date, entry_st_id, 'No');
      await auditDailyPlan(req, 'STATUS_CHANGE', {
        plan_date,
        entry_id: eid,
        target_user_id: row.user_id,
        target_user_name: row.user_name,
        details: { old_status, new_status: status, project: project_name, st_updated: st_updated || null, st_error: st_err || null },
      });
    }
  }
  res.json(row);
}

export async function apiDeleteEntry(req: Request, res: Response) {
  const eid = String(req.params.eid);
  const erow: any = await DailyPlanEntry.findOne({ id: eid }, 'user_id user_name plan_date project_name').lean();
  await auditDailyPlan(req, 'DELETE', {
    plan_date: erow ? String(erow.plan_date) : null,
    entry_id: eid,
    target_user_id: erow ? erow.user_id : null,
    target_user_name: erow ? erow.user_name : null,
    details: { project: erow ? erow.project_name : '' },
  });
  await DailyPlanEntry.deleteOne({ id: eid });
  res.json({ ok: true });
}

/** Transfer all daily plan entries from one user to another for a date or date range. */
export async function apiTransfer(req: Request, res: Response) {
  const d: any = req.body || {};
  const from_uid = d.from_user_id;
  const to_uid = d.to_user_id;
  const date_from = d.date_from;
  const date_to = d.date_to ?? date_from;
  if (!from_uid || !to_uid || !date_from) return res.status(400).json({ ok: false, error: 'from_user_id, to_user_id and date_from are required' });
  if (String(from_uid) === String(to_uid)) return res.status(400).json({ ok: false, error: 'Source and destination users must be different' });
  const to_row: any = await User.findOne({ id: toInt(to_uid), is_active: true }, 'full_name').lean();
  if (!to_row) return res.status(404).json({ ok: false, error: 'Destination user not found' });
  const to_name = to_row.full_name;
  const entries: any[] = await DailyPlanEntry.find(
    { user_id: toInt(from_uid), plan_date: { $gte: date_from, $lte: date_to } },
    'id plan_date project_name user_id user_name'
  ).lean();
  if (!entries.length) return res.json({ ok: true, transferred: 0, message: 'No entries found for that user/date range' });
  let count = 0;
  for (const e of entries) {
    await DailyPlanEntry.updateOne({ id: e.id }, { $set: { user_id: toInt(to_uid), user_name: to_name } });
    await auditDailyPlan(req, 'TRANSFER', {
      plan_date: String(e.plan_date),
      entry_id: e.id,
      target_user_id: to_uid,
      target_user_name: to_name,
      details: { from_user_id: from_uid, from_user: e.user_name, project: e.project_name },
    });
    count++;
  }
  res.json({ ok: true, transferred: count, message: `${count} entr${count === 1 ? 'y' : 'ies'} transferred to ${to_name}` });
}

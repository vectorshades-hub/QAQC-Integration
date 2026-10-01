import { Request } from 'express';
import { DailyPlanEntry, User, WorkPlanUserAssignment } from '../models';
import { todayIso } from '../utils/pyDates';
import { auditDailyPlan } from './audit';
import { genId } from './lists';

/**
 * Called when a work_plans entry is confirmed.
 * Looks up assigned users for the team and inserts daily_plan_entries.
 * If the assigned user is on leave that day, falls back to the default user.
 * `req` is absent when called from the scheduled Schedule Track import (no logged-in user to audit).
 */
export async function copyWpToDaily(req: Request | undefined, wp: any): Promise<void> {
  const team_name: string = wp.team_name || '';
  const plan_date = String(wp.plan_date || '');
  const project_name: string = wp.project_name || '';
  const wp_id = wp.id;
  const schedule_track_id = wp.schedule_track_id;

  const rawAssign = await WorkPlanUserAssignment.find({ team_name }).lean();
  const users = await User.find({ id: { $in: rawAssign.map((a: any) => a.user_id) } }, 'id full_name').lean();
  const nameOf = new Map(users.map((u: any) => [u.id, u.full_name]));
  // INNER JOIN users, ORDER BY is_default ASC, full_name
  const assignments = rawAssign
    .filter((a: any) => nameOf.has(a.user_id))
    .map((a: any) => ({ user_id: a.user_id, is_default: !!a.is_default, user_name: nameOf.get(a.user_id) as string }))
    .sort((a, b) => Number(a.is_default) - Number(b.is_default) || a.user_name.localeCompare(b.user_name, 'en'));

  if (!assignments.length) return; // no assignments configured for this team

  const fallback = assignments.find((a) => a.is_default) || null;
  const nonFallback = assignments.filter((a) => !a.is_default);
  // The people who should normally receive work (all non-fallback, or fallback if only one assigned)
  const targets = nonFallback.length ? nonFallback : fallback ? [fallback] : [];

  const isOnLeave = async (uid: number) =>
    !!(await DailyPlanEntry.exists({ plan_date, user_id: uid, status: { $in: ['LEAVE', 'TRAINING'] } }));

  const available: typeof targets = [];
  for (const a of targets) if (!(await isOnLeave(a.user_id))) available.push(a);
  const allOnLeave = available.length === 0 && targets.length > 0;

  let recipients: { uid: number; uname: string }[];
  if (available.length) {
    recipients = available.map((a) => ({ uid: a.user_id, uname: a.user_name }));
  } else if (allOnLeave) {
    if (fallback) recipients = [{ uid: fallback.user_id, uname: fallback.user_name }];
    else return; // no fallback configured - skip
  } else {
    return; // no targets configured
  }

  for (const { uid, uname } of recipients) {
    // Don't duplicate: skip if an entry for this project+date+user already exists
    const exists = await DailyPlanEntry.exists({ plan_date, user_id: uid, project_name });
    if (exists) continue;

    const eid = genId();
    await DailyPlanEntry.create({
      id: eid,
      plan_date,
      user_id: uid,
      user_name: uname,
      project_name,
      client_name: '',
      submission_date: plan_date,
      received_date: todayIso(),
      status: 'PENDING',
      notes: 'Auto from Work Plan',
      schedule_track_id: schedule_track_id !== undefined && schedule_track_id !== null ? String(schedule_track_id) : null,
    });
    await auditDailyPlan(req ?? ({} as Request), 'WP_CONFIRM_COPY', {
      plan_date,
      entry_id: eid,
      wp_id,
      target_user_id: uid,
      target_user_name: uname,
      details: { team: team_name, project: project_name },
    });
  }
}

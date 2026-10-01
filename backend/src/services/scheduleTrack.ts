/**
 * Integration with the external "Schedule Track" system.
 *
 * Schedule Track is a SEPARATE application whose data lives in its own MongoDB database
 * (default `schedule_tracker`, collection `records`) on the same MongoDB server. QAQC reads upcoming records from it
 * and writes back `records.qaqc` when a daily-plan entry is completed - exactly what the original app did
 * against PostgreSQL. Field mapping (old PostgreSQL column -> Schedule Track Mongo field):
 *   id -> legacyId (number)      project -> project        submission_name -> submissionName
 *   team -> team                 sub_date -> subDate (Date, UTC midnight)    status -> status
 *   submission_type -> submissionType     qaqc -> qaqc
 */
import mongoose from 'mongoose';
import { copyWpToDaily } from './workPlanCopy';
import { env } from '../config/env';
import { Team, User, WorkPlan } from '../models';
import { addDays, fmtDate, parseIso, todayIso } from '../utils/pyDates';
import { equalsCI } from '../utils/http';

export let lastStImportResult: { time_iso: string; inserted: number; skipped: number } | null = null;

let scheduleConn: mongoose.Connection | null = null;

/** Lazily open (and cache) the connection to the Schedule Track database. */
async function connectSchedule(): Promise<{ records: mongoose.mongo.Collection | null; err: string | null }> {
  if (!env.SCHEDULE_TRACK_MONGODB_URI) return { records: null, err: 'SCHEDULE_TRACK_MONGODB_URI is not configured' };
  try {
    if (!scheduleConn || scheduleConn.readyState !== 1) {
      scheduleConn = await mongoose.createConnection(env.SCHEDULE_TRACK_MONGODB_URI, { serverSelectionTimeoutMS: 8000 }).asPromise();
    }
    return { records: scheduleConn.db!.collection(env.SCHEDULE_TRACK_RECORDS_COLLECTION), err: null };
  } catch (e: any) {
    scheduleConn = null;
    return { records: null, err: String(e?.message || e) };
  }
}

/** Schedule Track stores dates as UTC-midnight Date objects */
const utcDay = (d: any): string => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

/**
 * Update records.qaqc in Schedule Track when a daily plan entry is COMPLETED (or reverted).
 * Resolution order:
 *   1. Direct st_id from daily_plan_entries.schedule_track_id (= records.legacyId)
 *   2. work_plans lookup by project_name (closest date wins)
 *   3. Name match: TRIM(project + ' ' + submissionName) = project_name
 * Returns [updated_count, error_message].
 */
export async function updateScheduleTrackQaqc(
  project_name: string,
  plan_date: string,
  st_id: string | null | undefined,
  qaqc_value = 'Yes'
): Promise<[number, string | null]> {
  try {
    let resolved: string | null | undefined = st_id;
    if (!resolved) {
      const cands = await WorkPlan.find({ project_name, schedule_track_id: { $ne: null } }, 'schedule_track_id plan_date').lean();
      const base = parseIso(plan_date);
      let best: any = null;
      let bestDiff = Infinity;
      for (const c of cands as any[]) {
        const d = parseIso(c.plan_date);
        const diff = base && d ? Math.abs(Math.round((d.getTime() - base.getTime()) / 86400000)) : Infinity;
        if (best === null || diff < bestDiff) {
          best = c;
          bestDiff = diff;
        }
      }
      if (best) resolved = best.schedule_track_id;
    }

    const { records, err } = await connectSchedule();
    if (err || !records) return [0, `Cannot connect to Schedule Track: ${err}`];
    try {
      let res;
      if (resolved) {
        const n = Number(resolved);
        res = await records.updateMany({ legacyId: Number.isFinite(n) ? n : resolved }, { $set: { qaqc: qaqc_value } });
      } else {
        res = await records.updateMany(
          { $expr: { $eq: [{ $trim: { input: { $concat: [{ $ifNull: ['$project', ''] }, ' ', { $ifNull: ['$submissionName', ''] }] } } }, project_name] } },
          { $set: { qaqc: qaqc_value } }
        );
      }
      return [res.matchedCount || 0, null];
    } catch (e: any) {
      return [0, String(e?.message || e)];
    }
  } catch (e: any) {
    return [0, String(e?.message || e)];
  }
}

export type StImportOutcome =
  | { kind: 'connect_error'; error: string }
  | { kind: 'query_error'; error: string }
  | { kind: 'ok'; inserted: number; skipped: number; errors: string[]; empty: boolean; start: string; end: string };

/**
 * Fetch records from new_schedule_track.records where sub_date falls between today and today + 30 days
 * and insert them into work_plans (skipping ones already imported).
 *
 * Mapping:
 *   project + ' ' + submission_name -> work_plans.project_name
 *   sub_date                        -> work_plans.plan_date
 *   team                            -> work_plans.team_name
 *   date_confirmed                  -> 'schedule_imported'
 *   submission_type                 -> notes
 */
export async function runScheduleTrackImport(): Promise<StImportOutcome> {
  const today = todayIso();
  const end = fmtDate(addDays(parseIso(today)!, 30));

  const { records, err } = await connectSchedule();
  if (err || !records) return { kind: 'connect_error', error: err || 'unknown' };

  let rawRows: any[] = [];
  try {
    rawRows = await records
      .find({
        subDate: { $ne: null, $gte: new Date(`${today}T00:00:00.000Z`), $lte: new Date(`${end}T23:59:59.999Z`) },
        // status is empty or not "completed"/"cancelled" (Schedule Track stores e.g. "COMPLETED (OVERDUE 3d)" too)
        status: { $not: /^\s*(completed|cancelled)/i },
      })
      .sort({ subDate: 1, team: 1, project: 1 })
      .toArray();
  } catch (e: any) {
    return { kind: 'query_error', error: String(e?.message || e) };
  }

  if (!rawRows.length) return { kind: 'ok', inserted: 0, skipped: 0, errors: [], empty: true, start: today, end };

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rawRows) {
    const project_part = String(row.project ?? '').trim();
    const submission_part = String(row.submissionName ?? '').trim();
    let team_name = String(row.team ?? '').trim();
    const plan_date_val = row.subDate;
    const submission_type = String(row.submissionType ?? '').trim();
    const st_id = row.legacyId !== undefined && row.legacyId !== null ? String(row.legacyId) : '';

    let project_name: string;
    if (project_part && submission_part) project_name = `${project_part} ${submission_part}`;
    else if (project_part) project_name = project_part;
    else if (submission_part) project_name = submission_part;
    else {
      skipped++;
      continue;
    }

    if (!team_name) {
      team_name = 'UNASSIGNED';
    } else {
      // Normalise: if a matching name already exists in QAQC (case-insensitive), use the stored QAQC name
      const t: any = await Team.findOne({ name: equalsCI(team_name) }, 'name').lean();
      if (t) team_name = t.name;
      else {
        const u: any = await User.findOne({ full_name: equalsCI(team_name) }, 'full_name').lean();
        if (u) team_name = u.full_name;
      }
    }

    let plan_date_str: string;
    try {
      plan_date_str = utcDay(plan_date_val);
    } catch {
      skipped++;
      continue;
    }

    // Skip already-imported records. Check by schedule_track_id first so a date change in ST doesn't duplicate.
    const existing = st_id
      ? await WorkPlan.exists({ schedule_track_id: st_id })
      : await WorkPlan.exists({ team_name, plan_date: plan_date_str, project_name });
    if (existing) {
      skipped++;
      continue;
    }

    // Ensure team exists so it appears in dropdowns
    try {
      if (!(await Team.exists({ name: team_name }))) await Team.create({ name: team_name });
    } catch {
      /* ignore */
    }

    try {
      const created = await WorkPlan.create({
        team_name,
        plan_date: plan_date_str,
        project_name,
        date_confirmed: 'schedule_imported',
        notes: submission_type,
        schedule_track_id: st_id || null,
      });
      inserted++;
      // Imported plans go straight to the assigned users' daily work plan
      await copyWpToDaily(undefined, created.toObject());
    } catch (e: any) {
      errors.push(String(e?.message || e));
      skipped++;
    }
  }
  return { kind: 'ok', inserted, skipped, errors, empty: false, start: today, end };
}

/** Scheduler entry point: run the import and remember the result for the UI toast. */
export async function doStImport(): Promise<void> {
  console.log(`[ST Auto-Import] Starting at ${new Date().toISOString()}`);
  try {
    const out = await runScheduleTrackImport();
    if (out.kind === 'connect_error') {
      console.log(`[ST Auto-Import] Cannot connect to Schedule Track DB: ${out.error}`);
      return;
    }
    if (out.kind === 'query_error') {
      console.log(`[ST Auto-Import] Query failed: ${out.error}`);
      return;
    }
    lastStImportResult = { time_iso: new Date().toISOString(), inserted: out.inserted, skipped: out.skipped };
    console.log(`[ST Auto-Import] Done: ${out.inserted} inserted, ${out.skipped} skipped`);
  } catch (e: any) {
    console.log(`[ST Auto-Import] Unexpected error: ${e?.message || e}`);
  }
}

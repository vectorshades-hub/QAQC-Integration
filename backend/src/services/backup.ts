import fs from 'fs';
import path from 'path';
import { paths, env } from '../config/env';
import { DailyPlanEntry, Submission, WorkPlan } from '../models';
import { ensureDir } from '../utils/files';
import { fmtIst, istDay, istNow, msUntilNextIst } from '../utils/pyDates';
import { dpExportWb, leaveCalExcelWb, saveWorkbook, subsExcelWb, wpExcelWb } from './excelExports';
import { doStImport } from './scheduleTrack';

export let lastBackupTime: Date | null = null;
let running = false;

const LEAVE_STATUSES = ['LEAVE', 'TRAINING', 'HALF_DAY_AM', 'HALF_DAY_PM'];

/**
 * Export 4 collections to dated Excel files in data/backup/YYYY-MM-DD/.
 * Runs automatically every day at midnight IST and on manual request.
 * Covers the last 60 days of data. Date folders older than 60 days are pruned.
 */
export async function doBackup(): Promise<string[]> {
  if (running) return [];
  running = true;
  const backed: string[] = [];
  try {
    const nowIst = istNow();
    const day = istDay(nowIst);
    const since = istDay(new Date(nowIst.getTime() - 60 * 86400000));
    try {
      const dateDir = path.join(paths.BACKUP_DIR, day);
      ensureDir(dateDir);

      const dpRows = await DailyPlanEntry.find({ plan_date: { $gte: since } }).lean();
      dpRows.sort((a: any, b: any) => (a.plan_date < b.plan_date ? -1 : a.plan_date > b.plan_date ? 1 : String(a.user_name).localeCompare(String(b.user_name), 'en')));
      backed.push(await saveWorkbook(dpExportWb(dpRows), path.join(dateDir, `daily_work_plan_${day}.xlsx`)));

      const wpRows = await WorkPlan.find({ plan_date: { $gte: since } }).sort({ plan_date: 1 }).lean();
      backed.push(await saveWorkbook(wpExcelWb(wpRows), path.join(dateDir, `work_plan_${day}.xlsx`)));

      const subRows = await Submission.find({ submission_date: { $gte: since } }).sort({ submission_date: 1, id: 1 }).lean();
      backed.push(await saveWorkbook(subsExcelWb(subRows), path.join(dateDir, `submission_log_${day}.xlsx`)));

      const lcRows = await DailyPlanEntry.find({ plan_date: { $gte: since }, status: { $in: LEAVE_STATUSES } }).lean();
      lcRows.sort((a: any, b: any) => (a.plan_date < b.plan_date ? -1 : a.plan_date > b.plan_date ? 1 : String(a.user_name).localeCompare(String(b.user_name), 'en')));
      backed.push(await saveWorkbook(leaveCalExcelWb(lcRows), path.join(dateDir, `leave_calendar_${day}.xlsx`)));

      lastBackupTime = new Date();
      console.log(`[Backup] ${day} - ${backed.length} files saved to data/backup/${day}/`);

      // Prune date folders older than 60 days
      const cutoff = istDay(new Date(nowIst.getTime() - 60 * 86400000));
      for (const entry of fs.readdirSync(paths.BACKUP_DIR)) {
        const ep = path.join(paths.BACKUP_DIR, entry);
        if (fs.statSync(ep).isDirectory() && entry < cutoff) {
          try {
            fs.rmSync(ep, { recursive: true, force: true });
          } catch {}
        }
      }
    } catch (e: any) {
      console.log(`[Backup] Error: ${e?.message || e}`);
    }
  } finally {
    running = false;
  }
  return backed;
}

let backupTimer: NodeJS.Timeout | null = null;
let stTimer: NodeJS.Timeout | null = null;

/** Schedule the next midnight-IST backup (timers are unref'd so they never keep the process alive). */
export function scheduleDailyBackup() {
  const { delay, nextRun } = msUntilNextIst(0, 0);
  backupTimer = setTimeout(async () => {
    await doBackup();
    scheduleDailyBackup();
  }, Math.min(delay, 2 ** 31 - 1));
  backupTimer.unref();
  console.log(`[Backup] Next auto-backup in ${(delay / 3600000).toFixed(1)} hours (${fmtIst(nextRun)} IST)`);
}

/** Schedule the next daily Schedule Track auto-import at ST_AUTO_IMPORT_TIME (IST). */
export function scheduleDailyStImport() {
  let h = 12,
    m = 35;
  try {
    const [hh, mm] = env.ST_AUTO_IMPORT_TIME.split(':').map((x) => parseInt(x, 10));
    if (Number.isFinite(hh) && Number.isFinite(mm)) {
      h = hh;
      m = mm;
    }
  } catch {}
  const { delay, nextRun } = msUntilNextIst(h, m);
  stTimer = setTimeout(async () => {
    await doStImport();
    scheduleDailyStImport();
  }, Math.min(delay, 2 ** 31 - 1));
  stTimer.unref();
  console.log(`[ST Auto-Import] Next run in ${(delay / 3600000).toFixed(1)} h (${fmtIst(nextRun)} IST)`);
}

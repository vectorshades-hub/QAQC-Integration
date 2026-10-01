import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { env, paths } from '../config/env';
import { DailyPlanAuditLog } from '../models';
import { doBackup, lastBackupTime } from '../services/backup';
import { doStImport, lastStImportResult } from '../services/scheduleTrack';
import { XLSX_MIME } from '../utils/files';
import { action, escapeRegex, flash, qstr } from '../utils/http';
import { argInt, fmtIst, istDay, istNow, msUntilNextIst } from '../utils/pyDates';

const pad = (n: number) => String(n).padStart(2, '0');
const utcFmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;

function backupFolders(limit: number, withModified: boolean) {
  const folders: any[] = [];
  if (!fs.existsSync(paths.BACKUP_DIR)) return folders;
  const names = fs.readdirSync(paths.BACKUP_DIR).sort().reverse().slice(0, limit);
  for (const dname of names) {
    const dpath = path.join(paths.BACKUP_DIR, dname);
    if (!fs.statSync(dpath).isDirectory()) continue;
    const files: any[] = [];
    for (const fname of fs.readdirSync(dpath).sort()) {
      const fpath = path.join(dpath, fname);
      const st = fs.statSync(fpath);
      if (!st.isFile()) continue;
      const f: any = { name: fname, path: `${dname}/${fname}`, size_kb: Math.round((st.size / 1024) * 10) / 10 };
      if (withModified) f.modified = utcFmt(st.mtime);
      files.push(f);
    }
    folders.push({ date: dname, files });
  }
  return folders;
}

export async function settingsPage(_req: Request, res: Response) {
  let next_run = '—';
  try {
    const [h, m] = env.ST_AUTO_IMPORT_TIME.split(':').map((x) => parseInt(x, 10));
    if (!Number.isFinite(h) || !Number.isFinite(m)) throw new Error('bad time');
    next_run = fmtIst(msUntilNextIst(h, m).nextRun) + ' IST';
  } catch {
    next_run = '—';
  }
  const tomorrow = new Date(istNow().getTime() + 86400000);
  const next_backup = `${istDay(tomorrow)} 00:00 IST`;
  res.json({
    st_auto_import_time: env.ST_AUTO_IMPORT_TIME,
    last_st_import: lastStImportResult ? lastStImportResult.time_iso : 'Never',
    next_run,
    last_backup: lastBackupTime ? fmtIst(new Date(lastBackupTime.getTime() + (5 * 60 + 30) * 60000)) + ' IST' : 'Never',
    next_backup,
    backup_folders: backupFolders(10, false),
  });
}

export function apiStImportStatus(_req: Request, res: Response) {
  res.json(lastStImportResult || {});
}

export function apiStImportRunNow(_req: Request, res: Response) {
  void doStImport();
  res.json({ ok: true, message: 'Import started' });
}

/** Manual backup - runs immediately in the background. */
export function backupExcel(_req: Request, res: Response) {
  void doBackup();
  return action(res, { flash: [flash('success', 'Backup started - files will appear in data/backup/YYYY-MM-DD/ shortly.')] });
}

export function apiBackupStatus(_req: Request, res: Response) {
  res.json({
    last_backup: lastBackupTime ? `${utcFmt(lastBackupTime)} UTC` : 'Never',
    folders: backupFolders(60, true),
    backup_dir: paths.BACKUP_DIR,
  });
}

export function downloadBackup(req: Request, res: Response) {
  const raw = Array.isArray((req.params as any).filename) ? (req.params as any).filename.join('/') : String((req.params as any).filename || '');
  const safe = raw.replace(/\.\./g, '').replace(/^\/+/, '');
  const p = path.join(paths.BACKUP_DIR, safe);
  if (!p.startsWith(paths.BACKUP_DIR) || !fs.existsSync(p) || !fs.statSync(p).isFile()) return res.status(404).json({ error: 'File not found' });
  res.setHeader('Content-Type', XLSX_MIME);
  res.download(p, path.basename(safe));
}

export async function apiDailyPlanLog(req: Request, res: Response) {
  const page = argInt(req.query.page, 1);
  const per_page = 50;
  const action_f = qstr(req, 'action').trim();
  const user_f = qstr(req, 'user').trim();
  const date_f = qstr(req, 'date').trim();
  const filter: any = {};
  if (action_f) filter.action = action_f;
  if (user_f) {
    const rx = new RegExp(escapeRegex(user_f), 'i');
    filter.$or = [{ performed_by_name: rx }, { target_user_name: rx }];
  }
  if (date_f) {
    const m = date_f.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const start = new Date(+m[1], +m[2] - 1, +m[3]);
      filter.created_at = { $gte: start, $lt: new Date(+m[1], +m[2] - 1, +m[3] + 1) };
    }
  }
  const total = await DailyPlanAuditLog.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / per_page));
  const rows = await DailyPlanAuditLog.find(filter).sort({ created_at: -1, id: -1 }).skip((page - 1) * per_page).limit(per_page).lean();
  res.json({ rows, total, page, pages });
}

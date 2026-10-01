import crypto from 'crypto';
import { execFile, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { paths } from '../config/env';
import { Submission } from '../models';
import { loadWorkbook, parseSubmissionRows } from '../services/excelImport';
import { saveWorkbook, subsExcelWb } from '../services/excelExports';
import { activeCheckers, activeTeams, masterLists } from '../services/lists';
import { ALLOWED_EXTS, MIME_MAP, XLSX_MIME, ensureDir, extOf, filesOf, moveFile, secureFilename } from '../utils/files';
import { FlashMsg, action, contains, escapeRegex, field, flash, qstr, toInt, wildcard } from '../utils/http';
import { argInt, todayIso } from '../utils/pyDates';

const collate = { locale: 'en' } as const;
const sessName = (req: Request) => String((req.session as any)?.full_name ?? '');

// ─── Master submission form ───────────────────────────────────────────────────
export async function masterSubmissionPage(_req: Request, res: Response) {
  const [clients, projects] = await masterLists();
  res.json({
    today: todayIso(),
    teams: (await activeTeams()).map((t) => t.name),
    checkers: (await activeCheckers()).map((u) => u.full_name),
    clients,
    projects,
  });
}

export async function apiSubMeta(_req: Request, res: Response) {
  const [clients, projects] = await masterLists();
  res.json({ teams: (await activeTeams()).map((t) => t.name), checkers: (await activeCheckers()).map((u) => u.full_name), clients, projects });
}

export async function addSubmission(req: Request, res: Response) {
  const sn = field(req, 'submission_name').trim();
  const mf = field(req, 'main_folder').trim(); // Reference Path (e.g. R:\Projects)
  const flashes: FlashMsg[] = [];
  const uploaded: any[] = [];
  const errors: string[] = [];

  // If a Reference Path is given, create the folder there (mf\sn). Otherwise fall back to the server UPLOADS_DIR.
  let dest_dir: string | null;
  if (mf && sn) dest_dir = path.join(mf, sn);
  else if (mf) dest_dir = mf;
  else if (sn) dest_dir = path.join(paths.UPLOADS_DIR, sn);
  else dest_dir = paths.UPLOADS_DIR;

  try {
    ensureDir(dest_dir);
  } catch (e: any) {
    errors.push(`Cannot create folder "${dest_dir}": ${e?.message || e}`);
    dest_dir = null;
  }

  for (const [fieldName, ftype] of [['file_d', 'D Sheet'], ['file_e', 'E Sheet'], ['file_cp', 'Check Print']] as const) {
    for (const f of filesOf(req, fieldName)) {
      if (!f || !f.originalname) continue;
      const ext = extOf(f.originalname);
      if (!ALLOWED_EXTS.has(ext)) {
        flashes.push(flash('warning', `File type .${ext} not allowed — skipped.`));
        continue;
      }
      let fname = secureFilename(f.originalname);
      if (dest_dir) {
        try {
          let save_path = path.join(dest_dir, fname);
          // If file exists, don't overwrite - add suffix
          if (fs.existsSync(save_path)) {
            const base = path.basename(fname, path.extname(fname));
            fname = `${base}_${crypto.randomBytes(2).toString('hex')}${path.extname(fname)}`;
            save_path = path.join(dest_dir, fname);
          }
          moveFile(f.path, save_path);
          uploaded.push({ type: ftype, original: secureFilename(f.originalname), stored: fname, dest_dir });
        } catch (e: any) {
          errors.push(`${fname}: ${e?.message || e}`);
        }
      }
    }
  }

  const row = await Submission.create({
    received_date: field(req, 'received_date'),
    submission_date: field(req, 'submission_date'),
    qc_checker: field(req, 'qc_checker'),
    team: field(req, 'team'),
    client: field(req, 'client'),
    rating: field(req, 'rating'),
    num_e_sheets: field(req, 'num_e_sheets'),
    num_d_sheets: field(req, 'num_d_sheets'),
    check_print: field(req, 'check_print', 'False'),
    job_name: field(req, 'job_name'),
    submission_name: sn,
    remarks: field(req, 'remarks'),
    main_folder: mf,
    files_copied: uploaded.map((u) => u.original),
    uploaded_files: uploaded,
    submitted_by: sessName(req),
  });
  const sid = (row as any).id;

  if (errors.length) flashes.push(flash('warning', `Submission #${sid} saved, but some files failed: ${errors.join('; ')}`));
  else if (uploaded.length) flashes.push(flash('success', `Submission #${sid} saved. ${uploaded.length} file(s) saved to ${dest_dir}`));
  else flashes.push(flash('success', `Submission #${sid} saved (no files attached).`));
  return action(res, { flash: flashes, redirect: '/master-submission' });
}

/** Serve a submission file from its saved location on this server. */
export async function viewSubmissionFile(req: Request, res: Response) {
  const sub_id = toInt(req.params.sub_id);
  const safe = path.basename(wildcard((req.params as any).stored_name)); // prevent path traversal
  const row: any = await Submission.findOne({ id: sub_id }, 'uploaded_files submission_name main_folder').lean();
  if (!row) return res.status(404).type('text/plain').send('Submission not found');

  const files: any[] = row.uploaded_files || [];
  const match = files.find((f) => f.stored === safe || f.original === safe);
  const candidates: string[] = [];
  if (match && match.dest_dir) candidates.push(path.join(match.dest_dir, safe)); // most reliable for new submissions
  const mf = row.main_folder || '';
  const sn = row.submission_name || '';
  if (mf && sn) candidates.push(path.join(mf, sn, safe));
  if (mf) candidates.push(path.join(mf, safe));
  if (sn) candidates.push(path.join(paths.UPLOADS_DIR, sn, safe));
  candidates.push(path.join(paths.UPLOADS_DIR, safe));

  const file_path = candidates.find((p) => {
    try {
      return fs.statSync(p).isFile();
    } catch {
      return false;
    }
  });
  if (!file_path) return res.status(404).type('text/plain').send(`File not found: ${safe}`);

  const original = match ? match.original || safe : safe;
  const ext = path.extname(safe).toLowerCase();
  const mime = MIME_MAP[ext] || 'application/octet-stream';
  const inline = ['.pdf', '.png', '.jpg', '.jpeg', '.gif'].includes(ext);
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(original)}"`);
  fs.createReadStream(file_path).pipe(res);
}

export function browseFolder(_req: Request, res: Response) {
  res.json({ path: '', note: 'File browsing not available on server. Type path manually.' });
}

/** After opening Explorer, bring its window to the foreground (Windows only, best effort). */
function focusExplorerWindow() {
  const script = `
Add-Type @"
using System; using System.Runtime.InteropServices;
public class QW {
  [DllImport("user32.dll")] public static extern IntPtr FindWindow(string c, string t);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
}
"@
Start-Sleep -Milliseconds 600
foreach ($c in @("CabinetWClass","ExploreWClass")) {
  $h = [QW]::FindWindow($c, $null)
  if ($h -ne [IntPtr]::Zero) {
    [QW]::ShowWindow($h, 9) | Out-Null
    $fg = [QW]::GetForegroundWindow()
    $ft = [QW]::GetWindowThreadProcessId($fg, [IntPtr]::Zero)
    $me = [QW]::GetCurrentThreadId()
    if ($ft -ne $me) { [QW]::AttachThreadInput($ft, $me, $true) | Out-Null }
    [QW]::BringWindowToTop($h) | Out-Null
    [QW]::SetForegroundWindow($h) | Out-Null
    if ($ft -ne $me) { [QW]::AttachThreadInput($ft, $me, $false) | Out-Null }
    break
  }
}`;
  execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true }, () => {});
}

export async function openFolder(req: Request, res: Response) {
  const p = String((req.body || {}).path ?? '').trim();
  if (!p) return res.json({ ok: false, error: 'No path provided' });
  try {
    const norm = path.normalize(p);
    if (!fs.existsSync(norm)) throw new Error(`[WinError 2] The system cannot find the file specified: '${norm}'`);
    if (process.platform === 'win32') {
      spawn('explorer.exe', [norm], { detached: true, stdio: 'ignore' }).unref();
      focusExplorerWindow();
    } else {
      spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [norm], { detached: true, stdio: 'ignore' }).unref();
    }
    return res.json({ ok: true });
  } catch (e: any) {
    return res.json({ ok: false, error: String(e?.message || e) });
  }
}

// ─── Submission log ───────────────────────────────────────────────────────────
/** LOWER(col) LIKE '%q%' with real LIKE semantics: '%' and '_' are wildcards, backslash escapes the next char. */
function likeContains(q: string): RegExp {
  let out = '';
  const s = q.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length) out += escapeRegex(s[++i]);
    else if (c === '%') out += '[\\s\\S]*';
    else if (c === '_') out += '[\\s\\S]';
    else out += escapeRegex(c);
  }
  return new RegExp(out, 'i');
}

const SORT_ALLOWED = new Set(['id', 'submission_date', 'received_date', 'team', 'client', 'submission_name', 'qc_checker', 'num_e_sheets', 'num_d_sheets', 'rating']);

export async function submissionLogPage(req: Request, res: Response) {
  const PER_PAGE = 50;
  let page = Math.max(1, argInt(req.query.page, 1));
  const q = qstr(req, 'q').trim();
  const team_f = qstr(req, 'team').trim();
  const checker_f = qstr(req, 'checker').trim();
  const rating_f = qstr(req, 'rating').trim();
  let sort = qstr(req, 'sort', 'submission_date').trim();
  let order = qstr(req, 'order', 'desc').trim().toLowerCase();
  if (!SORT_ALLOWED.has(sort)) sort = 'submission_date';
  if (order !== 'asc' && order !== 'desc') order = 'desc';

  const filter: any = {};
  if (q) {
    const rx = likeContains(q);
    filter.$or = ['submission_name', 'client', 'team', 'qc_checker', 'job_name'].map((k) => ({ [k]: rx }));
  }
  if (team_f) filter.team = team_f;
  if (checker_f) filter.qc_checker = checker_f;
  if (rating_f) filter.rating = rating_f;

  const total = await Submission.countDocuments(filter);
  const total_pages = Math.max(1, Math.ceil(total / PER_PAGE));
  page = Math.min(page, total_pages);
  const offset = (page - 1) * PER_PAGE;

  const statRows = await Submission.aggregate([{ $match: filter }, { $group: { _id: '$rating', cnt: { $sum: 1 } } }]);
  const stats: Record<string, number> = {};
  for (const r of statRows) stats[r._id ?? ''] = r.cnt;

  const dir = order === 'desc' ? -1 : 1;
  const sortSpec: any = sort === 'id' ? { id: dir } : { [sort]: dir, id: -1 };
  const submissions = await Submission.find(filter).collation(collate).sort(sortSpec).skip(offset).limit(PER_PAGE).lean();
  for (const s of submissions as any[]) if (!s.uploaded_files) s.uploaded_files = [];

  const [clients] = await masterLists();
  res.json({
    submissions,
    teams: (await activeTeams()).map((t) => t.name),
    checkers: (await activeCheckers()).map((u) => u.full_name),
    clients,
    page,
    total_pages,
    total,
    per_page: PER_PAGE,
    stats,
    q,
    team_filter: team_f,
    checker_filter: checker_f,
    rating_filter: rating_f,
    sort,
    order,
  });
}

export async function apiGetSubmission(req: Request, res: Response) {
  const row = await Submission.findOne({ id: toInt(req.params.sid) }).lean();
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
}

export async function updateSubmission(req: Request, res: Response) {
  await Submission.updateOne(
    { id: toInt(req.params.sid) },
    {
      $set: {
        received_date: field(req, 'received_date'),
        submission_date: field(req, 'submission_date'),
        qc_checker: field(req, 'qc_checker'),
        team: field(req, 'team'),
        client: field(req, 'client'),
        rating: field(req, 'rating'),
        num_e_sheets: field(req, 'num_e_sheets'),
        num_d_sheets: field(req, 'num_d_sheets'),
        check_print: field(req, 'check_print', 'False'),
        job_name: field(req, 'job_name'),
        submission_name: field(req, 'submission_name'),
        remarks: field(req, 'remarks'),
        main_folder: field(req, 'main_folder'),
        submitted_by: field(req, 'submitted_by'),
      },
    }
  );
  res.json({ ok: true });
}

export async function apiSubmissions(req: Request, res: Response) {
  const page = argInt(req.query.page, 1);
  const per = argInt(req.query.per_page, 25);
  const q = qstr(req, 'q').trim();
  const team = qstr(req, 'team');
  const rating = qstr(req, 'rating');
  let sort = qstr(req, 'sort', 'id');
  const dir = qstr(req, 'order', 'desc') === 'asc' ? 1 : -1;
  if (!['id', 'submission_date', 'received_date', 'team', 'client', 'submission_name', 'qc_checker', 'rating'].includes(sort)) sort = 'id';
  const filter: any = {};
  if (q) {
    const rx = contains(q);
    filter.$or = ['job_name', 'client', 'team', 'submission_name', 'qc_checker'].map((k) => ({ [k]: rx }));
  }
  if (team) filter.team = team;
  if (rating) filter.rating = rating;
  const total = await Submission.countDocuments(filter);
  const pages = total ? Math.ceil(total / per) : 1;
  const items = await Submission.find(filter).collation(collate).sort({ [sort]: dir }).skip((page - 1) * per).limit(per).lean();
  for (const s of items as any[]) if (!s.uploaded_files) s.uploaded_files = [];
  const teams = ((await Submission.distinct('team', { team: { $ne: '' } })) as string[]).sort((a, b) => a.localeCompare(b, 'en'));
  const ratings = ((await Submission.distinct('rating', { rating: { $ne: '' } })) as string[]).sort((a, b) => a.localeCompare(b, 'en'));
  res.json({ items, total, page, pages, per_page: per, teams, ratings });
}

export async function apiDeleteSubmission(req: Request, res: Response) {
  await Submission.deleteOne({ id: toInt(req.params.sid) });
  res.json({ ok: true });
}

export async function exportSubmissions(_req: Request, res: Response) {
  const rows = await Submission.find({}).sort({ submission_date: 1, id: 1 }).lean();
  const file = await saveWorkbook(subsExcelWb(rows), path.join(paths.DATA_DIR, 'submissions.xlsx'));
  res.setHeader('Content-Type', XLSX_MIME);
  res.download(file, 'submissions.xlsx');
}

// ─── Excel import / preview ───────────────────────────────────────────────────
function excelUpload(req: Request): { file?: Express.Multer.File; error?: string } {
  const f = filesOf(req, 'excel_file')[0];
  if (!f || !f.originalname) return { error: 'No file provided' };
  const ext = extOf(f.originalname);
  if (ext !== 'xlsx' && ext !== 'xls') return { error: 'Only .xlsx or .xls files accepted' };
  return { file: f };
}

async function parseUploaded(file: Express.Multer.File) {
  try {
    return { parsed: parseSubmissionRows(await loadWorkbook(file)) };
  } catch (e: any) {
    return { error: `Cannot read file: ${e?.message || e}` };
  }
}

const subInsertDoc = (r: any, submitted_by: string) => ({
  received_date: r.received_date,
  submission_date: r.submission_date,
  qc_checker: r.qc_checker,
  team: r.team,
  client: r.client,
  rating: r.rating,
  num_e_sheets: r.num_e_sheets,
  num_d_sheets: r.num_d_sheets,
  check_print: r.check_print,
  submission_name: r.submission_name,
  remarks: r.remarks,
  main_folder: r.main_folder,
  submitted_by,
  files_copied: [],
  uploaded_files: [],
});

export async function bulkUploadSubmissions(req: Request, res: Response) {
  const up = excelUpload(req);
  if (!up.file) return res.json({ ok: false, error: up.error });
  const { parsed, error } = await parseUploaded(up.file);
  if (!parsed) return res.json({ ok: false, error });
  const { rows, errors } = parsed;
  let inserted = 0;
  const by = sessName(req);
  for (const r of rows) {
    try {
      await Submission.create(subInsertDoc(r, by));
      inserted++;
    } catch (e: any) {
      errors.push(`Row ${r.row}: ${e?.message || e}`);
    }
  }
  res.json({ ok: true, inserted, errors });
}

export async function previewExcelSubmissions(req: Request, res: Response) {
  const up = excelUpload(req);
  if (!up.file) return res.json({ ok: false, error: up.error });
  const { parsed, error } = await parseUploaded(up.file);
  if (!parsed) return res.json({ ok: false, error });
  let existing = 0;
  for (const r of parsed.rows) {
    const hit = await Submission.exists({ submission_name: r.submission_name, submission_date: r.submission_date });
    (r as any).exists = !!hit;
    if (hit) existing++;
  }
  res.json({ ok: true, total: parsed.rows.length, existing, new: parsed.rows.length - existing, parse_errors: parsed.errors });
}

export async function importExcelSubmissions(req: Request, res: Response) {
  const up = excelUpload(req);
  if (!up.file) return res.json({ ok: false, error: up.error });
  const { parsed, error } = await parseUploaded(up.file);
  if (!parsed) return res.json({ ok: false, error });
  const { rows, errors } = parsed;
  let inserted = 0;
  let skipped = 0;
  const by = sessName(req);
  for (const r of rows) {
    const hit = await Submission.exists({ submission_name: r.submission_name, submission_date: r.submission_date });
    if (hit) {
      skipped++;
      continue;
    }
    try {
      await Submission.create(subInsertDoc(r, by));
      inserted++;
    } catch (e: any) {
      errors.push(`Row ${r.row}: ${e?.message || e}`);
    }
  }
  res.json({ ok: true, inserted, skipped, errors });
}

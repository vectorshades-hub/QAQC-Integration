import { Request, Response } from 'express';
import { MasterSet, MasterSetImage, MasterSetUpdate } from '../models';
import {
  OL_COL_MAP_IMPORT,
  OL_COL_MAP_PREVIEW,
  findOlHeader,
  loadWorkbook,
  olCell,
  rowValues,
} from '../services/excelImport';
import { ownershipTemplateWb } from '../services/excelExports';
import { activeCheckers, activeTeams, masterLists } from '../services/lists';
import { XLSX_MIME, extOf, filesOf } from '../utils/files';
import { action, contains, field, flash, qstr, toInt } from '../utils/http';
import { argInt } from '../utils/pyDates';

const collate = { locale: 'en' } as const;
const OL_PER_PAGE = 50;
const OL_SORT = new Set(['id', 'job_name', 'domain', 'client', 'qc_checker', 'ol_status', 'qc_done', 'done_by', 'ol_remarks']);
const isAdminReq = (req: Request) => (req.session as any)?.role === 'admin';
const sessName = (req: Request) => String((req.session as any)?.full_name ?? '');

const distinctNonEmpty = async (key: string): Promise<string[]> =>
  ((await MasterSet.distinct(key, { [key]: { $nin: ['', null] } })) as string[]).sort((a, b) => a.localeCompare(b, 'en'));

export async function ownershipLogPage(req: Request, res: Response) {
  const q = qstr(req, 'q').trim();
  const flt_domain = qstr(req, 'domain').trim();
  const flt_client = qstr(req, 'client').trim();
  const flt_status = qstr(req, 'status').trim();
  const flt_qc_done = qstr(req, 'qc_done').trim();
  const flt_team = qstr(req, 'team').trim();
  let sort_col = qstr(req, 'sort_col', 'id').trim();
  let sort_dir = qstr(req, 'sort_dir', 'desc').trim();
  if (!OL_SORT.has(sort_col)) sort_col = 'id';
  if (sort_dir !== 'asc' && sort_dir !== 'desc') sort_dir = 'desc';
  let page = Math.max(1, argInt(req.query.page, 1));

  const filter: any = {};
  if (q) {
    const rx = contains(q);
    filter.$or = ['job_name', 'client', 'qc_checker'].map((k) => ({ [k]: rx }));
  }
  if (flt_domain) filter.domain = flt_domain;
  if (flt_client) filter.client = flt_client;
  if (flt_status) filter.ol_status = flt_status;
  if (flt_qc_done) filter.qc_done = flt_qc_done;
  if (flt_team) filter.team = flt_team;

  const total = await MasterSet.countDocuments(filter);
  const total_pages = Math.max(1, Math.ceil(total / OL_PER_PAGE));
  page = Math.min(page, total_pages);
  const rows = await MasterSet.find(filter)
    .collation(collate)
    .sort({ [sort_col]: sort_dir === 'asc' ? 1 : -1 })
    .skip((page - 1) * OL_PER_PAGE)
    .limit(OL_PER_PAGE)
    .lean();

  const [, projects_list] = await masterLists();
  res.json({
    rows,
    q,
    flt_domain,
    flt_client,
    flt_status,
    flt_qc_done,
    flt_team,
    all_domains: await distinctNonEmpty('domain'),
    all_clients: await distinctNonEmpty('client'),
    all_statuses: await distinctNonEmpty('ol_status'),
    all_teams: (await activeTeams()).map((t) => t.name),
    all_projects: projects_list,
    checkers: (await activeCheckers()).map((u) => u.full_name),
    is_admin: isAdminReq(req),
    page,
    total_pages,
    total,
    per_page: OL_PER_PAGE,
    sort_col,
    sort_dir,
  });
}

export async function ownershipLogDetailPage(req: Request, res: Response) {
  const ms_id = toInt(req.params.ms_id)!;
  const rec = await MasterSet.findOne({ id: ms_id }).lean();
  if (!rec) return res.status(404).json({ error: 'Not found', flash: [flash('danger', 'Record not found.')], redirect: '/ownership-log' });
  const updates = await MasterSetUpdate.find({ ms_id }, 'id upd_date remark -_id').sort({ id: 1 }).lean();
  res.json({
    ms_id,
    rec,
    updates,
    teams: (await activeTeams()).map((t) => t.name),
    checkers: (await activeCheckers()).map((u) => u.full_name),
    all_domains: await distinctNonEmpty('domain'),
    all_clients: await distinctNonEmpty('client'),
    is_admin: isAdminReq(req),
  });
}

export async function editOwnershipLog(req: Request, res: Response) {
  const ms_id = toInt(req.params.ms_id);
  const set: any = {
    domain: field(req, 'domain'),
    ol_status: field(req, 'ol_status'),
    qc_done: field(req, 'qc_done'),
    done_by: field(req, 'done_by'),
    ol_remarks: field(req, 'ol_remarks'),
  };
  if (isAdminReq(req)) {
    set.client = field(req, 'client');
    set.qc_checker = field(req, 'qc_checker');
  }
  await MasterSet.updateOne({ id: ms_id }, { $set: set });
  return action(res, { flash: [flash('success', 'Ownership record updated.')], redirect: `/ownership-log/${ms_id}` });
}

export async function addOwnershipRecord(req: Request, res: Response) {
  const row: any = await MasterSet.create({
    job_name: field(req, 'job_name'),
    domain: field(req, 'domain'),
    client: field(req, 'client'),
    qc_checker: field(req, 'qc_checker'),
    team: field(req, 'team'),
    received_date: field(req, 'received_date'),
    working_days: field(req, 'working_days'),
    ol_status: field(req, 'ol_status'),
    qc_done: field(req, 'qc_done'),
    submitted_by: sessName(req),
  });
  return action(res, { flash: [flash('success', `Record #${row.id} created.`)], redirect: `/ownership-log/${row.id}` });
}

function olExcelUpload(req: Request): { file?: Express.Multer.File; error?: string } {
  const f = filesOf(req, 'excel_file')[0];
  if (!f || !f.originalname) return { error: 'No file provided' };
  const ext = extOf(f.originalname);
  if (ext !== 'xlsx' && ext !== 'xls') return { error: 'Only .xlsx or .xls files accepted' };
  return { file: f };
}

export async function importOlExcel(req: Request, res: Response) {
  const up = olExcelUpload(req);
  if (!up.file) return res.json({ ok: false, error: up.error });
  let ws;
  try {
    ws = await loadWorkbook(up.file);
  } catch (e: any) {
    return res.json({ ok: false, error: `Cannot read file: ${e?.message || e}` });
  }
  const { headerRow, colIdx } = findOlHeader(ws, OL_COL_MAP_IMPORT);
  if (headerRow === null || !('job_name' in colIdx)) {
    return res.json({
      ok: false,
      error: 'Could not find "Project Name" header. Make sure row 1 (or row 3 for the standard template) has the column headers.',
    });
  }
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];
  const by = sessName(req);
  for (let ri = headerRow + 1; ri <= ws.rowCount; ri++) {
    const row = rowValues(ws, ri);
    const job_name = olCell(row, colIdx, 'job_name');
    if (!job_name) {
      skipped++;
      continue;
    }
    try {
      await MasterSet.create({
        job_name,
        domain: olCell(row, colIdx, 'domain'),
        client: olCell(row, colIdx, 'client'),
        qc_checker: olCell(row, colIdx, 'qc_checker'),
        team: olCell(row, colIdx, 'team'),
        received_date: olCell(row, colIdx, 'received_date'),
        working_days: olCell(row, colIdx, 'working_days'),
        ol_status: olCell(row, colIdx, 'ol_status'),
        qc_done: olCell(row, colIdx, 'qc_done'),
        done_by: olCell(row, colIdx, 'done_by'),
        ol_remarks: olCell(row, colIdx, 'ol_remarks'),
        submitted_by: by,
      });
      inserted++;
    } catch (e: any) {
      errors.push(String(e?.message || e));
      skipped++;
    }
  }
  res.json({ ok: true, inserted, skipped, errors });
}

export async function apiOlQcDone(req: Request, res: Response) {
  if (!isAdminReq(req)) return res.status(403).json({ error: 'Forbidden' });
  const val = (req.body || {}).qc_done ?? '';
  if (!['Yes', 'No', 'Partial', ''].includes(val)) return res.status(400).json({ error: 'Invalid value' });
  await MasterSet.updateOne({ id: toInt(req.params.ms_id) }, { $set: { qc_done: val } });
  res.json({ ok: true });
}

export async function downloadOlTemplate(_req: Request, res: Response) {
  const buf = await ownershipTemplateWb().xlsx.writeBuffer();
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', 'attachment; filename="ownership_log_template.xlsx"');
  res.send(Buffer.from(buf as ArrayBuffer));
}

/** Parse Excel and return only rows whose job_name doesn't exist in master_sets. */
export async function previewNewOlRecords(req: Request, res: Response) {
  const up = olExcelUpload(req);
  if (!up.file) return res.json({ ok: false, error: up.error });
  let ws;
  try {
    ws = await loadWorkbook(up.file);
  } catch (e: any) {
    return res.json({ ok: false, error: `Cannot read file: ${e?.message || e}` });
  }
  const { headerRow, colIdx } = findOlHeader(ws, OL_COL_MAP_PREVIEW);
  if (headerRow === null || !('job_name' in colIdx)) return res.json({ ok: false, error: 'Could not find "Project Name" header.' });

  const existing = new Set<string>(((await MasterSet.distinct('job_name', { job_name: { $ne: null } })) as string[]).map(String));
  const new_records: any[] = [];
  let total_excel = 0;
  for (let ri = headerRow + 1; ri <= ws.rowCount; ri++) {
    const row = rowValues(ws, ri);
    const job_name = olCell(row, colIdx, 'job_name');
    if (!job_name) continue;
    total_excel++;
    if (existing.has(job_name)) continue;
    new_records.push({
      job_name,
      domain: olCell(row, colIdx, 'domain'),
      client: olCell(row, colIdx, 'client'),
      qc_checker: olCell(row, colIdx, 'qc_checker'),
      team: olCell(row, colIdx, 'team'),
      received_date: olCell(row, colIdx, 'received_date'),
      working_days: olCell(row, colIdx, 'working_days'),
      ol_status: olCell(row, colIdx, 'ol_status'),
      qc_done: olCell(row, colIdx, 'qc_done'),
      done_by: olCell(row, colIdx, 'done_by'),
      ol_remarks: olCell(row, colIdx, 'ol_remarks'),
    });
  }
  res.json({ ok: true, new_records, total_excel, existing_count: total_excel - new_records.length });
}

export async function deleteOlMultiple(req: Request, res: Response) {
  const ids: any[] = (req.body || {}).ids || [];
  if (!ids.length) return res.status(400).json({ ok: false, error: 'No IDs provided' });
  const safe_ids = ids.filter((i) => /^\d+$/.test(String(i))).map((i) => parseInt(String(i), 10));
  if (!safe_ids.length) return res.status(400).json({ ok: false, error: 'Invalid IDs' });
  // master_set_updates / images cascade with the parent row
  await MasterSetUpdate.deleteMany({ ms_id: { $in: safe_ids } });
  await MasterSetImage.deleteMany({ ms_id: { $in: safe_ids } });
  await MasterSet.deleteMany({ id: { $in: safe_ids } });
  res.json({ ok: true, deleted: safe_ids.length });
}

/** Insert one or more ownership-log records supplied as JSON. */
export async function addOlRecordsJson(req: Request, res: Response) {
  const records: any[] = (req.body || {}).records || [];
  if (!records.length) return res.json({ ok: false, error: 'No records provided' });
  const by = sessName(req);
  let inserted = 0;
  const errors: string[] = [];
  for (const rec of records) {
    const job_name = String(rec.job_name || '').trim();
    if (!job_name) continue;
    let wd: any = rec.working_days || null;
    if (wd) {
      const n = parseFloat(String(wd));
      wd = Number.isFinite(n) ? Math.trunc(n) : null;
    }
    try {
      await MasterSet.create({
        job_name,
        domain: rec.domain || '',
        client: rec.client || '',
        qc_checker: rec.qc_checker || '',
        team: rec.team || '',
        received_date: rec.received_date || null,
        working_days: wd !== null && wd !== undefined ? String(wd) : null,
        ol_status: rec.ol_status || '',
        qc_done: rec.qc_done || '',
        done_by: rec.done_by || '',
        ol_remarks: rec.ol_remarks || '',
        submitted_by: by,
      });
      inserted++;
    } catch (e: any) {
      errors.push(`${job_name}: ${e?.message || e}`);
    }
  }
  res.json({ ok: true, inserted, errors });
}

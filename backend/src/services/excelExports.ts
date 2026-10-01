/**
 * Excel workbook builders (ports of the openpyxl helpers in the original app.py).
 * Sheet names, headers, column widths, colours and freeze panes are kept identical.
 */
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { paths } from '../config/env';
import { DailyPlanEntry, MasterSet, MasterSetImage, MasterSetUpdate, User } from '../models';
import { imgDims, ensureDir } from '../utils/files';
import { fmtPyDateTime } from '../utils/pyDates';
import { sortByName } from './lists';

const argb = (hex: string) => 'FF' + hex.toUpperCase();
const fillOf = (hex: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: argb(hex) } });
const fontOf = (o: { name?: string; size?: number; bold?: boolean; color?: string; italic?: boolean }): Partial<ExcelJS.Font> => ({
  name: o.name,
  size: o.size,
  bold: o.bold,
  italic: o.italic,
  color: o.color ? { argb: argb(o.color) } : undefined,
});
const thin = (color: string): ExcelJS.Border => ({ style: 'thin', color: { argb: argb(color) } });
const boxThin = (color: string): Partial<ExcelJS.Borders> => ({ left: thin(color), right: thin(color), top: thin(color), bottom: thin(color) });

const str = (v: any) => (v === null || v === undefined ? '' : String(v));
/** Python str() of a value that may be a timestamp string / Date */
const tsStr = (v: any) => (v instanceof Date ? fmtPyDateTime(v) : str(v));

function header(ws: ExcelJS.Worksheet, hdrs: string[], widths: number[], opts: { font: Partial<ExcelJS.Font>; row?: number; border?: boolean; wrap?: boolean; fill?: string } ) {
  const row = opts.row ?? 1;
  hdrs.forEach((h, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = h;
    c.fill = fillOf(opts.fill || '1A1F3A');
    c.font = opts.font;
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: opts.wrap };
    if (opts.border) c.border = boxThin('D1D5DB');
    ws.getColumn(i + 1).width = widths[i];
  });
}

// ─── Submissions ──────────────────────────────────────────────────────────────
export function subsExcelWb(records: any[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Submissions');
  const bdr = boxThin('D1D5DB');
  header(ws, ['Sl No', 'Sub Name', 'Client', 'Received', 'Sub Date', 'QC Checker', 'Team', 'CP', 'E', 'D', 'Rating', 'Remark', 'Link'], [6, 28, 24, 14, 14, 14, 22, 11, 9, 9, 14, 28, 50], {
    font: fontOf({ bold: true, color: 'FFFFFF', name: 'Arial', size: 9 }),
    border: true,
    wrap: true,
  });
  ws.getRow(1).height = 28;
  const rc: Record<string, [string, string]> = { Good: ['D1FAE5', '065F46'], 'Above Average': ['DBEAFE', '1E40AF'], Average: ['FEF9C3', '854D0E'] };
  const rf = [fillOf('FFFFFF'), fillOf('F0F4FF')];
  const sorted = [...records].sort((a, b) => {
    const ka = [str(a.submission_date), str(a.id)];
    const kb = [str(b.submission_date), str(b.id)];
    return ka[0] < kb[0] ? -1 : ka[0] > kb[0] ? 1 : ka[1] < kb[1] ? -1 : ka[1] > kb[1] ? 1 : 0;
  });
  sorted.forEach((r, idx) => {
    const i = idx + 1;
    const ri = i + 1;
    const fill = rf[i % 2];
    const rat = str(r.rating);
    const [rb, rfg] = rc[rat] || ['FFFFFF', '374151'];
    const fo = str(r.main_folder);
    const sn = str(r.submission_name);
    const sep = fo.includes('/') ? '/' : '\\';
    const link = fo && sn ? fo.replace(/[\\/]+$/, '') + sep + sn : fo;
    const vals = [i, sn, str(r.client), str(r.received_date), str(r.submission_date), str(r.qc_checker), str(r.team), str(r.check_print), str(r.num_e_sheets), str(r.num_d_sheets), rat, str(r.remarks), link];
    vals.forEach((val, ci) => {
      const c = ws.getCell(ri, ci + 1);
      const col = ci + 1;
      c.value = val as any;
      c.border = bdr;
      c.font = fontOf({ name: 'Arial', size: 9 });
      if (col === 11 && rat) {
        c.fill = fillOf(rb);
        c.font = fontOf({ name: 'Arial', size: 9, bold: true, color: rfg });
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        c.fill = fill;
        c.alignment = { horizontal: [1, 8, 9, 10, 4, 5].includes(col) ? 'center' : 'left', vertical: 'middle' };
      }
    });
    ws.getRow(ri).height = 16;
  });
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1, topLeftCell: 'B2' }];
  return wb;
}

export async function saveWorkbook(wb: ExcelJS.Workbook, file: string): Promise<string> {
  ensureDir(path.dirname(file));
  await wb.xlsx.writeFile(file);
  return file;
}

// ─── Daily work plan (single day export) ──────────────────────────────────────
export async function dailyExcel(plan_date: string): Promise<ExcelJS.Workbook> {
  const entries: any[] = await DailyPlanEntry.find({ plan_date }).lean();
  entries.sort((a, b) => str(a.user_name).localeCompare(str(b.user_name), 'en') || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const users: any[] = await User.find({ is_active: true, role: { $ne: 'admin' } }, 'id full_name').lean();
  const usersSorted = sortByName(users, 'full_name');

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Daily ${plan_date}`);
  const thinB = boxThin('D1D5DB');
  const hfl = fillOf('1A1F3A');
  const hfn = fontOf({ bold: true, color: 'FFFFFF', name: 'Arial', size: 10 });
  ws.mergeCells('A1:I1');
  const t = ws.getCell('A1');
  t.value = `QAQC Daily Work Plan - ${plan_date}`;
  t.font = fontOf({ bold: true, color: 'FFFFFF', name: 'Arial', size: 13 });
  t.fill = hfl;
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;
  header(ws, ['Date', 'Member', 'Project/Task', 'Client', 'Sub Date', 'Rec Date', 'Submitted', 'Status', 'Notes'], [14, 16, 40, 22, 16, 16, 16, 14, 30], { font: hfn, row: 2, border: true });
  ws.getRow(2).height = 20;

  const emap: Record<string, any[]> = {};
  for (const e of entries) (emap[String(e.user_id)] ||= []).push(e);
  const ss: Record<string, [string, Partial<ExcelJS.Font>]> = {
    COMPLETED: ['D1FAE5', fontOf({ color: '065F46', name: 'Arial', size: 9, bold: true })],
    'IN PROGRESS': ['DBEAFE', fontOf({ color: '1E40AF', name: 'Arial', size: 9, bold: true })],
    LEAVE: ['FEE2E2', fontOf({ color: '991B1B', name: 'Arial', size: 9, bold: true })],
    TRAINING: ['FEF3C7', fontOf({ color: '92400E', name: 'Arial', size: 9, bold: true })],
  };
  const nf = fillOf('FAFAFA');
  let ri = 3;
  for (const u of usersSorted) {
    const ues = emap[String(u.id)] || [];
    if (!ues.length) {
      ws.getCell(ri, 2).value = u.full_name;
      ws.getCell(ri, 2).font = fontOf({ bold: true, name: 'Arial', size: 9 });
      for (let c = 1; c <= 9; c++) {
        ws.getCell(ri, c).border = thinB;
        ws.getCell(ri, c).fill = nf;
      }
      ws.getRow(ri).height = 18;
      ri++;
      continue;
    }
    const sr = ri;
    ues.forEach((e, ei) => {
      const st = str(e.status);
      const [sfillHex, sfont] = ss[st] || ['FAFAFA', fontOf({ name: 'Arial', size: 9 })];
      if (ei === 0) {
        ws.getCell(ri, 1).value = plan_date;
        ws.getCell(ri, 1).font = fontOf({ name: 'Arial', size: 9, color: '6B7280' });
        ws.getCell(ri, 2).value = u.full_name;
        ws.getCell(ri, 2).font = fontOf({ bold: true, name: 'Arial', size: 9 });
        ws.getCell(ri, 2).fill = fillOf('EFF6FF');
      }
      if (st === 'LEAVE' || st === 'TRAINING') {
        const c3 = ws.getCell(ri, 3);
        c3.value = st;
        c3.font = sfont;
        c3.fill = fillOf(sfillHex);
        c3.alignment = { horizontal: 'center' };
        ws.mergeCells(ri, 3, ri, 8);
      } else {
        const keys: [number, string][] = [[3, 'project_name'], [4, 'client_name'], [5, 'submission_date'], [6, 'received_date'], [7, 'submitted_date']];
        for (const [c, key] of keys) {
          ws.getCell(ri, c).value = str(e[key]);
          ws.getCell(ri, c).font = fontOf({ name: 'Arial', size: 9 });
        }
        const c8 = ws.getCell(ri, 8);
        c8.value = st;
        c8.font = sfont;
        c8.fill = fillOf(sfillHex);
        c8.alignment = { horizontal: 'center' };
      }
      ws.getCell(ri, 9).value = str(e.notes);
      ws.getCell(ri, 9).font = fontOf({ name: 'Arial', size: 9 });
      for (let c = 1; c <= 9; c++) ws.getCell(ri, c).border = thinB;
      ws.getRow(ri).height = 20;
      ri++;
    });
    if (ues.length > 1) {
      for (const col of [1, 2]) {
        ws.mergeCells(sr, col, ri - 1, col);
        ws.getCell(sr, col).alignment = { horizontal: 'center', vertical: 'middle' };
      }
    }
  }
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 2, topLeftCell: 'C3' }];
  return wb;
}

// ─── Work plans ───────────────────────────────────────────────────────────────
export function wpExcelWb(records: any[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('WorkPlans');
  header(ws, ['ID', 'Team', 'Date', 'Project', 'Confirmed', 'Notes', 'Created'], [6, 26, 12, 50, 10, 30, 18], { font: fontOf({ bold: true, color: 'FFFFFF', name: 'Arial', size: 9 }) });
  records.forEach((r, i) => {
    const ri = i + 2;
    const conf = r.date_confirmed === 'confirmed';
    const vals = [r.id, r.team_name, str(r.plan_date), r.project_name, conf ? 'Yes' : 'No', r.notes, tsStr(r.created_at).slice(0, 16)];
    vals.forEach((val, ci) => {
      const c = ws.getCell(ri, ci + 1);
      c.value = val as any;
      c.font = fontOf({ name: 'Arial', size: 9 });
      if (ci + 1 === 4) c.fill = fillOf(conf ? 'E8F4FD' : 'FCE8E8');
    });
  });
  ws.views = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2' }];
  return wb;
}

// ─── Daily plan entries (backup) ──────────────────────────────────────────────
export function dpExportWb(entries: any[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('DailyPlanEntries');
  header(ws, ['Date', 'User', 'Project', 'Client', 'Sub Date', 'Rec Date', 'Submitted', 'Status', 'Notes'], [12, 16, 45, 24, 14, 14, 16, 14, 30], { font: fontOf({ bold: true, color: 'FFFFFF', name: 'Arial', size: 9 }) });
  const sc: Record<string, [string, string]> = { COMPLETED: ['D1FAE5', '065F46'], 'IN PROGRESS': ['DBEAFE', '1E40AF'], LEAVE: ['FEE2E2', '991B1B'], TRAINING: ['FEF3C7', '92400E'] };
  entries.forEach((e, i) => {
    const ri = i + 2;
    const st = str(e.status);
    const [bg, fg] = sc[st] || ['FFFFFF', '374151'];
    const vals = [str(e.plan_date), e.user_name, e.project_name, e.client_name, e.submission_date, e.received_date, e.submitted_date, st, e.notes];
    vals.forEach((val, ci) => {
      const c = ws.getCell(ri, ci + 1);
      c.value = (val === undefined ? null : val) as any;
      c.font = fontOf({ name: 'Arial', size: 9, bold: ci + 1 === 8, color: ci + 1 === 8 ? fg : '374151' });
      if (ci + 1 === 8) c.fill = fillOf(bg);
    });
  });
  ws.views = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2' }];
  return wb;
}

// ─── Master sets list (kept for parity; the original helper was defined but not routed) ───
export function msListExcelWb(records: any[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('MasterSets');
  header(ws, ['ID', 'Job Name', 'Fabricator', 'Client', 'Received', 'Working Days', 'Team', 'QC Checker', 'Submitted By', 'Created'], [6, 40, 20, 24, 14, 12, 22, 16, 16, 16], { font: fontOf({ bold: true, color: 'FFFFFF', name: 'Arial', size: 9 }) });
  const rf = [fillOf('FFFFFF'), fillOf('F0F4FF')];
  records.forEach((r, i) => {
    const ri = i + 2;
    const vals = [r.id, r.job_name, r.fabricator, r.client, r.received_date, r.working_days, r.team, r.qc_checker, r.submitted_by, tsStr(r.created_at).slice(0, 10)];
    vals.forEach((val, ci) => {
      const c = ws.getCell(ri, ci + 1);
      c.value = val as any;
      c.fill = rf[ri % 2];
      c.font = fontOf({ name: 'Arial', size: 9 });
    });
  });
  ws.views = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2' }];
  return wb;
}

// ─── Leave calendar (backup) ──────────────────────────────────────────────────
export function leaveCalExcelWb(entries: any[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('LeaveCalendar');
  header(ws, ['Date', 'User', 'Status', 'Notes'], [14, 22, 16, 40], { font: fontOf({ bold: true, color: 'FFFFFF', name: 'Arial', size: 9 }) });
  const sc: Record<string, [string, string]> = { LEAVE: ['FEE2E2', '991B1B'], TRAINING: ['FEF3C7', '92400E'], HALF_DAY_AM: ['E0F2FE', '0369A1'], HALF_DAY_PM: ['F0FDF4', '166534'] };
  entries.forEach((e, i) => {
    const ri = i + 2;
    const st = str(e.status);
    const [bg, fg] = sc[st] || ['FFFFFF', '374151'];
    const vals = [str(e.plan_date), str(e.user_name), st, str(e.notes)];
    vals.forEach((val, ci) => {
      const c = ws.getCell(ri, ci + 1);
      const col = ci + 1;
      c.value = val;
      c.font = fontOf({ name: 'Arial', size: 9, bold: col === 3, color: col === 3 ? fg : '374151' });
      if (col === 3) c.fill = fillOf(bg);
      c.alignment = { horizontal: col === 1 || col === 3 ? 'center' : 'left', vertical: 'middle' };
    });
  });
  ws.views = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2' }];
  return wb;
}

// ─── Users export ─────────────────────────────────────────────────────────────
export function usersExcelWb(users: any[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Users');
  const headers = ['full_name', 'email', 'password', 'role', 'team', 'birthday', 'is_active'];
  const widths = [24, 28, 16, 12, 20, 14, 10];
  // Row 1 = instruction note, row 2 = headers, rows 3.. = data (same final layout as the original)
  header(ws, headers, widths, { font: fontOf({ bold: true, color: 'FFFFFF', size: 10 }), row: 2 });
  const alt = fillOf('F0F4FF');
  users.forEach((u, idx) => {
    const origRi = idx + 2; // row index before the note row was inserted
    const bd = u.birthday ? String(u.birthday).slice(0, 10) : '';
    const vals = [u.full_name, u.email || '', '', u.role, u.team || '', bd, u.is_active ? 'TRUE' : 'FALSE'];
    vals.forEach((v, ci) => {
      const c = ws.getCell(origRi + 1, ci + 1);
      c.value = v;
      if (origRi % 2 === 0) c.fill = alt;
    });
  });
  ws.mergeCells(1, 1, 1, headers.length);
  const note = ws.getCell(1, 1);
  note.value = 'Leave password blank to keep existing password (updates). Password required for new users. is_active: TRUE or FALSE.';
  note.font = fontOf({ italic: true, color: '6B7280', size: 9 });
  ws.getRow(1).height = 18;
  ws.getRow(2).height = 20;
  return wb;
}

export function ownershipTemplateWb(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Ownership Log');
  const headers = ['Project Name', 'Domain', 'Client', 'QC Checker', 'Team', 'Received Date', 'Working Days', 'Status', 'QC Done', 'Done By', 'Remarks'];
  headers.forEach((h, i) => {
    const c = ws.getCell(1, i + 1);
    c.value = h;
    c.fill = fillOf('1A1F3A');
    c.font = fontOf({ bold: true, color: 'FFFFFF', size: 10 });
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getColumn(i + 1).width = Math.max(h.length + 4, 16);
  });
  ws.getRow(1).height = 20;
  return wb;
}

// ─── Single master set export (with images) ───────────────────────────────────
export async function msExcel(ms_id: number): Promise<string | null> {
  const rec: any = await MasterSet.findOne({ id: ms_id }).lean();
  if (!rec) return null;
  const upds: any[] = await MasterSetUpdate.find({ ms_id }).sort({ id: 1 }).lean();
  const imgs: any[] = await MasterSetImage.find({ ms_id }).lean();
  imgs.sort((a, b) => str(a.side).localeCompare(str(b.side)) || (a.sort_order || 0) - (b.sort_order || 0) || a.id - b.id);
  const left = imgs.filter((i) => i.side === 'left').map((i) => i.path as string);
  const isoImg = imgs.find((i) => i.side === 'iso');
  const iso: string | null = isoImg ? isoImg.path : null;
  const safe = Array.from(str(rec.job_name)).map((c) => (/[A-Za-z0-9 _-]/.test(c) || /\p{L}|\p{N}/u.test(c) ? c : '_')).join('').slice(0, 50);
  const fp = path.join(paths.MS_DIR, `MS_${safe}_${ms_id}.xlsx`);
  ensureDir(path.dirname(fp));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Master Set');
  const T: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: argb('000000') } };
  const TK: Partial<ExcelJS.Border> = { style: 'medium', color: { argb: argb('000000') } };
  const S = (o: { t?: any; r?: any; b?: any; l?: any } = {}): Partial<ExcelJS.Borders> => ({ top: o.t, right: o.r, bottom: o.b, left: o.l });
  const C = (row: number, col: number, value: any = '', o: { bold?: boolean; size?: number; rgb?: string; h?: any; v?: any; fill?: string; wrap?: boolean; bdr?: Partial<ExcelJS.Borders>; italic?: boolean } = {}) => {
    const cell = ws.getCell(row, col);
    cell.value = value;
    cell.font = fontOf({ name: 'Calibri', size: o.size ?? 10, bold: !!o.bold, color: o.rgb ?? '000000', italic: !!o.italic });
    cell.alignment = { horizontal: o.h ?? 'left', vertical: o.v ?? 'middle', wrapText: !!o.wrap };
    if (o.fill) cell.fill = fillOf(o.fill);
    if (o.bdr) cell.border = o.bdr;
    return cell;
  };
  const M = (r1: number, c1: number, r2: number, c2: number) => ws.mergeCells(r1, c1, r2, c2);
  [1.5, 18, 8, 32, 18, 3, 12, 12, 12, 12, 12, 12, 12, 12].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const title = rec.fabricator ? `${rec.job_name || ''}_${rec.fabricator}` : rec.job_name || '';
  M(1, 1, 1, 5);
  C(1, 1, title, { bold: true, size: 13, rgb: '1A3A8C', h: 'center', v: 'middle', bdr: S({ t: TK, r: TK, l: TK }) });
  ws.getRow(1).height = 24;
  const row2 = `JOB RECEIVED ON  ${rec.received_date || ''}          working days PROJECT          ${rec.working_days || ''}`;
  M(2, 1, 2, 5);
  C(2, 1, row2, { bold: true, size: 10, rgb: '1A3A8C', h: 'center', v: 'middle', bdr: S({ t: T, r: TK, b: T, l: TK }) });
  ws.getRow(2).height = 20;
  for (const rr of [3, 4]) {
    M(rr, 1, rr, 5);
    C(rr, 1, '', { bdr: S({ l: TK, r: TK }) });
    ws.getRow(rr).height = 5;
  }
  C(5, 1, '', { bdr: S({ l: TK }) });
  C(5, 2, 'Date', { bold: true, size: 10, h: 'center', bdr: S({ t: TK, r: T, b: TK, l: TK }) });
  C(5, 3, '', { bdr: S({ t: TK, r: T, b: TK, l: T }) });
  M(5, 4, 5, 5);
  C(5, 4, 'Remark', { bold: true, size: 10, rgb: '0000FF', h: 'center', bdr: S({ t: TK, r: TK, b: TK, l: T }) });
  ws.getRow(5).height = 20;
  const nr = Math.max(8, upds.length + 2);
  const lr = 5 + nr;
  for (let i = 0; i < nr; i++) {
    const row = 6 + i;
    const u = i < upds.length ? upds[i] : {};
    const bb = row === lr ? TK : undefined;
    C(row, 1, '', { bdr: S({ l: TK, b: bb }) });
    C(row, 2, u.upd_date || '', { size: 9, h: 'center', bdr: S({ r: T, b: bb, l: TK }) });
    C(row, 3, '', { size: 10, bdr: S({ r: T, b: bb, l: T }) });
    M(row, 4, row, 5);
    C(row, 4, u.remark || '', { size: 9, h: 'left', wrap: true, bdr: S({ r: TK, b: bb, l: T }) });
    ws.getRow(row).height = 17;
  }
  const es = lr + 2;
  ws.getRow(es - 1).height = 6;
  const lines: string[] = rec.email_body ? String(rec.email_body).split('\n') : [];
  const n = lines.length;
  M(es - 1, 1, es - 1, 5);
  C(es - 1, 1, '', { bdr: S({ l: TK, r: TK }) });
  lines.forEach((line, li) => {
    const r = es + li;
    M(r, 1, r, 5);
    C(r, 1, line, { size: 9, h: 'left', v: 'top', wrap: true, bdr: S({ t: li === 0 ? TK : undefined, r: TK, b: li === n - 1 ? TK : undefined, l: TK }) });
    ws.getRow(r).height = 14;
  });
  let ee: number;
  if (!lines.length) {
    M(es, 1, es, 5);
    C(es, 1, '', { bdr: S({ t: TK, r: TK, b: TK, l: TK }) });
    ws.getRow(es).height = 14;
    ee = es;
  } else ee = es + n - 1;
  let cur = ee + 2;
  const imgExt = (p: string): 'png' | 'jpeg' | 'gif' => {
    const e = path.extname(p).toLowerCase();
    return e === '.png' ? 'png' : e === '.gif' ? 'gif' : 'jpeg';
  };
  if (left.length) {
    C(cur, 1, 'Attachments', { bold: true, size: 9, rgb: '374151' });
    ws.getRow(cur).height = 14;
    cur += 1;
    for (const ip of left) {
      if (ip && fs.existsSync(ip) && fs.statSync(ip).isFile()) {
        const [ow, oh] = imgDims(ip);
        const sc = Math.min(520 / ow, 300 / oh, 1.0);
        try {
          const id = wb.addImage({ buffer: fs.readFileSync(ip) as any, extension: imgExt(ip) });
          const w = Math.floor(ow * sc);
          const h = Math.floor(oh * sc);
          ws.addImage(id, { tl: { col: 0, row: cur - 1 }, ext: { width: w, height: h } });
          const rn = Math.max(14, Math.floor(h / 15) + 1);
          for (let rr = cur; rr < cur + rn; rr++) ws.getRow(rr).height = 15;
          cur += rn + 1;
        } catch {
          M(cur, 1, cur, 5);
          C(cur, 1, `[${path.basename(ip)}]`, { size: 8, rgb: '9CA3AF', italic: true });
          ws.getRow(cur).height = 13;
          cur += 2;
        }
      }
    }
  }
  const IL = 7, IR = 14, IT = 1, IB = 20;
  ws.getRow(IT).height = 22;
  for (let rr = IT + 1; rr <= IB; rr++) ws.getRow(rr).height = 16;
  M(IT, IL, IT, IR);
  const lbl = ws.getCell(IT, IL);
  lbl.value = 'ISO VIEW';
  lbl.font = fontOf({ name: 'Calibri', size: 11, bold: true, color: 'FF0000' });
  lbl.alignment = { horizontal: 'center', vertical: 'middle' };
  M(IT + 1, IL, IB, IR);
  ws.getCell(IT + 1, IL).fill = fillOf('EFEFEF');
  for (let r = IT; r <= IB; r++) {
    for (let c = IL; c <= IR; c++) {
      ws.getCell(r, c).border = S({ l: c === IL ? TK : undefined, r: c === IR ? TK : undefined, t: r === IT ? TK : r === IT + 1 ? T : undefined, b: r === IB ? TK : undefined });
    }
  }
  if (iso && fs.existsSync(iso) && fs.statSync(iso).isFile()) {
    const [ow, oh] = imgDims(iso);
    const sc = Math.min(((IR - IL) * 72) / ow, ((IB - IT) * 14) / oh, 1.0);
    try {
      const id = wb.addImage({ buffer: fs.readFileSync(iso) as any, extension: imgExt(iso) });
      ws.addImage(id, { tl: { col: IL - 1, row: IT }, ext: { width: Math.floor(ow * sc), height: Math.floor(oh * sc) } });
    } catch {
      /* ignore */
    }
  }
  const tr = IB + 1;
  M(tr, IL, tr, IR);
  C(tr, IL, `Team: ${rec.team || ''}`, { bold: true, size: 9, rgb: '1A1F3A', h: 'left' });
  ws.getRow(tr).height = 16;
  await wb.xlsx.writeFile(fp);
  return fp;
}

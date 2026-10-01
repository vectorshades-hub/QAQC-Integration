/**
 * Reading uploaded .xlsx files (ports of the openpyxl parsing in the original app.py).
 * `data_only=True` semantics: formula cells yield their cached result.
 */
import ExcelJS from 'exceljs';
import fs from 'fs';

/** Plain value of an ExcelJS cell (formula -> cached result, rich text -> text, hyperlink -> text). */
export function plain(v: any): any {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in v) return plain(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((r: any) => r.text).join('');
    if ('text' in v) return plain(v.text);
    if ('error' in v) return null;
    return String(v);
  }
  return v;
}

const p2 = (n: number) => String(n).padStart(2, '0');
const pad = p2;

/** Python str() for a cell value (datetime -> 'YYYY-MM-DD HH:MM:SS') */
export function pyStr(v: any): string {
  if (v instanceof Date) {
    const base = `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())} ${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}:${pad(v.getUTCSeconds())}`;
    return base;
  }
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  return String(v);
}

/** `v or ''` in Python: falsy (None, '', 0, False) -> '' */
const orEmpty = (v: any): any => (v === null || v === undefined || v === '' || v === 0 || v === false ? '' : v);

export async function loadWorkbook(file: Express.Multer.File): Promise<ExcelJS.Worksheet> {
  const wb = new ExcelJS.Workbook();
  const buf = fs.readFileSync(file.path);
  await wb.xlsx.load(buf as any);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('Workbook has no worksheets');
  return ws;
}

/** All values of a row as an array (index 0 == column A), length == ws.columnCount */
export function rowValues(ws: ExcelJS.Worksheet, rowNumber: number): any[] {
  const out: any[] = [];
  const cols = ws.columnCount;
  const row = ws.getRow(rowNumber);
  for (let c = 1; c <= cols; c++) out.push(plain(row.getCell(c).value));
  return out;
}

// ─── Submission log Excel ─────────────────────────────────────────────────────
const SUB_ALIASES: Record<string, string[]> = {
  submission_name: ['submission name', 'sub name'],
  client: ['client'],
  received_date: ['received date', 'received'],
  submission_date: ['submission date', 'sub date'],
  qc_checker: ['qc checker', 'checker'],
  team: ['team name', 'team'],
  check_print: ['check print', 'cp'],
  num_e_sheets: ['e sheet qty', 'e sheets', 'e'],
  num_d_sheets: ['d sheet qty', 'd sheets', 'd'],
  rating: ['rating'],
  remarks: ['remark', 'remarks'],
  main_folder: ['link'],
};

function normDate(v: any): string {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return s;
}

export type SubRow = {
  row: number;
  submission_name: string;
  received_date: string;
  submission_date: string;
  qc_checker: string;
  team: string;
  client: string;
  rating: string;
  num_e_sheets: string;
  num_d_sheets: string;
  check_print: string;
  remarks: string;
  main_folder: string;
};

export function parseSubmissionRows(ws: ExcelJS.Worksheet): { rows: SubRow[]; errors: string[] } {
  const header = rowValues(ws, 1).map((v) => String(orEmpty(v)).trim().toLowerCase());
  const colIdx: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(SUB_ALIASES)) {
    for (const alias of aliases) {
      const i = header.indexOf(alias);
      if (i >= 0) {
        colIdx[field] = i;
        break;
      }
    }
  }
  const cv = (row: any[], field: string) => {
    const i = colIdx[field];
    const v = i !== undefined && i < row.length ? row[i] : null;
    return v !== null && v !== undefined ? v : '';
  };
  const S = (row: any[], f: string) => {
    const v = orEmpty(cv(row, f));
    return (v instanceof Date ? pyStr(v) : String(v)).trim();
  };

  const rows: SubRow[] = [];
  const errors: string[] = [];
  const last = ws.rowCount;
  for (let ri = 2; ri <= last; ri++) {
    const row = rowValues(ws, ri);
    const anyVal = row.some((v) => v !== null && v !== undefined && String(v).trim() !== '' && orEmpty(v) !== '');
    if (!anyVal) continue;
    const sn = S(row, 'submission_name');
    if (!sn) {
      errors.push(`Row ${ri}: missing Submission Name — skipped`);
      continue;
    }
    const cp = S(row, 'check_print').toLowerCase();
    rows.push({
      row: ri,
      submission_name: sn,
      received_date: normDate(cv(row, 'received_date')),
      submission_date: normDate(cv(row, 'submission_date')),
      qc_checker: S(row, 'qc_checker'),
      team: S(row, 'team'),
      client: S(row, 'client'),
      rating: S(row, 'rating'),
      num_e_sheets: S(row, 'num_e_sheets'),
      num_d_sheets: S(row, 'num_d_sheets'),
      check_print: ['true', 'yes', '1', 'y'].includes(cp) ? 'True' : 'False',
      remarks: S(row, 'remarks'),
      main_folder: S(row, 'main_folder'),
    });
  }
  return { rows, errors };
}

// ─── Ownership log Excel ──────────────────────────────────────────────────────
const OL_KEYS = ['job_name', 'domain', 'client', 'qc_checker', 'team', 'received_date', 'working_days', 'ol_status', 'qc_done', 'done_by', 'ol_remarks'] as const;
export type OlKey = (typeof OL_KEYS)[number];

/** import-excel maps "done by" columns onto `team` (quirk of the original); preview maps them to `done_by`. */
export const OL_COL_MAP_IMPORT: Record<string, string> = {
  'project name': 'job_name',
  domain: 'domain',
  client: 'client',
  qc: 'qc_checker',
  'qc checker': 'qc_checker',
  team: 'team',
  'received date': 'received_date',
  'working days': 'working_days',
  status: 'ol_status',
  'qc done': 'qc_done',
  'qc done?': 'qc_done',
  'done by': 'team',
  'done by (qc)': 'team',
  done_by: 'team',
  remarks: 'ol_remarks',
};

export const OL_COL_MAP_PREVIEW: Record<string, string> = {
  'project name': 'job_name',
  domain: 'domain',
  client: 'client',
  qc: 'qc_checker',
  'qc checker': 'qc_checker',
  team: 'team',
  'received date': 'received_date',
  'working days': 'working_days',
  status: 'ol_status',
  'qc done': 'qc_done',
  'qc done?': 'qc_done',
  'done by': 'done_by',
  'done by (qc)': 'done_by',
  done_by: 'done_by',
  remarks: 'ol_remarks',
};

/** Scan the first 10 rows for a header row; returns header row number and column index map (0-based) */
export function findOlHeader(ws: ExcelJS.Worksheet, colMap: Record<string, string>): { headerRow: number | null; colIdx: Record<string, number> } {
  const maxRow = Math.min(10, ws.rowCount);
  for (let ri = 1; ri <= maxRow; ri++) {
    const cells = rowValues(ws, ri).map((v) => String(orEmpty(v)).trim().toLowerCase());
    if (cells.some((v) => v in colMap)) {
      const colIdx: Record<string, number> = {};
      cells.forEach((v, ci) => {
        if (v in colMap) colIdx[colMap[v]] = ci;
      });
      return { headerRow: ri, colIdx };
    }
  }
  return { headerRow: null, colIdx: {} };
}

/** cell_val(): str(v).strip() if v is not None else '' */
export function olCell(row: any[], colIdx: Record<string, number>, key: string): string {
  const i = colIdx[key];
  if (i === undefined) return '';
  const v = row[i];
  return v !== null && v !== undefined ? pyStr(v).trim() : '';
}

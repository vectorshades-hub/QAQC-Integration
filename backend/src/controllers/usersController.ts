import crypto from 'crypto';
import { Request, Response } from 'express';
import { DailyPlanEntry, Team, User, UserWpTheme, WorkPlan, WorkPlanUserAssignment } from '../models';
import { loadWorkbook, plain } from '../services/excelImport';
import { usersExcelWb } from '../services/excelExports';
import { activeTeams } from '../services/lists';
import { preparePasswordForStorage } from '../services/passwords';
import { XLSX_MIME, filesOf } from '../utils/files';
import { action, contains, equalsCI, field, flash, qstr, toInt } from '../utils/http';
import { argInt, fmtDate } from '../utils/pyDates';

const collate = { locale: 'en' } as const;
const sessUid = (req: Request) => String((req.session as any)?.user_id ?? '');

const USER_PUBLIC_FIELDS = 'id full_name email role team is_active created_at -_id';

export async function apiUsers(req: Request, res: Response) {
  const page = argInt(req.query.page, 1);
  const per = argInt(req.query.per_page, 500);
  const q = qstr(req, 'q').trim();
  const role = qstr(req, 'role');
  const status = qstr(req, 'status');
  const filter: any = {};
  if (q) {
    const rx = contains(q);
    filter.full_name = rx;
  }
  if (role) filter.role = role;
  if (status === 'active') filter.is_active = true;
  else if (status === 'inactive') filter.is_active = false;
  const total = await User.countDocuments(filter);
  const pages = total ? Math.ceil(total / per) : 1;
  const items = await User.find(filter, USER_PUBLIC_FIELDS).sort({ id: 1 }).skip((page - 1) * per).limit(per).lean();
  res.json({ items, total, page, pages });
}

export async function addUserPage(_req: Request, res: Response) {
  res.json({ teams: (await activeTeams()).map((t) => t.name) });
}

export async function addUserAction(req: Request, res: Response) {
  const fn = field(req, 'full_name').trim();
  const em = field(req, 'email').trim();
  const pw = field(req, 'password').trim();
  const ro = field(req, 'role', 'user');
  const tm = field(req, 'team').trim();
  const bd = field(req, 'birthday').trim() || null;
  if (!fn) return action(res, { ok: false, flash: [flash('danger', 'Full name is required.')] });
  // Only full name is required: a member without a password gets an unusable random one (can't log in until one is set).
  const password = pw || crypto.randomBytes(12).toString('hex');
  if (await User.exists({ full_name: equalsCI(fn) })) return action(res, { ok: false, flash: [flash('danger', 'A user with this full name already exists.')] });
  if (em && (await User.exists({ email: em }))) return action(res, { ok: false, flash: [flash('danger', 'Email already exists.')] });
  await User.create({ full_name: fn, email: em, password: preparePasswordForStorage(password), role: ro, team: tm, birthday: bd });
  return action(res, { flash: [flash('success', `${fn} created.`)], redirect: '/users' });
}

export async function editUserPage(req: Request, res: Response) {
  const user = await User.findOne({ id: toInt(req.params.uid) }, 'id full_name email role team is_active birthday created_at -_id').lean();
  if (!user) return res.status(404).json({ error: 'Not found', flash: [flash('danger', 'Not found.')], redirect: '/users' });
  res.json({ user, teams: (await activeTeams()).map((t) => t.name) });
}

export async function editUserAction(req: Request, res: Response) {
  const uid = toInt(req.params.uid);
  if (!(await User.exists({ id: uid }))) return action(res, { ok: false, flash: [flash('danger', 'Not found.')], redirect: '/users' });
  const newName = field(req, 'full_name').trim();
  if (!newName) return action(res, { ok: false, flash: [flash('danger', 'Full name is required.')] });
  if (await User.exists({ full_name: equalsCI(newName), id: { $ne: uid } })) return action(res, { ok: false, flash: [flash('danger', 'A user with this full name already exists.')] });
  const ia = !!field(req, 'is_active');
  const pw = field(req, 'password').trim();
  const bd = field(req, 'birthday').trim() || null;
  const set: any = {
    full_name: newName,
    email: field(req, 'email'),
    role: field(req, 'role', 'user'),
    team: field(req, 'team'),
    is_active: ia,
    birthday: bd,
  };
  if (pw) set.password = preparePasswordForStorage(pw);
  await User.updateOne({ id: uid }, { $set: set });
  return action(res, { flash: [flash('success', 'Updated.')], redirect: '/users' });
}

export async function deleteUserAction(req: Request, res: Response) {
  const uid = toInt(req.params.uid);
  if (String(uid) === sessUid(req)) return action(res, { ok: false, flash: [flash('danger', "Can't deactivate yourself.")], redirect: '/users' });
  await User.updateOne({ id: uid }, { $set: { is_active: false } });
  return action(res, { flash: [flash('success', 'Deactivated.')], redirect: '/users' });
}

/** Remove a user row with the same referential effects as the SQL foreign keys. */
async function removeUserRow(uid: number | null) {
  await DailyPlanEntry.updateMany({ user_id: uid }, { $set: { user_id: null } }); // ON DELETE SET NULL
  await WorkPlanUserAssignment.deleteMany({ user_id: uid }); // ON DELETE CASCADE
  await UserWpTheme.deleteMany({ user_id: uid }); // ON DELETE CASCADE
  await User.deleteOne({ id: uid });
}

export async function hardDeleteUserAction(req: Request, res: Response) {
  const uid = toInt(req.params.uid);
  if (String(uid) === sessUid(req)) return action(res, { ok: false, flash: [flash('danger', "Can't delete yourself.")], redirect: '/users' });
  await removeUserRow(uid);
  return action(res, { flash: [flash('success', 'Permanently deleted.')], redirect: '/users' });
}

export async function restoreUserAction(req: Request, res: Response) {
  await User.updateOne({ id: toInt(req.params.uid) }, { $set: { is_active: true } });
  return action(res, { flash: [flash('success', 'Restored.')], redirect: '/users' });
}

export async function exportUsersExcel(_req: Request, res: Response) {
  const users = await User.find({}, 'full_name email role team is_active birthday').sort({ id: 1 }).lean();
  const buf = await usersExcelWb(users).xlsx.writeBuffer();
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', 'attachment; filename="users_export.xlsx"');
  res.send(Buffer.from(buf as ArrayBuffer));
}

export async function bulkImportUsers(req: Request, res: Response) {
  const f = filesOf(req, 'file')[0];
  if (!f || !f.originalname.endsWith('.xlsx')) return res.status(400).json({ ok: false, error: 'Please upload a valid .xlsx file' });
  let ws;
  try {
    ws = await loadWorkbook(f);
  } catch (e: any) {
    return res.status(400).json({ ok: false, error: `Could not read file: ${e?.message || e}` });
  }
  const rows: any[][] = [];
  const cols = ws.columnCount;
  for (let r = 1; r <= ws.rowCount; r++) {
    const row: any[] = [];
    for (let c = 1; c <= cols; c++) row.push(plain(ws.getRow(r).getCell(c).value));
    rows.push(row);
  }
  // Find header row (skip instruction row if present)
  let header_row: string[] | null = null;
  let header_idx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] && rows[i][0] === 'full_name') {
      header_row = rows[i].map((c) => (c ? String(c).trim().toLowerCase() : ''));
      header_idx = i;
      break;
    }
  }
  if (!header_row) return res.status(400).json({ ok: false, error: 'Header row with "full_name" not found' });

  const col = (row: any[], name: string): string => {
    const idx = header_row!.indexOf(name);
    if (idx < 0 || idx >= row.length) return '';
    const v = row[idx];
    return v !== null && v !== undefined ? String(v).trim() : '';
  };

  let added = 0, updated = 0, skipped = 0;
  const errors: string[] = [];
  for (let k = header_idx + 1; k < rows.length; k++) {
    const row = rows[k];
    const row_num = k + 1;
    if (!row.some((v) => v)) continue;
    const full_name = col(row, 'full_name');
    const email = col(row, 'email');
    const password = col(row, 'password');
    let role = col(row, 'role') || 'user';
    const team = col(row, 'team');
    const is_active = col(row, 'is_active').toUpperCase() !== 'FALSE';
    if (!full_name) {
      skipped++;
      continue;
    }
    if (!['user', 'management', 'admin'].includes(role)) role = 'user';

    // Parse birthday - Excel date cells arrive as Date objects
    let bd_val: string | null = null;
    const bdIdx = header_row.indexOf('birthday');
    const raw_bd = bdIdx >= 0 && bdIdx < row.length ? row[bdIdx] : null;
    if (raw_bd !== null && raw_bd !== undefined) {
      if (raw_bd instanceof Date) bd_val = fmtDate(new Date(raw_bd.getUTCFullYear(), raw_bd.getUTCMonth(), raw_bd.getUTCDate(), 12));
      else {
        const s = String(raw_bd).trim();
        let m: RegExpMatchArray | null;
        if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) bd_val = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
        else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
          // '%d/%m/%Y' is tried before '%m/%d/%Y'
          const a = +m[1], b = +m[2];
          if (b >= 1 && b <= 12 && a >= 1 && a <= 31) bd_val = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
          else if (a >= 1 && a <= 12 && b >= 1 && b <= 31) bd_val = `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
        } else if ((m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/))) bd_val = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      }
    }

    const existing: any = await User.findOne({ full_name: equalsCI(full_name) }, 'id').lean();
    if (existing) {
      const set: any = { email, role, team, is_active, birthday: bd_val };
      if (password) set.password = preparePasswordForStorage(password);
      await User.updateOne({ id: existing.id }, { $set: set });
      updated++;
    } else {
      if (email && (await User.exists({ email }))) {
        errors.push(`Row ${row_num}: email "${email}" already in use`);
        continue;
      }
      await User.create({ full_name, email, password: preparePasswordForStorage(password || crypto.randomBytes(12).toString('hex')), role, team, birthday: bd_val, is_active });
      added++;
    }
  }
  res.json({ ok: true, added, updated, skipped, errors });
}

export async function userWpTheme(req: Request, res: Response) {
  const uid = toInt(req.params.uid);
  if (!(await User.exists({ id: uid }))) return res.status(404).json({ ok: false, error: 'User not found' });
  if (req.method === 'GET') {
    const theme: any = await UserWpTheme.findOne({ user_id: uid }).lean();
    return res.json({ row_even: theme ? theme.row_even : '#ffffff', row_odd: theme ? theme.row_odd : '#f5f7ff' });
  }
  const d: any = req.body || {};
  const even = String(d.row_even || '#ffffff').trim();
  const odd = String(d.row_odd || '#f5f7ff').trim();
  await UserWpTheme.updateOne({ user_id: uid }, { $set: { row_even: even, row_odd: odd } }, { upsert: true });
  res.json({ ok: true });
}

/** Groups of users whose full_name matches case-insensitively. */
export async function apiUserDuplicates(_req: Request, res: Response) {
  const users: any[] = await User.find({}, 'id full_name email role team is_active -_id').lean();
  users.sort((a, b) => a.full_name.toLowerCase().localeCompare(b.full_name.toLowerCase(), 'en'));
  const groups: Record<string, any[]> = {};
  for (const u of users) (groups[u.full_name.trim().toLowerCase()] ||= []).push(u);
  res.json({ groups: Object.values(groups).filter((g) => g.length > 1) });
}

/** Merge a duplicate user into a primary user, transferring all references. */
export async function apiMergeUsers(req: Request, res: Response) {
  const d: any = req.body || {};
  const keep_id = d.keep_id;
  const merge_id = d.merge_id;
  if (!keep_id || !merge_id || String(keep_id) === String(merge_id)) return res.status(400).json({ ok: false, error: 'Invalid user IDs' });
  if (String(merge_id) === sessUid(req)) return res.status(400).json({ ok: false, error: 'Cannot merge the currently logged-in user' });
  const keep: any = await User.findOne({ id: toInt(keep_id) }).lean();
  const dupe: any = await User.findOne({ id: toInt(merge_id) }).lean();
  if (!keep || !dupe) return res.status(404).json({ ok: false, error: 'User not found' });
  await DailyPlanEntry.updateMany({ user_id: toInt(merge_id) }, { $set: { user_id: toInt(keep_id), user_name: keep.full_name } });
  await WorkPlan.updateMany({ team_name: equalsCI(dupe.full_name) }, { $set: { team_name: keep.full_name } });
  if (dupe.full_name !== keep.full_name) await Team.deleteOne({ name: dupe.full_name });
  await removeUserRow(toInt(merge_id));
  res.json({ ok: true, message: `Merged "${dupe.full_name}" into "${keep.full_name}"` });
}

export async function userBirthdayApi(req: Request, res: Response) {
  const bd = (req.body || {}).birthday || null;
  await User.updateOne({ id: toInt(req.params.uid) }, { $set: { birthday: bd } });
  res.json({ ok: true });
}

export { collate };

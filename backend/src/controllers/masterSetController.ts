import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { paths } from '../config/env';
import { MasterSet, MasterSetImage, MasterSetUpdate } from '../models';
import { msExcel } from '../services/excelExports';
import { activeCheckers, activeTeams, masterLists } from '../services/lists';
import { XLSX_MIME, ensureDir, filesOf, firstFile, moveFile } from '../utils/files';
import { action, contains, field, flash, qstr, toInt } from '../utils/http';
import { argInt, todayIso } from '../utils/pyDates';

const sessName = (req: Request) => String((req.session as any)?.full_name ?? '');
const hex8 = () => crypto.randomBytes(4).toString('hex');

async function imagesOf(ms_id: number) {
  const imgs: any[] = await MasterSetImage.find({ ms_id }).lean();
  imgs.sort((a, b) => String(a.side).localeCompare(String(b.side)) || (a.sort_order || 0) - (b.sort_order || 0) || a.id - b.id);
  return imgs.map((i) => ({ id: i.id, side: i.side, path: i.path, sort_order: i.sort_order }));
}

export async function masterSetPage(_req: Request, res: Response) {
  const [clients, projects] = await masterLists();
  const ms_list: any[] = await MasterSet.find({}).sort({ id: -1 }).lean();
  const counts = await MasterSetUpdate.aggregate([{ $group: { _id: '$ms_id', c: { $sum: 1 } } }]);
  const cm = new Map<number, number>(counts.map((c) => [c._id, c.c]));
  for (const ms of ms_list) {
    ms.update_count = cm.get(ms.id) || 0;
    ms.updates = Array.from({ length: ms.update_count }, () => ({}));
  }
  res.json({
    ms_list,
    teams: (await activeTeams()).map((t) => t.name),
    checkers: (await activeCheckers()).map((u) => u.full_name),
    clients,
    projects,
  });
}

export async function apiMasterSets(req: Request, res: Response) {
  const page = argInt(req.query.page, 1);
  const per = argInt(req.query.per_page, 25);
  const q = qstr(req, 'q').trim();
  const team = qstr(req, 'team');
  const filter: any = {};
  if (q) {
    const rx = contains(q);
    filter.$or = ['job_name', 'client', 'fabricator'].map((k) => ({ [k]: rx }));
  }
  if (team) filter.team = team;
  const total = await MasterSet.countDocuments(filter);
  const pages = total ? Math.ceil(total / per) : 1;
  const items = await MasterSet.find(filter).sort({ id: -1 }).skip((page - 1) * per).limit(per).lean();
  const teams = (await activeTeams()).map((t) => t.name);
  res.json({ items, total, page, pages, teams });
}

export async function apiMsMeta(_req: Request, res: Response) {
  const [clients, projects] = await masterLists();
  res.json({ teams: (await activeTeams()).map((t) => t.name), checkers: (await activeCheckers()).map((u) => u.full_name), clients, projects });
}

export async function addMasterSet(req: Request, res: Response) {
  const row: any = await MasterSet.create({
    job_name: field(req, 'job_name'),
    fabricator: field(req, 'fabricator'),
    client: field(req, 'client'),
    received_date: field(req, 'received_date'),
    working_days: field(req, 'working_days'),
    team: field(req, 'team'),
    qc_checker: field(req, 'qc_checker'),
    email_body: field(req, 'email_body'),
    submitted_by: sessName(req),
  });
  return action(res, { flash: [flash('success', `Master Set #${row.id} created.`)], redirect: `/master-set/${row.id}` });
}

export async function masterSetDetailPage(req: Request, res: Response) {
  const ms_id = toInt(req.params.ms_id)!;
  const rec = await MasterSet.findOne({ id: ms_id }).lean();
  if (!rec) return res.status(404).json({ error: 'Not found', flash: [flash('danger', 'Not found.')], redirect: '/master-set' });
  const updates = await MasterSetUpdate.find({ ms_id }, 'id upd_date remark -_id').sort({ id: 1 }).lean();
  const imgs = await imagesOf(ms_id);
  const [clients, projects] = await masterLists();
  res.json({
    ms_id,
    rec,
    updates,
    left_images: imgs.filter((i) => i.side === 'left'),
    iso_image: imgs.find((i) => i.side === 'iso') || null,
    teams: (await activeTeams()).map((t) => t.name),
    checkers: (await activeCheckers()).map((u) => u.full_name),
    clients,
    projects,
    today: todayIso(),
  });
}

export async function apiMsDetail(req: Request, res: Response) {
  const ms_id = toInt(req.params.ms_id)!;
  const rec: any = await MasterSet.findOne({ id: ms_id }).lean();
  if (!rec) return res.status(404).json({ error: 'Not found' });
  rec.updates = await MasterSetUpdate.find({ ms_id }, 'id upd_date remark -_id').sort({ id: 1 }).lean();
  const imgs = await imagesOf(ms_id);
  rec.left_images = imgs.filter((i) => i.side === 'left');
  rec.iso_image = imgs.find((i) => i.side === 'iso') || null;
  const [clients, projects] = await masterLists();
  res.json({ rec, teams: (await activeTeams()).map((t) => t.name), checkers: (await activeCheckers()).map((u) => u.full_name), clients, projects });
}

export async function editMasterSet(req: Request, res: Response) {
  const ms_id = toInt(req.params.ms_id);
  await MasterSet.updateOne(
    { id: ms_id },
    {
      $set: {
        job_name: field(req, 'job_name'),
        fabricator: field(req, 'fabricator'),
        client: field(req, 'client'),
        received_date: field(req, 'received_date'),
        working_days: field(req, 'working_days'),
        team: field(req, 'team'),
        qc_checker: field(req, 'qc_checker'),
        email_body: field(req, 'email_body'),
        folder_path: field(req, 'folder_path'),
      },
    }
  );
  return action(res, { flash: [flash('success', 'Updated.')], redirect: `/master-set/${ms_id}` });
}

export async function addMsUpdate(req: Request, res: Response) {
  const ms_id = toInt(req.params.ms_id);
  await MasterSetUpdate.create({ ms_id, upd_date: field(req, 'update_date'), remark: field(req, 'update_remark') });
  return action(res, { flash: [flash('success', 'Update added.')], redirect: `/master-set/${ms_id}` });
}

export async function delMsUpdate(req: Request, res: Response) {
  const ms_id = toInt(req.params.ms_id);
  await MasterSetUpdate.deleteOne({ id: toInt(req.params.upd_id), ms_id });
  return action(res, { flash: [flash('success', 'Removed.')], redirect: `/master-set/${ms_id}` });
}

export async function deleteMasterSet(req: Request, res: Response) {
  const ms_id = toInt(req.params.ms_id);
  // ON DELETE CASCADE (updates + image rows; image files are left on disk like the original)
  await MasterSetUpdate.deleteMany({ ms_id });
  await MasterSetImage.deleteMany({ ms_id });
  await MasterSet.deleteOne({ id: ms_id });
  return action(res, { flash: [flash('success', 'Deleted.')], redirect: '/master-set' });
}

export async function uploadIso(req: Request, res: Response) {
  const ms_id = toInt(req.params.ms_id)!;
  const f = firstFile(req, 'iso_image');
  if (f && f.originalname) {
    // Remove the old file from disk before replacing
    const old: any = await MasterSetImage.findOne({ ms_id, side: 'iso' }, 'path').lean();
    if (old && old.path) {
      try {
        fs.unlinkSync(old.path);
      } catch {}
    }
    const ext = path.extname(f.originalname).toLowerCase();
    const name = `iso_${ms_id}_${hex8()}${ext}`;
    ensureDir(paths.MS_IMG_DIR);
    const p = path.join(paths.MS_IMG_DIR, name);
    moveFile(f.path, p);
    await MasterSetImage.deleteMany({ ms_id, side: 'iso' });
    await MasterSetImage.create({ ms_id, side: 'iso', path: p });
    return action(res, { flash: [flash('success', 'ISO uploaded.')], redirect: `/master-set/${ms_id}` });
  }
  return action(res, { redirect: `/master-set/${ms_id}` });
}

export async function uploadLeft(req: Request, res: Response) {
  const ms_id = toInt(req.params.ms_id)!;
  let so = await MasterSetImage.countDocuments({ ms_id, side: 'left' });
  let added = 0;
  ensureDir(paths.MS_IMG_DIR);
  for (const f of filesOf(req, 'left_images')) {
    if (f && f.originalname) {
      const ext = path.extname(f.originalname).toLowerCase();
      const name = `left_${ms_id}_${hex8()}${ext}`;
      const p = path.join(paths.MS_IMG_DIR, name);
      moveFile(f.path, p);
      await MasterSetImage.create({ ms_id, side: 'left', path: p, sort_order: so });
      so++;
      added++;
    }
  }
  return action(res, { flash: added ? [flash('success', `${added} image(s) added.`)] : undefined, redirect: `/master-set/${ms_id}` });
}

export async function delMsImage(req: Request, res: Response) {
  const ms_id = toInt(req.params.ms_id);
  const row: any = await MasterSetImage.findOne({ id: toInt(req.params.img_id), ms_id }, 'path').lean();
  if (row) {
    try {
      fs.unlinkSync(row.path);
    } catch {}
    await MasterSetImage.deleteOne({ id: toInt(req.params.img_id) });
  }
  return action(res, { flash: [flash('success', 'Removed.')], redirect: `/master-set/${ms_id}` });
}

export async function serveMsImage(req: Request, res: Response) {
  const row: any = await MasterSetImage.findOne({ id: toInt(req.params.img_id), ms_id: toInt(req.params.ms_id) }, 'path').lean();
  if (!row || !fs.existsSync(row.path) || !fs.statSync(row.path).isFile()) return res.status(404).end();
  res.setHeader('Content-Type', path.extname(row.path).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg');
  fs.createReadStream(row.path).pipe(res);
}

export async function exportMsExcel(req: Request, res: Response) {
  const ms_id = toInt(req.params.ms_id)!;
  const p = await msExcel(ms_id);
  if (!p) return res.redirect('/master-set');
  const rec: any = await MasterSet.findOne({ id: ms_id }, 'job_name').lean();
  const name = (rec ? rec.job_name : 'MasterSet').replace(/ /g, '_').slice(0, 40);
  res.setHeader('Content-Type', XLSX_MIME);
  res.download(p, `MasterSet_${name}.xlsx`);
}

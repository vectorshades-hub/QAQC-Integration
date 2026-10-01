import { Request, Response } from 'express';
import { Client, DailyPlanEntry, Project, Team, User, WorkPlan } from '../models';
import { action, equalsCI, field, flash, isDuplicateKey, toInt } from '../utils/http';

const collate = { locale: 'en' } as const;
const sessUid = (req: Request) => String((req.session as any)?.user_id ?? '');

// ─── Teams ────────────────────────────────────────────────────────────────────
export async function teamsPage(_req: Request, res: Response) {
  res.json({ teams: await Team.find({}).collation(collate).sort({ name: 1 }).lean() });
}

export async function apiTeams(_req: Request, res: Response) {
  res.json({ items: await Team.find({}).collation(collate).sort({ name: 1 }).lean() });
}

export async function addTeam(req: Request, res: Response) {
  const name = field(req, 'name').trim();
  if (!name) return action(res, { ok: false, flash: [flash('danger', 'Name required.')], redirect: '/teams' });
  try {
    await Team.create({ name });
    return action(res, { flash: [flash('success', `Team "${name}" added.`)], redirect: '/teams' });
  } catch {
    return action(res, { ok: false, flash: [flash('danger', 'Team already exists.')], redirect: '/teams' });
  }
}

export async function editTeam(req: Request, res: Response) {
  const team_id = toInt(req.params.team_id);
  const name = field(req, 'name').trim();
  if (name) {
    const old: any = await Team.findOne({ id: team_id }, 'name').lean();
    if (old && old.name !== name) {
      await Team.updateOne({ id: team_id }, { $set: { name } });
      await WorkPlan.updateMany({ team_name: old.name }, { $set: { team_name: name } });
      await User.updateMany({ team: old.name }, { $set: { team: name } });
      await DailyPlanEntry.updateMany({ user_name: old.name }, { $set: { user_name: name } });
    }
  }
  return action(res, { flash: [flash('success', 'Updated.')], redirect: '/teams' });
}

export async function deleteTeam(req: Request, res: Response) {
  await Team.deleteOne({ id: toInt(req.params.team_id) });
  return action(res, { flash: [flash('success', 'Deleted.')], redirect: '/teams' });
}

/**
 * Merge a duplicate team into a primary team. Transfers ALL references:
 * work_plans.team_name, users.team, daily_plan_entries.user_name (denormalised full_name), and collapses
 * user records whose full_name matches the duplicate team name. Finally deletes the duplicate team row.
 */
export async function apiMergeTeams(req: Request, res: Response) {
  const d: any = req.body || {};
  const keep_id = d.keep_id;
  const merge_id = d.merge_id;
  if (!keep_id || !merge_id || String(keep_id) === String(merge_id)) return res.status(400).json({ ok: false, error: 'Invalid team IDs' });
  const keep: any = await Team.findOne({ id: toInt(keep_id) }).lean();
  const dupe: any = await Team.findOne({ id: toInt(merge_id) }).lean();
  if (!keep || !dupe) return res.status(404).json({ ok: false, error: 'Team not found' });
  const kn = keep.name;
  const dn = dupe.name;

  await WorkPlan.updateMany({ team_name: equalsCI(dn) }, { $set: { team_name: kn } });
  await User.updateMany({ team: equalsCI(dn) }, { $set: { team: kn } });
  await DailyPlanEntry.updateMany({ user_name: equalsCI(dn) }, { $set: { user_name: kn } });

  // Collapse user records whose full_name matches the duplicate team name.
  const keep_user: any = await User.findOne({ full_name: kn }, 'id').lean();
  const dup_users: any[] = await User.find({ full_name: equalsCI(dn), $expr: { $ne: ['$full_name', kn] } }, 'id').lean();
  for (const u of dup_users) {
    if (keep_user && String(u.id) !== sessUid(req)) {
      await DailyPlanEntry.updateMany({ user_id: u.id }, { $set: { user_id: keep_user.id, user_name: kn } });
      await User.deleteOne({ id: u.id });
    } else {
      await DailyPlanEntry.updateMany({ user_id: u.id }, { $set: { user_name: kn } });
      await User.updateOne({ id: u.id }, { $set: { full_name: kn } });
    }
  }
  await Team.deleteOne({ id: toInt(merge_id) });
  res.json({ ok: true, message: `Merged "${dn}" into "${kn}"` });
}

// ─── Projects & Clients ───────────────────────────────────────────────────────
export async function projectsPage(_req: Request, res: Response) {
  const [clients, projects] = await Promise.all([
    Client.find({ is_active: true }).collation(collate).sort({ name: 1 }).lean(),
    Project.find({ is_active: true }).collation(collate).sort({ name: 1 }).lean(),
  ]);
  res.json({ clients, projects });
}

export const apiProjects = projectsPage;

const REDIRECT = '/projects';

export async function addClient(req: Request, res: Response) {
  const name = field(req, 'name').trim();
  if (!name) return action(res, { ok: false, flash: [flash('danger', 'Client name required.')], redirect: REDIRECT });
  try {
    await Client.create({ name });
    return action(res, { flash: [flash('success', `Client "${name}" added.`)], redirect: REDIRECT });
  } catch (e) {
    if (!isDuplicateKey(e)) throw e;
    return action(res, { ok: false, flash: [flash('warning', 'Client already exists.')], redirect: REDIRECT });
  }
}

export async function editClient(req: Request, res: Response) {
  const name = field(req, 'name').trim();
  if (name) {
    await Client.updateOne({ id: toInt(req.params.cid) }, { $set: { name } });
    return action(res, { flash: [flash('success', 'Client updated.')], redirect: REDIRECT });
  }
  return action(res, { redirect: REDIRECT });
}

export async function deleteClient(req: Request, res: Response) {
  await Client.updateOne({ id: toInt(req.params.cid) }, { $set: { is_active: false } });
  return action(res, { flash: [flash('success', 'Client removed.')], redirect: REDIRECT });
}

export async function hardDeleteClient(req: Request, res: Response) {
  await Client.deleteOne({ id: toInt(req.params.cid) });
  return action(res, { flash: [flash('success', 'Client permanently deleted.')], redirect: REDIRECT });
}

export async function addProjectEntry(req: Request, res: Response) {
  const name = field(req, 'name').trim();
  if (!name) return action(res, { ok: false, flash: [flash('danger', 'Project name required.')], redirect: REDIRECT });
  try {
    await Project.create({ name });
    return action(res, { flash: [flash('success', `Project "${name}" added.`)], redirect: REDIRECT });
  } catch (e) {
    if (!isDuplicateKey(e)) throw e;
    return action(res, { ok: false, flash: [flash('warning', 'Project already exists.')], redirect: REDIRECT });
  }
}

export async function editProjectEntry(req: Request, res: Response) {
  const name = field(req, 'name').trim();
  if (name) {
    await Project.updateOne({ id: toInt(req.params.pid) }, { $set: { name } });
    return action(res, { flash: [flash('success', 'Project updated.')], redirect: REDIRECT });
  }
  return action(res, { redirect: REDIRECT });
}

export async function deleteProjectEntry(req: Request, res: Response) {
  await Project.updateOne({ id: toInt(req.params.pid) }, { $set: { is_active: false } });
  return action(res, { flash: [flash('success', 'Project removed.')], redirect: REDIRECT });
}

export async function hardDeleteProjectEntry(req: Request, res: Response) {
  await Project.deleteOne({ id: toInt(req.params.pid) });
  return action(res, { flash: [flash('success', 'Project permanently deleted.')], redirect: REDIRECT });
}

export async function apiMasterLists(_req: Request, res: Response) {
  const { masterLists } = await import('../services/lists');
  const [clients, projects] = await masterLists();
  res.json({ clients, projects });
}

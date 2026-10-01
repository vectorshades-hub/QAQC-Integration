import crypto from 'crypto';
import { Client, Project, Team, User } from '../models';

const collate = { locale: 'en' } as const;

export const genId = (): string => crypto.randomUUID().slice(0, 8);

export const activeTeams = async (): Promise<{ id: number; name: string }[]> =>
  Team.find({ is_active: true }, { id: 1, name: 1, _id: 0 }).collation(collate).sort({ name: 1 }).lean();

export const activeCheckers = async (): Promise<{ id: number; full_name: string }[]> =>
  User.find({ is_active: true, role: { $ne: 'admin' } }, { id: 1, full_name: 1, _id: 0 })
    .collation(collate)
    .sort({ full_name: 1 })
    .lean();

/** Clients and projects (separate collections) as plain name lists. */
export async function masterLists(): Promise<[string[], string[]]> {
  const [c, p] = await Promise.all([
    Client.find({ is_active: true }, { name: 1, _id: 0 }).collation(collate).sort({ name: 1 }).lean(),
    Project.find({ is_active: true }, { name: 1, _id: 0 }).collation(collate).sort({ name: 1 }).lean(),
  ]);
  return [c.map((x: any) => x.name), p.map((x: any) => x.name)];
}

/** Active, non-admin users (for the plan/leave grids) */
export const activeMembers = async (fields = 'id full_name team') =>
  User.find({ is_active: true, role: { $ne: 'admin' } }, fields + ' -_id').collation(collate).sort({ full_name: 1 }).lean();

export const sortByName = <T extends Record<string, any>>(rows: T[], key: string): T[] =>
  [...rows].sort((a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'en'));

import { Request, Response } from 'express';
import { EventModel, User } from '../models';
import { action, field, flash, toInt } from '../utils/http';
import { fmtDate } from '../utils/pyDates';

const isAdminReq = (req: Request) => (req.session as any)?.role === 'admin';

export function eventsPage(req: Request, res: Response) {
  res.json({ is_admin: isAdminReq(req) });
}

export async function eventsAdd(req: Request, res: Response) {
  const title = field(req, 'title').trim();
  const description = field(req, 'description').trim();
  const event_date = field(req, 'event_date').trim();
  if (!title || !event_date) {
    return action(res, { ok: false, flash: [flash('danger', 'Title and date are required.')], redirect: '/events' });
  }
  await EventModel.create({ title, description, event_date, created_by: String((req.session as any)?.full_name ?? '') });
  return action(res, { flash: [flash('success', 'Announcement added.')], redirect: '/events' });
}

export async function eventsEdit(req: Request, res: Response) {
  await EventModel.updateOne(
    { id: toInt(req.params.eid) },
    {
      $set: {
        title: field(req, 'title').trim(),
        description: field(req, 'description').trim(),
        event_date: field(req, 'event_date').trim(),
        is_active: !!field(req, 'is_active'),
      },
    }
  );
  return action(res, { flash: [flash('success', 'Updated.')], redirect: '/events' });
}

export async function eventsDelete(req: Request, res: Response) {
  await EventModel.deleteOne({ id: toInt(req.params.eid) });
  return action(res, { flash: [flash('success', 'Deleted.')], redirect: '/events' });
}

export async function apiEvents(_req: Request, res: Response) {
  const items = await EventModel.find({}, 'id title description event_date is_active created_by created_at -_id').sort({ event_date: -1 }).limit(200).lean();
  res.json({ items });
}

export async function apiEventsToday(req: Request, res: Response) {
  const today = new Date();
  const today_iso = fmtDate(today);
  const mmdd = today_iso.slice(5); // 'MM-DD'
  const birthdays = await User.find({ is_active: true, birthday: { $regex: `^\\d{4}-${mmdd}$` } }, 'id full_name birthday -_id').lean();
  const announcements = await EventModel.find({ is_active: true, event_date: today_iso }, 'id title description -_id').sort({ id: 1 }).lean();
  res.json({ birthdays, announcements, current_user_id: parseInt(String((req.session as any)?.user_id ?? 0), 10) || 0, today: today_iso });
}

export async function apiEventsBirthdays(_req: Request, res: Response) {
  const rows: any[] = await User.find({ is_active: true, role: { $ne: 'admin' } }, 'id full_name team birthday -_id').lean();
  const md = (b: string | null) => (b ? [parseInt(b.slice(5, 7), 10), parseInt(b.slice(8, 10), 10)] : [Infinity, Infinity]);
  rows.sort((a, b) => {
    const [am, ad] = md(a.birthday);
    const [bm, bd] = md(b.birthday);
    return am - bm || ad - bd || String(a.full_name).localeCompare(String(b.full_name), 'en');
  });
  res.json({ items: rows });
}

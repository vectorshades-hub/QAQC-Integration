import { Request } from 'express';
import { DailyPlanAuditLog } from '../models';

const num = (v: any): number | null => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Insert a row into daily_plan_audit_log using the current session user. Never throws. */
export async function auditDailyPlan(
  req: Request,
  action: string,
  o: {
    plan_date?: string | null;
    entry_id?: string | null;
    wp_id?: number | null;
    target_user_id?: any;
    target_user_name?: string | null;
    details?: Record<string, any>;
  } = {}
): Promise<void> {
  try {
    const s: any = req.session || {};
    await DailyPlanAuditLog.create({
      action,
      entry_id: o.entry_id ?? null,
      wp_id: o.wp_id ?? null,
      performed_by_id: num(s.user_id),
      performed_by_name: s.full_name ?? '',
      target_user_id: num(o.target_user_id),
      target_user_name: o.target_user_name ?? null,
      plan_date: o.plan_date ?? null,
      details: o.details || {},
    });
  } catch {
    /* never let logging crash a real operation */
  }
}

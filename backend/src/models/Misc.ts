import { Schema } from 'mongoose';
import { makeModel } from './base';

export const UserWpTheme = makeModel(
  'UserWpTheme',
  'user_wp_themes',
  {
    user_id: { type: Number, required: true, unique: true },
    row_even: { type: String, default: '#ffffff' },
    row_odd: { type: String, default: '#f5f7ff' },
  },
  { serial: false }
);

export const WorkPlanUserAssignment = makeModel('WorkPlanUserAssignment', 'work_plan_user_assignments', {
  team_name: { type: String, required: true, index: true },
  user_id: { type: Number, required: true },
  is_default: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
});
WorkPlanUserAssignment.schema.index({ team_name: 1, user_id: 1 }, { unique: true });

export const DailyPlanAuditLog = makeModel('DailyPlanAuditLog', 'daily_plan_audit_log', {
  action: { type: String, required: true, index: true },
  entry_id: { type: String, default: null },
  wp_id: { type: Number, default: null },
  performed_by_id: { type: Number, default: null },
  performed_by_name: { type: String, default: null },
  target_user_id: { type: Number, default: null },
  target_user_name: { type: String, default: null },
  plan_date: { type: String, default: null },
  details: { type: Schema.Types.Mixed, default: () => ({}) },
  created_at: { type: Date, default: Date.now, index: true },
});

export const EventModel = makeModel('Event', 'events', {
  title: { type: String, required: true },
  description: { type: String, default: '' },
  event_date: { type: String, required: true, index: true },
  is_active: { type: Boolean, default: true },
  created_by: { type: String, default: '' },
  created_at: { type: Date, default: Date.now },
});

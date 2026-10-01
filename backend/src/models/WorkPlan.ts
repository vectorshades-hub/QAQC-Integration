import { makeModel } from './base';

export const WorkPlan = makeModel('WorkPlan', 'work_plans', {
  team_name: { type: String, required: true },
  plan_date: { type: String, required: true, index: true },
  project_name: { type: String, required: true },
  date_confirmed: { type: String, default: 'confirmed' },
  notes: { type: String, default: '' },
  schedule_track_id: { type: String, default: null, index: true },
  created_at: { type: Date, default: Date.now },
});

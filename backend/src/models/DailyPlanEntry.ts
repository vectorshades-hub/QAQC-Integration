import { makeModel } from './base';

/** daily_plan_entries - `id` is an 8 char string (not auto-increment) */
export const DailyPlanEntry = makeModel(
  'DailyPlanEntry',
  'daily_plan_entries',
  {
    id: { type: String, required: true, unique: true },
    plan_date: { type: String, required: true, index: true }, // 'YYYY-MM-DD'
    user_id: { type: Number, default: null, index: true }, // ON DELETE SET NULL
    user_name: { type: String, required: true },
    project_name: { type: String, default: '' },
    client_name: { type: String, default: '' },
    submission_date: { type: String, default: '' },
    received_date: { type: String, default: '' },
    submitted_date: { type: String, default: '' },
    status: { type: String, default: 'IN PROGRESS', index: true },
    notes: { type: String, default: '' },
    schedule_track_id: { type: String, default: null, index: true },
    expected_completion: { type: String, default: '' },
    created_at: { type: Date, default: Date.now },
  },
  { serial: false }
);

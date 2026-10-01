import { makeModel } from './base';

/** app_settings (the table existed in the original schema but no route used it) */
export const AppSetting = makeModel(
  'AppSetting',
  'app_settings',
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true },
    updated_at: { type: Date, default: Date.now },
  },
  { serial: false }
);

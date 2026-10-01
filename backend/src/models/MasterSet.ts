import { makeModel } from './base';

/** master_sets - also the backing store of the Ownership Log (domain / ol_* fields) */
export const MasterSet = makeModel('MasterSet', 'master_sets', {
  job_name: { type: String, required: true },
  fabricator: { type: String, default: '' },
  client: { type: String, default: '' },
  received_date: { type: String, default: '' },
  working_days: { type: String, default: '' },
  team: { type: String, default: '' },
  qc_checker: { type: String, default: '' },
  email_body: { type: String, default: '' },
  submitted_by: { type: String, default: '' },
  created_at: { type: Date, default: Date.now },
  domain: { type: String, default: '' },
  ol_status: { type: String, default: '' },
  qc_done: { type: String, default: '' },
  done_by: { type: String, default: '' },
  ol_remarks: { type: String, default: '' },
  folder_path: { type: String, default: '' },
});

export const MasterSetUpdate = makeModel('MasterSetUpdate', 'master_set_updates', {
  ms_id: { type: Number, index: true },
  upd_date: { type: String, default: '' },
  remark: { type: String, default: '' },
  created_at: { type: Date, default: Date.now },
});

export const MasterSetImage = makeModel('MasterSetImage', 'master_set_images', {
  ms_id: { type: Number, index: true },
  side: { type: String, default: 'left' },
  path: { type: String, required: true },
  sort_order: { type: Number, default: 0 },
});

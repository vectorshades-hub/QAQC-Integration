import { Schema } from 'mongoose';
import { makeModel } from './base';

export const Submission = makeModel('Submission', 'submissions', {
  received_date: { type: String, default: '' },
  submission_date: { type: String, default: '', index: true },
  qc_checker: { type: String, default: '' },
  team: { type: String, default: '', index: true },
  client: { type: String, default: '' },
  rating: { type: String, default: '', index: true },
  num_e_sheets: { type: String, default: '' },
  num_d_sheets: { type: String, default: '' },
  check_print: { type: String, default: 'False' },
  job_name: { type: String, default: '' },
  submission_name: { type: String, default: '' },
  remarks: { type: String, default: '' },
  main_folder: { type: String, default: '' },
  files_copied: { type: Schema.Types.Mixed, default: () => [] },
  uploaded_files: { type: Schema.Types.Mixed, default: () => [] },
  submitted_by: { type: String, default: '' },
  created_at: { type: Date, default: Date.now },
});

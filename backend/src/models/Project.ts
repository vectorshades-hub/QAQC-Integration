import { makeModel } from './base';

export const Project = makeModel('Project', 'projects', {
  name: { type: String, required: true, unique: true },
  is_active: { type: Boolean, default: true, index: true },
  created_at: { type: Date, default: Date.now },
});

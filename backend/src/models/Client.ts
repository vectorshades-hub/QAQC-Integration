import { makeModel } from './base';

export const Client = makeModel('Client', 'clients', {
  name: { type: String, required: true, unique: true },
  is_active: { type: Boolean, default: true, index: true },
  created_at: { type: Date, default: Date.now },
});

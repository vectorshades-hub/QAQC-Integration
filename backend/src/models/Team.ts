import { makeModel } from './base';

export const Team = makeModel('Team', 'teams', {
  name: { type: String, required: true, unique: true },
  is_active: { type: Boolean, default: true },
});

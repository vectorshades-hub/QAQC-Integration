import { makeModel, todayDateString } from './base';

/**
 * users
 * NOTE: passwords are stored as PLAIN TEXT on purpose (explicit requirement for now).
 * All password handling lives in services/passwords.ts so hashing can be added in one place later.
 * `password` is select:false and is stripped from every JSON response.
 */
export const User = makeModel('User', 'users', {
  full_name: { type: String, required: true },
  email: { type: String, default: '' },
  password: { type: String, required: true, select: false },
  role: { type: String, default: 'user' },
  team: { type: String, default: '' },
  is_active: { type: Boolean, default: true },
  created_at: { type: String, default: todayDateString }, // DATE
  birthday: { type: String, default: null }, // DATE 'YYYY-MM-DD' or null
});

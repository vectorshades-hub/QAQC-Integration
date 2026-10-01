import dotenv from 'dotenv';
import path from 'path';

// Load backend/.env first, then the project-level .env (project root) as a fallback.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const backendRoot = path.resolve(__dirname, '../..');

function resolveDir(p: string | undefined, fallback: string): string {
  const v = p && p.trim() ? p.trim() : fallback;
  return path.isAbsolute(v) ? v : path.resolve(backendRoot, v);
}

export const env = {
  PORT: parseInt(process.env.PORT || '8001', 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/qaqc',
  SESSION_SECRET: process.env.SESSION_SECRET || '',
  SESSION_MAX_AGE_DAYS: parseInt(process.env.SESSION_MAX_AGE_DAYS || '365', 10),
  /** Root for backups, uploads, master-set images and generated Excel files (was web_v1.1/data). */
  DATA_DIR: resolveDir(process.env.DATA_DIR, './data'),
  /** MongoDB database of the external Schedule Track app (same local server by default). Blank = integration off. */
  SCHEDULE_TRACK_MONGODB_URI: process.env.SCHEDULE_TRACK_MONGODB_URI ?? 'mongodb://localhost:27017/schedule_tracker',
  SCHEDULE_TRACK_RECORDS_COLLECTION: process.env.SCHEDULE_TRACK_RECORDS_COLLECTION || 'records',
  /** Daily Schedule Track auto-import time, IST, HH:MM. */
  ST_AUTO_IMPORT_TIME: process.env.ST_AUTO_IMPORT_TIME || '08:00',
  /** Optional: allow direct browser calls from this origin (normally not needed: Next.js proxies /api). */
  CORS_ORIGIN: process.env.CORS_ORIGIN || '',
  NODE_ENV: process.env.NODE_ENV || 'development',
};

if (!env.SESSION_SECRET) {
  // Same idea as the original app (fixed default), but loudly flagged - set SESSION_SECRET in .env.
  console.warn('[config] SESSION_SECRET is not set - using an insecure development default. Set it in .env.');
  env.SESSION_SECRET = 'dev-only-insecure-secret-change-me';
}

export const paths = {
  DATA_DIR: env.DATA_DIR,
  BACKUP_DIR: path.join(env.DATA_DIR, 'backup'),
  MS_IMG_DIR: path.join(env.DATA_DIR, 'master_sets', 'images'),
  MS_DIR: path.join(env.DATA_DIR, 'master_sets'),
  UPLOADS_DIR: path.join(env.DATA_DIR, 'submissions_files'),
  TMP_UPLOAD_DIR: path.join(env.DATA_DIR, '.tmp_uploads'),
};

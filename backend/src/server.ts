import { createApp } from './app';
import { connectDb } from './config/db';
import { env, paths } from './config/env';
import * as models from './models';
import { scheduleDailyBackup, scheduleDailyStImport } from './services/backup';
import { ensureDir } from './utils/files';

async function seedIfEmpty() {
  if ((await models.User.countDocuments({})) > 0) return;
  console.log('Seeding admin user...');
  await models.User.create({ full_name: 'Administrator', email: 'admin@qaqc.com', password: 'admin123', role: 'admin', team: 'Admin' });
  console.log('Seeded. Administrator/admin123');
}

async function main() {
  for (const d of [paths.DATA_DIR, paths.BACKUP_DIR, paths.MS_IMG_DIR, paths.UPLOADS_DIR]) {
    try {
      ensureDir(d);
    } catch (e: any) {
      console.log(`[Warning] Could not create ${d}: ${e?.message || e}`);
    }
  }
  console.log('Initialising database...');
  await connectDb();
  // Build indexes (unique constraints) before serving
  await Promise.all(Object.values(models).filter((m: any) => m && typeof m.init === 'function').map((m: any) => m.init()));
  // username was removed; its unique index would make every new user collide on null
  await models.User.collection.dropIndex('username_1').catch(() => {});
  await seedIfEmpty();

  scheduleDailyBackup(); // midnight IST
  scheduleDailyStImport(); // ST_AUTO_IMPORT_TIME IST

  const app = createApp();
  app.listen(env.PORT, '0.0.0.0', () => console.log(`QAQC Integration API running at http://0.0.0.0:${env.PORT}`));
}

main().catch((e) => {
  console.error('Fatal startup error:', e);
  process.exit(1);
});

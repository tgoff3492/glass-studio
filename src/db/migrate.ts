import type { SQLiteDatabase } from 'expo-sqlite';

import { LATEST_VERSION } from './migrations';
import { runMigrations } from './runMigrations';
import { snapshotDatabase } from './snapshot';

export const DATABASE_NAME = 'glass-studio.db';

/** Passed to SQLiteProvider's onInit, so it runs before any screen renders. */
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  // Before an app update changes an existing database, keep a copy of it as it was.
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current > 0 && current < LATEST_VERSION) await snapshotDatabase(db, `before-update-v${current}`);
  await runMigrations(db);
}

import type { SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from './runMigrations';

export const DATABASE_NAME = 'glass-studio.db';

/** Passed to SQLiteProvider's onInit, so it runs before any screen renders. */
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await runMigrations(db);
}

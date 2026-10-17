import { migrations as defaultMigrations, type Migration } from './migrations.ts';

/** The two database calls migrations need. expo-sqlite's SQLiteDatabase satisfies this. */
export type MigratableDb = {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
};

/**
 * Brings the database up to the latest schema. Each pending migration runs
 * inside its own transaction, and the stored version only advances once that
 * migration has fully applied, so a failure part-way leaves the data intact.
 * Returns the version the database ends at.
 */
export async function runMigrations(
  db: MigratableDb,
  migrations: Migration[] = defaultMigrations,
): Promise<number> {
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let current = row?.user_version ?? 0;

  for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
    if (m.version <= current) continue;
    await db.execAsync('BEGIN;');
    try {
      await db.execAsync(m.sql);
      await db.execAsync(`PRAGMA user_version = ${m.version};`);
      await db.execAsync('COMMIT;');
    } catch (err) {
      await db.execAsync('ROLLBACK;');
      throw err;
    }
    current = m.version;
  }
  return current;
}

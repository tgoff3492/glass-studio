import type { QueryDb } from './glassRepo.ts';

// Small things the app remembers between launches.
export const SETTING = {
  lastBackupAt: 'last_backup_at',
  lastSnapshotAt: 'last_snapshot_at',
  welcomeSeen: 'welcome_seen',
} as const;

export async function getSetting(db: QueryDb, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setSetting(db: QueryDb, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [key, value]);
}

/** How much she has entered, for backup reminders and the backup summary. */
export async function countEverything(db: QueryDb): Promise<{ glass: number; supplies: number; projects: number; photos: number }> {
  const row = await db.getFirstAsync<{ glass: number; supplies: number; projects: number; photos: number }>(
    `SELECT (SELECT COUNT(*) FROM glass_items) AS glass, (SELECT COUNT(*) FROM supplies) AS supplies,
            (SELECT COUNT(*) FROM projects) AS projects, (SELECT COUNT(*) FROM photos) AS photos`,
    [],
  );
  return row ?? { glass: 0, supplies: 0, projects: 0, photos: 0 };
}

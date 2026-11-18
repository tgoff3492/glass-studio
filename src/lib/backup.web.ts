import type { SQLiteDatabase } from 'expo-sqlite';

import type { BackupInfo } from '@/domain/backupFormat';

// The web preview is for looking, not daily use, so it doesn't make backups.
export const backupsSupported = false;

export type BackupOutcome = { status: 'shared'; info: BackupInfo } | { status: 'failed'; message: string };
export type RestoreOutcome = { status: 'restored'; info: BackupInfo } | { status: 'canceled' } | { status: 'failed'; message: string };

const message = 'Backups work in the iPhone and iPad app. The web preview keeps its data in this browser only.';

export async function shareBackup(_db: SQLiteDatabase): Promise<BackupOutcome> {
  return { status: 'failed', message };
}

export async function restoreBackup(_db: SQLiteDatabase): Promise<RestoreOutcome> {
  return { status: 'failed', message };
}

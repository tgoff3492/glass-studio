import Constants from 'expo-constants';
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { backupDatabaseAsync, deserializeDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { LATEST_VERSION } from '@/db/migrations';
import { runMigrations } from '@/db/runMigrations';
import { SETTING, countEverything, setSetting } from '@/db/settingsRepo';
import { backupsDir, snapshotDatabase } from '@/db/snapshot';
import { BACKUP_FORMAT, backupFileName, readBackup, writeBackup, type BackupInfo } from '@/domain/backupFormat';

import { logError } from './errorLog';
import { photosDir } from './photoStore';

// iPhone, iPad and Android. The web preview uses backup.web.ts.

export const backupsSupported = true;

const CHUNK = 256 * 1024;

const photoFiles = (): File[] => {
  const dir = photosDir();
  return dir.exists ? dir.list().filter((f): f is File => f instanceof File) : [];
};

/** Writes everything into one .zip file and returns it. */
async function buildBackup(db: SQLiteDatabase, into: File): Promise<BackupInfo> {
  const photos = photoFiles();
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const info: BackupInfo = {
    format: BACKUP_FORMAT,
    // The file's internal marker stays 'Glass Studio' so backups made before the rename still restore.
    app: 'Glass Studio',
    schemaVersion: version?.user_version ?? LATEST_VERSION,
    createdAt: new Date().toISOString(),
    appVersion: Constants.expoConfig?.version ?? 'unknown',
    counts: { ...(await countEverything(db)), photos: photos.length },
  };
  const database = await db.serializeAsync();
  if (into.exists) into.delete();
  into.create();
  const handle = into.open();
  try {
    await writeBackup(
      { info, database, photoNames: photos.map((p) => p.name) },
      (name) => new File(photosDir(), name).bytes(),
      (chunk) => handle.writeBytesSync(chunk),
    );
  } finally {
    handle.close();
  }
  return info;
}

export type BackupOutcome = { status: 'shared'; info: BackupInfo } | { status: 'failed'; message: string };

/**
 * Saves a backup and opens the share sheet, where she can choose "Save to Files"
 * (iCloud Drive), AirDrop it, or send it to someone.
 */
export async function shareBackup(db: SQLiteDatabase): Promise<BackupOutcome> {
  try {
    const file = new File(Paths.cache, backupFileName(new Date()));
    const info = await buildBackup(db, file);
    if (!(await Sharing.isAvailableAsync())) return { status: 'failed', message: 'Sharing isn’t available on this device.' };
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/zip',
      UTI: 'public.zip-archive',
      dialogTitle: 'Save your Katharos backup',
    });
    await setSetting(db, SETTING.lastBackupAt, info.createdAt);
    return { status: 'shared', info };
  } catch (err) {
    logError(err, 'backup');
    return { status: 'failed', message: 'The backup couldn’t be made. Try again, or send Taylor a note.' };
  }
}

export type RestoreOutcome = { status: 'restored'; info: BackupInfo } | { status: 'canceled' } | { status: 'failed'; message: string };

/**
 * Replaces everything in the app with a backup she picks. Before anything changes, the
 * current data is saved as a backup in the app's own folder, so a wrong pick can be undone.
 */
export async function restoreBackup(db: SQLiteDatabase): Promise<RestoreOutcome> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/zip', 'application/x-zip-compressed', 'public.zip-archive'] });
  if (picked.canceled) return { status: 'canceled' };

  const holding = new Directory(Paths.cache, `restore-${Date.now()}`);
  try {
    holding.create({ intermediates: true });
    const handle = picked.result.open(FileMode.ReadOnly);
    const writers = new Map<string, ReturnType<File['open']>>();
    let result;
    try {
      result = readBackup(
        () => handle.readBytesSync(CHUNK),
        (name, chunk, final) => {
          let w = writers.get(name);
          if (!w) {
            const f = new File(holding, name);
            f.create({ overwrite: true });
            w = f.open();
            writers.set(name, w);
          }
          if (chunk.length > 0) w.writeBytesSync(chunk);
          if (final) {
            w.close();
            writers.delete(name);
          }
        },
        LATEST_VERSION,
      );
    } finally {
      handle.close();
      writers.forEach((w) => w.close());
    }
    if (!result.ok) return { status: 'failed', message: result.problem };

    // Keep what's here now, in case this was the wrong file.
    const dir = backupsDir();
    dir.create({ idempotent: true, intermediates: true });
    await buildBackup(db, new File(dir, `before-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`));
    await snapshotDatabase(db, 'before-restore');

    // Bring an older backup up to date in memory, then copy it over the live database.
    const incoming = await deserializeDatabaseAsync(result.database);
    try {
      await runMigrations(incoming);
      await backupDatabaseAsync({ sourceDatabase: incoming, destDatabase: db });
    } finally {
      await incoming.closeAsync();
    }

    // Swap the photos: the restored data only knows the photos in the backup.
    const photos = photosDir();
    photos.create({ idempotent: true, intermediates: true });
    const keep = new Set(result.photoNames);
    for (const f of photoFiles()) if (!keep.has(f.name)) f.delete();
    for (const name of result.photoNames) {
      const staged = new File(holding, name);
      if (!staged.exists) continue;
      const dest = new File(photos, name);
      if (dest.exists) dest.delete();
      staged.moveSync(dest);
    }
    await setSetting(db, SETTING.lastBackupAt, result.info.createdAt);
    return { status: 'restored', info: result.info };
  } catch (err) {
    logError(err, 'restore');
    return { status: 'failed', message: 'The backup couldn’t be restored. Nothing was changed. Send Taylor a note.' };
  } finally {
    try {
      holding.delete();
    } catch {
      // The cache folder is cleared by the system eventually.
    }
  }
}

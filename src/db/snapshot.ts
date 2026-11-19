import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { logError } from '@/lib/errorLog';

// Quiet copies of the database kept on the device: one before every app update
// changes the database, and one a week. They live in Documents/backups, which the
// phone's own iCloud backup includes. They don't hold photos; those never change.

const KEEP = 6;

export const backupsDir = () => new Directory(Paths.document, 'backups');

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

/** The file system path SQLite needs, from a file:// address. */
const toPath = (uri: string) => decodeURIComponent(uri.replace(/^file:\/\//, ''));

export async function snapshotDatabase(db: SQLiteDatabase, label: string): Promise<boolean> {
  try {
    const dir = backupsDir();
    dir.create({ idempotent: true, intermediates: true });
    const file = new File(dir, `${label}-${stamp()}.db`);
    await db.execAsync(`VACUUM INTO '${toPath(file.uri).replace(/'/g, "''")}'`);
    pruneSnapshots(dir);
    return true;
  } catch (err) {
    logError(err, `snapshot ${label}`);
    return false;
  }
}

function pruneSnapshots(dir: Directory): void {
  const files = dir
    .list()
    .filter((f): f is File => f instanceof File && f.name.endsWith('.db'))
    .sort((a, b) => b.name.slice(b.name.indexOf('-20')).localeCompare(a.name.slice(a.name.indexOf('-20'))));
  for (const old of files.slice(KEEP)) old.delete();
}

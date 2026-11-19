import { Unzip, UnzipInflate, Zip, ZipDeflate, ZipPassThrough, strFromU8, strToU8 } from 'fflate';

// One backup file holds everything: the database and every photo, zipped.
// Pure functions over bytes, so they can be tested without a phone.
//
//   backup.json          what's inside and when it was made
//   glass-studio.db      the whole database
//   photos/<name>        each photo, by the same name the database uses

export const BACKUP_FORMAT = 1;

export type BackupInfo = {
  format: number;
  /** An internal marker, unchanged since the app was called Glass Studio, so old backups still restore. */
  app: 'Glass Studio';
  /** The database schema version (PRAGMA user_version) when it was saved. */
  schemaVersion: number;
  createdAt: string;
  appVersion: string;
  counts: { glass: number; supplies: number; projects: number; photos: number };
};

const INFO = 'backup.json';
const DATABASE = 'glass-studio.db';
const PHOTOS = 'photos/';

export type BackupStart = {
  info: BackupInfo;
  database: Uint8Array;
  photoNames: string[];
};

/**
 * Writes a backup a piece at a time, so hundreds of photos never sit in memory at once.
 * `write` receives the zip file's bytes in order.
 */
export async function writeBackup(
  { info, database, photoNames }: BackupStart,
  readPhoto: (name: string) => Promise<Uint8Array>,
  write: (chunk: Uint8Array) => void,
): Promise<void> {
  let failure: Error | null = null;
  const zip = new Zip((err, chunk) => {
    if (err) failure = err;
    else write(chunk);
  });
  const add = (name: string, bytes: Uint8Array, compress: boolean) => {
    const file = compress ? new ZipDeflate(name, { level: 6 }) : new ZipPassThrough(name);
    zip.add(file);
    file.push(bytes, true);
    if (failure) throw failure;
  };
  add(INFO, strToU8(JSON.stringify(info, null, 2)), true);
  add(DATABASE, database, true);
  // Photos are already compressed; storing them as they are is just as small and much faster.
  for (const name of photoNames) add(PHOTOS + safeName(name), await readPhoto(name), false);
  zip.end();
  if (failure) throw failure;
}

export type ReadResult = { ok: true; info: BackupInfo; database: Uint8Array; photoNames: string[] } | { ok: false; problem: string };

const NOT_A_BACKUP = "That file isn't a Katharos backup. Choose the .zip file the app saved.";

/**
 * Reads a backup a piece at a time. `readChunk` returns the next bytes of the file, or an
 * empty array at the end. Photos are handed to `onPhoto` as they arrive, so the caller can
 * write them to a holding folder; only use them if this returns ok.
 */
export function readBackup(
  readChunk: () => Uint8Array,
  onPhoto: (name: string, chunk: Uint8Array, final: boolean) => void,
  latestSchema: number,
): ReadResult {
  const kept: Record<string, Uint8Array[]> = { [INFO]: [], [DATABASE]: [] };
  const photoNames: string[] = [];
  let failure: Error | null = null;
  try {
    const unzip = new Unzip((file) => {
      if (file.name === INFO || file.name === DATABASE) {
        const parts = kept[file.name];
        file.ondata = (err, chunk) => {
          if (err) failure = err;
          else parts.push(chunk);
        };
        file.start();
      } else if (file.name.startsWith(PHOTOS) && file.name.length > PHOTOS.length) {
        const name = safeName(file.name.slice(PHOTOS.length));
        photoNames.push(name);
        file.ondata = (err, chunk, final) => {
          if (err) failure = err;
          else onPhoto(name, chunk, final);
        };
        file.start();
      }
    });
    unzip.register(UnzipInflate);
    for (;;) {
      const chunk = readChunk();
      if (chunk.length === 0) {
        unzip.push(new Uint8Array(0), true);
        break;
      }
      unzip.push(chunk);
      if (failure) break;
    }
  } catch {
    return { ok: false, problem: NOT_A_BACKUP };
  }
  if (failure || kept[INFO].length === 0 || kept[DATABASE].length === 0) return { ok: false, problem: NOT_A_BACKUP };

  let info: BackupInfo;
  try {
    info = JSON.parse(strFromU8(join(kept[INFO])));
  } catch {
    return { ok: false, problem: 'That backup is damaged and can’t be read.' };
  }
  if (info.app !== 'Glass Studio' || typeof info.schemaVersion !== 'number') return { ok: false, problem: NOT_A_BACKUP };
  if (info.format > BACKUP_FORMAT || info.schemaVersion > latestSchema) {
    return { ok: false, problem: 'That backup was made by a newer version of the app. Update the app, then restore it.' };
  }
  return { ok: true, info, database: join(kept[DATABASE]), photoNames };
}

function join(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** "Katharos backup 2026-11-18.zip" */
export function backupFileName(date: Date): string {
  const d = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `Katharos backup ${d}.zip`;
}

/** "today", "yesterday", "12 days ago", or "never". */
export function describeLastBackup(iso: string | null, now: Date): string {
  if (!iso) return 'never';
  const days = Math.floor((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/** Nudge her to back up once there's something worth losing and it's been a while. */
export function backupIsDue(lastIso: string | null, itemCount: number, now: Date, everyDays = 30): boolean {
  if (itemCount < 10) return false;
  if (!lastIso) return true;
  return now.getTime() - new Date(lastIso).getTime() > everyDays * 86_400_000;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** No folders or odd characters sneak in through a file name. */
function safeName(name: string): string {
  return name.replace(/^.*[\\/]/, '').replace(/[^A-Za-z0-9._-]/g, '_');
}

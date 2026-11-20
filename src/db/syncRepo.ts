import type { Bind, QueryDb } from './glassRepo.ts';
import { newId } from './ids.ts';

// The device side of sync. It knows nothing about Firebase: it turns local changes into
// documents to send, and applies documents that arrive. lib/sync/ does the talking.
//
// Rules:
//  - Each row is one document, keyed by table and id. The newest write wins.
//  - A row changed here and not yet sent keeps the local version; it goes up next.
//  - Rows from another app version may have columns this one doesn't know; those are
//    ignored, and columns this one has that the document lacks keep their default.

/** Synced tables, parents first, so a project line never arrives before its glass. */
export const SYNC_TABLES = [
  'glass_items',
  'supplies',
  'projects',
  'glass_pieces',
  'project_glass',
  'project_supplies',
  'photos',
  'shopping_items',
  'settings',
] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

const KEY: Record<SyncTable, string> = Object.fromEntries(SYNC_TABLES.map((t) => [t, t === 'settings' ? 'key' : 'id'])) as Record<SyncTable, string>;

/** Settings that follow her between devices. Others (last backup, welcome seen) are per device. */
export const SYNCED_SETTINGS = ['hourly_rate_cents', 'markup_percent'];

export type Row = Record<string, Bind>;

/** One row, as stored in the cloud. `data` is null once the row has been deleted. */
export type SyncDoc = { table: SyncTable; id: string; data: Row | null; device: string };

export const isSyncTable = (t: string): t is SyncTable => (SYNC_TABLES as readonly string[]).includes(t);

// ---------- device identity and bookkeeping ----------

export async function getSyncState(db: QueryDb, key: string): Promise<string | null> {
  const r = await db.getFirstAsync<{ value: string }>('SELECT value FROM sync_state WHERE key = ?', [key]);
  return r?.value ?? null;
}

export async function setSyncState(db: QueryDb, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [key, value]);
}

/** A random id for this install, so a device can recognize its own changes coming back. */
export async function deviceId(db: QueryDb): Promise<string> {
  const existing = await getSyncState(db, 'device_id');
  if (existing) return existing;
  const id = newId();
  await setSyncState(db, 'device_id', id);
  return id;
}

/**
 * The first time an account syncs on this device, everything already here goes up,
 * not just what changes from now on. Returns true if it did that.
 */
export async function prepareForAccount(db: QueryDb, uid: string): Promise<boolean> {
  if ((await getSyncState(db, 'uid')) === uid) return false;
  const now = new Date().toISOString();
  for (const t of SYNC_TABLES) {
    // "WHERE true" lets SQLite tell the upsert apart from the SELECT.
    const where = t === 'settings' ? ` WHERE key IN (${SYNCED_SETTINGS.map(() => '?').join(', ')})` : ' WHERE true';
    await db.runAsync(
      `INSERT INTO sync_outbox (tbl, row_id, changed_at) SELECT ?, ${KEY[t]}, ? FROM ${t}${where}
       ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at`,
      [t, now, ...(t === 'settings' ? SYNCED_SETTINGS : [])],
    );
  }
  await db.runAsync('DELETE FROM sync_photos', []);
  await setSyncState(db, 'uid', uid);
  await setSyncState(db, 'pulled_through', '0');
  return true;
}

export async function pendingCount(db: QueryDb): Promise<number> {
  const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sync_outbox', []);
  return r?.n ?? 0;
}

// ---------- sending ----------

export type Outgoing = { docs: SyncDoc[]; sent: { tbl: string; row_id: string; changed_at: string }[] };

/** The next batch of local changes, as documents. */
export async function nextOutgoing(db: QueryDb, device: string, limit = 400): Promise<Outgoing> {
  const pending = await db.getAllAsync<{ tbl: string; row_id: string; changed_at: string }>(
    'SELECT tbl, row_id, changed_at FROM sync_outbox ORDER BY changed_at LIMIT ?',
    [limit],
  );
  const docs: SyncDoc[] = [];
  for (const p of pending) {
    if (!isSyncTable(p.tbl)) continue;
    const row = await db.getFirstAsync<Row>(`SELECT * FROM ${p.tbl} WHERE ${KEY[p.tbl]} = ?`, [p.row_id]);
    docs.push({ table: p.tbl, id: p.row_id, data: row ? cleanRow(row) : null, device });
  }
  return { docs, sent: pending };
}

/** Marks a batch as sent. A row changed again while sending stays queued. */
export async function markSent(db: QueryDb, sent: Outgoing['sent']): Promise<void> {
  for (const s of sent) {
    await db.runAsync('DELETE FROM sync_outbox WHERE tbl = ? AND row_id = ? AND changed_at = ?', [s.tbl, s.row_id, s.changed_at]);
  }
}

/** Web-preview photos are whole images in the row; too big to sync, and only for looking. */
function cleanRow(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[k] = typeof v === 'string' && v.startsWith('data:') ? null : v;
  return out;
}

// ---------- receiving ----------

const columnCache = new Map<string, string[]>();
async function columnsOf(db: QueryDb, table: SyncTable): Promise<string[]> {
  const hit = columnCache.get(table);
  if (hit) return hit;
  const cols = (await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`, [])).map((c) => c.name);
  columnCache.set(table, cols);
  return cols;
}

export type ApplyResult = { applied: number; skipped: number; failed: number };

/**
 * Applies documents from the cloud. Rows with unsent local changes are left alone, as are
 * this device's own changes coming back. Parents go in before children and deletes go
 * children first, all with the change log paused.
 */
export async function applyIncoming(db: QueryDb, incoming: SyncDoc[], device: string): Promise<ApplyResult> {
  const result: ApplyResult = { applied: 0, skipped: 0, failed: 0 };
  // Rows that couldn't go in last time (usually waiting on their parent) get another try,
  // unless a newer copy just arrived.
  const fresh = new Set(incoming.map((d) => `${d.table}:${d.id}`));
  const retry = (await db.getAllAsync<{ doc_key: string; doc: string }>('SELECT doc_key, doc FROM sync_retry', []))
    .filter((r) => !fresh.has(r.doc_key))
    .map((r) => JSON.parse(r.doc) as SyncDoc);
  const docs = [...retry, ...incoming];
  const order = (t: SyncTable) => SYNC_TABLES.indexOf(t);
  const relevant: SyncDoc[] = [];
  for (const d of docs) {
    if (!isSyncTable(d.table) || d.device === device) {
      result.skipped++;
      continue;
    }
    if (d.table === 'settings' && !SYNCED_SETTINGS.includes(d.id)) {
      result.skipped++;
      continue;
    }
    const waiting = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sync_outbox WHERE tbl = ? AND row_id = ?', [d.table, d.id]);
    if ((waiting?.n ?? 0) > 0) {
      result.skipped++;
      continue;
    }
    relevant.push(d);
  }
  const upserts = relevant.filter((d) => d.data !== null).sort((a, b) => order(a.table) - order(b.table));
  const deletes = relevant.filter((d) => d.data === null).sort((a, b) => order(b.table) - order(a.table));

  await setSyncState(db, 'applying', '1');
  try {
    for (const d of [...upserts, ...deletes]) {
      const docKey = `${d.table}:${d.id}`;
      try {
        await applyOne(db, d);
        await db.runAsync('DELETE FROM sync_retry WHERE doc_key = ?', [docKey]);
        result.applied++;
      } catch {
        // Usually a line whose glass hasn't arrived yet. Kept for the next pass; given up
        // after 20 tries so one bad row can't hold things up forever.
        await db.runAsync(
          `INSERT INTO sync_retry (doc_key, doc, attempts) VALUES (?, ?, 1)
           ON CONFLICT (doc_key) DO UPDATE SET doc = excluded.doc, attempts = attempts + 1`,
          [docKey, JSON.stringify(d)],
        );
        await db.runAsync('DELETE FROM sync_retry WHERE attempts > 20', []);
        result.failed++;
      }
    }
  } finally {
    await setSyncState(db, 'applying', '0');
  }
  return result;
}

async function applyOne(db: QueryDb, d: SyncDoc): Promise<void> {
  const key = KEY[d.table];
  if (d.data === null) {
    await db.runAsync(`DELETE FROM ${d.table} WHERE ${key} = ?`, [d.id]);
    return;
  }
  const known = await columnsOf(db, d.table);
  const cols = known.filter((c) => c in d.data!);
  if (!cols.includes(key)) cols.push(key);
  const values = cols.map((c) => (c === key ? d.id : (d.data![c] ?? null)));
  const updates = cols.filter((c) => c !== key).map((c) => `${c} = excluded.${c}`);
  await db.runAsync(
    `INSERT INTO ${d.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})` +
      (updates.length > 0 ? ` ON CONFLICT (${key}) DO UPDATE SET ${updates.join(', ')}` : ` ON CONFLICT (${key}) DO NOTHING`),
    values,
  );
}

// ---------- photos ----------

/** Every photo file the records point at, by file name. */
export async function referencedPhotos(db: QueryDb): Promise<string[]> {
  const rows = await db.getAllAsync<{ ref: string }>(
    `SELECT photo_uri AS ref FROM glass_items UNION SELECT fired_photo_uri FROM glass_items
     UNION SELECT photo_uri FROM supplies UNION SELECT pattern_photo_uri FROM projects UNION SELECT uri FROM photos`,
    [],
  );
  return [
    ...new Set(
      rows
        .map((r) => r.ref)
        .filter((r): r is string => typeof r === 'string' && r.startsWith('photos/'))
        .map((r) => r.slice(7)),
    ),
  ];
}

export async function photosNotUploaded(db: QueryDb, names: string[]): Promise<string[]> {
  const done = new Set((await db.getAllAsync<{ name: string }>('SELECT name FROM sync_photos', [])).map((r) => r.name));
  return names.filter((n) => !done.has(n));
}

export async function markPhotoUploaded(db: QueryDb, name: string): Promise<void> {
  await db.runAsync('INSERT INTO sync_photos (name, uploaded_at) VALUES (?, ?) ON CONFLICT (name) DO NOTHING', [name, new Date().toISOString()]);
}

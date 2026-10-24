import type { GlassFields } from '../domain/glass.ts';
import { newId, nowIso } from './ids.ts';
import type { Coe, GlassItem, GlassKind } from './types.ts';

type Bind = string | number | null;

/** The database calls the repository needs. expo-sqlite's SQLiteDatabase satisfies this. */
export type QueryDb = {
  runAsync(sql: string, params: Bind[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params: Bind[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: Bind[]): Promise<T | null>;
};

export type GlassFilter = {
  search?: string;
  kind?: GlassKind | null;
  coe?: Coe | 'none' | null;
  colorFamily?: string | null;
};

const COLUMNS = [
  'kind',
  'manufacturer',
  'color_name',
  'product_code',
  'coe',
  'glass_type',
  'color_family',
  'quantity',
  'unit',
  'cost_per_unit_cents',
  'photo_uri',
  'fired_photo_uri',
  'notes',
] as const satisfies readonly (keyof GlassFields)[];

export async function listGlass(db: QueryDb, filter: GlassFilter = {}): Promise<GlassItem[]> {
  const where: string[] = [];
  const params: Bind[] = [];

  const search = filter.search?.trim();
  if (search) {
    // Every word must match somewhere, so "blue bull" finds Bullseye blues.
    for (const word of search.split(/\s+/)) {
      where.push(
        "(color_name LIKE ? ESCAPE '\\' OR manufacturer LIKE ? ESCAPE '\\' OR product_code LIKE ? ESCAPE '\\' OR notes LIKE ? ESCAPE '\\')",
      );
      const like = `%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      params.push(like, like, like, like);
    }
  }
  if (filter.kind) {
    where.push('kind = ?');
    params.push(filter.kind);
  }
  if (filter.coe === 'none') {
    where.push('coe IS NULL');
  } else if (filter.coe) {
    where.push('coe = ?');
    params.push(filter.coe);
  }
  if (filter.colorFamily) {
    where.push('color_family = ?');
    params.push(filter.colorFamily);
  }

  const sql =
    'SELECT * FROM glass_items' +
    (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ' ORDER BY color_name COLLATE NOCASE, manufacturer COLLATE NOCASE';
  return db.getAllAsync<GlassItem>(sql, params);
}

export function getGlass(db: QueryDb, id: string): Promise<GlassItem | null> {
  return db.getFirstAsync<GlassItem>('SELECT * FROM glass_items WHERE id = ?', [id]);
}

export async function createGlass(db: QueryDb, fields: GlassFields): Promise<string> {
  const id = newId();
  const now = nowIso();
  const cols = ['id', ...COLUMNS, 'created_at', 'updated_at'];
  await db.runAsync(
    `INSERT INTO glass_items (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    [id, ...COLUMNS.map((c) => fields[c]), now, now],
  );
  return id;
}

export async function updateGlass(db: QueryDb, id: string, fields: GlassFields): Promise<void> {
  await db.runAsync(
    `UPDATE glass_items SET ${COLUMNS.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
    [...COLUMNS.map((c) => fields[c]), nowIso(), id],
  );
}

/** Sets a new quantity, never below zero. Returns what was saved. */
export async function setGlassQuantity(db: QueryDb, id: string, quantity: number): Promise<number> {
  const q = Math.max(0, Math.round(quantity * 100) / 100);
  await db.runAsync('UPDATE glass_items SET quantity = ?, updated_at = ? WHERE id = ?', [q, nowIso(), id]);
  return q;
}

export type DeleteResult = { deleted: true } | { deleted: false; usedInProjects: number };

/** Deletes an item unless a project still uses it. */
export async function deleteGlass(db: QueryDb, id: string): Promise<DeleteResult> {
  const used = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(DISTINCT project_id) AS n FROM project_glass WHERE glass_item_id = ?',
    [id],
  );
  if (used && used.n > 0) return { deleted: false, usedInProjects: used.n };
  await db.runAsync("DELETE FROM photos WHERE owner_type = 'glass' AND owner_id = ?", [id]);
  await db.runAsync('DELETE FROM glass_items WHERE id = ?', [id]);
  return { deleted: true };
}

/** Distinct makers she has entered, for suggestions in the form. */
export async function listManufacturers(db: QueryDb): Promise<string[]> {
  const rows = await db.getAllAsync<{ manufacturer: string }>(
    'SELECT DISTINCT manufacturer FROM glass_items WHERE manufacturer IS NOT NULL ORDER BY manufacturer COLLATE NOCASE',
    [],
  );
  return rows.map((r) => r.manufacturer);
}

import { categoriesInGroup, type SupplyFields, type SupplyGroup } from '../domain/supplies.ts';
import type { QueryDb } from './glassRepo.ts';
import { newId, nowIso } from './ids.ts';
import type { Supply } from './types.ts';

type Bind = string | number | null;

export type SupplyFilter = {
  search?: string;
  group?: SupplyGroup | null;
  /** Only supplies that are out, or at or below their minimum. */
  lowOnly?: boolean;
};

const COLUMNS = [
  'category',
  'name',
  'brand',
  'size',
  'quantity',
  'unit',
  'min_quantity',
  'cost_per_unit_cents',
  'photo_uri',
  'notes',
] as const satisfies readonly (keyof SupplyFields)[];

/** SQL for "out, or at or below the minimum she set". Matches stockLevel() in domain/supplies. */
const LOW_SQL = '(quantity <= 0 OR (min_quantity IS NOT NULL AND quantity <= min_quantity))';

export async function listSupplies(db: QueryDb, filter: SupplyFilter = {}): Promise<Supply[]> {
  const where: string[] = [];
  const params: Bind[] = [];

  const search = filter.search?.trim();
  if (search) {
    for (const word of search.split(/\s+/)) {
      where.push("(name LIKE ? ESCAPE '\\' OR brand LIKE ? ESCAPE '\\' OR size LIKE ? ESCAPE '\\' OR notes LIKE ? ESCAPE '\\')");
      const like = `%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      params.push(like, like, like, like);
    }
  }
  if (filter.group) {
    const cats = categoriesInGroup(filter.group);
    where.push(`category IN (${cats.map(() => '?').join(', ')})`);
    params.push(...cats);
  }
  if (filter.lowOnly) where.push(LOW_SQL);

  const sql =
    'SELECT * FROM supplies' +
    (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ' ORDER BY name COLLATE NOCASE, size COLLATE NOCASE';
  return db.getAllAsync<Supply>(sql, params);
}

export async function countLowSupplies(db: QueryDb): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM supplies WHERE ${LOW_SQL}`, []);
  return row?.n ?? 0;
}

export function getSupply(db: QueryDb, id: string): Promise<Supply | null> {
  return db.getFirstAsync<Supply>('SELECT * FROM supplies WHERE id = ?', [id]);
}

export async function createSupply(db: QueryDb, fields: SupplyFields): Promise<string> {
  const id = newId();
  const now = nowIso();
  const cols = ['id', ...COLUMNS, 'created_at', 'updated_at'];
  await db.runAsync(
    `INSERT INTO supplies (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    [id, ...COLUMNS.map((c) => fields[c]), now, now],
  );
  return id;
}

export async function updateSupply(db: QueryDb, id: string, fields: SupplyFields): Promise<void> {
  await db.runAsync(
    `UPDATE supplies SET ${COLUMNS.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
    [...COLUMNS.map((c) => fields[c]), nowIso(), id],
  );
}

export async function setSupplyQuantity(db: QueryDb, id: string, quantity: number): Promise<number> {
  const q = Math.max(0, Math.round(quantity * 100) / 100);
  await db.runAsync('UPDATE supplies SET quantity = ?, updated_at = ? WHERE id = ?', [q, nowIso(), id]);
  return q;
}

export type SupplyDeleteResult = { deleted: true } | { deleted: false; usedInProjects: number };

export async function deleteSupply(db: QueryDb, id: string): Promise<SupplyDeleteResult> {
  const used = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(DISTINCT project_id) AS n FROM project_supplies WHERE supply_id = ?',
    [id],
  );
  if (used && used.n > 0) return { deleted: false, usedInProjects: used.n };
  await db.runAsync("DELETE FROM shopping_items WHERE source_type = 'supply' AND source_id = ?", [id]);
  await db.runAsync("DELETE FROM photos WHERE owner_type = 'supply' AND owner_id = ?", [id]);
  await db.runAsync('DELETE FROM supplies WHERE id = ?', [id]);
  return { deleted: true };
}

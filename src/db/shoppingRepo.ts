import type { QueryDb } from './glassRepo.ts';
import { newId, nowIso } from './ids.ts';
import type { ShoppingItem, ShoppingSource } from './types.ts';

export type NewShoppingItem = {
  label: string;
  note?: string | null;
  source_type?: ShoppingSource | null;
  source_id?: string | null;
};

/** Items still to buy first (newest on top), then checked-off ones. */
export function listShopping(db: QueryDb): Promise<ShoppingItem[]> {
  return db.getAllAsync<ShoppingItem>('SELECT * FROM shopping_items ORDER BY done ASC, created_at DESC', []);
}

/**
 * Adds something to buy. If the same glass or supply is already on the list and
 * not checked off, returns that entry instead of adding a duplicate.
 */
export async function addShoppingItem(db: QueryDb, item: NewShoppingItem): Promise<{ id: string; added: boolean }> {
  const label = item.label.trim();
  if (label === '') throw new Error('A shopping item needs a name.');
  if (item.source_type && item.source_id) {
    const existing = await openItemFor(db, item.source_type, item.source_id);
    if (existing) return { id: existing.id, added: false };
  }
  const id = newId();
  const now = nowIso();
  await db.runAsync(
    'INSERT INTO shopping_items (id, label, note, source_type, source_id, done, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
    [id, label, item.note?.trim() || null, item.source_type ?? null, item.source_id ?? null, now, now],
  );
  return { id, added: true };
}

/** The unchecked list entry for a glass or supply, if there is one. */
export function openItemFor(db: QueryDb, type: ShoppingSource, sourceId: string): Promise<ShoppingItem | null> {
  return db.getFirstAsync<ShoppingItem>(
    'SELECT * FROM shopping_items WHERE source_type = ? AND source_id = ? AND done = 0',
    [type, sourceId],
  );
}

export async function setShoppingDone(db: QueryDb, id: string, done: boolean): Promise<void> {
  await db.runAsync('UPDATE shopping_items SET done = ?, updated_at = ? WHERE id = ?', [done ? 1 : 0, nowIso(), id]);
}

export async function deleteShoppingItem(db: QueryDb, id: string): Promise<void> {
  await db.runAsync('DELETE FROM shopping_items WHERE id = ?', [id]);
}

/** Removes everything checked off. Returns how many were removed. */
export async function clearDoneShopping(db: QueryDb): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM shopping_items WHERE done = 1', []);
  await db.runAsync('DELETE FROM shopping_items WHERE done = 1', []);
  return row?.n ?? 0;
}

export async function countOpenShopping(db: QueryDb): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM shopping_items WHERE done = 0', []);
  return row?.n ?? 0;
}

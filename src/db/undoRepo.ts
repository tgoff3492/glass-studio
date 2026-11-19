import type { Bind, QueryDb } from './glassRepo.ts';

// Undo for quick changes: before a change, copy the rows it can touch; to undo, put them
// back exactly. Two kinds of scope:
//   - 'row':  one row by id that must keep existing (a glass or supply). Restored in place,
//             so nothing that points at it is disturbed.
//   - 'set':  every row matching a condition (a glass's sizes, a project line). Rows the
//             change added are removed and the copied ones put back.

type Table = 'glass_items' | 'glass_pieces' | 'supplies' | 'project_glass' | 'project_supplies' | 'shopping_items';

export type UndoScope = { kind: 'row'; table: 'glass_items' | 'supplies'; id: string } | { kind: 'set'; table: Table; where: string; params: Bind[] };

export type UndoSnapshot = { scope: UndoScope; rows: Record<string, unknown>[] }[];

export async function captureUndo(db: QueryDb, scopes: UndoScope[]): Promise<UndoSnapshot> {
  const out: UndoSnapshot = [];
  for (const scope of scopes) {
    const rows =
      scope.kind === 'row'
        ? await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${scope.table} WHERE id = ?`, [scope.id])
        : await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${scope.table} WHERE ${scope.where}`, scope.params);
    out.push({ scope, rows: rows.map((r) => ({ ...r })) });
  }
  return out;
}

export async function applyUndo(db: QueryDb, snapshot: UndoSnapshot): Promise<void> {
  // Parents first (a project line needs its glass), and sets after rows.
  const ordered = [...snapshot].sort((a, b) => (a.scope.kind === b.scope.kind ? 0 : a.scope.kind === 'row' ? -1 : 1));
  for (const { scope, rows } of ordered) {
    if (scope.kind === 'set') await db.runAsync(`DELETE FROM ${scope.table} WHERE ${scope.where}`, scope.params);
    for (const row of rows) {
      const cols = Object.keys(row);
      const updates = cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`);
      await db.runAsync(
        `INSERT INTO ${scope.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})` +
          (updates.length > 0 ? ` ON CONFLICT (id) DO UPDATE SET ${updates.join(', ')}` : ''),
        cols.map((c) => row[c] as Bind),
      );
    }
  }
}

// What each quick change can touch.

export const glassScopes = (glassId: string): UndoScope[] => [
  { kind: 'row', table: 'glass_items', id: glassId },
  { kind: 'set', table: 'glass_pieces', where: 'glass_item_id = ?', params: [glassId] },
];

export const supplyScopes = (supplyId: string): UndoScope[] => [{ kind: 'row', table: 'supplies', id: supplyId }];

export const projectGlassLineScopes = (line: { id: string; glass_item_id: string }): UndoScope[] => [
  ...glassScopes(line.glass_item_id),
  { kind: 'set', table: 'project_glass', where: 'id = ?', params: [line.id] },
];

export const projectSupplyLineScopes = (line: { id: string; supply_id: string }): UndoScope[] => [
  ...supplyScopes(line.supply_id),
  { kind: 'set', table: 'project_supplies', where: 'id = ?', params: [line.id] },
];

export const shoppingItemScopes = (ids: string[]): UndoScope[] =>
  ids.map((id) => ({ kind: 'set' as const, table: 'shopping_items' as const, where: 'id = ?', params: [id] }));

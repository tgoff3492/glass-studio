import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createGlass, getGlass, listGlassSizes, changeGlassSize, setGlassQuantity } from './glassRepo.ts';
import { createProject, listProjectGlass, returnGlass, takeGlass, cutFromSheet } from './projectsRepo.ts';
import { addShoppingItem, deleteShoppingItem, listShopping } from './shoppingRepo.ts';
import { openTestDb } from './testDb.ts';
import { applyUndo, captureUndo, glassScopes, projectGlassLineScopes, shoppingItemScopes } from './undoRepo.ts';
import { validateGlassInput, emptyGlassInput } from '../domain/glass.ts';

async function sheetGlass(db: Awaited<ReturnType<typeof openTestDb>>['db']) {
  const r = validateGlassInput({ ...emptyGlassInput('sheet'), color_name: 'Cobalt', coe: 90, sizes: [{ width: 12, height: 12, count: 1 }] });
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return createGlass(db, r.value, r.sizes);
}

const sizes = async (db: Awaited<ReturnType<typeof openTestDb>>['db'], id: string) =>
  (await listGlassSizes(db, id)).map((s) => `${s.width}x${s.height}:${s.count}`).join(' ');

test('undo puts a burst of size taps back as they were, including sizes the taps added', async () => {
  const { db } = await openTestDb();
  const id = await sheetGlass(db);
  const snap = await captureUndo(db, glassScopes(id));
  await changeGlassSize(db, id, 12, 12, -1);
  await changeGlassSize(db, id, 12, 12, -1); // already 0: no change
  await changeGlassSize(db, id, 6, 6, 2);
  assert.equal(await sizes(db, id), '12x12:0 6x6:2');
  await applyUndo(db, snap);
  assert.equal(await sizes(db, id), '12x12:1');
  assert.equal((await getGlass(db, id))?.quantity, 1);
});

test('undo of a plain quantity change', async () => {
  const { db } = await openTestDb();
  const r = validateGlassInput({ ...emptyGlassInput('frit'), color_name: 'Clear', coe: 90, quantity: '16', unit: 'oz' });
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  const id = await createGlass(db, r.value);
  const snap = await captureUndo(db, glassScopes(id));
  await setGlassQuantity(db, id, 3);
  await applyUndo(db, snap);
  assert.equal((await getGlass(db, id))?.quantity, 16);
});

test('undo of "Put back" takes the glass out again and restores the line', async () => {
  const { db } = await openTestDb();
  const id = await sheetGlass(db);
  const p = await createProject(db, { name: 'Panel', kind: 'stained', notes: null });
  assert.ok((await takeGlass(db, p, id, { size: { width: 12, height: 12 }, count: 1 })).ok);
  const [line] = await listProjectGlass(db, p);
  const snap = await captureUndo(db, projectGlassLineScopes(line));
  await returnGlass(db, line.id);
  assert.equal(await sizes(db, id), '12x12:1');
  await applyUndo(db, snap);
  assert.equal(await sizes(db, id), '12x12:0');
  const back = await listProjectGlass(db, p);
  assert.equal(back.length, 1);
  assert.equal(back[0].id, line.id);
});

test('undo of removing a cut sheet brings the line back without touching inventory', async () => {
  const { db } = await openTestDb();
  const id = await sheetGlass(db);
  const p = await createProject(db, { name: 'Dish', kind: 'fused', notes: null });
  await cutFromSheet(db, p, id, { width: 12, height: 12 }, { kind: 'none' });
  const [line] = await listProjectGlass(db, p);
  const snap = await captureUndo(db, projectGlassLineScopes(line));
  await returnGlass(db, line.id);
  await applyUndo(db, snap);
  assert.equal((await listProjectGlass(db, p))[0].partial, 1);
  assert.equal(await sizes(db, id), '12x12:0');
});

test('undo brings back a shopping item that was removed', async () => {
  const { db } = await openTestDb();
  const { id } = await addShoppingItem(db, { label: 'Flux' });
  const snap = await captureUndo(db, shoppingItemScopes([id]));
  await deleteShoppingItem(db, id);
  await applyUndo(db, snap);
  assert.deepEqual(
    (await listShopping(db)).map((i) => i.label),
    ['Flux'],
  );
});

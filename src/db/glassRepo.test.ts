/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyGlassInput, validateGlassInput, type GlassInput } from '../domain/glass.ts';
import {
  createGlass,
  deleteGlass,
  findGlassByCode,
  getGlass,
  glassWithBarcode,
  linkBarcode,
  listGlass,
  listManufacturers,
  setGlassQuantity,
  updateGlass,
} from './glassRepo.ts';
import { openTestDb } from './testDb.ts';

function fields(overrides: Partial<GlassInput>) {
  const r = validateGlassInput({ ...emptyGlassInput(overrides.kind), ...overrides });
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
}

async function seeded() {
  const t = await openTestDb();
  const ids = {
    royal: await createGlass(t.db, fields({ color_name: 'Deep Royal Blue', manufacturer: 'Bullseye', product_code: '001114', coe: 90, color_family: 'blue', quantity: '2' })),
    amber: await createGlass(t.db, fields({ color_name: 'Light Amber', manufacturer: 'Oceanside', coe: 96, color_family: 'orange', quantity: '1.5' })),
    frit: await createGlass(t.db, fields({ kind: 'frit', color_name: 'Turquoise Blue Coarse', manufacturer: 'Bullseye', coe: 90, color_family: 'blue', quantity: '8', unit: 'oz' })),
    kokomo: await createGlass(t.db, fields({ color_name: 'Cobalt 100% Off', manufacturer: 'Kokomo', color_family: 'blue', quantity: '1' })),
  };
  return { ...t, ids };
}

test('creates and reads back an item', async () => {
  const { db, ids } = await seeded();
  const item = await getGlass(db, ids.royal);
  assert.equal(item?.color_name, 'Deep Royal Blue');
  assert.equal(item?.coe, 90);
  assert.equal(item?.quantity, 2);
  assert.equal(item?.unit, 'sheet');
  assert.ok(item?.created_at);
});

test('lists alphabetically by color', async () => {
  const { db } = await seeded();
  const names = (await listGlass(db)).map((g) => g.color_name);
  assert.deepEqual(names, ['Cobalt 100% Off', 'Deep Royal Blue', 'Light Amber', 'Turquoise Blue Coarse']);
});

test('search matches every word across color, maker and code', async () => {
  const { db } = await seeded();
  assert.deepEqual((await listGlass(db, { search: 'blue bull' })).map((g) => g.color_name), ['Deep Royal Blue', 'Turquoise Blue Coarse']);
  assert.deepEqual((await listGlass(db, { search: '001114' })).map((g) => g.color_name), ['Deep Royal Blue']);
  assert.deepEqual((await listGlass(db, { search: 'AMBER' })).map((g) => g.color_name), ['Light Amber']);
});

test('search treats % and _ as plain characters', async () => {
  const { db } = await seeded();
  assert.deepEqual((await listGlass(db, { search: '100%' })).map((g) => g.color_name), ['Cobalt 100% Off']);
  assert.equal((await listGlass(db, { search: '_' })).length, 0);
});

test('filters by COE, kind and color family', async () => {
  const { db } = await seeded();
  assert.equal((await listGlass(db, { coe: 90 })).length, 2);
  assert.equal((await listGlass(db, { coe: 96 })).length, 1);
  assert.deepEqual((await listGlass(db, { coe: 'none' })).map((g) => g.manufacturer), ['Kokomo']);
  assert.deepEqual((await listGlass(db, { kind: 'frit' })).map((g) => g.color_name), ['Turquoise Blue Coarse']);
  assert.equal((await listGlass(db, { colorFamily: 'blue', coe: 90, kind: 'sheet' })).length, 1);
});

test('updates an item', async () => {
  const { db, ids } = await seeded();
  await updateGlass(db, ids.amber, fields({ color_name: 'Medium Amber', manufacturer: 'Oceanside', coe: 96, quantity: '3' }));
  const item = await getGlass(db, ids.amber);
  assert.equal(item?.color_name, 'Medium Amber');
  assert.equal(item?.quantity, 3);
});

test('quantity never goes below zero and rounds to hundredths', async () => {
  const { db, ids } = await seeded();
  assert.equal(await setGlassQuantity(db, ids.royal, -1), 0);
  assert.equal(await setGlassQuantity(db, ids.royal, 1.23456), 1.23);
  assert.equal((await getGlass(db, ids.royal))?.quantity, 1.23);
});

test('deletes an item, but not one a project uses', async () => {
  const { db, raw, ids } = await seeded();
  assert.deepEqual(await deleteGlass(db, ids.amber), { deleted: true });
  assert.equal(await getGlass(db, ids.amber), null);

  raw.exec(`INSERT INTO projects (id, name, kind, created_at, updated_at) VALUES ('p1', 'Window', 'stained', 'x', 'x')`);
  raw.exec(`INSERT INTO project_glass (id, project_id, glass_item_id, quantity, unit) VALUES ('pg1', 'p1', '${ids.royal}', 1, 'sheet')`);
  assert.deepEqual(await deleteGlass(db, ids.royal), { deleted: false, usedInProjects: 1 });
  assert.ok(await getGlass(db, ids.royal));
});

test('lists the makers she has used', async () => {
  const { db } = await seeded();
  assert.deepEqual(await listManufacturers(db), ['Bullseye', 'Kokomo', 'Oceanside']);
});

test('finds glass by linked barcode, then by product code', async () => {
  const { db, ids } = await seeded();
  assert.deepEqual((await findGlassByCode(db, '001114')).map((g) => g.id), [ids.royal]);
  assert.deepEqual(await findGlassByCode(db, '0123456789012'), []);

  assert.deepEqual(await linkBarcode(db, ids.amber, '0 12345 67890 5'), { linked: true });
  assert.equal((await getGlass(db, ids.amber))?.barcode, '012345678905');
  assert.deepEqual((await findGlassByCode(db, '012345678905')).map((g) => g.id), [ids.amber]);
  assert.deepEqual((await listGlass(db, { search: '678905' })).map((g) => g.id), [ids.amber]);
});

test('a barcode can only belong to one item', async () => {
  const { db, ids } = await seeded();
  await linkBarcode(db, ids.amber, '111');
  const r = await linkBarcode(db, ids.royal, '111');
  assert.equal(r.linked, false);
  if (!r.linked) assert.equal(r.usedBy.id, ids.amber);
  assert.equal((await glassWithBarcode(db, '111', ids.amber)), null);
  assert.equal((await glassWithBarcode(db, '111'))?.id, ids.amber);
  await assert.rejects(createGlass(db, fields({ color_name: 'Copy', barcode: '111' })));
});

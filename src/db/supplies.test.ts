/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  changeCategory,
  emptySupplyInput,
  lowStockNote,
  stockLevel,
  supplyInputFromItem,
  supplyTitle,
  validateSupplyInput,
  type SupplyInput,
} from '../domain/supplies.ts';
import {
  addShoppingItem,
  clearDoneShopping,
  countOpenShopping,
  deleteShoppingItem,
  listShopping,
  openItemFor,
  setShoppingDone,
} from './shoppingRepo.ts';
import {
  countLowSupplies,
  createSupply,
  deleteSupply,
  getSupply,
  listSupplies,
  setSupplyQuantity,
  updateSupply,
} from './suppliesRepo.ts';
import { openTestDb } from './testDb.ts';

function fields(overrides: Partial<SupplyInput>) {
  const base = emptySupplyInput(overrides.category);
  const r = validateSupplyInput({ ...base, ...overrides });
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
}

async function seeded() {
  const t = await openTestDb();
  const ids = {
    foil: await createSupply(t.db, fields({ category: 'foil', size: '7/32 in, black-backed', quantity: '2', min_quantity: '2' })),
    solder: await createSupply(t.db, fields({ category: 'solder', size: '60/40', brand: 'Canfield', quantity: '3', min_quantity: '1' })),
    wash: await createSupply(t.db, fields({ category: 'kiln_wash', quantity: '0' })),
    paper: await createSupply(t.db, fields({ category: 'shelf_paper', quantity: '10' })),
  };
  return { ...t, ids };
}

// ---- rules ----

test('stock level: out at zero, low at or under the minimum', () => {
  assert.equal(stockLevel({ quantity: 0, min_quantity: null }), 'out');
  assert.equal(stockLevel({ quantity: 2, min_quantity: 2 }), 'low');
  assert.equal(stockLevel({ quantity: 3, min_quantity: 2 }), 'ok');
  assert.equal(stockLevel({ quantity: 1, min_quantity: null }), 'ok');
});

test('category picks a sensible name and unit', () => {
  const s = emptySupplyInput('solder');
  assert.equal(s.name, 'Solder');
  assert.equal(s.unit, 'lb');
  const came = changeCategory(s, 'came');
  assert.equal(came.name, 'Lead came');
  assert.equal(came.unit, 'stick');
  const custom = changeCategory({ ...s, name: 'Lead-free solder' }, 'came');
  assert.equal(custom.name, 'Lead-free solder');
});

test('validates name, amounts and price', () => {
  const bad = validateSupplyInput({ ...emptySupplyInput('other'), quantity: 'some', min_quantity: '-1', cost: 'free' });
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    assert.ok(bad.errors.name);
    assert.ok(bad.errors.quantity);
    assert.ok(bad.errors.min_quantity);
    assert.ok(bad.errors.cost);
  }
  const good = validateSupplyInput({ ...emptySupplyInput('foil'), size: ' 1/4 in ', quantity: '3', min_quantity: '1 1/2', cost: '$14.95' });
  assert.ok(good.ok);
  if (good.ok) {
    assert.equal(good.value.size, '1/4 in');
    assert.equal(good.value.min_quantity, 1.5);
    assert.equal(good.value.cost_per_unit_cents, 1495);
  }
});

test('titles and low-stock notes read naturally', () => {
  assert.equal(supplyTitle({ name: 'Copper foil', size: '7/32 in' }), 'Copper foil, 7/32 in');
  assert.equal(supplyTitle({ name: 'Flux', size: null }), 'Flux');
  assert.equal(lowStockNote({ quantity: 1, unit: 'roll', min_quantity: 2 }), '1 roll left · reminder at 2');
  assert.equal(lowStockNote({ quantity: 0, unit: 'lb', min_quantity: null }), 'None left');
});

test('round-trips a supply through the form', () => {
  const v = fields({ category: 'patina', brand: 'Novacan', quantity: '2', min_quantity: '1', cost: '9.5' });
  const again = validateSupplyInput(supplyInputFromItem({ ...v, id: 'x', created_at: '', updated_at: '' }));
  assert.ok(again.ok);
  if (again.ok) assert.deepEqual(again.value, v);
});

// ---- supplies data ----

test('lists, searches and filters supplies', async () => {
  const { db } = await seeded();
  assert.deepEqual((await listSupplies(db)).map((s) => s.name), ['Copper foil', 'Kiln wash', 'Solder', 'Thinfire shelf paper']);
  assert.deepEqual((await listSupplies(db, { search: '60/40' })).map((s) => s.name), ['Solder']);
  assert.deepEqual((await listSupplies(db, { search: 'canfield' })).map((s) => s.name), ['Solder']);
  assert.deepEqual((await listSupplies(db, { group: 'fusing' })).map((s) => s.name), ['Kiln wash', 'Thinfire shelf paper']);
  assert.deepEqual((await listSupplies(db, { lowOnly: true })).map((s) => s.name), ['Copper foil', 'Kiln wash']);
  assert.equal(await countLowSupplies(db), 2);
});

test('restocking takes a supply off the low list', async () => {
  const { db, ids } = await seeded();
  await setSupplyQuantity(db, ids.foil, 6);
  assert.equal(await countLowSupplies(db), 1);
  assert.equal(await setSupplyQuantity(db, ids.foil, -3), 0);
});

test('updates and deletes a supply', async () => {
  const { db, ids } = await seeded();
  await updateSupply(db, ids.solder, fields({ category: 'solder', size: '50/50', quantity: '1' }));
  assert.equal((await getSupply(db, ids.solder))?.size, '50/50');

  await addShoppingItem(db, { label: 'Solder', source_type: 'supply', source_id: ids.solder });
  assert.deepEqual(await deleteSupply(db, ids.solder), { deleted: true });
  assert.equal(await getSupply(db, ids.solder), null);
  assert.equal((await listShopping(db)).length, 0, 'its shopping entry goes too');
});

test('a supply used by a project is kept', async () => {
  const { db, raw, ids } = await seeded();
  raw.exec(`INSERT INTO projects (id, name, kind, created_at, updated_at) VALUES ('p1', 'Lamp', 'stained', 'x', 'x')`);
  raw.exec(`INSERT INTO project_supplies (id, project_id, supply_id, quantity, unit) VALUES ('ps1', 'p1', '${ids.foil}', 1, 'roll')`);
  assert.deepEqual(await deleteSupply(db, ids.foil), { deleted: false, usedInProjects: 1 });
});

// ---- shopping list ----

test('adds, checks off and clears shopping items', async () => {
  const { db } = await openTestDb();
  await addShoppingItem(db, { label: 'Bullseye Tekta clear', note: '2 sheets' });
  await new Promise((r) => setTimeout(r, 5));
  const { id: grinder } = await addShoppingItem(db, { label: 'New grinder bit' });
  assert.equal(await countOpenShopping(db), 2);
  assert.deepEqual((await listShopping(db)).map((s) => s.label), ['New grinder bit', 'Bullseye Tekta clear']);

  await setShoppingDone(db, grinder, true);
  assert.equal(await countOpenShopping(db), 1);
  assert.deepEqual((await listShopping(db)).map((s) => s.label), ['Bullseye Tekta clear', 'New grinder bit'], 'checked items sink');

  assert.equal(await clearDoneShopping(db), 1);
  assert.equal((await listShopping(db)).length, 1);
});

test('the same glass is not added twice while still on the list', async () => {
  const { db } = await openTestDb();
  const first = await addShoppingItem(db, { label: 'Deep Royal Blue', source_type: 'glass', source_id: 'g1' });
  const again = await addShoppingItem(db, { label: 'Deep Royal Blue', source_type: 'glass', source_id: 'g1' });
  assert.equal(first.added, true);
  assert.equal(again.added, false);
  assert.equal(again.id, first.id);
  assert.ok(await openItemFor(db, 'glass', 'g1'));

  await setShoppingDone(db, first.id, true);
  assert.equal(await openItemFor(db, 'glass', 'g1'), null);
  assert.equal((await addShoppingItem(db, { label: 'Deep Royal Blue', source_type: 'glass', source_id: 'g1' })).added, true);

  await deleteShoppingItem(db, first.id);
  assert.equal((await listShopping(db)).length, 1);
  await assert.rejects(addShoppingItem(db, { label: '  ' }));
});

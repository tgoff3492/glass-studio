/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyGlassInput, formatQuantity, inputFromItem, parseAmount, validateGlassInput } from './glass.ts';

test('parses decimals and fractions', () => {
  assert.equal(parseAmount('2'), 2);
  assert.equal(parseAmount(' 1.5 '), 1.5);
  assert.equal(parseAmount('3/4'), 0.75);
  assert.equal(parseAmount('1 1/2'), 1.5);
  assert.equal(parseAmount('1,000'), 1000);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('lots'), null);
});

test('formats quantities with the right unit word', () => {
  assert.equal(formatQuantity(1, 'sheet'), '1 sheet');
  assert.equal(formatQuantity(2.5, 'sheet'), '2.5 sheets');
  assert.equal(formatQuantity(0.333333, 'lb'), '0.33 lb');
  assert.equal(formatQuantity(3, 'piece'), '3 pieces');
});

test('requires a color name and a sensible quantity', () => {
  const r = validateGlassInput({ ...emptyGlassInput(), quantity: '-2' });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.ok(r.errors.color_name);
    assert.ok(r.errors.quantity);
  }
});

test('frit needs a COE, stained sheet glass does not', () => {
  const frit = validateGlassInput({ ...emptyGlassInput('frit'), color_name: 'Clear Fine' });
  assert.equal(frit.ok, false);
  if (!frit.ok) assert.match(frit.errors.coe ?? '', /COE/);

  const sheet = validateGlassInput({ ...emptyGlassInput('sheet'), color_name: 'Kokomo Ruby', quantity: '1' });
  assert.equal(sheet.ok, true);
});

test('cleans up fields and converts price to cents', () => {
  const r = validateGlassInput({
    ...emptyGlassInput('frit'),
    color_name: '  Black Coarse ',
    manufacturer: ' ',
    coe: 96,
    glass_type: 'streaky',
    quantity: '1 1/2',
    unit: 'lb',
    cost: '$18.99',
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.color_name, 'Black Coarse');
    assert.equal(r.value.manufacturer, null);
    assert.equal(r.value.glass_type, null); // types only apply to sheets and scrap
    assert.equal(r.value.quantity, 1.5);
    assert.equal(r.value.cost_per_unit_cents, 1899);
  }
});

test('rejects a nonsense price', () => {
  const r = validateGlassInput({ ...emptyGlassInput(), color_name: 'Clear', cost: 'cheap' });
  assert.equal(r.ok, false);
});

test('round-trips an item through the form', () => {
  const r = validateGlassInput({ ...emptyGlassInput(), color_name: 'Clear', coe: 90, cost: '12.5', quantity: '1' });
  assert.ok(r.ok);
  if (!r.ok) return;
  const item = { ...r.value, id: 'x', created_at: '', updated_at: '' };
  const again = validateGlassInput(inputFromItem(item));
  assert.ok(again.ok);
  if (again.ok) assert.deepEqual(again.value, r.value);
});

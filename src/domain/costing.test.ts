import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatMoney, parseMoney, projectCost } from './costing.ts';

test('adds up glass, supplies and time, and counts a cut sheet as a whole one', () => {
  const c = projectCost({
    glass: [
      { color_name: 'Cobalt', quantity: 2, partial: 0, cost_per_unit_cents: 1250 },
      { color_name: 'Clear', quantity: 1, partial: 1, cost_per_unit_cents: 900 },
      { color_name: 'Ruby', quantity: 1, partial: 0, cost_per_unit_cents: null },
    ],
    supplies: [{ name: 'Copper foil', quantity: 0.25, cost_per_unit_cents: 1400 }],
    minutes: 150,
    hourlyCents: 1500,
    markupPercent: 20,
  });
  assert.equal(c.materialsCents, 2500 + 900 + 350);
  assert.deepEqual(c.unpriced, ['Ruby']);
  assert.equal(c.timeCents, 3750);
  assert.equal(c.totalCents, 7500);
  assert.equal(c.priceCents, 9000);
});

test('no rate means no time cost, no markup means no price', () => {
  const c = projectCost({ glass: [], supplies: [], minutes: 90, hourlyCents: null, markupPercent: null });
  assert.equal(c.timeCents, null);
  assert.equal(c.priceCents, null);
  assert.equal(c.totalCents, 0);
});

test('money in and out', () => {
  assert.equal(formatMoney(1240), '$12.40');
  assert.equal(formatMoney(7200), '$72');
  assert.equal(formatMoney(123456), '$1,234.56');
  assert.equal(parseMoney('$15'), 1500);
  assert.equal(parseMoney('15.5'), 1550);
  assert.equal(parseMoney(''), null);
  assert.equal(parseMoney('abc'), undefined);
});

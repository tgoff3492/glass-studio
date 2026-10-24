/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyGlassInput, validateGlassInput } from './glass.ts';
import {
  changeSize,
  formatArea,
  normalizeSizeSearch,
  parseDimension,
  removeSize,
  sizeLabel,
  summarizeSizes,
  totalAreaSqIn,
  totalSheets,
} from './sizes.ts';

test('sizes read shorter side first', () => {
  assert.equal(sizeLabel(12, 6), '6×12');
  assert.equal(sizeLabel(8.5, 11), '8.5×11');
});

test('parses a side', () => {
  assert.equal(parseDimension('12'), 12);
  assert.equal(parseDimension('8 1/2'), 8.5);
  assert.equal(parseDimension('12"'), 12);
  assert.equal(parseDimension('12 in'), 12);
  assert.equal(parseDimension('0'), null);
  assert.equal(parseDimension('big'), null);
});

test('adds, uses and removes sizes', () => {
  let s = changeSize([], 12, 12, 3);
  s = changeSize(s, 12, 6, 4);
  s = changeSize(s, 6, 12, 1);
  assert.deepEqual(s, [
    { width: 12, height: 12, count: 3 },
    { width: 6, height: 12, count: 5 },
  ]);
  s = changeSize(s, 12, 12, -5);
  assert.equal(s[0].count, 0, 'never below zero');
  assert.deepEqual(changeSize([], 6, 6, -1), [], 'using a size she does not have does nothing');
  assert.deepEqual(removeSize(s, 12, 6), [{ width: 12, height: 12, count: 0 }]);
});

test('totals and summary match how she says it', () => {
  const s = [
    { width: 6, height: 12, count: 4 },
    { width: 12, height: 12, count: 3 },
    { width: 6, height: 6, count: 0 },
  ];
  assert.equal(totalSheets(s), 7);
  assert.equal(totalAreaSqIn(s), 720);
  assert.equal(formatArea(720), '5 sq ft');
  assert.equal(formatArea(36), '36 sq in');
  assert.equal(summarizeSizes(s), '3 × 12×12 · 4 × 6×12');
});

test('search understands 12x12', () => {
  assert.equal(normalizeSizeSearch('12x12'), '12×12');
  assert.equal(normalizeSizeSearch('6 X 12'), '6×12');
  assert.equal(normalizeSizeSearch('blue'), 'blue');
});

test('a sheet listed by size gets its count from the sizes', () => {
  const r = validateGlassInput({
    ...emptyGlassInput('sheet'),
    color_name: 'Clear',
    sizes: [
      { width: 12, height: 12, count: 3 },
      { width: 6, height: 12, count: 4 },
      { width: 6, height: 6, count: 0 },
    ],
  });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.quantity, 7);
    assert.equal(r.value.unit, 'sheet');
    assert.equal(r.value.size_summary, '3 × 12×12 · 4 × 6×12');
    assert.equal(r.sizes.length, 2, 'sizes with none left are dropped');
  }
});

test('a sheet needs sizes or a count', () => {
  const none = validateGlassInput({ ...emptyGlassInput('sheet'), color_name: 'Clear' });
  assert.equal(none.ok, false);
  if (!none.ok) assert.match(none.errors.quantity ?? '', /sizes/);
  const counted = validateGlassInput({ ...emptyGlassInput('sheet'), color_name: 'Clear', quantity: '2' });
  assert.ok(counted.ok);
  if (counted.ok) assert.equal(counted.value.size_summary, null);
});

test('sizes are ignored for frit', () => {
  const r = validateGlassInput({
    ...emptyGlassInput('frit'),
    color_name: 'Clear Fine',
    coe: 96,
    quantity: '8',
    sizes: [{ width: 12, height: 12, count: 1 }],
  });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.quantity, 8);
    assert.deepEqual(r.sizes, []);
  }
});

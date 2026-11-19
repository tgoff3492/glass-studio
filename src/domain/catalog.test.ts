import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CATALOG, codeKey, findByCode, searchCatalog } from './catalog.ts';

test('the catalog has both makers with the right COE', () => {
  assert.ok(CATALOG.filter((g) => g.maker === 'Bullseye').every((g) => g.coe === 90));
  assert.ok(CATALOG.filter((g) => g.maker === 'Oceanside').every((g) => g.coe === 96));
  assert.ok(CATALOG.length > 400);
});

test('every entry has a known color family and no duplicate codes per maker', () => {
  const families = new Set(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown', 'black', 'white', 'gray', 'clear', 'multi']);
  for (const g of CATALOG) assert.ok(families.has(g.colorFamily), `${g.code} ${g.colorFamily}`);
  const seen = new Set<string>();
  for (const g of CATALOG) {
    const k = `${g.maker}:${codeKey(g.code, g.maker)}`;
    assert.ok(!seen.has(k), `duplicate ${k}`);
    seen.add(k);
  }
});

test('Bullseye codes match however they are written', () => {
  for (const typed of ['0100', '100', '000100', '0100-0030', '000100-0030-F']) {
    const hits = findByCode(typed, 'Bullseye');
    assert.equal(hits.length, 1, typed);
    assert.equal(hits[0].name, 'Black');
  }
});

test('Oceanside codes match the catalog and the shop spelling', () => {
  for (const typed of ['523-2W-F', 'SF523.2W', 'sf 523-2w', '523-2W']) {
    const hits = findByCode(typed, 'Oceanside');
    assert.equal(hits.length, 1, typed);
    assert.equal(hits[0].name, 'Teal Green Waterglass');
  }
});

test('search puts the exact code first, then names', () => {
  assert.equal(searchCatalog('1101')[0].name, 'Clear');
  assert.equal(searchCatalog('SF1009')[0].name, 'Black Opal Smooth');
  const cobalt = searchCatalog('cobalt');
  assert.ok(cobalt.length >= 2 && cobalt.every((g) => /cobalt/i.test(g.name)));
  const wispy = searchCatalog('oceanside teal wispy');
  assert.equal(wispy[0].code, '823-92S-F');
  assert.deepEqual(searchCatalog('x'), []);
});

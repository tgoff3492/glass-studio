/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkCoe } from './coe.ts';

test('all COE 96 is compatible', () => {
  assert.deepEqual(checkCoe([96, 96, 96]), { ok: true, coe: 96 });
});

test('unknown COE is ignored', () => {
  assert.deepEqual(checkCoe([90, null]), { ok: true, coe: 90 });
  assert.deepEqual(checkCoe([null]), { ok: true, coe: null });
  assert.deepEqual(checkCoe([]), { ok: true, coe: null });
});

test('mixing 90 and 96 is flagged', () => {
  assert.deepEqual(checkCoe([96, 90, 96]), { ok: false, found: [90, 96] });
});

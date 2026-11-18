import assert from 'node:assert/strict';
import { test } from 'node:test';

import { countEverything, getSetting, setSetting } from './settingsRepo.ts';
import { openTestDb } from './testDb.ts';

test('settings are saved and replaced', async () => {
  const { db } = await openTestDb();
  assert.equal(await getSetting(db, 'x'), null);
  await setSetting(db, 'x', '1');
  await setSetting(db, 'x', '2');
  assert.equal(await getSetting(db, 'x'), '2');
  assert.deepEqual({ ...(await countEverything(db)) }, { glass: 0, supplies: 0, projects: 0, photos: 0 });
});

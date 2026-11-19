import assert from 'node:assert/strict';
import { test } from 'node:test';

import { backupFileName, backupIsDue, describeLastBackup, readBackup, writeBackup, type BackupInfo } from './backupFormat.ts';

const info: BackupInfo = {
  format: 1,
  app: 'Glass Studio',
  schemaVersion: 9,
  createdAt: '2026-11-18T15:00:00.000Z',
  appVersion: '0.2.0',
  counts: { glass: 3, supplies: 1, projects: 1, photos: 2 },
};

async function pack(database: Uint8Array, photos: Record<string, Uint8Array>, i: BackupInfo = info): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  await writeBackup({ info: i, database, photoNames: Object.keys(photos) }, async (n) => photos[n], (c) => chunks.push(c));
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** Reads bytes back 7 at a time, the way the app reads a file in pieces. */
function unpack(bytes: Uint8Array) {
  let at = 0;
  const photos: Record<string, number[]> = {};
  const result = readBackup(
    () => {
      const c = bytes.slice(at, at + 7);
      at += c.length;
      return c;
    },
    (name, chunk) => {
      photos[name] = [...(photos[name] ?? []), ...chunk];
    },
    9,
  );
  return { result, photos };
}

test('a backup round-trips the database and photos', async () => {
  const bytes = await pack(new Uint8Array([1, 2, 3, 4]), { 'a.jpg': new Uint8Array([9, 9]), 'b.png': new Uint8Array([8]) });
  const { result, photos } = unpack(bytes);
  assert.ok(result.ok);
  assert.deepEqual([...result.database], [1, 2, 3, 4]);
  assert.deepEqual(result.photoNames.sort(), ['a.jpg', 'b.png']);
  assert.deepEqual(photos, { 'a.jpg': [9, 9], 'b.png': [8] });
  assert.equal(result.info.counts.glass, 3);
});

test('refuses files that are not backups, or are from a newer app', async () => {
  assert.equal(unpack(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).result.ok, false);
  const newer = unpack(await pack(new Uint8Array([1]), {}, { ...info, schemaVersion: 12 })).result;
  assert.ok(!newer.ok && /newer version/.test(newer.problem));
});

test('photo names cannot climb out of the photos folder', async () => {
  const { result, photos } = unpack(await pack(new Uint8Array([1]), { '../../evil.jpg': new Uint8Array([1]) }));
  assert.ok(result.ok);
  assert.deepEqual(Object.keys(photos), ['evil.jpg']);
});

test('describes when she last backed up', () => {
  const now = new Date(2026, 10, 18, 10);
  assert.equal(describeLastBackup(null, now), 'never');
  assert.equal(describeLastBackup(new Date(2026, 10, 18, 8).toISOString(), now), 'today');
  assert.equal(describeLastBackup(new Date(2026, 10, 17, 23).toISOString(), now), 'yesterday');
  assert.equal(describeLastBackup(new Date(2026, 10, 6).toISOString(), now), '12 days ago');
  assert.equal(backupFileName(now), 'Glass Studio backup 2026-11-18.zip');
});

test('only nudges once there is something to lose', () => {
  const now = new Date(2026, 10, 18);
  assert.equal(backupIsDue(null, 3, now), false);
  assert.equal(backupIsDue(null, 25, now), true);
  assert.equal(backupIsDue(new Date(2026, 10, 1).toISOString(), 25, now), false);
  assert.equal(backupIsDue(new Date(2026, 9, 1).toISOString(), 25, now), true);
});

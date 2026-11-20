import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyGlassInput, validateGlassInput } from '../domain/glass.ts';
import { changeGlassSize, createGlass, deleteGlass, getGlass, listGlassSizes, setGlassQuantity } from './glassRepo.ts';
import { createProject, listProjectGlass, takeGlass } from './projectsRepo.ts';
import { setSetting } from './settingsRepo.ts';
import {
  applyIncoming,
  deviceId,
  markSent,
  nextOutgoing,
  pendingCount,
  prepareForAccount,
  referencedPhotos,
  SYNC_TABLES,
  type SyncDoc,
} from './syncRepo.ts';
import { openTestDb } from './testDb.ts';

type Db = Awaited<ReturnType<typeof openTestDb>>['db'];

/** A stand-in for Firestore: documents in arrival order, newest write wins. */
class FakeCloud {
  log: SyncDoc[] = [];
  push(docs: SyncDoc[]) {
    this.log.push(...docs.map((d) => structuredClone(d)));
  }
  since(n: number) {
    return this.log.slice(n);
  }
}

async function device(name: string) {
  const { db, raw } = await openTestDb();
  await prepareForAccount(db, 'kathryn');
  return { db, raw, id: await deviceId(db), name, seen: 0 };
}

async function push(d: Awaited<ReturnType<typeof device>>, cloud: FakeCloud) {
  for (;;) {
    const out = await nextOutgoing(d.db, d.id);
    if (out.sent.length === 0) return;
    cloud.push(out.docs);
    await markSent(d.db, out.sent);
  }
}

async function pull(d: Awaited<ReturnType<typeof device>>, cloud: FakeCloud) {
  const docs = cloud.since(d.seen);
  d.seen = cloud.log.length;
  return applyIncoming(d.db, docs, d.id);
}

async function sheet(db: Db, color: string, count = 2) {
  const r = validateGlassInput({ ...emptyGlassInput('sheet'), color_name: color, coe: 90, sizes: [{ width: 12, height: 12, count }] });
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return createGlass(db, r.value, r.sizes);
}

/** Everything that syncs, minus timestamps, so two devices can be compared. */
async function snapshot(db: Db) {
  const out: Record<string, unknown[]> = {};
  for (const t of SYNC_TABLES) {
    const rows = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${t} ORDER BY 1`, []);
    out[t] = rows.map((r) => ({ ...r }));
  }
  out.settings = (out.settings as { key: string }[]).filter((s) => s.key === 'hourly_rate_cents' || s.key === 'markup_percent');
  return out;
}

test('every change is noted for sending; changes that arrive are not sent back', async () => {
  const a = await device('iPhone');
  const id = await sheet(a.db, 'Cobalt');
  assert.ok((await pendingCount(a.db)) >= 2); // the glass and its size
  await setSetting(a.db, 'welcome_seen', 'x'); // per-device setting: not synced
  const out = await nextOutgoing(a.db, a.id);
  assert.ok(out.docs.some((d) => d.table === 'glass_items' && d.id === id));
  assert.ok(!out.docs.some((d) => d.table === 'settings'));

  const b = await device('iPad');
  await applyIncoming(b.db, out.docs, b.id);
  assert.equal((await getGlass(b.db, id))?.color_name, 'Cobalt');
  assert.equal(await pendingCount(b.db), 0);
});

test('two devices end up the same: glass, sizes, projects and pricing', async () => {
  const cloud = new FakeCloud();
  const a = await device('iPhone');
  const b = await device('iPad');
  const cobalt = await sheet(a.db, 'Cobalt', 3);
  const p = await createProject(a.db, { name: 'Panel', kind: 'stained', notes: null });
  assert.ok((await takeGlass(a.db, p, cobalt, { size: { width: 12, height: 12 }, count: 1 })).ok);
  await setSetting(a.db, 'hourly_rate_cents', '2000');
  await push(a, cloud);
  await pull(b, cloud);
  assert.deepEqual(await snapshot(b.db), await snapshot(a.db));

  // And back the other way: the iPad uses another sheet.
  await changeGlassSize(b.db, cobalt, 12, 12, -1);
  await push(b, cloud);
  await pull(a, cloud);
  assert.equal((await listGlassSizes(a.db, cobalt))[0].count, 1);
  assert.deepEqual(await snapshot(a.db), await snapshot(b.db));
});

test('deletes reach the other device', async () => {
  const cloud = new FakeCloud();
  const a = await device('iPhone');
  const b = await device('iPad');
  const id = await sheet(a.db, 'Amber');
  await push(a, cloud);
  await pull(b, cloud);
  assert.ok(await getGlass(b.db, id));
  assert.ok((await deleteGlass(a.db, id)).deleted);
  await push(a, cloud);
  await pull(b, cloud);
  assert.equal(await getGlass(b.db, id), null);
  assert.deepEqual(await listGlassSizes(b.db, id), []);
});

test('a change not yet sent is kept, then wins when it goes up', async () => {
  const cloud = new FakeCloud();
  const a = await device('iPhone');
  const b = await device('iPad');
  const r = validateGlassInput({ ...emptyGlassInput('frit'), color_name: 'Clear', coe: 90, quantity: '16', unit: 'oz' });
  if (!r.ok) throw new Error();
  const id = await createGlass(a.db, r.value);
  await push(a, cloud);
  await pull(b, cloud);

  await setGlassQuantity(a.db, id, 10); // iPhone, sent first
  await setGlassQuantity(b.db, id, 4); // iPad, offline
  await push(a, cloud);
  await pull(b, cloud); // the iPad keeps its own unsent 4
  assert.equal((await getGlass(b.db, id))?.quantity, 4);
  await push(b, cloud);
  await pull(a, cloud);
  assert.equal((await getGlass(a.db, id))?.quantity, 4);
});

test('a line that arrives before its glass goes in once the glass does', async () => {
  const a = await device('iPhone');
  const b = await device('iPad');
  const id = await sheet(a.db, 'Ruby', 2);
  const p = await createProject(a.db, { name: 'Lamp', kind: 'stained', notes: null });
  await takeGlass(a.db, p, id, { size: { width: 12, height: 12 }, count: 1 });
  const { docs } = await nextOutgoing(a.db, a.id);
  const lines = docs.filter((d) => d.table === 'project_glass');
  const rest = docs.filter((d) => d.table !== 'project_glass' && d.table !== 'glass_items');
  const glass = docs.filter((d) => d.table === 'glass_items');

  const first = await applyIncoming(b.db, [...lines, ...rest.filter((d) => d.table === 'projects')], b.id);
  assert.equal(first.failed, 1);
  await applyIncoming(b.db, [...glass, ...rest], b.id);
  assert.equal((await listProjectGlass(b.db, p)).length, 1);
});

test('signing in the first time sends what was already here; columns from a newer app are ignored', async () => {
  const { db } = await openTestDb();
  await sheet(db, 'Teal');
  await db.runAsync('DELETE FROM sync_outbox', []); // as if made before sync existed
  assert.equal(await pendingCount(db), 0);
  assert.equal(await prepareForAccount(db, 'kathryn'), true);
  assert.ok((await pendingCount(db)) >= 2);
  assert.equal(await prepareForAccount(db, 'kathryn'), false);

  const b = await device('iPad');
  const doc: SyncDoc = {
    table: 'glass_items',
    id: 'g-new',
    device: 'someone-else',
    data: { id: 'g-new', kind: 'sheet', color_name: 'Lime', quantity: 1, unit: 'sheet', created_at: 'x', updated_at: 'x', sparkle_level: 9 },
  };
  assert.equal((await applyIncoming(b.db, [doc], b.id)).applied, 1);
  assert.equal((await getGlass(b.db, 'g-new'))?.color_name, 'Lime');
});

test('photos are listed by file name; web-preview images are not synced', async () => {
  const a = await device('iPhone');
  const r = validateGlassInput({ ...emptyGlassInput('sheet'), color_name: 'Rose', coe: 96, quantity: '1', photo_uri: 'photos/abc.jpg' });
  if (!r.ok) throw new Error();
  await createGlass(a.db, r.value);
  const r2 = validateGlassInput({ ...emptyGlassInput('sheet'), color_name: 'Web', coe: 96, quantity: '1', photo_uri: 'data:image/png;base64,AAAA' });
  if (!r2.ok) throw new Error();
  const webId = await createGlass(a.db, r2.value);
  assert.deepEqual(await referencedPhotos(a.db), ['abc.jpg']);
  const { docs } = await nextOutgoing(a.db, a.id);
  assert.equal(docs.find((d) => d.id === webId)?.data?.photo_uri, null);
});

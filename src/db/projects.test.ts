/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyGlassInput, validateGlassInput, type GlassInput } from '../domain/glass.ts';
import {
  formatMinutes,
  minutesSoFar,
  projectCoeWarning,
  statusChange,
  statusLabel,
  statusSteps,
  validateProjectInput,
  wouldMixCoe,
} from '../domain/projects.ts';
import { emptySupplyInput, validateSupplyInput } from '../domain/supplies.ts';
import { createGlass, deleteGlass, getGlass, listGlassSizes } from './glassRepo.ts';
import {
  addProjectMinutes,
  addProjectPhoto,
  createProject,
  deleteProject,
  deleteProjectPhoto,
  describeUse,
  getProject,
  listProjectGlass,
  listProjectPhotos,
  listProjects,
  listProjectSupplies,
  projectsUsingGlass,
  returnGlass,
  returnSupply,
  setProjectStatus,
  startProjectTimer,
  stopProjectTimer,
  updateProject,
  takeGlass,
  takeSupply,
} from './projectsRepo.ts';
import { createSupply, getSupply } from './suppliesRepo.ts';
import { openTestDb } from './testDb.ts';

const glassFields = (o: Partial<GlassInput>) => {
  const r = validateGlassInput({ ...emptyGlassInput(o.kind), ...o });
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r;
};

async function setup() {
  const t = await openTestDb();
  const cobalt = glassFields({ color_name: 'Cobalt', coe: 90, sizes: [{ width: 12, height: 12, count: 3 }, { width: 6, height: 12, count: 4 }] });
  const ids = {
    cobalt: await createGlass(t.db, cobalt.value, cobalt.sizes),
    amber: await createGlass(t.db, glassFields({ color_name: 'Amber', coe: 96, quantity: '2' }).value),
    frit: await createGlass(t.db, glassFields({ kind: 'frit', color_name: 'Clear Fine', coe: 90, quantity: '16', unit: 'oz' }).value),
    kokomo: await createGlass(t.db, glassFields({ color_name: 'Kokomo Ruby', quantity: '1' }).value),
  };
  const foil = validateSupplyInput({ ...emptySupplyInput('foil'), quantity: '3' });
  if (!foil.ok) throw new Error();
  const foilId = await createSupply(t.db, foil.value);
  return { ...t, ids, foilId };
}

// ---- rules ----

test('status steps follow the craft', () => {
  assert.ok(!statusSteps('stained').some((s) => s.value === 'firing'), 'stained never goes in the kiln');
  assert.ok(statusSteps('fused').some((s) => s.value === 'firing'));
  assert.equal(statusLabel('stained', 'assembling'), 'Foiling & soldering');
  assert.equal(statusLabel('fused', 'firing'), 'In the kiln');
});

test('status dates', () => {
  const start = statusChange({ started_on: null, finished_on: null }, 'cutting', '2026-10-24');
  assert.deepEqual(start, { status: 'cutting', started_on: '2026-10-24', finished_on: null });
  const done = statusChange({ started_on: '2026-10-01', finished_on: null }, 'done', '2026-10-24');
  assert.equal(done.finished_on, '2026-10-24');
  assert.equal(done.started_on, '2026-10-01');
  const reopened = statusChange({ started_on: '2026-10-01', finished_on: '2026-10-24' }, 'finishing', '2026-10-25');
  assert.equal(reopened.finished_on, null);
  assert.equal(statusChange({ started_on: null, finished_on: null }, 'idea', 'x').started_on, null);
});

test('time reads naturally', () => {
  assert.equal(formatMinutes(45), '45 min');
  assert.equal(formatMinutes(120), '2 h');
  assert.equal(formatMinutes(195), '3 h 15 min');
  assert.equal(minutesSoFar({ minutes_spent: 30, timer_started_at: '2026-10-24T10:00:00.000Z' }, '2026-10-24T10:20:00.000Z'), 50);
});

test('COE warnings only for fused work', () => {
  assert.equal(projectCoeWarning('stained', [{ color_name: 'A', coe: 90 }, { color_name: 'B', coe: 96 }]), null);
  assert.deepEqual(projectCoeWarning('fused', [{ color_name: 'A', coe: 90 }, { color_name: 'B', coe: 96 }]), { kind: 'mixed', found: [90, 96] });
  assert.deepEqual(projectCoeWarning('fused', [{ color_name: 'A', coe: 90 }, { color_name: 'Ruby', coe: null }]), { kind: 'unknown', names: ['Ruby'] });
  assert.equal(projectCoeWarning('fused', [{ color_name: 'A', coe: 90 }]), null);
  assert.equal(wouldMixCoe([90, null], 96), true);
  assert.equal(wouldMixCoe([90], 90), false);
  assert.equal(wouldMixCoe([90], null), false);
});

test('a project needs a name', () => {
  assert.equal(validateProjectInput({ name: ' ', kind: 'fused', notes: '' }).ok, false);
  const ok = validateProjectInput({ name: ' Sun catcher ', kind: 'fused', notes: '' });
  assert.deepEqual(ok, { ok: true, value: { name: 'Sun catcher', kind: 'fused', notes: null } });
});

// ---- data ----

test('using sized sheets takes them out of inventory, and putting back returns them', async () => {
  const { db, ids } = await setup();
  const p = await createProject(db, { name: 'Window', kind: 'stained', notes: null });

  assert.deepEqual(await takeGlass(db, p, ids.cobalt, { size: { width: 12, height: 6 }, count: 2 }), { ok: true });
  assert.deepEqual(await takeGlass(db, p, ids.cobalt, { size: { width: 6, height: 12 }, count: 1 }), { ok: true });
  let sizes = await listGlassSizes(db, ids.cobalt);
  assert.equal(sizes.find((s) => s.width === 6)?.count, 1);
  assert.equal((await getGlass(db, ids.cobalt))?.quantity, 4);

  const lines = await listProjectGlass(db, p);
  assert.equal(lines.length, 1, 'same glass and size adds up on one line');
  assert.equal(describeUse(lines[0]), '3 × 6×12');

  const tooMany = await takeGlass(db, p, ids.cobalt, { size: { width: 12, height: 12 }, count: 5 });
  assert.deepEqual(tooMany, { ok: false, message: 'You have 3 of 12×12.' });

  await returnGlass(db, lines[0].id);
  sizes = await listGlassSizes(db, ids.cobalt);
  assert.equal(sizes.find((s) => s.width === 6)?.count, 4);
  assert.equal((await listProjectGlass(db, p)).length, 0);
});

test('using an amount of frit or counted sheets', async () => {
  const { db, ids } = await setup();
  const p = await createProject(db, { name: 'Bowl', kind: 'fused', notes: null });
  assert.deepEqual(await takeGlass(db, p, ids.frit, { quantity: 4.5 }), { ok: true });
  assert.equal((await getGlass(db, ids.frit))?.quantity, 11.5);
  assert.deepEqual(await takeGlass(db, p, ids.frit, { quantity: 20 }), { ok: false, message: 'You have 11.5 oz.' });
  assert.deepEqual(await takeGlass(db, p, ids.frit, { quantity: 0 }), { ok: false, message: 'Enter how much you used.' });
  const [line] = await listProjectGlass(db, p);
  assert.equal(describeUse(line), '4.5 oz');
  await returnGlass(db, line.id);
  assert.equal((await getGlass(db, ids.frit))?.quantity, 16);
});

test('supplies used and put back', async () => {
  const { db, foilId } = await setup();
  const p = await createProject(db, { name: 'Lamp', kind: 'stained', notes: null });
  assert.deepEqual(await takeSupply(db, p, foilId, 1), { ok: true });
  assert.deepEqual(await takeSupply(db, p, foilId, 0.5), { ok: true });
  assert.equal((await getSupply(db, foilId))?.quantity, 1.5);
  const [line] = await listProjectSupplies(db, p);
  assert.equal(line.quantity, 1.5);
  assert.equal(line.name, 'Copper foil');
  assert.deepEqual(await takeSupply(db, p, foilId, 5), { ok: false, message: 'You have 1.5 rolls.' });
  await returnSupply(db, line.id);
  assert.equal((await getSupply(db, foilId))?.quantity, 3);
});

test('status, edits and time', async () => {
  const { db } = await setup();
  const p = await createProject(db, { name: 'Plate', kind: 'fused', notes: null });
  await setProjectStatus(db, p, 'firing');
  let proj = await getProject(db, p);
  assert.equal(proj?.status, 'firing');
  assert.ok(proj?.started_on);

  await updateProject(db, p, { name: 'Plate', kind: 'stained', notes: 'Changed my mind' });
  proj = await getProject(db, p);
  assert.equal(proj?.status, 'finishing', 'stained has no kiln step');

  await setProjectStatus(db, p, 'done');
  assert.ok((await getProject(db, p))?.finished_on);

  await addProjectMinutes(db, p, 30);
  await addProjectMinutes(db, p, -45);
  assert.equal((await getProject(db, p))?.minutes_spent, 0);

  await startProjectTimer(db, p, '2026-10-24T10:00:00.000Z');
  await startProjectTimer(db, p, '2026-10-24T10:30:00.000Z');
  assert.equal((await getProject(db, p))?.timer_started_at, '2026-10-24T10:00:00.000Z', 'starting again keeps the first start');
  assert.equal(await stopProjectTimer(db, p, '2026-10-24T11:15:00.000Z'), 75);
  proj = await getProject(db, p);
  assert.equal(proj?.minutes_spent, 75);
  assert.equal(proj?.timer_started_at, null);
  assert.equal(await stopProjectTimer(db, p), 0);
});

test('lists, filters and photos', async () => {
  const { db, ids } = await setup();
  const a = await createProject(db, { name: 'Sunflower panel', kind: 'stained', notes: null });
  const b = await createProject(db, { name: 'Ocean bowl', kind: 'fused', notes: 'Blues and teals' });
  await setProjectStatus(db, b, 'done');
  await takeGlass(db, a, ids.kokomo, { quantity: 1 });
  const photo = await addProjectPhoto(db, a, 'file://one.jpg');

  const active = await listProjects(db, { show: 'active' });
  assert.deepEqual(active.map((p) => p.name), ['Sunflower panel']);
  assert.equal(active[0].cover_uri, 'file://one.jpg');
  assert.equal(active[0].glass_count, 1);
  assert.deepEqual((await listProjects(db, { show: 'done' })).map((p) => p.name), ['Ocean bowl']);
  assert.deepEqual((await listProjects(db, { kind: 'fused' })).map((p) => p.name), ['Ocean bowl']);
  assert.deepEqual((await listProjects(db, { search: 'teal' })).map((p) => p.name), ['Ocean bowl']);
  assert.deepEqual((await projectsUsingGlass(db, ids.kokomo)).map((p) => p.name), ['Sunflower panel']);

  assert.equal(await deleteProjectPhoto(db, photo), 'file://one.jpg');
  assert.equal((await listProjectPhotos(db, a)).length, 0);
});

test('deleting a project can put materials back, or leave them used', async () => {
  const { db, ids, foilId } = await setup();
  const keep = await createProject(db, { name: 'Used up', kind: 'fused', notes: null });
  await takeGlass(db, keep, ids.amber, { quantity: 1 });
  await addProjectPhoto(db, keep, 'file://a.jpg');
  assert.deepEqual(await deleteGlass(db, ids.amber), { deleted: false, usedInProjects: 1 });
  assert.deepEqual(await deleteProject(db, keep, false), ['file://a.jpg']);
  assert.equal((await getGlass(db, ids.amber))?.quantity, 1, 'stays used');

  const back = await createProject(db, { name: 'Never started', kind: 'stained', notes: null });
  await takeGlass(db, back, ids.cobalt, { size: { width: 12, height: 12 }, count: 1 });
  await takeSupply(db, back, foilId, 1);
  await deleteProject(db, back, true);
  assert.equal((await listGlassSizes(db, ids.cobalt)).find((s) => s.width === 12)?.count, 3);
  assert.equal((await getSupply(db, foilId))?.quantity, 3);
  assert.equal(await getProject(db, back), null);
});

/// <reference types="node" />
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { LATEST_VERSION, migrations } from './migrations.ts';
import { runMigrations, type MigratableDb } from './runMigrations.ts';

// Wraps Node's built-in SQLite in the same async shape expo-sqlite exposes.
function openTestDb() {
  const raw = new DatabaseSync(':memory:');
  const db: MigratableDb = {
    async execAsync(sql) {
      raw.exec(sql);
    },
    async getFirstAsync<T>(sql: string) {
      return (raw.prepare(sql).get() as T) ?? null;
    },
  };
  return { raw, db };
}

const now = '2026-10-16T00:00:00.000Z';

test('migrates a new database to the latest version', async () => {
  const { raw, db } = openTestDb();
  assert.equal(await runMigrations(db), LATEST_VERSION);
  const tables = raw
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((r) => (r as { name: string }).name);
  for (const t of ['glass_items', 'supplies', 'projects', 'project_glass', 'project_supplies', 'photos', 'firing_schedules', 'schedule_segments', 'firings']) {
    assert.ok(tables.includes(t), `missing table ${t}`);
  }
});

test('running again is a no-op', async () => {
  const { db } = openTestDb();
  await runMigrations(db);
  assert.equal(await runMigrations(db), LATEST_VERSION);
});

test('rejects a COE other than 90 or 96', async () => {
  const { raw, db } = openTestDb();
  await runMigrations(db);
  const insert = raw.prepare(
    'INSERT INTO glass_items (id, kind, color_name, coe, quantity, unit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  insert.run('a', 'sheet', 'Deep Royal Blue', 90, 1, 'sheet', now, now);
  insert.run('b', 'sheet', 'Clear', null, 1, 'sheet', now, now);
  assert.throws(() => insert.run('c', 'sheet', 'Mystery', 104, 1, 'sheet', now, now));
});

test('glass used in a project cannot be deleted out from under it', async () => {
  const { raw, db } = openTestDb();
  await runMigrations(db);
  raw.exec(`
    INSERT INTO glass_items (id, kind, color_name, coe, quantity, unit, created_at, updated_at)
      VALUES ('g1', 'sheet', 'Amber', 96, 2, 'sheet', '${now}', '${now}');
    INSERT INTO projects (id, name, kind, created_at, updated_at)
      VALUES ('p1', 'Sun catcher', 'fused', '${now}', '${now}');
    INSERT INTO project_glass (id, project_id, glass_item_id, quantity, unit)
      VALUES ('pg1', 'p1', 'g1', 0.5, 'sheet');
  `);
  assert.throws(() => raw.exec("DELETE FROM glass_items WHERE id = 'g1'"));
  raw.exec("DELETE FROM projects WHERE id = 'p1'");
  const left = raw.prepare('SELECT COUNT(*) AS n FROM project_glass').get() as { n: number };
  assert.equal(left.n, 0);
});

test('a failed migration rolls back and keeps the old version', async () => {
  const { raw, db } = openTestDb();
  const broken = [...migrations, { version: LATEST_VERSION + 1, sql: 'CREATE TABLE extra (id TEXT); SELECT nope FROM missing;' }];
  await assert.rejects(runMigrations(db, broken));
  const v = raw.prepare('PRAGMA user_version').get() as { user_version: number };
  assert.equal(v.user_version, LATEST_VERSION);
  const extra = raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'extra'").get() as { n: number };
  assert.equal(extra.n, 0);
});

test('migration 6 rebuilds glass without losing sizes or project links, and moves dichroic over', async () => {
  const { raw, db } = openTestDb();
  await runMigrations(db, migrations.filter((m) => m.version <= 5));
  raw.exec(`
    INSERT INTO glass_items (id, kind, color_name, coe, quantity, unit, size_summary, barcode, created_at, updated_at)
      VALUES ('g1', 'sheet', 'Cobalt', 90, 3, 'sheet', '3 × 12×12', '111', '${now}', '${now}');
    INSERT INTO glass_pieces (id, glass_item_id, width_in, height_in, count) VALUES ('gp1', 'g1', 12, 12, 3);
    INSERT INTO projects (id, name, kind, created_at, updated_at) VALUES ('p1', 'Bowl', 'fused', '${now}', '${now}');
    INSERT INTO project_glass (id, project_id, glass_item_id, quantity, unit) VALUES ('pg1', 'p1', 'g1', 1, 'sheet');
    INSERT INTO supplies (id, category, name, size, brand, quantity, unit, cost_per_unit_cents, created_at, updated_at)
      VALUES ('s1', 'dichroic', 'Dichroic glass', 'COE 96 on black, 2 × 2 in', 'CBS', 6, 'piece', 450, '${now}', '${now}');
    INSERT INTO supplies (id, category, name, quantity, unit, created_at, updated_at)
      VALUES ('s2', 'foil', 'Copper foil', 2, 'roll', '${now}', '${now}');
    INSERT INTO project_supplies (id, project_id, supply_id, quantity, unit) VALUES ('ps1', 'p1', 's1', 2, 'piece');
    INSERT INTO project_supplies (id, project_id, supply_id, quantity, unit) VALUES ('ps2', 'p1', 's2', 1, 'roll');
    INSERT INTO shopping_items (id, label, source_type, source_id, done, created_at, updated_at)
      VALUES ('sh1', 'Dichroic', 'supply', 's1', 0, '${now}', '${now}');
  `);

  assert.equal(await runMigrations(db), LATEST_VERSION);
  const one = <T,>(sql: string) => raw.prepare(sql).get() as T;
  const count = (sql: string) => (raw.prepare(sql).get() as { n: number }).n;

  assert.equal(count('SELECT COUNT(*) AS n FROM glass_pieces'), 1, 'sizes survive the rebuild');
  assert.equal(count("SELECT COUNT(*) AS n FROM project_glass WHERE glass_item_id = 'g1'"), 1, 'project links survive');
  assert.equal(one<{ barcode: string }>("SELECT barcode FROM glass_items WHERE id = 'g1'").barcode, '111');

  const dichro = one<{ kind: string; color_name: string; coe: number; manufacturer: string; quantity: number; cost_per_unit_cents: number }>(
    "SELECT * FROM glass_items WHERE id = 's1'",
  );
  assert.equal(dichro.kind, 'dichroic');
  assert.equal(dichro.color_name, 'Dichroic, COE 96 on black, 2 × 2 in');
  assert.equal(dichro.coe, 96);
  assert.equal(dichro.manufacturer, 'CBS');
  assert.equal(dichro.quantity, 6);
  assert.equal(dichro.cost_per_unit_cents, 450);
  assert.equal(count("SELECT COUNT(*) AS n FROM supplies WHERE category = 'dichroic'"), 0);
  assert.equal(count("SELECT COUNT(*) AS n FROM project_glass WHERE glass_item_id = 's1' AND quantity = 2"), 1, 'its project use moves too');
  assert.equal(count('SELECT COUNT(*) AS n FROM project_supplies'), 1, 'foil use stays a supply');
  assert.equal(one<{ source_type: string }>("SELECT source_type FROM shopping_items WHERE id = 'sh1'").source_type, 'glass');

  // The rebuilt table still enforces its rules, and links are back on.
  assert.throws(() => raw.exec(`INSERT INTO glass_items (id, kind, color_name, quantity, unit, created_at, updated_at) VALUES ('x', 'bogus', 'X', 1, 'sheet', 'x', 'x')`));
  assert.throws(() => raw.exec(`INSERT INTO glass_items (id, kind, color_name, quantity, unit, barcode, created_at, updated_at) VALUES ('y', 'sheet', 'Y', 1, 'sheet', '111', 'x', 'x')`));
  assert.throws(() => raw.exec("DELETE FROM glass_items WHERE id = 'g1'"), 'glass used by a project still cannot be deleted');
  assert.equal(one<{ foreign_keys: number }>('PRAGMA foreign_keys').foreign_keys, 1);
});

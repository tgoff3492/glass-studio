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

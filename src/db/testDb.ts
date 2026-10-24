/// <reference types="node" />
// Test helper only: never imported by the app. Wraps Node's built-in SQLite in
// the same async shape expo-sqlite exposes, so database code can be tested off-device.
import { DatabaseSync } from 'node:sqlite';

import type { QueryDb } from './glassRepo.ts';
import { runMigrations, type MigratableDb } from './runMigrations.ts';

type Bind = string | number | null;

export async function openTestDb() {
  const raw = new DatabaseSync(':memory:');
  const db: MigratableDb & QueryDb = {
    async execAsync(sql: string) {
      raw.exec(sql);
    },
    async getFirstAsync<T>(sql: string, params: Bind[] = []) {
      return (raw.prepare(sql).get(...params) as T) ?? null;
    },
    async getAllAsync<T>(sql: string, params: Bind[] = []) {
      return raw.prepare(sql).all(...params) as T[];
    },
    async runAsync(sql: string, params: Bind[] = []) {
      return raw.prepare(sql).run(...params);
    },
  };
  await runMigrations(db);
  return { raw, db };
}

import type { SQLiteDatabase } from 'expo-sqlite';

// The web preview keeps its database inside the browser; there's no folder to copy into.
export async function snapshotDatabase(_db: SQLiteDatabase, _label: string): Promise<boolean> {
  return false;
}

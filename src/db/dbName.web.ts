/**
 * The web preview's database. Adding ?device=2 to the address opens a second, separate
 * one, so two browser tabs can act like an iPhone and an iPad when testing sync.
 */
export function databaseName(): string {
  const d = new URLSearchParams(globalThis.location?.search ?? '').get('device');
  return d && /^[a-z0-9-]{1,20}$/i.test(d) ? `glass-studio-${d}.db` : 'glass-studio.db';
}

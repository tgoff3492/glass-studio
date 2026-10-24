/** Parses "1.5", "1 1/2", "1/2" or "3/4". Returns null if it isn't a number. */
export function parseAmount(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const n = Number(t.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

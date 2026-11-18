import type { Coe, GlassType } from '../db/types.ts';
import { BULLSEYE_COE90, OCEANSIDE_COE96, type CatalogRow } from './catalogData.ts';

// A built-in list of the glass the big makers publish, so adding a sheet can be
// "type 1101, tap" instead of filling in every field by hand.

export type CatalogGlass = {
  maker: 'Bullseye' | 'Oceanside';
  code: string;
  name: string;
  coe: Coe;
  glassType: GlassType;
  colorFamily: string;
  /** The maker's screen approximation, when they publish one. */
  hex: string | null;
};

const toEntry =
  (maker: CatalogGlass['maker'], coe: Coe) =>
  (r: CatalogRow): CatalogGlass => ({
    maker,
    code: r[0],
    name: r[1],
    coe,
    glassType: r[2],
    colorFamily: r[3],
    hex: r[4] || null,
  });

export const CATALOG: CatalogGlass[] = [...BULLSEYE_COE90.map(toEntry('Bullseye', 90)), ...OCEANSIDE_COE96.map(toEntry('Oceanside', 96))];

/**
 * Reduces a code to the part that identifies the glass, so the ways it's written
 * on labels and in shops all match:
 *  - Bullseye: "0100", "100", "000100", "0100-0030", "000100-0030-F" → "100"
 *  - Oceanside: "523-2W-F", "SF523.2W", "sf 523-2w" → "5232W"
 */
export function codeKey(code: string, maker?: CatalogGlass['maker']): string {
  let s = code.trim().toUpperCase().replace(/\s+/g, '');
  // "SF" is how shops write Oceanside codes, so it never names a Bullseye glass.
  if (maker === 'Bullseye' && /^SF\d/.test(s)) return '';
  const bullseye = s.match(/^0*(\d{2,4})(?:-\d{4})?(?:-[A-Z]{1,3})?$/);
  if (bullseye && maker !== 'Oceanside') return bullseye[1].replace(/^0+(?=\d)/, '');
  s = s
    .replace(/^SF(?=\d)/, '')
    .replace(/\./g, '-')
    .replace(/-F$/, '');
  return s.replace(/[^A-Z0-9]/g, '');
}

const KEYS = CATALOG.map((g) => ({ g, key: codeKey(g.code, g.maker), words: `${g.maker} ${g.name} ${g.code}`.toLowerCase() }));

/** The catalog entries whose code matches exactly. Used for scanned labels and typed codes. */
export function findByCode(code: string, maker?: string | null): CatalogGlass[] {
  const m = makerOf(maker);
  return KEYS.filter((k) => (!m || k.g.maker === m) && k.key === codeKey(code, k.g.maker)).map((k) => k.g);
}

/**
 * Search by code or words. "1101", "cobalt", "oceanside teal wispy" and "SF523.2W" all work.
 * Exact code matches come first, then codes that start with what she typed, then name matches.
 */
export function searchCatalog(query: string, limit = 20): CatalogGlass[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const words = q.split(/\s+/).filter(Boolean);
  const scored: { g: CatalogGlass; score: number; i: number; len: number }[] = [];
  KEYS.forEach(({ g, key, words: hay }, i) => {
    const qKey = codeKey(q, g.maker);
    let score = 0;
    if (qKey && key === qKey) score = 3;
    else if (qKey.length >= 2 && /\d/.test(qKey) && key.startsWith(qKey)) score = 2;
    else if (words.every((w) => hay.includes(w))) score = 1;
    if (score > 0) scored.push({ g, score, i, len: key.length });
  });
  return scored
    .sort((a, b) => b.score - a.score || (a.score === 2 ? a.len - b.len : 0) || a.i - b.i)
    .slice(0, limit)
    .map((s) => s.g);
}

function makerOf(maker?: string | null): CatalogGlass['maker'] | null {
  const m = (maker ?? '').trim().toLowerCase();
  if (m.startsWith('bull')) return 'Bullseye';
  if (m.startsWith('ocean') || m.startsWith('spectrum')) return 'Oceanside';
  return null;
}

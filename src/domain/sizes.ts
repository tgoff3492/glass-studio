import { parseAmount } from './numbers.ts';

// Sheet glass is counted by size: "3 12×12s and 4 6×12s". Sizes are in inches.

export type SheetSize = { width: number; height: number; count: number };

/** One-tap sizes in the form. Anything else can be typed. */
export const COMMON_SIZES: [number, number][] = [
  [6, 6],
  [6, 12],
  [12, 12],
  [12, 24],
  [24, 24],
];

/** 12×6 and 6×12 are the same piece, so the shorter side always comes first. */
export function normalizeSize(width: number, height: number): [number, number] {
  return width <= height ? [width, height] : [height, width];
}

const num = (n: number) => String(Number(n.toFixed(2)));

/** "6×12". */
export function sizeLabel(width: number, height: number): string {
  const [w, h] = normalizeSize(width, height);
  return `${num(w)}×${num(h)}`;
}

/** Reads one side, like "12", "8.5" or "8 1/2". Null if it isn't a sensible size. */
export function parseDimension(text: string): number | null {
  const n = parseAmount(text.replace(/("|in(ches)?)$/i, '').trim());
  if (n === null || n <= 0 || n > 120) return null;
  return n;
}

/** Adds `delta` sheets of a size, creating the size if it's new. Counts never go below zero. */
export function changeSize(sizes: SheetSize[], width: number, height: number, delta: number): SheetSize[] {
  const [w, h] = normalizeSize(width, height);
  const i = sizes.findIndex((s) => s.width === w && s.height === h);
  if (i === -1) return delta > 0 ? [...sizes, { width: w, height: h, count: delta }] : sizes;
  return sizes.map((s, j) => (j === i ? { ...s, count: Math.max(0, s.count + delta) } : s));
}

export function removeSize(sizes: SheetSize[], width: number, height: number): SheetSize[] {
  const [w, h] = normalizeSize(width, height);
  return sizes.filter((s) => !(s.width === w && s.height === h));
}

/** Largest pieces first, which is how people tend to list them. */
export function sortSizes(sizes: SheetSize[]): SheetSize[] {
  return [...sizes].sort((a, b) => b.width * b.height - a.width * a.height || a.width - b.width);
}

export function totalSheets(sizes: SheetSize[]): number {
  return sizes.reduce((n, s) => n + s.count, 0);
}

export function totalAreaSqIn(sizes: SheetSize[]): number {
  return sizes.reduce((n, s) => n + s.count * s.width * s.height, 0);
}

/** "5 sq ft", "1.5 sq ft", or square inches for small amounts. */
export function formatArea(sqIn: number): string {
  if (sqIn <= 0) return '0 sq ft';
  if (sqIn < 72) return `${num(sqIn)} sq in`;
  return `${num(Math.round((sqIn / 144) * 10) / 10)} sq ft`;
}

/** "3 × 12×12 · 4 × 6×12". Sizes with none left are left out. Also what search matches against. */
export function summarizeSizes(sizes: SheetSize[]): string {
  return sortSizes(sizes.filter((s) => s.count > 0))
    .map((s) => `${s.count} × ${sizeLabel(s.width, s.height)}`)
    .join(' · ');
}

/** Lets "12x12" or "12 X 12" in the search box match the stored "12×12". */
export function normalizeSizeSearch(word: string): string {
  return word.replace(/(\d)\s*[xX*×]\s*(\d)/g, '$1×$2');
}

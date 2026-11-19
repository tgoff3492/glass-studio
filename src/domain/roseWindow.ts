// The rose window drawn in the app icon and the welcome animation: a gold center,
// a ring of eight violet and lavender petals, and an outer ring of sixteen jewel
// colors, held together by dark lead lines. Coordinates are in a 220 × 220 box
// centered on 0,0. Plain data, so the icon script and the app share one drawing.

export const WINDOW_RADIUS = 100;
export const LEAD = '#1C2540';

export type Piece = {
  id: string;
  /** SVG path in the -110…110 box. */
  d: string;
  fill: string;
  /** Which ring it's in, 0 = center. Pieces arrive ring by ring. */
  ring: 0 | 1 | 2;
  /** The middle of the piece, for flying it in from the right direction. */
  cx: number;
  cy: number;
};

const CENTER = '#F2B544';
const RING1 = ['#7E5BC9', '#C9B6F2'];
const RING2 = ['#2E9C94', '#3E6FC2', '#D9577A', '#E9A23B'];

const R0 = 24;
const R1 = 60;
const R2 = 96;

const round = (n: number) => Math.round(n * 100) / 100;
const pt = (r: number, a: number) => `${round(r * Math.cos(a))} ${round(r * Math.sin(a))}`;

/** A ring segment between two radii and two angles (radians, 0 = right, clockwise). */
function wedge(r1: number, r2: number, a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return [
    `M ${pt(r1, a0)}`,
    `L ${pt(r2, a0)}`,
    `A ${r2} ${r2} 0 ${large} 1 ${pt(r2, a1)}`,
    `L ${pt(r1, a1)}`,
    `A ${r1} ${r1} 0 ${large} 0 ${pt(r1, a0)}`,
    'Z',
  ].join(' ');
}

/**
 * A petal: pointed at the outside, rounded where it meets the center. Reads as a
 * flower rather than a pie, which is what makes it look like leaded glass.
 */
function petal(r1: number, r2: number, a0: number, a1: number): string {
  const mid = (a0 + a1) / 2;
  const shoulder = r1 + (r2 - r1) * 0.55;
  return [
    `M ${pt(r1, a0)}`,
    `Q ${pt(shoulder * 1.08, a0)} ${pt(r2, mid)}`,
    `Q ${pt(shoulder * 1.08, a1)} ${pt(r1, a1)}`,
    `A ${r1} ${r1} 0 0 0 ${pt(r1, a0)}`,
    'Z',
  ].join(' ');
}

function centroid(r1: number, r2: number, a0: number, a1: number) {
  const r = (r1 + r2) / 2;
  const a = (a0 + a1) / 2;
  return { cx: round(r * Math.cos(a)), cy: round(r * Math.sin(a)) };
}

export function roseWindowPieces(): Piece[] {
  const pieces: Piece[] = [];
  pieces.push({
    id: 'c',
    d: `M ${-R0} 0 A ${R0} ${R0} 0 1 1 ${R0} 0 A ${R0} ${R0} 0 1 1 ${-R0} 0 Z`,
    fill: CENTER,
    ring: 0,
    cx: 0,
    cy: 0,
  });
  const start = -Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const a0 = start + (i * Math.PI) / 4;
    const a1 = a0 + Math.PI / 4;
    pieces.push({ id: `p${i}`, d: petal(R0, R1 + 6, a0, a1), fill: RING1[i % 2], ring: 1, ...centroid(R0, R1, a0, a1) });
  }
  // The gaps between petals, so the ring has no holes.
  for (let i = 0; i < 8; i++) {
    const a0 = start + (i * Math.PI) / 4;
    const a1 = a0 + Math.PI / 4;
    pieces.push({ id: `g${i}`, d: gapBetweenPetals(a0, a1), fill: '#E8E2F7', ring: 1, ...centroid(R1 - 10, R1, a0, a1) });
  }
  for (let i = 0; i < 16; i++) {
    const a0 = start + (i * Math.PI) / 8 - Math.PI / 16;
    const a1 = a0 + Math.PI / 8;
    pieces.push({ id: `o${i}`, d: wedge(R1, R2, a0, a1), fill: RING2[i % 4], ring: 2, ...centroid(R1, R2, a0, a1) });
  }
  return pieces;
}

/** The clear glass behind each petal tip, filling out to the ring of jewels. */
function gapBetweenPetals(a0: number, a1: number): string {
  const mid = (a0 + a1) / 2;
  const shoulder = (R0 + (R1 + 6 - R0) * 0.55) * 1.08;
  // Outline: along the outer circle from a0 to a1, then back along the petal edges.
  return [
    `M ${pt(R1, a0)}`,
    `A ${R1} ${R1} 0 0 1 ${pt(R1, a1)}`,
    `L ${pt(R0, a1)}`,
    `Q ${pt(shoulder, a1)} ${pt(R1 + 6, mid)}`,
    `Q ${pt(shoulder, a0)} ${pt(R0, a0)}`,
    'Z',
  ].join(' ');
}

/** A whole window as one SVG string, for the icon script and the web. */
export function roseWindowSvg({
  size,
  background,
  lead = 6,
  glow = false,
}: {
  size: number;
  background?: string;
  lead?: number;
  glow?: boolean;
}): string {
  const pieces = roseWindowPieces();
  const bg = background ? `<rect x="-${size}" y="-${size}" width="${size * 2}" height="${size * 2}" fill="${background}"/>` : '';
  const glowDefs = glow
    ? `<defs><radialGradient id="glow"><stop offset="0" stop-color="#FFF4D6" stop-opacity="0.55"/><stop offset="1" stop-color="#FFF4D6" stop-opacity="0"/></radialGradient></defs><circle r="108" fill="url(#glow)"/>`
    : '';
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-110 -110 220 220">`,
    bg,
    glowDefs,
    `<circle r="${WINDOW_RADIUS}" fill="${LEAD}"/>`,
    ...pieces.map((p) => `<path d="${p.d}" fill="${p.fill}" stroke="${LEAD}" stroke-width="${lead / 2}" stroke-linejoin="round"/>`),
    `<circle r="${WINDOW_RADIUS - 2}" fill="none" stroke="${LEAD}" stroke-width="${lead}"/>`,
    '</svg>',
  ].join('');
}

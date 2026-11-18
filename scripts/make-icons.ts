// Draws the app icon, splash and Android icons from the same rose window the
// welcome animation uses. Needs rsvg-convert (macOS: `brew install librsvg`).
//
//   node --experimental-strip-types scripts/make-icons.ts

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { roseWindowPieces, roseWindowSvg } from '../src/domain/roseWindow.ts';

const NAVY = '#24304F';
const NAVY_DEEP = '#18203A';
const out = (name: string) => join(import.meta.dirname, '..', 'assets', name);
const tmp = mkdtempSync(join(tmpdir(), 'icons-'));

/** The window, `fraction` of the canvas wide, centered. */
function windowAt(size: number, fraction: number, lead = 6): string {
  const w = size * fraction;
  const inner = roseWindowSvg({ size: w, lead }).replace('<svg ', `<svg x="${(size - w) / 2}" y="${(size - w) / 2}" `);
  return inner;
}

function render(name: string, size: number, body: string): void {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;
  const file = join(tmp, name.replace('.png', '.svg'));
  writeFileSync(file, svg);
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), file, '-o', out(name)]);
  console.log(`wrote assets/${name}`);
}

const glow = (size: number) =>
  `<defs><radialGradient id="bg" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#3A4A78"/><stop offset="0.6" stop-color="${NAVY}"/><stop offset="1" stop-color="${NAVY_DEEP}"/></radialGradient>` +
  `<radialGradient id="halo"><stop offset="0.55" stop-color="#FFF1CC" stop-opacity="0.35"/><stop offset="1" stop-color="#FFF1CC" stop-opacity="0"/></radialGradient></defs>` +
  `<rect width="${size}" height="${size}" fill="url(#bg)"/><circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.47}" fill="url(#halo)"/>`;

// iOS: full bleed, no transparency. iOS rounds the corners itself.
render('icon.png', 1024, glow(1024) + windowAt(1024, 0.8));

// Splash: the window alone, on the navy set in app.json.
render('splash-icon.png', 1024, windowAt(1024, 0.92));

// Android adaptive icon: the launcher crops to a circle or squircle inside the middle 66%.
render('android-icon-background.png', 512, glow(512));
render('android-icon-foreground.png', 512, windowAt(512, 0.6));

// Android themed icon: one color. Android uses only the shape, so the glass is solid
// and the lead lines are cut out of it.
const mono = (size: number) => {
  const s = (size * 0.62) / 220;
  const pieces = roseWindowPieces()
    .map((p) => `<path d="${p.d}" fill="white" stroke="black" stroke-width="4" stroke-linejoin="round"/>`)
    .join('');
  return (
    `<defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="black"/>` +
    `<g transform="translate(${size / 2} ${size / 2}) scale(${s})">${pieces}</g></mask></defs>` +
    `<rect width="${size}" height="${size}" fill="white" mask="url(#m)"/>`
  );
};
render('android-icon-monochrome.png', 432, mono(432));

// Browser tab.
render('favicon.png', 48, windowAt(48, 1, 10));

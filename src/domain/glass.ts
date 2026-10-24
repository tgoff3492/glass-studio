import type { Coe, GlassItem, GlassKind, GlassType, QuantityUnit } from '../db/types.ts';

// Vocabulary and rules for glass inventory. Plain data and functions only,
// so it can be tested without a phone.

export const GLASS_KINDS: { value: GlassKind; label: string; plural: string }[] = [
  { value: 'sheet', label: 'Sheet', plural: 'Sheets' },
  { value: 'frit', label: 'Frit', plural: 'Frit' },
  { value: 'powder', label: 'Powder', plural: 'Powder' },
  { value: 'stringer', label: 'Stringer', plural: 'Stringers' },
  { value: 'noodle', label: 'Noodle', plural: 'Noodles' },
  { value: 'confetti', label: 'Confetti', plural: 'Confetti' },
  { value: 'scrap', label: 'Scrap', plural: 'Scrap' },
];

export const GLASS_TYPES: { value: GlassType; label: string }[] = [
  { value: 'cathedral', label: 'Cathedral' },
  { value: 'opalescent', label: 'Opalescent' },
  { value: 'streaky', label: 'Streaky' },
  { value: 'wispy', label: 'Wispy' },
  { value: 'iridized', label: 'Iridized' },
  { value: 'textured', label: 'Textured' },
  { value: 'clear', label: 'Clear' },
  { value: 'other', label: 'Other' },
];

/** Color families for filtering, each with a swatch used when an item has no photo. */
export const COLOR_FAMILIES: { value: string; label: string; swatch: string }[] = [
  { value: 'red', label: 'Red', swatch: '#C0392B' },
  { value: 'orange', label: 'Orange', swatch: '#E07B24' },
  { value: 'yellow', label: 'Yellow', swatch: '#E8C21E' },
  { value: 'green', label: 'Green', swatch: '#2E8B57' },
  { value: 'blue', label: 'Blue', swatch: '#2F5FB3' },
  { value: 'purple', label: 'Purple', swatch: '#7B4BA8' },
  { value: 'pink', label: 'Pink', swatch: '#E07AA0' },
  { value: 'brown', label: 'Brown', swatch: '#8B5A2B' },
  { value: 'black', label: 'Black', swatch: '#222222' },
  { value: 'white', label: 'White', swatch: '#F2F2F2' },
  { value: 'gray', label: 'Gray', swatch: '#8E959C' },
  { value: 'clear', label: 'Clear', swatch: '#DCE9EE' },
  { value: 'multi', label: 'Mixed', swatch: '#B59A6A' },
];

/** Suggestions for the maker field. She can type any name. */
export const MANUFACTURERS = [
  'Bullseye',
  'Oceanside',
  'Spectrum',
  'Wissmach',
  'Kokomo',
  'Youghiogheny',
  'Uroboros',
  'Armstrong',
];

export const UNIT_LABELS: Record<QuantityUnit, { one: string; many: string }> = {
  sheet: { one: 'sheet', many: 'sheets' },
  sq_in: { one: 'sq in', many: 'sq in' },
  lb: { one: 'lb', many: 'lb' },
  oz: { one: 'oz', many: 'oz' },
  g: { one: 'g', many: 'g' },
  piece: { one: 'piece', many: 'pieces' },
  ft: { one: 'ft', many: 'ft' },
  roll: { one: 'roll', many: 'rolls' },
  jar: { one: 'jar', many: 'jars' },
};

/** Units that make sense for each kind of glass, most common first. */
export const UNITS_FOR_KIND: Record<GlassKind, QuantityUnit[]> = {
  sheet: ['sheet', 'sq_in'],
  frit: ['oz', 'lb', 'g', 'jar'],
  powder: ['oz', 'lb', 'g', 'jar'],
  stringer: ['oz', 'piece'],
  noodle: ['oz', 'piece'],
  confetti: ['oz', 'g', 'jar'],
  scrap: ['lb', 'oz', 'piece'],
};

/** How much one tap of + or − changes the quantity. */
export const STEP_FOR_UNIT: Record<QuantityUnit, number> = {
  sheet: 0.25,
  sq_in: 12,
  lb: 0.25,
  oz: 1,
  g: 25,
  piece: 1,
  ft: 1,
  roll: 1,
  jar: 1,
};

/** Kinds that only exist for fusing, so their COE always matters. */
const FUSING_ONLY: GlassKind[] = ['frit', 'powder', 'stringer', 'noodle', 'confetti'];

export function kindLabel(kind: GlassKind): string {
  return GLASS_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export function typeLabel(type: GlassType | null): string | null {
  if (!type) return null;
  return GLASS_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function colorFamily(value: string | null) {
  return COLOR_FAMILIES.find((c) => c.value === value) ?? null;
}

/** "1 sheet", "2.5 sheets", "8 oz". Trims trailing zeros. */
export function formatQuantity(quantity: number, unit: QuantityUnit): string {
  const n = Number(quantity.toFixed(2));
  const label = UNIT_LABELS[unit] ?? { one: unit, many: unit };
  return `${n} ${n === 1 ? label.one : label.many}`;
}

export function coeLabel(coe: Coe | null): string {
  return coe === null ? 'No COE' : `COE ${coe}`;
}

/** What the add/edit form collects. Text fields are raw strings as typed. */
export type GlassInput = {
  kind: GlassKind;
  color_name: string;
  manufacturer: string;
  product_code: string;
  barcode: string;
  coe: Coe | null;
  glass_type: GlassType | null;
  color_family: string | null;
  quantity: string;
  unit: QuantityUnit;
  cost: string;
  photo_uri: string | null;
  fired_photo_uri: string | null;
  notes: string;
};

export type GlassFields = Omit<GlassItem, 'id' | 'created_at' | 'updated_at'>;

export type ValidationResult =
  | { ok: true; value: GlassFields }
  | { ok: false; errors: Partial<Record<keyof GlassInput, string>> };

export function emptyGlassInput(kind: GlassKind = 'sheet', barcode = ''): GlassInput {
  return {
    kind,
    color_name: '',
    manufacturer: '',
    product_code: '',
    barcode,
    coe: null,
    glass_type: null,
    color_family: null,
    quantity: '1',
    unit: UNITS_FOR_KIND[kind][0],
    cost: '',
    photo_uri: null,
    fired_photo_uri: null,
    notes: '',
  };
}

export function inputFromItem(item: GlassItem): GlassInput {
  return {
    kind: item.kind,
    color_name: item.color_name,
    manufacturer: item.manufacturer ?? '',
    product_code: item.product_code ?? '',
    barcode: item.barcode ?? '',
    coe: item.coe,
    glass_type: item.glass_type,
    color_family: item.color_family,
    quantity: String(item.quantity),
    unit: item.unit,
    cost: item.cost_per_unit_cents === null ? '' : (item.cost_per_unit_cents / 100).toFixed(2),
    photo_uri: item.photo_uri,
    fired_photo_uri: item.fired_photo_uri,
    notes: item.notes ?? '',
  };
}

const blankToNull = (s: string) => (s.trim() === '' ? null : s.trim());

/** Barcodes are compared exactly, so drop spaces a person might type between digit groups. */
export function normalizeBarcode(code: string): string {
  return code.replace(/\s+/g, '');
}

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

/** Checks the form and turns it into database fields, or explains what to fix. */
export function validateGlassInput(input: GlassInput): ValidationResult {
  const errors: Partial<Record<keyof GlassInput, string>> = {};

  if (input.color_name.trim() === '') errors.color_name = 'Enter a color name.';

  const quantity = parseAmount(input.quantity);
  if (quantity === null || quantity < 0) errors.quantity = 'Enter how much you have, like 1, 2.5 or 3/4.';

  if (FUSING_ONLY.includes(input.kind) && input.coe === null) {
    errors.coe = `Choose a COE. ${kindLabel(input.kind)} is used for fusing, so it matters.`;
  }

  let costCents: number | null = null;
  if (input.cost.trim() !== '') {
    const cost = parseAmount(input.cost.replace(/^\$/, ''));
    if (cost === null || cost < 0) errors.cost = 'Enter a price like 12.50, or leave it blank.';
    else costCents = Math.round(cost * 100);
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      kind: input.kind,
      color_name: input.color_name.trim(),
      manufacturer: blankToNull(input.manufacturer),
      product_code: blankToNull(input.product_code),
      barcode: blankToNull(normalizeBarcode(input.barcode)),
      coe: input.coe,
      glass_type: input.kind === 'sheet' || input.kind === 'scrap' ? input.glass_type : null,
      color_family: input.color_family,
      quantity: quantity as number,
      unit: input.unit,
      cost_per_unit_cents: costCents,
      photo_uri: input.photo_uri,
      fired_photo_uri: input.fired_photo_uri,
      notes: blankToNull(input.notes),
    },
  };
}

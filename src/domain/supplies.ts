import type { QuantityUnit, Supply, SupplyCategory } from '../db/types.ts';
import { parseAmount, UNIT_LABELS } from './glass.ts';

export type SupplyGroup = 'stained' | 'fusing' | 'general';

type CategoryInfo = {
  value: SupplyCategory;
  label: string;
  group: SupplyGroup;
  /** Pre-filled name when she picks the category, so most items need no typing. */
  defaultName: string;
  /** Example for the size field, in the trade's own terms. */
  sizeHint: string;
  units: QuantityUnit[];
};

export const SUPPLY_CATEGORIES: CategoryInfo[] = [
  { value: 'foil', label: 'Copper foil', group: 'stained', defaultName: 'Copper foil', sizeHint: '7/32 in, black-backed', units: ['roll'] },
  { value: 'solder', label: 'Solder', group: 'stained', defaultName: 'Solder', sizeHint: '60/40, 50/50 or lead-free', units: ['lb', 'oz'] },
  { value: 'came', label: 'Came', group: 'stained', defaultName: 'Lead came', sizeHint: '1/4 in H, lead or zinc', units: ['stick', 'ft'] },
  { value: 'flux', label: 'Flux', group: 'stained', defaultName: 'Flux', sizeHint: 'Liquid or gel, 8 oz', units: ['bottle', 'oz'] },
  { value: 'patina', label: 'Patina', group: 'stained', defaultName: 'Patina', sizeHint: 'Black, copper or brass', units: ['bottle', 'oz'] },
  { value: 'grinder_bit', label: 'Grinder bits', group: 'stained', defaultName: 'Grinder bit', sizeHint: '3/4 in standard, 1/4 in fine', units: ['piece'] },
  { value: 'cutter', label: 'Cutters and oil', group: 'general', defaultName: 'Cutter oil', sizeHint: 'Pistol grip cutter, or 4 oz oil', units: ['piece', 'bottle'] },
  { value: 'kiln_wash', label: 'Kiln wash', group: 'fusing', defaultName: 'Kiln wash', sizeHint: 'Primo Primer, Bullseye shelf primer', units: ['lb', 'oz'] },
  { value: 'fiber_paper', label: 'Fiber paper', group: 'fusing', defaultName: 'Fiber paper', sizeHint: '1/8 in or 1/16 in thick', units: ['sheet', 'roll', 'sq_in'] },
  { value: 'shelf_paper', label: 'Shelf paper', group: 'fusing', defaultName: 'Thinfire shelf paper', sizeHint: '20 in × 20 in sheets', units: ['sheet', 'roll'] },
  { value: 'mold', label: 'Molds', group: 'fusing', defaultName: 'Slump mold', sizeHint: '8 in square plate', units: ['piece'] },
  { value: 'dichroic', label: 'Dichroic', group: 'fusing', defaultName: 'Dichroic glass', sizeHint: 'COE 90 on black, 2 × 2 in', units: ['piece', 'sq_in', 'sheet'] },
  { value: 'other', label: 'Other', group: 'general', defaultName: '', sizeHint: '', units: ['piece', 'pack', 'bottle', 'roll', 'lb', 'oz'] },
];

export const SUPPLY_GROUPS: { value: SupplyGroup; label: string }[] = [
  { value: 'stained', label: 'Stained glass' },
  { value: 'fusing', label: 'Fusing' },
  { value: 'general', label: 'General' },
];

export function categoryInfo(category: SupplyCategory): CategoryInfo {
  return SUPPLY_CATEGORIES.find((c) => c.value === category) ?? SUPPLY_CATEGORIES[SUPPLY_CATEGORIES.length - 1];
}

export function categoriesInGroup(group: SupplyGroup): SupplyCategory[] {
  return SUPPLY_CATEGORIES.filter((c) => c.group === group).map((c) => c.value);
}

export type StockLevel = 'ok' | 'low' | 'out';

/** Out at zero; low at or below her minimum; otherwise fine. No minimum means never "low". */
export function stockLevel(s: Pick<Supply, 'quantity' | 'min_quantity'>): StockLevel {
  if (s.quantity <= 0) return 'out';
  if (s.min_quantity !== null && s.quantity <= s.min_quantity) return 'low';
  return 'ok';
}

/** "Copper foil, 7/32 in" — how a supply reads in lists and on the shopping list. */
export function supplyTitle(s: Pick<Supply, 'name' | 'size'>): string {
  return s.size ? `${s.name}, ${s.size}` : s.name;
}

export type SupplyInput = {
  category: SupplyCategory;
  name: string;
  brand: string;
  size: string;
  quantity: string;
  unit: QuantityUnit;
  min_quantity: string;
  cost: string;
  photo_uri: string | null;
  notes: string;
};

export type SupplyFields = Omit<Supply, 'id' | 'created_at' | 'updated_at'>;

export type SupplyValidation =
  | { ok: true; value: SupplyFields }
  | { ok: false; errors: Partial<Record<keyof SupplyInput, string>> };

export function emptySupplyInput(category: SupplyCategory = 'foil'): SupplyInput {
  const info = categoryInfo(category);
  return {
    category,
    name: info.defaultName,
    brand: '',
    size: '',
    quantity: '1',
    unit: info.units[0],
    min_quantity: '',
    cost: '',
    photo_uri: null,
    notes: '',
  };
}

export function supplyInputFromItem(s: Supply): SupplyInput {
  return {
    category: s.category,
    name: s.name,
    brand: s.brand ?? '',
    size: s.size ?? '',
    quantity: String(s.quantity),
    unit: s.unit,
    min_quantity: s.min_quantity === null ? '' : String(s.min_quantity),
    cost: s.cost_per_unit_cents === null ? '' : (s.cost_per_unit_cents / 100).toFixed(2),
    photo_uri: s.photo_uri,
    notes: s.notes ?? '',
  };
}

/** Switching category swaps in that category's usual name and unit, unless she already typed her own name. */
export function changeCategory(input: SupplyInput, category: SupplyCategory): SupplyInput {
  const from = categoryInfo(input.category);
  const to = categoryInfo(category);
  const nameWasDefault = input.name.trim() === '' || input.name === from.defaultName;
  return {
    ...input,
    category,
    name: nameWasDefault ? to.defaultName : input.name,
    unit: to.units.includes(input.unit) ? input.unit : to.units[0],
  };
}

const blankToNull = (s: string) => (s.trim() === '' ? null : s.trim());

export function validateSupplyInput(input: SupplyInput): SupplyValidation {
  const errors: Partial<Record<keyof SupplyInput, string>> = {};

  if (input.name.trim() === '') errors.name = 'Enter a name, like "Copper foil".';

  const quantity = parseAmount(input.quantity);
  if (quantity === null || quantity < 0) errors.quantity = 'Enter how much you have, like 2 or 1 1/2.';

  let min: number | null = null;
  if (input.min_quantity.trim() !== '') {
    min = parseAmount(input.min_quantity);
    if (min === null || min < 0) errors.min_quantity = 'Enter a number, or leave it blank for no reminder.';
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
      category: input.category,
      name: input.name.trim(),
      brand: blankToNull(input.brand),
      size: blankToNull(input.size),
      quantity: quantity as number,
      unit: input.unit,
      min_quantity: min,
      cost_per_unit_cents: costCents,
      photo_uri: input.photo_uri,
      notes: blankToNull(input.notes),
    },
  };
}

/** "2 left · reminder at 3" for the shopping list's running-low section. */
export function lowStockNote(s: Pick<Supply, 'quantity' | 'unit' | 'min_quantity'>): string {
  const label = UNIT_LABELS[s.unit] ?? { one: s.unit, many: s.unit };
  const left = s.quantity <= 0 ? 'None left' : `${Number(s.quantity.toFixed(2))} ${s.quantity === 1 ? label.one : label.many} left`;
  return s.min_quantity === null ? left : `${left} · reminder at ${Number(s.min_quantity.toFixed(2))}`;
}

// What a piece cost to make, from the prices she entered and her time at the bench,
// and a starting price with her own markup. Pure, so it's easy to test.

export type CostInput = {
  glass: { color_name: string; quantity: number; partial: 0 | 1; cost_per_unit_cents: number | null }[];
  supplies: { name: string; quantity: number; cost_per_unit_cents: number | null }[];
  minutes: number;
  /** Her time, per hour. Null until she sets it. */
  hourlyCents: number | null;
  /** Added on top of cost, as a percent. Null or 0 means none. */
  markupPercent: number | null;
};

export type Cost = {
  materialsCents: number;
  /** Things used that have no price yet, so the materials figure is low. */
  unpriced: string[];
  timeCents: number | null;
  totalCents: number;
  /** Total plus markup, rounded up to a whole dollar. Null without a markup. */
  priceCents: number | null;
};

export function projectCost(input: CostInput): Cost {
  let materials = 0;
  const unpriced: string[] = [];
  for (const g of input.glass) {
    // A sheet she cut from counts as the whole sheet; what's left went back as its own piece.
    const amount = g.partial ? 1 : g.quantity;
    if (g.cost_per_unit_cents === null) unpriced.push(g.color_name);
    else materials += amount * g.cost_per_unit_cents;
  }
  for (const s of input.supplies) {
    if (s.cost_per_unit_cents === null) unpriced.push(s.name);
    else materials += s.quantity * s.cost_per_unit_cents;
  }
  materials = Math.round(materials);
  const time = input.hourlyCents === null ? null : Math.round((input.minutes / 60) * input.hourlyCents);
  const total = materials + (time ?? 0);
  const price = input.markupPercent ? Math.ceil((total * (1 + input.markupPercent / 100)) / 100) * 100 : null;
  return { materialsCents: materials, unpriced: [...new Set(unpriced)], timeCents: time, totalCents: total, priceCents: price };
}

/** 1240 → "$12.40"; 7200 → "$72". */
export function formatMoney(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars)
    ? `$${dollars.toLocaleString('en-US')}`
    : `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "15", "$15", "15.50" → cents; blank → null; anything else → undefined (an error). */
export function parseMoney(text: string): number | null | undefined {
  const t = text.trim().replace(/^\$/, '').replace(/,/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
}

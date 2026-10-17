import type { Coe } from '../db/types.ts';

export type CoeCheck =
  | { ok: true; coe: Coe | null }
  | { ok: false; found: Coe[] };

/**
 * Checks whether glass going into one fused piece is compatible.
 * Glass with no COE recorded is ignored here; the app asks for COE on fusing glass.
 * Mixing COE 90 and COE 96 in one firing causes stress cracks, so that is the failure case.
 */
export function checkCoe(coes: (Coe | null)[]): CoeCheck {
  const found = [...new Set(coes.filter((c): c is Coe => c !== null))].sort((a, b) => a - b);
  if (found.length > 1) return { ok: false, found };
  return { ok: true, coe: found[0] ?? null };
}

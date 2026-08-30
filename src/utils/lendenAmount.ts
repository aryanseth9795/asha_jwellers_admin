// Resolves the effective amount of a Len-Den entry from its line items.
// See agent/2026-08-31-lenden-bill-design.md §4.3.

export interface AmountSource {
  amount?: number | null;
  amountOverridden?: number | null;
}

export interface HasTotal {
  total: number;
}

export function sumItemTotals(items: HasTotal[]): number {
  return items.reduce((sum, item) => sum + item.total, 0);
}

/**
 * Two independent guards protect historical data:
 *   1. no items  -> the stored amount is authoritative
 *   2. overridden -> the user typed it, so it wins
 * Only when neither applies is the amount recomputed from items.
 */
export function resolveEffectiveAmount(
  lenden: AmountSource,
  items: HasTotal[],
): number {
  if (items.length === 0) return lenden.amount ?? 0;
  if (lenden.amountOverridden === 1) return lenden.amount ?? 0;
  return sumItemTotals(items);
}

/** Whether a typed amount diverges from the item sum, for the `*` marker. */
export function isAmountOverridden(
  lenden: AmountSource,
  items: HasTotal[],
): boolean {
  if (items.length === 0) return false;
  return (lenden.amount ?? 0) !== sumItemTotals(items);
}

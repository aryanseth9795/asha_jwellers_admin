import { fyStartYear } from "./analytics/periods";
import { roundGrams } from "./analytics/format";
import { OldJewelleryItem } from "../types/entry";

/** One old jewellery item with the Len-Den entry and customer it came from. */
export interface OldJewelleryRegisterRow extends OldJewelleryItem {
  date: string;
  billNo: number | null;
  userId: number;
  userName: string;
}

export type RegisterMetalFilter = "all" | "gold" | "silver";
export type RegisterPeriod = "month" | "year" | "all";

export interface RegisterFilter {
  metal: RegisterMetalFilter;
  period: RegisterPeriod;
}

export interface RegisterTotals {
  count: number;
  weight: number; // grams
  value: number; // rupees
}

export interface RegisterSummary {
  gold: RegisterTotals;
  silver: RegisterTotals;
  // Items saved before metal was tracked. Kept apart so they never inflate
  // either metal's totals.
  unknown: RegisterTotals;
  total: RegisterTotals;
}


const addItem = (
  totals: RegisterTotals,
  item: OldJewelleryRegisterRow,
): RegisterTotals => ({
  count: totals.count + 1,
  weight: roundGrams(totals.weight + (item.weight ?? 0)),
  value: totals.value + item.value,
});

export const summarizeRegister = (
  rows: OldJewelleryRegisterRow[],
): RegisterSummary => {
  const empty: RegisterTotals = { count: 0, weight: 0, value: 0 };
  return rows.reduce<RegisterSummary>(
    (summary, item) => {
      const bucket = item.metal ?? "unknown";
      return {
        ...summary,
        [bucket]: addItem(summary[bucket], item),
        total: addItem(summary.total, item),
      };
    },
    { gold: empty, silver: empty, unknown: empty, total: empty },
  );
};

// "year" is the Indian financial year, matching Analytics.
const inPeriod = (dateString: string, period: RegisterPeriod, now: Date) => {
  if (period === "all") return true;
  const date = new Date(dateString);
  if (period === "year") return fyStartYear(date) === fyStartYear(now);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
};

export const filterRegister = (
  rows: OldJewelleryRegisterRow[],
  { metal, period }: RegisterFilter,
  now: Date = new Date(),
): OldJewelleryRegisterRow[] =>
  rows.filter(
    (row) =>
      (metal === "all" || row.metal === metal) &&
      inPeriod(row.date, period, now),
  );

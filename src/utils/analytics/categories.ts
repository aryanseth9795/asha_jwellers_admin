import { AnalyticsData } from "./types";
import { Period, inPeriod } from "./periods";
import { Change, change } from "./compare";
import { roundGrams } from "./format";

export type CategoryMetal = "gold" | "silver" | "unknown";

export interface Category {
  key: string;
  label: string;
  metal: CategoryMetal;
}

export interface CategoryStat extends Category {
  value: number; // rupees
  weight: number; // grams
  items: number;
  share: number; // of this period's sold value, 0..1
  growth: Change | null; // value vs previous period; null without one
}

/** Metal + purity. Only exact "gold"/"silver" count; legacy purity "Silver" means none. */
export const categoryOf = (metal: string | null, purity: string | null | undefined): Category => {
  if (metal !== "gold" && metal !== "silver") {
    return { key: "unknown", label: "Unknown metal", metal: "unknown" };
  }
  const trimmed = purity?.trim() ?? "";
  const grade = trimmed && trimmed !== "Silver" ? trimmed : null;
  const name = metal === "gold" ? "Gold" : "Silver";
  return { key: `${metal}:${grade ?? "-"}`, label: `${name} ${grade ?? "(no purity)"}`, metal };
};

interface Totals {
  category: Category;
  value: number;
  weight: number;
  items: number;
}

const totalsIn = (data: AnalyticsData, period: Period): Map<string, Totals> => {
  const dateOf = new Map(data.lenden.map((bill) => [bill.id, bill.date]));
  const totals = new Map<string, Totals>();
  for (const item of data.soldItems) {
    const date = dateOf.get(item.lendenId);
    if (!date || !inPeriod(date, period)) continue;
    const category = categoryOf(item.metal, item.purity);
    const t = totals.get(category.key) ?? { category, value: 0, weight: 0, items: 0 };
    t.value += item.total;
    t.weight = roundGrams(t.weight + (item.weight ?? 0));
    t.items += 1;
    totals.set(category.key, t);
  }
  return totals;
};

export const buildCategoryView = (
  data: AnalyticsData,
  period: Period,
  previous: Period | null,
): CategoryStat[] => {
  const current = totalsIn(data, period);
  const before = previous ? totalsIn(data, previous) : new Map<string, Totals>();
  const totalValue = [...current.values()].reduce((s, t) => s + t.value, 0);
  const keys = new Set([...current.keys(), ...before.keys()]);
  return [...keys]
    .map((key) => {
      const now = current.get(key);
      const prev = before.get(key);
      const value = now?.value ?? 0;
      return {
        ...(now ?? prev)!.category,
        value,
        weight: now?.weight ?? 0,
        items: now?.items ?? 0,
        share: totalValue ? value / totalValue : 0,
        growth: previous ? change(value, prev?.value ?? 0) : null,
      };
    })
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
};

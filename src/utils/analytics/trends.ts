import { AnalyticsData } from "./types";
import { Period, periodFor, shiftPeriod } from "./periods";
import { Change, change } from "./compare";
import { buildSalesView } from "./sales";
import { buildMetalView } from "./metal";
import { baakiAt } from "./baki";

export type TrendGrain = "week" | "month" | "quarter" | "fy";

export const TREND_COUNTS: Record<TrendGrain, number> = { week: 8, month: 6, quarter: 4, fy: 5 };

export interface TrendRow {
  period: Period;
  label: string;
  bills: number;
  sales: number;
  collected: number;
  collectionRate: number | null; // collected ÷ net sales; null when net sales is 0
  oldReturned: number;
  baakiAtEnd: number; // at period end, or now for the current period
  goldGrams: number;
  silverGrams: number;
  change: {
    sales: Change | null;
    collected: Change | null;
    baakiAtEnd: Change | null;
    goldGrams: Change | null;
    silverGrams: Change | null;
  };
}

/** The last `count` periods of a grain, oldest first, ending with the one containing `now`. */
export const buildTrends = (
  data: AnalyticsData,
  grain: TrendGrain,
  now: Date = new Date(),
  count: number = TREND_COUNTS[grain],
): TrendRow[] => {
  const latest = periodFor(grain, now);
  const rows: TrendRow[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const period = shiftPeriod(latest, -i);
    const sales = buildSalesView(data, period);
    const metal = buildMetalView(data, period);
    const at = new Date(Math.min(period.end.getTime(), now.getTime()));
    const prev = rows[rows.length - 1];
    const row: TrendRow = {
      period,
      label: period.label,
      bills: sales.bills,
      sales: sales.sales,
      collected: sales.collected,
      collectionRate: sales.netSales > 0 ? sales.collected / sales.netSales : null,
      oldReturned: sales.oldCredit,
      baakiAtEnd: baakiAt(data, at),
      goldGrams: metal.sold.gold.weight,
      silverGrams: metal.sold.silver.weight,
      change: { sales: null, collected: null, baakiAtEnd: null, goldGrams: null, silverGrams: null },
    };
    if (prev) {
      row.change = {
        sales: change(row.sales, prev.sales),
        collected: change(row.collected, prev.collected),
        baakiAtEnd: change(row.baakiAtEnd, prev.baakiAtEnd),
        goldGrams: change(row.goldGrams, prev.goldGrams),
        silverGrams: change(row.silverGrams, prev.silverGrams),
      };
    }
    rows.push(row);
  }
  return rows;
};

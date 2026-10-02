import { AnalyticsData } from "./types";
import { Period, periodFor, shiftPeriod, toDateEquivalent } from "./periods";
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
interface Figures {
  sales: number;
  collected: number;
  baakiAtEnd: number;
  goldGrams: number;
  silverGrams: number;
}

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
    const inProgress = now.getTime() >= period.start.getTime() && now.getTime() < period.end.getTime();
    const row: TrendRow = {
      period,
      label: inProgress ? `${period.label} (so far)` : period.label,
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
      // The newest row is partial, so it is compared with the same days of the one before.
      const cut = toDateEquivalent(prev.period, period, now);
      let base: Figures = prev;
      if (cut !== prev.period) {
        const cutSales = buildSalesView(data, cut);
        const cutMetal = buildMetalView(data, cut);
        base = {
          sales: cutSales.sales,
          collected: cutSales.collected,
          baakiAtEnd: baakiAt(data, cut.end),
          goldGrams: cutMetal.sold.gold.weight,
          silverGrams: cutMetal.sold.silver.weight,
        };
      }
      row.change = {
        sales: change(row.sales, base.sales),
        collected: change(row.collected, base.collected),
        baakiAtEnd: change(row.baakiAtEnd, base.baakiAtEnd),
        goldGrams: change(row.goldGrams, base.goldGrams),
        silverGrams: change(row.silverGrams, base.silverGrams),
      };
    }
    rows.push(row);
  }
  return rows;
};

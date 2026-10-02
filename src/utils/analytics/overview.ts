import { AnalyticsData } from "./types";
import { Bucket, Period, Unit, toDateEquivalent } from "./periods";
import { Change, change } from "./compare";
import { formatInr, formatPct } from "./format";
import { SalesView, buildSalesView } from "./sales";
import { buildMetalView } from "./metal";
import { countNewCustomers } from "./customers";
import { buildRehanView } from "./rehan";
import { baakiAging, baakiAt } from "./baki";
import { buildCategoryView } from "./categories";
import { buildVillageView } from "./villages";
import { buildImportanceView } from "./importance";

export type KpiFormat = "rupees" | "grams" | "percent" | "count";

export interface Kpi {
  key: string;
  label: string;
  value: number | null;
  format: KpiFormat;
  upIsGood: boolean;
  change: Change | null; // vs previous period
  yoy: Change | null; // vs same period last year
}

export interface Insight {
  tone: "good" | "bad" | "info";
  text: string;
}

export interface OverviewView {
  kpis: Kpi[];
  insights: Insight[];
  buckets: Bucket[];
  salesSeries: number[];
  previousSalesSeries: number[] | null; // aligned to `buckets` by position
}

interface Figures {
  sales: number;
  collected: number;
  collectionRate: number | null;
  bills: number;
  avgBill: number;
  baakiEnd: number;
  goldSold: number;
  silverSold: number;
  oldReturnPct: number | null;
  newCustomers: number;
  rehanGiven: number;
}

const KPIS: { key: keyof Figures; label: string; format: KpiFormat; upIsGood: boolean }[] = [
  { key: "sales", label: "Sales", format: "rupees", upIsGood: true },
  { key: "collected", label: "Collected", format: "rupees", upIsGood: true },
  { key: "collectionRate", label: "Collection rate", format: "percent", upIsGood: true },
  { key: "bills", label: "Bills", format: "count", upIsGood: true },
  { key: "avgBill", label: "Avg bill", format: "rupees", upIsGood: true },
  { key: "baakiEnd", label: "Baaki (period end)", format: "rupees", upIsGood: false },
  { key: "goldSold", label: "Gold sold", format: "grams", upIsGood: true },
  { key: "silverSold", label: "Silver sold", format: "grams", upIsGood: true },
  { key: "oldReturnPct", label: "Old jewellery returned", format: "percent", upIsGood: false },
  { key: "newCustomers", label: "New customers", format: "count", upIsGood: true },
  { key: "rehanGiven", label: "Rehan given", format: "rupees", upIsGood: true },
];

const UNIT_WORD: Record<Unit, string> = { day: "day", week: "week", month: "month", year: "year" };

const fit = (values: number[], length: number) =>
  Array.from({ length }, (_, i) => values[i] ?? 0);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const buildOverview = (
  data: AnalyticsData,
  period: Period,
  previous: Period | null,
  lastYear: Period | null,
  now: Date = new Date(),
): OverviewView => {
  // `p` is the range measured; `baakiPeriod` supplies the end date for baaki.
  const figures = (p: Period, sales: SalesView, baakiPeriod: Period = p): Figures => {
    const metal = buildMetalView(data, p);
    // The current period is measured up to now, not to its future end.
    const at = new Date(Math.min(baakiPeriod.end.getTime(), now.getTime()));
    return {
      sales: sales.sales,
      collected: sales.collected,
      collectionRate: sales.netSales > 0 ? sales.collected / sales.netSales : null,
      bills: sales.bills,
      avgBill: sales.avgBill,
      baakiEnd: baakiAt(data, at),
      goldSold: metal.sold.gold.weight,
      silverSold: metal.sold.silver.weight,
      oldReturnPct: sales.sales > 0 ? sales.oldCredit / sales.sales : null,
      newCustomers: countNewCustomers(data, p),
      rehanGiven: buildRehanView(data, p).given,
    };
  };

  // Each period's sales view is built once and shared by KPIs, chart and insights.
  const salesView = buildSalesView(data, period);
  const previousView = previous ? buildSalesView(data, previous) : null;

  // A period still in progress is compared with the same days of the others.
  const comparable = (other: Period | null, full: SalesView | null) => {
    if (!other) return null;
    const cut = toDateEquivalent(other, period, now);
    const view = cut === other ? (full ?? buildSalesView(data, other)) : buildSalesView(data, cut);
    return { cut, figures: figures(cut, view, other) };
  };

  const cur = figures(period, salesView);
  const prevCompare = comparable(previous, previousView);
  const prev = prevCompare ? prevCompare.figures : null;
  const ly = comparable(lastYear, null)?.figures ?? null;
  const compareWith = (other: Figures | null, key: keyof Figures): Change | null => {
    if (!other) return null;
    const a = cur[key];
    const b = other[key];
    return a === null || b === null ? null : change(a, b);
  };
  const kpis: Kpi[] = KPIS.map((def) => ({
    ...def,
    value: cur[def.key],
    change: compareWith(prev, def.key),
    yoy: compareWith(ly, def.key),
  }));

  const bucketList = salesView.buckets;
  const salesSeries = salesView.salesSeries;
  const previousSalesSeries = previous
    ? fit(previousView!.salesSeries, bucketList.length)
    : null;

  const insights: Insight[] = [];

  if (prevCompare && prev && prev.sales > 0) {
    const label = prevCompare.cut.label;
    const pct = change(cur.sales, prev.sales).pct!;
    const span = `${formatInr(prev.sales)} → ${formatInr(cur.sales)}`;
    if (Math.abs(pct) < 0.02) {
      insights.push({ tone: "info", text: `Sales flat vs ${label} (${span})` });
    } else {
      insights.push({
        tone: pct > 0 ? "good" : "bad",
        text: `Sales ${pct > 0 ? "up" : "down"} ${formatPct(Math.abs(pct))} vs ${label} (${span})`,
      });
    }
  }

  const best = Math.max(0, ...salesSeries);
  if (bucketList.length > 1 && best > 0) {
    const i = salesSeries.indexOf(best);
    insights.push({
      tone: "info",
      text: `Best ${UNIT_WORD[period.unit]}: ${bucketList[i].label} with ${formatInr(best)}`,
    });
  }

  const categories = buildCategoryView(data, period, previous);
  const topCategory = categories.find((c) => c.value > 0);
  if (topCategory) {
    insights.push({
      tone: "info",
      text: `${topCategory.label} is the top seller: ${formatPct(topCategory.share)} of sales`,
    });
  }
  const withPct = categories.filter((c) => c.growth?.pct !== null && c.growth?.pct !== undefined);
  const growing = withPct
    .filter((c) => c.growth!.pct! > 0)
    .sort((a, b) => b.growth!.pct! - a.growth!.pct!)[0];
  if (growing) {
    insights.push({ tone: "good", text: `${growing.label} grew fastest: +${formatPct(growing.growth!.pct!)}` });
  }
  const falling = withPct
    .filter((c) => c.growth!.pct! < -0.1)
    .sort((a, b) => a.growth!.pct! - b.growth!.pct!)[0];
  if (falling) {
    insights.push({ tone: "bad", text: `${falling.label} fell ${formatPct(Math.abs(falling.growth!.pct!))}` });
  }

  const village = buildVillageView(data, period, previous).find((v) => v.sales > 0);
  if (village && village.key !== "") {
    insights.push({
      tone: "info",
      text: `${village.name} brings ${formatPct(village.share)} of sales (${plural(village.buyers, "buyer")})`,
    });
  }

  const importance = buildImportanceView(data, period);
  if (importance.buyers >= 5) {
    insights.push({
      tone: "info",
      text: `Top 20% of buyers bring ${formatPct(importance.topFifthShare)} of sales`,
    });
  }

  if (prev) {
    const delta = cur.baakiEnd - prev.baakiEnd;
    if (delta > 0) {
      insights.push({ tone: "bad", text: `Baaki rose by ${formatInr(delta)} to ${formatInr(cur.baakiEnd)}` });
    } else if (delta < 0) {
      insights.push({ tone: "good", text: `Baaki fell by ${formatInr(-delta)} to ${formatInr(cur.baakiEnd)}` });
    }
  }

  const stale = baakiAging(data, now).slice(3); // older than 180 days
  const staleAmount = stale.reduce((s, b) => s + b.amount, 0);
  if (staleAmount > 0) {
    const bills = stale.reduce((s, b) => s + b.count, 0);
    insights.push({
      tone: "bad",
      text: `${formatInr(staleAmount)} of baaki is over 6 months old (${plural(bills, "bill")})`,
    });
  }

  if (cur.collectionRate !== null && cur.collectionRate < 0.6) {
    insights.push({ tone: "bad", text: `Only ${formatPct(cur.collectionRate)} of net sales collected so far` });
  }

  if (cur.oldReturnPct !== null && cur.oldReturnPct >= 0.15) {
    insights.push({ tone: "info", text: `Old jewellery covered ${formatPct(cur.oldReturnPct)} of sales value` });
  }

  return { kpis, insights, buckets: bucketList, salesSeries, previousSalesSeries };
};

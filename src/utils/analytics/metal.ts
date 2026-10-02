import { AnalyticsData } from "./types";
import { Bucket, Period, buckets, inPeriod, series } from "./periods";
import { roundGrams } from "./format";

export interface WeightValue {
  weight: number; // grams
  value: number; // rupees
}

export interface MetalTotals {
  gold: WeightValue;
  silver: WeightValue;
  unknown: WeightValue;
}

export interface MetalView {
  sold: MetalTotals;
  received: MetalTotals;
  buckets: Bucket[];
  soldGold: number[];
  soldSilver: number[];
  receivedGold: number[];
  receivedSilver: number[];
}

interface MetalLine {
  date: string;
  metal: keyof MetalTotals;
  weight: number;
  value: number;
}

// Only exact "gold"/"silver" count; anything else must not inflate either.
const metalOf = (raw: string | null): keyof MetalTotals =>
  raw === "gold" || raw === "silver" ? raw : "unknown";

const totalsOf = (lines: MetalLine[]): MetalTotals => {
  const totals: MetalTotals = {
    gold: { weight: 0, value: 0 },
    silver: { weight: 0, value: 0 },
    unknown: { weight: 0, value: 0 },
  };
  for (const line of lines) {
    const t = totals[line.metal];
    t.weight = roundGrams(t.weight + line.weight);
    t.value += line.value;
  }
  return totals;
};

export const buildMetalView = (data: AnalyticsData, period: Period): MetalView => {
  const dateOf = new Map(data.lenden.map((entry) => [entry.id, entry.date]));
  const toLines = (rows: { lendenId: number; metal: string | null; weight: number | null }[],
    valueOf: (i: number) => number): MetalLine[] =>
    rows.flatMap((row, i) => {
      const date = dateOf.get(row.lendenId);
      if (!date || !inPeriod(date, period)) return [];
      return [{ date, metal: metalOf(row.metal), weight: row.weight ?? 0, value: valueOf(i) }];
    });

  const sold = toLines(data.soldItems, (i) => data.soldItems[i].total);
  const received = toLines(data.oldItems, (i) => data.oldItems[i].value);
  const bucketList = buckets(period);
  const weightSeries = (lines: MetalLine[], metal: keyof MetalTotals) =>
    series(bucketList, period,
      lines.filter((l) => l.metal === metal).map((l) => ({ date: l.date, value: l.weight })),
    ).map(roundGrams);

  return {
    sold: totalsOf(sold),
    received: totalsOf(received),
    buckets: bucketList,
    soldGold: weightSeries(sold, "gold"),
    soldSilver: weightSeries(sold, "silver"),
    receivedGold: weightSeries(received, "gold"),
    receivedSilver: weightSeries(received, "silver"),
  };
};

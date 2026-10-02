import { AnalyticsData } from "./types";
import { Period, inPeriod } from "./periods";
import { Change, change } from "./compare";

export interface VillageStat {
  key: string; // "" = no address
  name: string; // most common spelling
  customers: number; // all-time
  buyers: number; // in the period
  sales: number;
  share: number; // of the period's sales, 0..1
  openBaaki: number; // as of today
  growth: Change | null;
}

/** The text before the first comma, with spacing collapsed. */
export const villageName = (address: string | null | undefined): string =>
  (address ?? "").split(",")[0].replace(/\s+/g, " ").trim();

export const villageKey = (address: string | null | undefined): string =>
  villageName(address).toLowerCase();

export const villageLabel = (address: string | null | undefined): string =>
  villageName(address) || "No address";

export const buildVillageView = (
  data: AnalyticsData,
  period: Period,
  previous: Period | null,
): VillageStat[] => {
  const villageOf = new Map<number, string>();
  const spellings = new Map<string, Map<string, number>>();
  const stats = new Map<string, VillageStat>();
  for (const user of data.users) {
    const name = villageName(user.address);
    const key = name.toLowerCase();
    villageOf.set(user.id, key);
    const counts = spellings.get(key) ?? new Map<string, number>();
    counts.set(name, (counts.get(name) ?? 0) + 1);
    spellings.set(key, counts);
    const stat = stats.get(key) ?? {
      key, name: "", customers: 0, buyers: 0, sales: 0, share: 0, openBaaki: 0, growth: null,
    };
    stat.customers++;
    stats.set(key, stat);
  }

  const buyers = new Map<string, Set<number>>();
  const previousSales = new Map<string, number>();
  for (const bill of data.lenden) {
    const key = villageOf.get(bill.userId);
    if (key === undefined) continue;
    const stat = stats.get(key)!;
    if (inPeriod(bill.date, period)) {
      stat.sales += bill.amount ?? 0;
      buyers.set(key, (buyers.get(key) ?? new Set<number>()).add(bill.userId));
    }
    if (previous && inPeriod(bill.date, previous)) {
      previousSales.set(key, (previousSales.get(key) ?? 0) + (bill.amount ?? 0));
    }
    if ((bill.status ?? 0) === 0 && (bill.baki ?? 0) > 0) stat.openBaaki += bill.baki ?? 0;
  }

  const total = [...stats.values()].reduce((s, v) => s + v.sales, 0);
  for (const stat of stats.values()) {
    let best = "";
    let bestCount = 0;
    for (const [spelling, count] of spellings.get(stat.key)!) {
      if (count > bestCount) {
        best = spelling;
        bestCount = count;
      }
    }
    stat.name = stat.key === "" ? "No address" : best;
    stat.buyers = buyers.get(stat.key)?.size ?? 0;
    stat.share = total ? stat.sales / total : 0;
    stat.growth = previous ? change(stat.sales, previousSales.get(stat.key) ?? 0) : null;
  }
  return [...stats.values()].sort((a, b) => b.sales - a.sales || b.customers - a.customers);
};

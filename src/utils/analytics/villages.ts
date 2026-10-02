import { AnalyticsData, UserRow } from "./types";
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

// ASCII punctuation and the Devanagari danda; "Manwal ." and "Manwal" are one village.
const PUNCTUATION = /[.,;:!?'"()[\]{}/\\|_*#@&+=~`^\-।]/g;

/** The text before the first comma, punctuation removed and spacing collapsed. */
export const villageName = (address: string | null | undefined): string =>
  (address ?? "").split(",")[0].replace(PUNCTUATION, " ").replace(/\s+/g, " ").trim();

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

export const OTHER_VILLAGES = "Other villages";
export const UNKNOWN_VILLAGE = "Unknown";
export const MIN_VILLAGE_CUSTOMERS = 5;

export interface VillageGroups {
  of: Map<number, string>; // userId → grouped village
  customers: Map<string, number>; // grouped village → customers on file
  order: string[]; // named villages by customers, then Other villages, then Unknown
}

const mostCommon = (counts: Map<string, number>): string => {
  let best = "";
  let bestCount = 0;
  for (const [spelling, count] of counts) {
    if (count > bestCount) {
      best = spelling;
      bestCount = count;
    }
  }
  return best;
};

/** Spec §12.5: villages with fewer than 5 customers become "Other villages"; blank is "Unknown". */
export const groupVillages = (users: UserRow[]): VillageGroups => {
  const byKey = new Map<string, { ids: number[]; spellings: Map<string, number> }>();
  for (const user of users) {
    const name = villageName(user.address);
    const key = name.toLowerCase();
    const group = byKey.get(key) ?? { ids: [], spellings: new Map<string, number>() };
    group.ids.push(user.id);
    group.spellings.set(name, (group.spellings.get(name) ?? 0) + 1);
    byKey.set(key, group);
  }

  const of = new Map<number, string>();
  const customers = new Map<string, number>();
  const named: { name: string; count: number }[] = [];
  for (const [key, group] of byKey) {
    let village: string;
    if (key === "") village = UNKNOWN_VILLAGE;
    else if (group.ids.length < MIN_VILLAGE_CUSTOMERS) village = OTHER_VILLAGES;
    else {
      village = mostCommon(group.spellings);
      named.push({ name: village, count: group.ids.length });
    }
    group.ids.forEach((id) => of.set(id, village));
    customers.set(village, (customers.get(village) ?? 0) + group.ids.length);
  }
  named.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const order = [
    ...named.map((n) => n.name),
    ...[OTHER_VILLAGES, UNKNOWN_VILLAGE].filter((v) => customers.has(v)),
  ];
  return { of, customers, order };
};

/** A customer's grouped village; Unknown when the customer is not on file. */
export const villageOfUser = (groups: VillageGroups, userId: number): string =>
  groups.of.get(userId) ?? UNKNOWN_VILLAGE;

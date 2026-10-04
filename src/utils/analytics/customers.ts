import { AnalyticsData } from "./types";
import { Period, dayNumber, daysSince, inPeriod, median, toTime } from "./periods";
import { oldCreditByLenden } from "./sales";

export type Tier = "good" | "medium" | "low";

export interface CustomerStat {
  userId: number;
  name: string;
  visits: number; // distinct purchase days in the period
  sales: number;
  daysSinceLastVisit: number;
  tier: Tier;
  highBaaki: boolean;
}

export interface GapBin {
  label: string;
  count: number;
}

export interface CustomersView {
  totalCustomers: number;
  activeInPeriod: number;
  newInPeriod: number;
  buyers: number;
  repeatCustomers: number;
  repeatRate: number; // 0..1
  medianGapDays: number | null;
  gapBins: GapBin[];
  tierCounts: Record<Tier, number>;
  customers: CustomerStat[]; // buyers in the period, highest sales first
}

const GAP_BINS = [
  { label: "< 1 mo", maxDays: 29 },
  { label: "1–3 mo", maxDays: 89 },
  { label: "3–6 mo", maxDays: 179 },
  { label: "6–12 mo", maxDays: 365 },
  { label: "> 12 mo", maxDays: Infinity },
];

/** 1–3 points by rank among peers; ties share the lower rank. */
export const thirdPoints = (value: number, peers: number[]): 1 | 2 | 3 => {
  const share = peers.filter((p) => p < value).length / peers.length;
  return share >= 2 / 3 ? 3 : share >= 1 / 3 ? 2 : 1;
};

export const recencyPoints = (days: number): 1 | 2 | 3 =>
  days <= 90 ? 3 : days <= 365 ? 2 : 1;

export const tierFor = (score: number): Tier =>
  score >= 8 ? "good" : score >= 6 ? "medium" : "low";

// A date that cannot be read (NaN) never wins, so a customer's latest and earliest are readable ones.
const latest = (dates: string[]) =>
  dates.reduce((a, b) => (toTime(a) >= toTime(b) || Number.isNaN(toTime(b)) ? a : b));
const earliest = (dates: string[]) =>
  dates.reduce((a, b) => (toTime(a) <= toTime(b) || Number.isNaN(toTime(b)) ? a : b));

/** Customers whose first Len-Den or Rehan entry falls in the period (the view's newInPeriod, without the rest). */
export const countNewCustomers = (data: AnalyticsData, period: Period): number => {
  const first = new Map<number, number>();
  const note = (userId: number, stored: string) => {
    const t = toTime(stored);
    if (Number.isNaN(t)) return;
    const seen = first.get(userId);
    if (seen === undefined || t < seen) first.set(userId, t);
  };
  data.lenden.forEach((entry) => note(entry.userId, entry.date));
  data.rehan.forEach((entry) => note(entry.userId, entry.openDate));
  const start = period.start.getTime();
  const end = period.end.getTime();
  let count = 0;
  for (const t of first.values()) if (t >= start && t < end) count++;
  return count;
};

export const buildCustomersView = (
  data: AnalyticsData,
  period: Period,
  now: Date = new Date(),
): CustomersView => {
  const names = new Map(data.users.map((u) => [u.id, u.name]));

  // All-time activity of any kind, for active / new / recency.
  const activity = new Map<number, string[]>();
  const record = (userId: number, date: string) =>
    activity.set(userId, [...(activity.get(userId) ?? []), date]);
  data.lenden.forEach((entry) => record(entry.userId, entry.date));
  data.rehan.forEach((entry) => record(entry.userId, entry.openDate));

  let activeInPeriod = 0;
  let newInPeriod = 0;
  for (const dates of activity.values()) {
    if (dates.some((d) => inPeriod(d, period))) activeInPeriod++;
    if (inPeriod(earliest(dates), period)) newInPeriod++;
  }

  // Purchases in the period. Two bills on one day are one visit.
  const purchases = new Map<number, { days: Set<number>; sales: number }>();
  for (const entry of data.lenden) {
    if (!inPeriod(entry.date, period)) continue;
    const p = purchases.get(entry.userId) ?? { days: new Set<number>(), sales: 0 };
    p.days.add(dayNumber(entry.date));
    p.sales += entry.amount ?? 0;
    purchases.set(entry.userId, p);
  }

  const gaps: number[] = [];
  for (const p of purchases.values()) {
    const days = [...p.days].sort((a, b) => a - b);
    for (let i = 1; i < days.length; i++) gaps.push(days[i] - days[i - 1]);
  }
  const gapBins = GAP_BINS.map(({ label }) => ({ label, count: 0 }));
  for (const gap of gaps) gapBins[GAP_BINS.findIndex((b) => gap <= b.maxDays)].count++;

  // High baaki compares open dues with all-time net purchases.
  const credit = oldCreditByLenden(data);
  const net = new Map<number, number>();
  const owed = new Map<number, number>();
  for (const entry of data.lenden) {
    const value = (entry.amount ?? 0) - (entry.discount ?? 0) - (credit.get(entry.id) ?? 0);
    net.set(entry.userId, (net.get(entry.userId) ?? 0) + value);
    if ((entry.status ?? 0) === 0 && (entry.baki ?? 0) > 0) {
      owed.set(entry.userId, (owed.get(entry.userId) ?? 0) + (entry.baki ?? 0));
    }
  }

  const visitPeers = [...purchases.values()].map((p) => p.days.size);
  const salesPeers = [...purchases.values()].map((p) => p.sales);
  const tooFewToRank = purchases.size < 3;

  const customers: CustomerStat[] = [...purchases]
    .map(([userId, p]) => {
      const daysSinceLastVisit = Math.max(0, daysSince(latest(activity.get(userId)!), now));
      const tier: Tier = tooFewToRank
        ? "medium"
        : tierFor(
            recencyPoints(daysSinceLastVisit) +
              thirdPoints(p.days.size, visitPeers) +
              thirdPoints(p.sales, salesPeers),
          );
      const netPurchases = net.get(userId) ?? 0;
      return {
        userId,
        name: names.get(userId) ?? "Unknown",
        visits: p.days.size,
        sales: p.sales,
        daysSinceLastVisit,
        tier,
        highBaaki: netPurchases > 0 && (owed.get(userId) ?? 0) > netPurchases * 0.5,
      };
    })
    .sort((a, b) => b.sales - a.sales);

  const repeatCustomers = customers.filter((c) => c.visits >= 2).length;
  const tierCounts: Record<Tier, number> = { good: 0, medium: 0, low: 0 };
  customers.forEach((c) => tierCounts[c.tier]++);

  return {
    totalCustomers: data.users.length,
    activeInPeriod,
    newInPeriod,
    buyers: customers.length,
    repeatCustomers,
    repeatRate: customers.length ? repeatCustomers / customers.length : 0,
    medianGapDays: median(gaps),
    gapBins,
    tierCounts,
    customers,
  };
};

import { AnalyticsData } from "./types";
import { daysSince, toTime } from "./periods";
import { oldCreditByLenden } from "./sales";

export interface AgingBucket {
  label: string;
  count: number;
  amount: number;
}

/**
 * Outstanding baaki at an instant, rebuilt from bill and payment dates
 * (spec §10.4). Legacy bills without jama_entries count lenden.jama as paid
 * on the bill date. An overpaid bill contributes 0, never a negative.
 */
export const baakiAt = (data: AnalyticsData, at: Date): number => {
  const t = at.getTime();
  const before = (stored: string) => toTime(stored) < t;
  const credit = oldCreditByLenden(data);
  const hasEntries = new Set(data.jama.map((j) => j.lendenId));
  const paid = new Map<number, number>();
  const pay = (id: number, amount: number) => paid.set(id, (paid.get(id) ?? 0) + amount);
  for (const j of data.jama) if (before(j.date)) pay(j.lendenId, j.amount);

  let total = 0;
  for (const bill of data.lenden) {
    if (!before(bill.date)) continue;
    if (!hasEntries.has(bill.id)) pay(bill.id, bill.jama ?? 0);
    const net = (bill.amount ?? 0) - (bill.discount ?? 0) - (credit.get(bill.id) ?? 0);
    total += Math.max(0, net - (paid.get(bill.id) ?? 0));
  }
  return total;
};

const AGING = [
  { label: "0–30 days", maxDays: 30 },
  { label: "31–90 days", maxDays: 90 },
  { label: "91–180 days", maxDays: 180 },
  { label: "181–365 days", maxDays: 365 },
  { label: "> 1 year", maxDays: Infinity },
];

/** Label of the extra bucket for open bills whose date cannot be read. */
export const UNREADABLE_AGING = "Date unreadable";

/**
 * Open entries' stored baki grouped by how old the bill is. A bill whose date cannot be read
 * cannot be aged, but its baki must not vanish: it goes in a last "Date unreadable" bucket,
 * added only when it has a bill, so the buckets always add up to the open baki.
 */
export const baakiAging = (data: AnalyticsData, now: Date = new Date()): AgingBucket[] => {
  const buckets = AGING.map(({ label }) => ({ label, count: 0, amount: 0 }));
  const unreadable = { label: UNREADABLE_AGING, count: 0, amount: 0 };
  for (const bill of data.lenden) {
    const baki = bill.baki ?? 0;
    if ((bill.status ?? 0) !== 0 || baki <= 0) continue;
    const age = Math.max(0, daysSince(bill.date, now));
    const bucket = Number.isNaN(age) ? unreadable : buckets[AGING.findIndex((a) => age <= a.maxDays)];
    bucket.count++;
    bucket.amount += baki;
  }
  return unreadable.count > 0 ? [...buckets, unreadable] : buckets;
};

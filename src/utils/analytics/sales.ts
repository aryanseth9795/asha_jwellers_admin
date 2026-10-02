import { AnalyticsData } from "./types";
import { Bucket, Period, Point, buckets, inPeriod, series, sum } from "./periods";

export interface BaakiCustomer {
  userId: number;
  name: string;
  baki: number;
}

export interface SalesView {
  bills: number;
  sales: number; // gross bill value
  oldCredit: number;
  discount: number;
  netSales: number;
  avgBill: number;
  collected: number; // cash by payment date
  baakiOutstanding: number; // open entries, as of today
  topBaaki: BaakiCustomer[];
  buckets: Bucket[];
  salesSeries: number[];
  collectedSeries: number[];
}

export const oldCreditByLenden = (data: AnalyticsData): Map<number, number> => {
  const credit = new Map<number, number>();
  for (const item of data.oldItems) {
    credit.set(item.lendenId, (credit.get(item.lendenId) ?? 0) + item.value);
  }
  return credit;
};

/**
 * Cash received, dated when it arrived. Entries created before jama_entries
 * existed only have the lenden.jama total, so that is used at the bill date;
 * it is never added on top of real entries because it duplicates them.
 */
export const payments = (data: AnalyticsData): Point[] => {
  const hasEntries = new Set(data.jama.map((j) => j.lendenId));
  const points: Point[] = data.jama.map((j) => ({ date: j.date, value: j.amount }));
  for (const entry of data.lenden) {
    const legacy = entry.jama ?? 0;
    if (!hasEntries.has(entry.id) && legacy > 0) {
      points.push({ date: entry.date, value: legacy });
    }
  }
  return points;
};

export const buildSalesView = (data: AnalyticsData, period: Period): SalesView => {
  const bills = data.lenden.filter((entry) => inPeriod(entry.date, period));
  const credit = oldCreditByLenden(data);
  const sales = sum(bills.map((entry) => entry.amount ?? 0));
  const discount = sum(bills.map((entry) => entry.discount ?? 0));
  const oldCredit = sum(bills.map((entry) => credit.get(entry.id) ?? 0));
  const periodPayments = payments(data).filter((p) => inPeriod(p.date, period));

  const names = new Map(data.users.map((u) => [u.id, u.name]));
  const owedByUser = new Map<number, number>();
  for (const entry of data.lenden) {
    const baki = entry.baki ?? 0;
    if ((entry.status ?? 0) === 0 && baki > 0) {
      owedByUser.set(entry.userId, (owedByUser.get(entry.userId) ?? 0) + baki);
    }
  }
  const topBaaki = [...owedByUser]
    .map(([userId, baki]) => ({ userId, name: names.get(userId) ?? "Unknown", baki }))
    .sort((a, b) => b.baki - a.baki)
    .slice(0, 5);

  const bucketList = buckets(period, [
    ...bills.map((entry) => entry.date),
    ...periodPayments.map((p) => p.date),
  ]);

  return {
    bills: bills.length,
    sales,
    oldCredit,
    discount,
    netSales: sales - oldCredit - discount,
    avgBill: bills.length ? Math.round(sales / bills.length) : 0,
    collected: sum(periodPayments.map((p) => p.value)),
    baakiOutstanding: sum([...owedByUser.values()]),
    topBaaki,
    buckets: bucketList,
    salesSeries: series(bucketList, period,
      bills.map((entry) => ({ date: entry.date, value: entry.amount ?? 0 }))),
    collectedSeries: series(bucketList, period, periodPayments),
  };
};

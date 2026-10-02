import { AnalyticsData, RehanRow, RehanTxRow } from "./types";
import { Bucket, Period, Point, allPeriod, buckets, daysBetween, inPeriod, median, series, sum } from "./periods";

export interface AnnualRehan {
  label: string;
  given: number;
  recovered: number;
  opened: number;
}

export interface RehanView {
  openCount: number; // as of today
  openBalance: number; // as of today
  opened: number;
  closed: number;
  given: number;
  recovered: number;
  medianDaysToClose: number | null;
  avgDaysToClose: number | null;
  buckets: Bucket[];
  givenSeries: number[];
  recoveredSeries: number[];
  annual: AnnualRehan[];
}

/**
 * The opening amount isn't stored: rehan.amount is a running balance that
 * diya raises and jama lowers. Clamped at 0 because a balance edited by hand
 * on the detail screen can make the reconstruction negative.
 */
export const principalOf = (entry: RehanRow, txs: RehanTxRow[]): number => {
  const diya = sum(txs.filter((t) => t.type === "diya").map((t) => t.amount));
  const jama = sum(txs.filter((t) => t.type === "jama").map((t) => t.amount));
  return Math.max(0, (entry.amount ?? 0) - diya + jama);
};

export const buildRehanView = (data: AnalyticsData, period: Period): RehanView => {
  const txByRehan = new Map<number, RehanTxRow[]>();
  for (const tx of data.rehanTx) {
    txByRehan.set(tx.rehanId, [...(txByRehan.get(tx.rehanId) ?? []), tx]);
  }

  const givenPoints: Point[] = [
    ...data.rehan.map((r) => ({ date: r.openDate, value: principalOf(r, txByRehan.get(r.id) ?? []) })),
    ...data.rehanTx.filter((t) => t.type === "diya").map((t) => ({ date: t.date, value: t.amount })),
  ];
  const recoveredPoints: Point[] = data.rehanTx
    .filter((t) => t.type === "jama")
    .map((t) => ({ date: t.date, value: t.amount }));
  const openedPoints: Point[] = data.rehan.map((r) => ({ date: r.openDate, value: 1 }));

  const inP = (p: Point) => inPeriod(p.date, period);
  const open = data.rehan.filter((r) => (r.status ?? 0) === 0);
  const closed = data.rehan.filter(
    (r): r is RehanRow & { closedDate: string } =>
      r.status === 1 && !!r.closedDate && inPeriod(r.closedDate, period),
  );
  const closeDays = closed
    .map((r) => daysBetween(r.openDate, r.closedDate))
    .filter((d) => d >= 0);

  const bucketList = buckets(period);
  const all = allPeriod([...givenPoints, ...recoveredPoints].map((p) => p.date));
  const annualBuckets = buckets(all);
  const annualGiven = series(annualBuckets, all, givenPoints);
  const annualRecovered = series(annualBuckets, all, recoveredPoints);
  const annualOpened = series(annualBuckets, all, openedPoints);

  return {
    openCount: open.length,
    openBalance: sum(open.map((r) => r.amount ?? 0)),
    opened: openedPoints.filter(inP).length,
    closed: closed.length,
    given: sum(givenPoints.filter(inP).map((p) => p.value)),
    recovered: sum(recoveredPoints.filter(inP).map((p) => p.value)),
    medianDaysToClose: median(closeDays),
    avgDaysToClose: closeDays.length ? Math.round(sum(closeDays) / closeDays.length) : null,
    buckets: bucketList,
    givenSeries: series(bucketList, period, givenPoints),
    recoveredSeries: series(bucketList, period, recoveredPoints),
    annual: annualBuckets.map((b, i) => ({
      label: b.label,
      given: annualGiven[i],
      recovered: annualRecovered[i],
      opened: annualOpened[i],
    })),
  };
};

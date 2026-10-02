import { PledgeRow } from "./pledges";
import { pledgeStats } from "./pledgeBook";
import { Bucket, sum } from "../periods";

export interface ItemStat {
  item: string;
  pledges: number;
  principal: number;
  avgTicket: number;
  openPrincipal: number;
  openShare: number; // of the open book of all rows given
  redeemedPct: number;
  medianDaysToRedeem: number | null;
}

export interface QuarterMix {
  buckets: Bucket[];
  series: { label: string; values: number[] }[];
}

export interface BundleStats {
  bundles: number;
  bundleShare: number;
  avgBundle: number;
  singles: number;
  avgSingle: number;
  premium: number | null; // average bundle vs average single item, e.g. 0.62 = +62 %
}

const openBookOf = (rows: PledgeRow[]) => sum(rows.filter((r) => r.open).map((r) => r.principal));

const statOf = (item: string, group: PledgeRow[], openBook: number): ItemStat => {
  const s = pledgeStats(group);
  return {
    item,
    pledges: s.pledges,
    principal: s.principal,
    avgTicket: s.avgPledge,
    openPrincipal: s.openBook,
    openShare: openBook ? s.openBook / openBook : 0,
    redeemedPct: s.redeemedPct,
    medianDaysToRedeem: s.medianDaysToRedeem,
  };
};

export const itemStats = (rows: PledgeRow[]): ItemStat[] => {
  const openBook = openBookOf(rows);
  const groups = new Map<string, PledgeRow[]>();
  for (const r of rows) {
    const list = groups.get(r.item) ?? [];
    list.push(r);
    groups.set(r.item, list);
  }
  return [...groups]
    .map(([item, group]) => statOf(item, group, openBook))
    .sort((a, b) => b.principal - a.principal || a.item.localeCompare(b.item));
};

/** Items with at least `minPledges` pledges, then the rest as "All other items (n)". */
export const rankItems = (rows: PledgeRow[], minPledges = 5): ItemStat[] => {
  const stats = itemStats(rows);
  const large = stats.filter((s) => s.pledges >= minPledges);
  const small = stats.filter((s) => s.pledges < minPledges);
  if (small.length === 0) return large;
  const smallItems = new Set(small.map((s) => s.item));
  return [
    ...large,
    statOf(`All other items (${small.length})`, rows.filter((r) => smallItems.has(r.item)), openBookOf(rows)),
  ];
};

const quarterOf = (iso: string) => {
  const d = new Date(iso);
  return { year: d.getFullYear(), q: Math.floor(d.getMonth() / 3) + 1 };
};

/** Pledges opened per calendar quarter for the last `quarters` quarters: the `top` items, then the rest. */
export const itemMixByQuarter = (rows: PledgeRow[], now: Date, quarters = 4, top = 3): QuarterMix => {
  const current = quarterOf(now.toISOString());
  const buckets: Bucket[] = [];
  for (let i = quarters - 1; i >= 0; i--) {
    const index = current.year * 4 + (current.q - 1) - i;
    const year = Math.floor(index / 4);
    const q = (index % 4) + 1;
    buckets.push({ key: `${year}-Q${q}`, label: `Q${q} '${String(year % 100).padStart(2, "0")}` });
  }
  const position = new Map(buckets.map((b, i) => [b.key, i]));
  const inRange = rows
    .map((r) => {
      const { year, q } = quarterOf(r.openDate);
      return { r, i: position.get(`${year}-Q${q}`) };
    })
    .filter((x): x is { r: PledgeRow; i: number } => x.i !== undefined);
  if (inRange.length === 0) return { buckets, series: [] };

  const totals = new Map<string, { count: number; principal: number }>();
  for (const { r } of inRange) {
    const t = totals.get(r.item) ?? { count: 0, principal: 0 };
    t.count++;
    t.principal += r.principal;
    totals.set(r.item, t);
  }
  const topItems = [...totals]
    .sort((a, b) => b[1].count - a[1].count || b[1].principal - a[1].principal || a[0].localeCompare(b[0]))
    .slice(0, top)
    .map(([item]) => item);
  const series = topItems.map((item) => ({ label: item, values: buckets.map(() => 0) }));
  const rest = { label: "All other items", values: buckets.map(() => 0) };
  for (const { r, i } of inRange) {
    const s = series.find((x) => x.label === r.item) ?? rest;
    s.values[i]++;
  }
  return { buckets, series: rest.values.some((v) => v > 0) ? [...series, rest] : series };
};

export const bundleStats = (rows: PledgeRow[]): BundleStats => {
  const bundles = rows.filter((r) => r.bundle);
  const singles = rows.filter((r) => !r.bundle);
  const avg = (list: PledgeRow[]) => (list.length ? sum(list.map((r) => r.principal)) / list.length : 0);
  const avgBundle = avg(bundles);
  const avgSingle = avg(singles);
  return {
    bundles: bundles.length,
    bundleShare: rows.length ? bundles.length / rows.length : 0,
    avgBundle,
    singles: singles.length,
    avgSingle,
    premium: avgBundle && avgSingle ? avgBundle / avgSingle - 1 : null,
  };
};

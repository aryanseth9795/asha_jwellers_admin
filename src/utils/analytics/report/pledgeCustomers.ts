import { AnalyticsData, UserRow } from "../types";
import { sum, toTime } from "../periods";
import { OTHER_VILLAGES, UNKNOWN_VILLAGE, VillageGroups } from "../villages";
import { PledgeRow } from "./pledges";
import { monthLabel, pledgeStats } from "./pledgeBook";

export interface VillageStat {
  village: string;
  customersOnFile: number;
  pledging: number;
  pledges: number;
  perCustomer: number; // pledges per pledging customer
  principal: number;
  openPrincipal: number;
  openShare: number;
  avgTicket: number;
  redeemedPct: number;
}

export interface Concentration {
  customers: number;
  top10: number;
  top20: number;
  top50: number;
  tenLargest: number;
  curve: { customerShare: number; principalShare: number }[]; // cumulative, largest customers first
}

export interface Exposure {
  userId: number;
  name: string;
  village: string;
  openPrincipal: number;
  openPledges: number;
  oldestOpenDays: number;
  redeemed: number;
  totalPledges: number;
}

export interface RepeatBucket {
  label: string;
  customers: number;
  customerShare: number;
  principal: number;
  principalShare: number;
}

export interface AddedPoint {
  key: string;
  label: string;
  added: number;
  total: number;
}

export interface Segment {
  label: string;
  customers: number;
}

const groupBy = <T, K>(list: T[], key: (t: T) => K): Map<K, T[]> => {
  const map = new Map<K, T[]>();
  for (const item of list) {
    const k = key(item);
    const bucket = map.get(k) ?? [];
    bucket.push(item);
    map.set(k, bucket);
  }
  return map;
};

const isNamed = (v: string) => v !== OTHER_VILLAGES && v !== UNKNOWN_VILLAGE;

export const villageStats = (rows: PledgeRow[], groups: VillageGroups): VillageStat[] => {
  const openBook = sum(rows.filter((r) => r.open).map((r) => r.principal));
  const byVillage = groupBy(rows, (r) => r.village);
  const villages = [...groups.order, ...[...byVillage.keys()].filter((v) => !groups.order.includes(v))];
  const stats = villages.map((village) => {
    const s = pledgeStats(byVillage.get(village) ?? []);
    return {
      village,
      customersOnFile: groups.customers.get(village) ?? 0,
      pledging: s.customers,
      pledges: s.pledges,
      perCustomer: s.customers ? s.pledges / s.customers : 0,
      principal: s.principal,
      openPrincipal: s.openBook,
      openShare: openBook ? s.openBook / openBook : 0,
      avgTicket: s.avgPledge,
      redeemedPct: s.redeemedPct,
    };
  });
  const named = stats
    .filter((s) => isNamed(s.village))
    .sort((a, b) => b.principal - a.principal || b.customersOnFile - a.customersOnFile || a.village.localeCompare(b.village));
  return [
    ...named,
    ...stats.filter((s) => s.village === OTHER_VILLAGES),
    ...stats.filter((s) => s.village === UNKNOWN_VILLAGE),
  ];
};

export const concentration = (rows: PledgeRow[]): Concentration => {
  const perCustomer = [...groupBy(rows, (r) => r.userId).values()]
    .map((list) => sum(list.map((r) => r.principal)))
    .sort((a, b) => b - a);
  const total = sum(perCustomer);
  const n = perCustomer.length;
  const shareOfTop = (count: number) => (total ? sum(perCustomer.slice(0, count)) / total : 0);
  const curve = [{ customerShare: 0, principalShare: 0 }];
  let running = 0;
  perCustomer.forEach((p, i) => {
    running += p;
    curve.push({ customerShare: (i + 1) / n, principalShare: total ? running / total : 0 });
  });
  return {
    customers: n,
    top10: shareOfTop(Math.ceil(n / 10)),
    top20: shareOfTop(Math.ceil(n / 5)),
    top50: shareOfTop(Math.ceil(n / 2)),
    tenLargest: shareOfTop(10),
    curve,
  };
};

/** Customers by open principal, largest first; customers with nothing open are left out. */
export const exposures = (rows: PledgeRow[], users: UserRow[], limit: number): Exposure[] => {
  const names = new Map(users.map((u) => [u.id, u.name]));
  return [...groupBy(rows, (r) => r.userId)]
    .map(([userId, list]) => {
      const open = list.filter((r) => r.open);
      return {
        userId,
        name: names.get(userId) ?? `Customer #${userId}`,
        village: list[0].village,
        openPrincipal: sum(open.map((r) => r.principal)),
        openPledges: open.length,
        oldestOpenDays: open.reduce((m, r) => Math.max(m, r.daysOpen ?? 0), 0),
        redeemed: list.length - open.length,
        totalPledges: list.length,
      };
    })
    .filter((e) => e.openPrincipal > 0)
    .sort((a, b) => b.openPrincipal - a.openPrincipal || a.userId - b.userId)
    .slice(0, limit);
};

const REPEAT = [
  { label: "1 pledge", min: 1, max: 1 },
  { label: "2", min: 2, max: 2 },
  { label: "3", min: 3, max: 3 },
  { label: "4–6", min: 4, max: 6 },
  { label: "7 or more", min: 7, max: Infinity },
];

export const repeatCustomers = (rows: PledgeRow[]): RepeatBucket[] => {
  const perCustomer = [...groupBy(rows, (r) => r.userId).values()].map((list) => ({
    count: list.length,
    principal: sum(list.map((r) => r.principal)),
  }));
  const total = sum(perCustomer.map((c) => c.principal));
  return REPEAT.map(({ label, min, max }) => {
    const inBucket = perCustomer.filter((c) => c.count >= min && c.count <= max);
    const principal = sum(inBucket.map((c) => c.principal));
    return {
      label,
      customers: inBucket.length,
      customerShare: perCustomer.length ? inBucket.length / perCustomer.length : 0,
      principal,
      principalShare: total ? principal / total : 0,
    };
  });
};

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/** New customers per month (from users.createdAt) with a running total, up to this month. */
export const customersAdded = (users: UserRow[], now: Date): AddedPoint[] => {
  const counts = new Map<string, number>();
  for (const u of users) {
    if (!u.createdAt) continue;
    const k = keyOf(new Date(toTime(u.createdAt)));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  if (counts.size === 0) return [];
  const first = [...counts.keys()].sort()[0];
  const last = keyOf(now) > first ? keyOf(now) : first;
  const points: AddedPoint[] = [];
  let y = Number(first.slice(0, 4));
  let m = Number(first.slice(5, 7));
  let total = 0;
  for (;;) {
    const key = `${y}-${pad(m)}`;
    const added = counts.get(key) ?? 0;
    total += added;
    points.push({ key, label: monthLabel(key), added, total });
    if (key >= last) break;
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return points;
};

/** Customers on file by what they do with the shop; only the village filter applies (spec §12.1). */
export const customerSegments = (
  data: AnalyticsData,
  rows: PledgeRow[],
  groups: VillageGroups,
  village = "all",
): Segment[] => {
  const billed = new Set(data.lenden.map((b) => b.userId));
  const pledges = groupBy(rows, (r) => r.userId);
  const counts = { openOnly: 0, both: 0, redeemedOnly: 0, billsOnly: 0, none: 0 };
  for (const user of data.users) {
    if (village !== "all" && groups.of.get(user.id) !== village) continue;
    const list = pledges.get(user.id) ?? [];
    const hasBills = billed.has(user.id);
    if (list.length && hasBills) counts.both++;
    else if (list.some((r) => r.open)) counts.openOnly++;
    else if (list.length) counts.redeemedOnly++;
    else if (hasBills) counts.billsOnly++;
    else counts.none++;
  }
  return [
    { label: "Open pledge only", customers: counts.openOnly },
    { label: "Pledges and bills", customers: counts.both },
    { label: "Redeemed pledges only", customers: counts.redeemedOnly },
    { label: "Bills only", customers: counts.billsOnly },
    { label: "No activity yet", customers: counts.none },
  ];
};

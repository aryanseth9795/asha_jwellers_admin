import { AnalyticsData } from "./types";
import { Period, dayNumber, inPeriod } from "./periods";
import { villageLabel } from "./villages";

export interface KeyCustomer {
  userId: number;
  name: string;
  village: string;
  periodSales: number;
  share: number; // of the period's sales, 0..1
  lifetimeSales: number;
  openBaaki: number; // as of today
  visits: number; // distinct purchase days in the period
}

export interface ImportanceView {
  buyers: number;
  topFifthShare: number; // share of sales from the top 20% of buyers (rounded up)
  top: KeyCustomer[];
}

export const buildImportanceView = (
  data: AnalyticsData,
  period: Period,
  limit = 10,
): ImportanceView => {
  const users = new Map(data.users.map((u) => [u.id, u]));
  const lifetime = new Map<number, number>();
  const owed = new Map<number, number>();
  const inP = new Map<number, { sales: number; days: Set<number> }>();
  for (const bill of data.lenden) {
    const amount = bill.amount ?? 0;
    lifetime.set(bill.userId, (lifetime.get(bill.userId) ?? 0) + amount);
    if ((bill.status ?? 0) === 0 && (bill.baki ?? 0) > 0) {
      owed.set(bill.userId, (owed.get(bill.userId) ?? 0) + (bill.baki ?? 0));
    }
    if (!inPeriod(bill.date, period)) continue;
    const p = inP.get(bill.userId) ?? { sales: 0, days: new Set<number>() };
    p.sales += amount;
    p.days.add(dayNumber(bill.date));
    inP.set(bill.userId, p);
  }

  const total = [...inP.values()].reduce((s, p) => s + p.sales, 0);
  const ranked: KeyCustomer[] = [...inP]
    .map(([userId, p]) => ({
      userId,
      name: users.get(userId)?.name ?? "Unknown",
      village: villageLabel(users.get(userId)?.address),
      periodSales: p.sales,
      share: total ? p.sales / total : 0,
      lifetimeSales: lifetime.get(userId) ?? 0,
      openBaaki: owed.get(userId) ?? 0,
      visits: p.days.size,
    }))
    .sort((a, b) => b.periodSales - a.periodSales);

  const fifth = Math.ceil(ranked.length * 0.2);
  const fifthSales = ranked.slice(0, fifth).reduce((s, c) => s + c.periodSales, 0);
  return {
    buyers: ranked.length,
    topFifthShare: total ? fifthSales / total : 0,
    top: ranked.slice(0, limit),
  };
};

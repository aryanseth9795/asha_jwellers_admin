import { buildTrends } from "../../../src/utils/analytics/trends";
import { AnalyticsData, LendenRow } from "../../../src/utils/analytics/types";

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const NOW = new Date(2026, 9, 2, 12);
const bill = (o: Partial<LendenRow>): LendenRow => ({
  id: 1, userId: 1, date: iso(2026, 8, 10), amount: 0, discount: null,
  jama: null, baki: null, status: 0, ...o,
});
const empty: AnalyticsData = {
  users: [], lenden: [], jama: [], rehan: [], rehanTx: [], soldItems: [], oldItems: [],
};
const data: AnalyticsData = {
  ...empty,
  lenden: [
    bill({ id: 1, date: iso(2026, 8, 10), amount: 100000 }),
    bill({ id: 2, date: iso(2026, 9, 15), amount: 50000 }),
    bill({ id: 3, date: iso(2026, 10, 1), amount: 30000 }),
  ],
  jama: [
    { lendenId: 1, amount: 40000, date: iso(2026, 8, 10) },
    { lendenId: 2, amount: 50000, date: iso(2026, 9, 20) },
  ],
  soldItems: [
    { lendenId: 1, metal: "gold", purity: "22KT", weight: 10, total: 100000 },
    { lendenId: 2, metal: "silver", purity: "Desi", weight: 200, total: 50000 },
    { lendenId: 3, metal: "gold", purity: "22KT", weight: 3, total: 30000 },
  ],
};

describe("buildTrends", () => {
  const rows = buildTrends(data, "month", NOW, 3);

  it("lists the last N periods oldest first, ending with the current one", () => {
    expect(rows.map((r) => r.label)).toEqual(["Aug 2026", "Sep 2026", "Oct 2026 (so far)"]);
  });

  it("fills each period's figures", () => {
    expect(rows[0]).toMatchObject({
      bills: 1, sales: 100000, collected: 40000, collectionRate: 0.4,
      baakiAtEnd: 60000, goldGrams: 10, silverGrams: 0, oldReturned: 0,
    });
    expect(rows[1]).toMatchObject({ sales: 50000, collected: 50000, collectionRate: 1, baakiAtEnd: 60000, silverGrams: 200 });
    // the current period is measured up to now, not to its end
    expect(rows[2]).toMatchObject({ sales: 30000, collected: 0, collectionRate: 0, baakiAtEnd: 90000, goldGrams: 3 });
  });

  it("compares each row with the one before", () => {
    expect(rows[0].change.sales).toBeNull();
    expect(rows[1].change.baakiAtEnd?.pct).toBe(0);
    expect(rows[2].change.sales?.pct).toBeNull(); // Sep 1-2 had no sales
    expect(rows[2].change.baakiAtEnd?.pct).toBeCloseTo(0.5);
    expect(rows[2].change.goldGrams?.pct).toBeNull(); // nothing in Sep
  });

  it("uses default counts per grain and survives no data", () => {
    expect(buildTrends(data, "week", NOW)).toHaveLength(8);
    const fys = buildTrends(empty, "fy", NOW);
    expect(fys).toHaveLength(5);
    expect(fys[4].label).toBe("FY 2026-27 (so far)");
    expect(fys[4]).toMatchObject({ sales: 0, collectionRate: null, baakiAtEnd: 0 });
  });
});

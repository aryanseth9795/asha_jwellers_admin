import { baakiAging, baakiAt } from "./baki";
import { AnalyticsData, LendenRow } from "./types";

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const empty: AnalyticsData = {
  users: [], lenden: [], jama: [], rehan: [], rehanTx: [], soldItems: [], oldItems: [],
};
const bill = (o: Partial<LendenRow>): LendenRow => ({
  id: 1, userId: 1, date: iso(2026, 4, 5), amount: 0, discount: null,
  jama: null, baki: null, status: 0, ...o,
});

describe("baakiAt", () => {
  const data: AnalyticsData = {
    ...empty,
    lenden: [
      bill({ id: 1, date: iso(2026, 4, 5), amount: 100000, discount: 1000 }),
      bill({ id: 2, date: iso(2026, 5, 5), amount: 50000, jama: 20000 }), // legacy jama
      bill({ id: 3, date: iso(2026, 8, 1), amount: 1000 }), // overpaid
    ],
    jama: [
      { lendenId: 1, amount: 30000, date: iso(2026, 4, 5) },
      { lendenId: 1, amount: 50000, date: iso(2026, 6, 1) },
      { lendenId: 3, amount: 5000, date: iso(2026, 8, 1) },
    ],
    oldItems: [{ lendenId: 1, metal: "gold", weight: 3, value: 19000 }],
  };

  it("counts only bills and payments dated before the instant", () => {
    expect(baakiAt(data, new Date(2026, 3, 1))).toBe(0);
    expect(baakiAt(data, new Date(2026, 4, 1))).toBe(50000); // 80000 net − 30000
    expect(baakiAt(data, new Date(2026, 5, 1))).toBe(80000); // + bill 2: 50000 − legacy 20000
    expect(baakiAt(data, new Date(2026, 6, 1))).toBe(30000); // bill 1 fully paid
  });

  it("never lets an overpaid bill reduce the total", () => {
    expect(baakiAt(data, new Date(2026, 8, 1))).toBe(30000);
  });

  it("is zero with no data", () => {
    expect(baakiAt(empty, new Date())).toBe(0);
  });
});

describe("baakiAging", () => {
  it("groups open baaki by bill age", () => {
    const now = new Date(2026, 9, 2, 12);
    const data: AnalyticsData = {
      ...empty,
      lenden: [
        bill({ id: 1, date: iso(2026, 9, 20), baki: 1000 }), // 12 days
        bill({ id: 2, date: iso(2026, 7, 1), baki: 2000 }), // 93 days
        bill({ id: 3, date: iso(2026, 1, 1), baki: 3000 }), // 274 days
        bill({ id: 4, date: iso(2025, 6, 1), baki: 4000 }), // 488 days
        bill({ id: 5, date: iso(2026, 9, 1), baki: 0, status: 1 }),
        bill({ id: 6, date: iso(2026, 9, 1), baki: 0, status: 0 }),
      ],
    };
    expect(baakiAging(data, now)).toEqual([
      { label: "0–30 days", count: 1, amount: 1000 },
      { label: "31–90 days", count: 0, amount: 0 },
      { label: "91–180 days", count: 1, amount: 2000 },
      { label: "181–365 days", count: 1, amount: 3000 },
      { label: "> 1 year", count: 1, amount: 4000 },
    ]);
  });
});

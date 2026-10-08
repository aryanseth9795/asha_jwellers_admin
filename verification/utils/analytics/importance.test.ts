import { buildImportanceView } from "../../../src/utils/analytics/importance";
import { fyPeriod } from "../../../src/utils/analytics/periods";
import { AnalyticsData, LendenRow } from "../../../src/utils/analytics/types";

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
let nextId = 1;
const bill = (userId: number, date: string, amount: number, o: Partial<LendenRow> = {}): LendenRow => ({
  id: nextId++, userId, date, amount, discount: null, jama: null, baki: 0, status: 1, ...o,
});
const empty: AnalyticsData = {
  users: [], lenden: [], jama: [], rehan: [], rehanTx: [], soldItems: [], oldItems: [],
};

describe("buildImportanceView", () => {
  const data: AnalyticsData = {
    ...empty,
    users: [
      { id: 1, name: "A", address: "Ramdaspur, Jaunpur" },
      { id: 2, name: "B", address: "Malhani" },
      { id: 3, name: "C", address: null },
      { id: 4, name: "D", address: "Malhani" },
      { id: 5, name: "E", address: "Malhani" },
    ],
    lenden: [
      bill(1, iso(2026, 5, 1), 100000),
      bill(1, iso(2026, 5, 1), 0), // same day: one visit
      bill(2, iso(2026, 6, 1), 50000, { baki: 10000, status: 0 }),
      bill(3, iso(2026, 7, 1), 30000),
      bill(4, iso(2026, 8, 1), 15000),
      bill(5, iso(2026, 9, 1), 5000),
      bill(1, iso(2025, 5, 1), 40000),
    ],
  };
  const view = buildImportanceView(data, fyPeriod(2026));

  it("ranks buyers by sales in the period", () => {
    expect(view.buyers).toBe(5);
    expect(view.top.map((c) => c.name)).toEqual(["A", "B", "C", "D", "E"]);
    expect(view.top[0]).toMatchObject({
      village: "Ramdaspur", periodSales: 100000, share: 0.5, lifetimeSales: 140000, visits: 1,
    });
    expect(view.top[1].openBaaki).toBe(10000);
    expect(view.top[2].village).toBe("No address");
  });

  it("measures how concentrated sales are in the top 20% of buyers", () => {
    expect(view.topFifthShare).toBe(0.5);
  });

  it("respects the limit and handles no data", () => {
    expect(buildImportanceView(data, fyPeriod(2026), 3).top).toHaveLength(3);
    expect(buildImportanceView(empty, fyPeriod(2026))).toEqual({ buyers: 0, topFifthShare: 0, top: [] });
  });
});

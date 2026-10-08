import { fyPeriod } from "../../../src/utils/analytics/periods";
import { buildSalesView, payments } from "../../../src/utils/analytics/sales";
import { AnalyticsData, LendenRow } from "../../../src/utils/analytics/types";

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const FY26 = fyPeriod(2026);

const lenden = (o: Partial<LendenRow>): LendenRow => ({
  id: 1, userId: 1, date: iso(2026, 5, 10), amount: 0, discount: null,
  jama: null, baki: null, status: 0, ...o,
});

const empty: AnalyticsData = {
  users: [], lenden: [], jama: [], rehan: [], rehanTx: [], soldItems: [], oldItems: [],
};

describe("payments", () => {
  it("uses jama entries by their own date", () => {
    const data = { ...empty, lenden: [lenden({ id: 1, jama: 500 })],
      jama: [{ lendenId: 1, amount: 500, date: iso(2026, 7, 1) }] };
    expect(payments(data)).toEqual([{ date: iso(2026, 7, 1), value: 500 }]);
  });

  it("falls back to legacy lenden.jama at the bill date, never on top of entries", () => {
    const data = { ...empty,
      lenden: [lenden({ id: 1, jama: 300 }), lenden({ id: 2, jama: 800, date: iso(2026, 6, 1) })],
      jama: [{ lendenId: 1, amount: 300, date: iso(2026, 7, 1) }] };
    const result = payments(data);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ date: iso(2026, 6, 1), value: 800 });
  });
});

describe("buildSalesView", () => {
  const data: AnalyticsData = {
    ...empty,
    users: [{ id: 1, name: "Ram" }, { id: 2, name: "Sita" }],
    lenden: [
      lenden({ id: 1, userId: 1, amount: 100000, discount: 1000, baki: 20000, status: 0, date: iso(2026, 4, 5) }),
      lenden({ id: 2, userId: 2, amount: 50000, baki: 0, status: 1, date: iso(2026, 5, 5) }),
      lenden({ id: 3, userId: 2, amount: 9999, baki: 5000, status: 0, date: iso(2025, 5, 5) }),
    ],
    jama: [
      { lendenId: 1, amount: 60000, date: iso(2026, 4, 5) },
      { lendenId: 2, amount: 50000, date: iso(2026, 6, 1) },
    ],
    oldItems: [{ lendenId: 1, metal: "gold", weight: 3, value: 19000 }],
  };
  const view = buildSalesView(data, FY26);

  it("totals sales, deductions and net for bills dated in the FY", () => {
    expect(view.bills).toBe(2);
    expect(view.sales).toBe(150000);
    expect(view.discount).toBe(1000);
    expect(view.oldCredit).toBe(19000);
    expect(view.netSales).toBe(130000);
    expect(view.avgBill).toBe(75000);
  });

  it("counts collections by payment month", () => {
    expect(view.collected).toBe(110000);
    expect(view.collectedSeries[0]).toBe(60000); // Apr
    expect(view.collectedSeries[2]).toBe(50000); // Jun
    expect(view.salesSeries[1]).toBe(50000); // May
  });

  it("reports open baaki as of today regardless of period, top customers first", () => {
    expect(view.baakiOutstanding).toBe(25000);
    expect(view.topBaaki).toEqual([
      { userId: 1, name: "Ram", baki: 20000 },
      { userId: 2, name: "Sita", baki: 5000 },
    ]);
  });

  it("returns zeros, not NaN, with no data", () => {
    const blank = buildSalesView(empty, FY26);
    expect(blank.avgBill).toBe(0);
    expect(blank.sales).toBe(0);
    expect(blank.salesSeries.every((v) => v === 0)).toBe(true);
  });
});

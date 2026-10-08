import { buildOverview } from "../../../src/utils/analytics/overview";
import { monthPeriod, previousPeriod, samePeriodLastYear } from "../../../src/utils/analytics/periods";
import { AnalyticsData, LendenRow } from "../../../src/utils/analytics/types";

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const NOW = new Date(2026, 9, 20, 12);
const bill = (o: Partial<LendenRow>): LendenRow => ({
  id: 1, userId: 1, date: iso(2026, 10, 1), amount: 0, discount: null,
  jama: null, baki: null, status: 0, ...o,
});
const empty: AnalyticsData = {
  users: [], lenden: [], jama: [], rehan: [], rehanTx: [], soldItems: [], oldItems: [],
};
const data: AnalyticsData = {
  ...empty,
  users: [
    { id: 1, name: "A", address: "Ramdaspur, Jaunpur" },
    { id: 2, name: "B", address: "Malhani" },
  ],
  lenden: [
    bill({ id: 1, userId: 1, date: iso(2026, 9, 10), amount: 100000, baki: 0, status: 1 }),
    bill({ id: 2, userId: 2, date: iso(2026, 10, 5), amount: 150000, baki: 90000, status: 0 }),
    bill({ id: 3, userId: 1, date: iso(2026, 10, 12), amount: 50000, baki: 30000, status: 0 }),
    bill({ id: 4, userId: 2, date: iso(2025, 10, 8), amount: 80000, jama: 80000, baki: 0, status: 1 }),
  ],
  jama: [
    { lendenId: 1, amount: 100000, date: iso(2026, 9, 10) },
    { lendenId: 2, amount: 60000, date: iso(2026, 10, 5) },
  ],
  soldItems: [
    { lendenId: 1, metal: "gold", purity: "22KT", weight: 14, total: 100000 },
    { lendenId: 2, metal: "gold", purity: "22KT", weight: 20, total: 150000 },
    { lendenId: 3, metal: "silver", purity: "Desi", weight: 500, total: 50000 },
    { lendenId: 4, metal: "gold", purity: "22KT", weight: 12, total: 80000 },
  ],
  oldItems: [{ lendenId: 3, metal: "gold", weight: 4, value: 20000 }],
};
const oct = monthPeriod(new Date(2026, 9, 7));
const view = buildOverview(data, oct, previousPeriod(oct), samePeriodLastYear(oct), NOW);
const kpi = (key: string) => view.kpis.find((k) => k.key === key)!;

describe("buildOverview KPIs", () => {
  it("compares with the previous period and the same period last year", () => {
    expect(kpi("sales")).toMatchObject({ value: 200000, upIsGood: true, format: "rupees" });
    expect(kpi("sales").change?.pct).toBe(1);
    expect(kpi("sales").yoy?.pct).toBe(1.5);
    expect(kpi("collected").value).toBe(60000);
    expect(kpi("collected").change?.pct).toBeCloseTo(-0.4);
  });

  it("derives rates, counts, grams and baaki", () => {
    expect(kpi("collectionRate").value).toBeCloseTo(60000 / 180000);
    expect(kpi("bills").value).toBe(2);
    expect(kpi("avgBill").value).toBe(100000);
    expect(kpi("baakiEnd")).toMatchObject({ value: 120000, upIsGood: false });
    expect(kpi("baakiEnd").change).toMatchObject({ previous: 0, pct: null });
    expect(kpi("goldSold").value).toBe(20);
    expect(kpi("silverSold").value).toBe(500);
    expect(kpi("oldReturnPct").value).toBeCloseTo(0.1);
    expect(kpi("newCustomers").value).toBe(0);
    expect(kpi("rehanGiven").value).toBe(0);
  });

  it("charts this period with the previous one aligned under it", () => {
    expect(view.salesSeries).toEqual([0, 150000, 50000, 0, 0]);
    expect(view.previousSalesSeries).toEqual([0, 100000, 0, 0, 0]);
  });
});

describe("buildOverview insights", () => {
  it("writes the insights the data supports, in order", () => {
    expect(view.insights).toEqual([
      { tone: "good", text: "Sales up 100% vs 1 Sep 2026 – 20 Sep 2026 (₹1,00,000 → ₹2,00,000)" },
      { tone: "info", text: "Best week: 5 Oct with ₹1,50,000" },
      { tone: "info", text: "Gold 22KT is the top seller: 75% of sales" },
      { tone: "good", text: "Gold 22KT grew fastest: +50%" },
      { tone: "info", text: "Malhani brings 75% of sales (1 buyer)" },
      { tone: "bad", text: "Baaki rose by ₹1,20,000 to ₹1,20,000" },
      { tone: "bad", text: "Only 33% of net sales collected so far" },
    ]);
  });

  it("stays calm with no data", () => {
    const blank = buildOverview(empty, oct, previousPeriod(oct), null, NOW);
    expect(blank.insights).toEqual([]);
    expect(blank.kpis.find((k) => k.key === "collectionRate")!.value).toBeNull();
    expect(blank.kpis.find((k) => k.key === "collectionRate")!.change).toBeNull();
    expect(blank.kpis.every((k) => k.yoy === null)).toBe(true);
  });
});

describe("buildOverview early in a period", () => {
  it("compares with the same days of the previous period", () => {
    const early: AnalyticsData = {
      ...empty,
      lenden: [
        bill({ id: 1, date: iso(2026, 9, 1), amount: 10000, baki: 0, status: 1 }),
        bill({ id: 2, date: iso(2026, 9, 25), amount: 90000, baki: 0, status: 1 }),
        bill({ id: 3, date: iso(2026, 10, 1), amount: 10000, baki: 0, status: 1 }),
      ],
    };
    const now = new Date(2026, 9, 2, 12);
    const v = buildOverview(early, oct, previousPeriod(oct), null, now);
    expect(v.kpis.find((k) => k.key === "sales")!.change?.pct).toBe(0);
    expect(v.insights[0]).toEqual({
      tone: "info",
      text: "Sales flat vs 1 Sep 2026 – 2 Sep 2026 (₹10,000 → ₹10,000)",
    });
    // the chart overlay still shows the whole previous month
    expect(v.previousSalesSeries).toEqual([10000, 0, 0, 90000, 0]);
  });
});

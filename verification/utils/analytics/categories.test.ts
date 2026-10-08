import { buildCategoryView, categoryOf } from "../../../src/utils/analytics/categories";
import { fyPeriod } from "../../../src/utils/analytics/periods";
import { AnalyticsData } from "../../../src/utils/analytics/types";

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const empty: AnalyticsData = {
  users: [], lenden: [], jama: [], rehan: [], rehanTx: [], soldItems: [], oldItems: [],
};
const entry = (id: number, date: string) => ({
  id, userId: 1, date, amount: 0, discount: null, jama: null, baki: null, status: 1,
});

describe("categoryOf", () => {
  it("names metal and purity", () => {
    expect(categoryOf("gold", "22KT")).toEqual({ key: "gold:22KT", label: "Gold 22KT", metal: "gold" });
    expect(categoryOf("gold", null).label).toBe("Gold (no purity)");
    expect(categoryOf("silver", "Silver")).toEqual({
      key: "silver:-", label: "Silver (no purity)", metal: "silver",
    });
  });

  it("puts anything but exact gold/silver in Unknown metal", () => {
    expect(categoryOf(null, "22KT")).toEqual({ key: "unknown", label: "Unknown metal", metal: "unknown" });
    expect(categoryOf("Silver", "Desi").key).toBe("unknown");
  });
});

describe("buildCategoryView", () => {
  const data: AnalyticsData = {
    ...empty,
    lenden: [entry(1, iso(2026, 5, 1)), entry(2, iso(2026, 6, 1)), entry(3, iso(2025, 5, 1))],
    soldItems: [
      { lendenId: 1, metal: "gold", purity: "22KT", weight: 10, total: 70000 },
      { lendenId: 1, metal: "gold", purity: "18KT", weight: 2, total: 10000 },
      { lendenId: 2, metal: "silver", purity: "Desi", weight: 250, total: 25000 },
      { lendenId: 2, metal: "gold", purity: "22KT", weight: 5, total: 35000 },
      { lendenId: 2, metal: null, purity: null, weight: null, total: 300 },
      { lendenId: 3, metal: "gold", purity: "22KT", weight: 10, total: 50000 },
      { lendenId: 3, metal: "silver", purity: "Fancy", weight: 100, total: 9000 },
    ],
  };
  const view = buildCategoryView(data, fyPeriod(2026), fyPeriod(2025));

  it("ranks categories by value, keeping ones that only sold last period", () => {
    expect(view.map((c) => c.label)).toEqual([
      "Gold 22KT", "Silver Desi", "Gold 18KT", "Unknown metal", "Silver Fancy",
    ]);
  });

  it("totals value, grams, items and share", () => {
    expect(view[0]).toMatchObject({ value: 105000, weight: 15, items: 2 });
    expect(view[0].share).toBeCloseTo(105000 / 140300);
    expect(view[4]).toMatchObject({ value: 0, weight: 0, items: 0, share: 0 });
  });

  it("measures growth against the previous period", () => {
    expect(view[0].growth?.pct).toBeCloseTo(1.1);
    expect(view[4].growth?.pct).toBe(-1);
    expect(view[2].growth?.pct).toBeNull(); // nothing last period
    expect(buildCategoryView(data, fyPeriod(2026), null)[0].growth).toBeNull();
  });
});

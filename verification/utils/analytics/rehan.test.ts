import { fyPeriod } from "../../../src/utils/analytics/periods";
import { buildRehanView, principalOf } from "../../../src/utils/analytics/rehan";
import { AnalyticsData, RehanRow } from "../../../src/utils/analytics/types";

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const FY26 = fyPeriod(2026);
const empty: AnalyticsData = {
  users: [], lenden: [], jama: [], rehan: [], rehanTx: [], soldItems: [], oldItems: [],
};
const rehan = (o: Partial<RehanRow>): RehanRow => ({
  id: 1, userId: 1, openDate: iso(2026, 4, 1), closedDate: null, status: 0, amount: 0, ...o,
});

describe("principalOf", () => {
  it("rebuilds the opening amount from balance and history", () => {
    expect(principalOf(rehan({ amount: 12000 }), [
      { rehanId: 1, type: "diya", amount: 5000, date: iso(2026, 5, 1) },
      { rehanId: 1, type: "jama", amount: 3000, date: iso(2026, 6, 1) },
    ])).toBe(10000);
  });

  it("never goes negative when the balance was hand-edited", () => {
    expect(principalOf(rehan({ amount: 0 }), [
      { rehanId: 1, type: "diya", amount: 5000, date: iso(2026, 5, 1) },
    ])).toBe(0);
  });
});

describe("buildRehanView", () => {
  const data: AnalyticsData = {
    ...empty,
    rehan: [
      rehan({ id: 1, amount: 12000, openDate: iso(2026, 4, 1) }),
      rehan({ id: 2, amount: 0, status: 1, openDate: iso(2026, 4, 10), closedDate: iso(2026, 5, 10) }),
      rehan({ id: 3, amount: 0, status: 1, openDate: iso(2025, 4, 1), closedDate: iso(2026, 7, 1) }),
      rehan({ id: 4, amount: 7000, openDate: iso(2025, 1, 1) }),
    ],
    rehanTx: [
      { rehanId: 1, type: "diya", amount: 5000, date: iso(2026, 5, 1) },
      { rehanId: 1, type: "jama", amount: 3000, date: iso(2026, 6, 1) },
      { rehanId: 2, type: "jama", amount: 20000, date: iso(2026, 5, 10) },
    ],
  };
  const view = buildRehanView(data, FY26);

  it("snapshots open rehan as of today", () => {
    expect(view.openCount).toBe(2);
    expect(view.openBalance).toBe(19000);
  });

  it("sums given and recovered by date within the FY", () => {
    // given: #1 principal 10000 (Apr) + diya 5000 (May) + #2 principal 20000 (Apr)
    expect(view.given).toBe(35000);
    expect(view.recovered).toBe(23000);
    expect(view.givenSeries[0]).toBe(30000);
    expect(view.opened).toBe(2);
  });

  it("measures days to close for entries closed in the FY", () => {
    expect(view.closed).toBe(2);
    expect(view.medianDaysToClose).toBe((30 + 456) / 2);
  });

  it("builds per-FY annual rows across all data", () => {
    expect(view.annual.map((a) => a.label)).toEqual(["24-25", "25-26", "26-27"]);
    expect(view.annual[2].opened).toBe(2);
  });

  it("returns zeros with no data", () => {
    const blank = buildRehanView(empty, FY26);
    expect(blank.openBalance).toBe(0);
    expect(blank.medianDaysToClose).toBeNull();
    expect(blank.annual).toEqual([]);
  });
});

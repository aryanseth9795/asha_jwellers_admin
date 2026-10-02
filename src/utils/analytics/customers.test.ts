import { buildCustomersView, recencyPoints, thirdPoints, tierFor } from "./customers";
import { AnalyticsData, LendenRow } from "./types";

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const NOW = new Date(2026, 9, 2, 12);
const FY26 = { kind: "fy", startYear: 2026 } as const;
const ALL = { kind: "all" } as const;

let nextId = 1;
const bill = (userId: number, date: string, amount: number, o: Partial<LendenRow> = {}): LendenRow => ({
  id: nextId++, userId, date, amount, discount: null, jama: null, baki: 0, status: 1, ...o,
});

const empty: AnalyticsData = {
  users: [], lenden: [], jama: [], rehan: [], rehanTx: [], soldItems: [], oldItems: [],
};

describe("scoring helpers", () => {
  it("gives thirds by rank with ties going up", () => {
    expect(thirdPoints(1, [1, 2, 3])).toBe(1);
    expect(thirdPoints(2, [1, 2, 3])).toBe(2);
    expect(thirdPoints(3, [1, 2, 3])).toBe(3);
    expect(thirdPoints(5, [5, 5, 5])).toBe(3);
  });

  it("scores recency on fixed day limits", () => {
    expect(recencyPoints(90)).toBe(3);
    expect(recencyPoints(91)).toBe(2);
    expect(recencyPoints(366)).toBe(1);
  });

  it("maps total score to tier", () => {
    expect(tierFor(9)).toBe("good");
    expect(tierFor(8)).toBe("good");
    expect(tierFor(7)).toBe("medium");
    expect(tierFor(5)).toBe("low");
  });
});

describe("buildCustomersView", () => {
  const data: AnalyticsData = {
    ...empty,
    users: [1, 2, 3, 4].map((id) => ({ id, name: `C${id}` })),
    lenden: [
      // C1: 3 visits, big spender, recent
      bill(1, iso(2026, 4, 10), 100000),
      bill(1, iso(2026, 4, 10), 5000), // same day: one visit
      bill(1, iso(2026, 6, 10), 100000),
      bill(1, iso(2026, 9, 20), 100000),
      // C2: 2 visits, 61 days apart
      bill(2, iso(2026, 5, 1), 20000),
      bill(2, iso(2026, 7, 1), 20000),
      // C3: one small purchase long ago in FY, owes most of it
      bill(3, iso(2026, 4, 2), 10000, { baki: 8000, status: 0 }),
      // C4: bought only in the previous FY
      bill(4, iso(2025, 6, 1), 50000),
    ],
    rehan: [{ id: 1, userId: 4, openDate: iso(2026, 8, 1), closedDate: null, status: 0, amount: 1000 }],
  };
  const view = buildCustomersView(data, FY26, NOW);

  it("counts customers, actives, newcomers and buyers", () => {
    expect(view.totalCustomers).toBe(4);
    expect(view.activeInPeriod).toBe(4); // C4 via rehan
    expect(view.newInPeriod).toBe(3); // C4's first activity was FY 25-26
    expect(view.buyers).toBe(3);
  });

  it("treats same-day bills as one visit for repeats and gaps", () => {
    expect(view.repeatCustomers).toBe(2);
    expect(view.repeatRate).toBeCloseTo(2 / 3);
    // gaps: C1 61, 102; C2 61 -> median 61
    expect(view.medianGapDays).toBe(61);
    expect(view.gapBins.find((b) => b.label === "1–3 mo")?.count).toBe(2);
    expect(view.gapBins.find((b) => b.label === "3–6 mo")?.count).toBe(1);
  });

  it("tiers buyers and flags high baaki separately", () => {
    const byName = Object.fromEntries(view.customers.map((c) => [c.name, c]));
    expect(byName.C1.tier).toBe("good");
    expect(byName.C3.tier).toBe("low");
    expect(byName.C3.highBaaki).toBe(true);
    expect(byName.C1.highBaaki).toBe(false);
    expect(view.customers[0].name).toBe("C1"); // sorted by sales
    expect(view.tierCounts.good + view.tierCounts.medium + view.tierCounts.low).toBe(3);
  });

  it("makes everyone medium with fewer than three buyers", () => {
    const small = buildCustomersView({ ...data, lenden: data.lenden.filter((l) => l.userId === 1) }, ALL, NOW);
    expect(small.customers.map((c) => c.tier)).toEqual(["medium"]);
  });

  it("returns zeros with no data", () => {
    const blank = buildCustomersView(empty, FY26, NOW);
    expect(blank.repeatRate).toBe(0);
    expect(blank.medianGapDays).toBeNull();
    expect(blank.customers).toEqual([]);
  });
});

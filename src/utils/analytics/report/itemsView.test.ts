import { bundleStats, itemMixByQuarter, itemStats, rankItems } from "./itemsView";
import { buildPledgeRows } from "./pledges";
import { NOW, fixtureData } from "./fixture";

const rows = buildPledgeRows(fixtureData, NOW);

describe("itemStats", () => {
  it("summarises each item type, largest principal first", () => {
    const stats = itemStats(rows);
    expect(stats.map((s) => s.item)).toEqual(["Chain", "Kardhan", "Payal", "Locket", "Tika", "Unspecified", "Other"]);
    expect(stats[0]).toMatchObject({
      item: "Chain", pledges: 2, principal: 55000, avgTicket: 27500, openPrincipal: 55000, redeemedPct: 0, medianDaysToRedeem: null,
    });
    expect(stats[0].openShare).toBeCloseTo(55000 / 88000);
    expect(stats[3]).toMatchObject({ item: "Locket", openPrincipal: 0, redeemedPct: 1, medianDaysToRedeem: 180 });
  });
});

describe("rankItems", () => {
  it("groups small items into one closing row", () => {
    const ranked = rankItems(rows, 2);
    expect(ranked.map((r) => r.item)).toEqual(["Chain", "Payal", "All other items (5)"]);
    expect(ranked[2]).toMatchObject({ pledges: 5, principal: 34000, openPrincipal: 23000 });
    expect(ranked[2].redeemedPct).toBeCloseTo(2 / 5);
  });

  it("has no closing row when every item is large enough", () => {
    expect(rankItems(rows, 1).some((r) => r.item.startsWith("All other"))).toBe(false);
  });
});

describe("itemMixByQuarter", () => {
  it("counts the top items per calendar quarter, the rest together", () => {
    const mix = itemMixByQuarter(rows, NOW, 4, 3);
    expect(mix.buckets.map((b) => b.label)).toEqual(["Q1 '26", "Q2 '26", "Q3 '26", "Q4 '26"]);
    expect(mix.series).toEqual([
      { label: "Chain", values: [0, 0, 1, 0] },
      { label: "Kardhan", values: [1, 0, 0, 0] },
      { label: "Tika", values: [1, 0, 0, 0] },
      { label: "All other items", values: [0, 0, 3, 0] },
    ]);
  });

  it("is empty without pledges", () => {
    expect(itemMixByQuarter([], NOW).series).toEqual([]);
  });
});

describe("bundleStats", () => {
  it("compares bundles with single items", () => {
    const b = bundleStats(rows);
    expect(b).toMatchObject({ bundles: 2, singles: 7, avgBundle: 14000 });
    expect(b.avgSingle).toBeCloseTo(71000 / 7);
    expect(b.bundleShare).toBeCloseTo(2 / 9);
    expect(b.premium).toBeCloseTo(14000 / (71000 / 7) - 1);
    expect(bundleStats([])).toMatchObject({ bundles: 0, bundleShare: 0, premium: null });
  });
});

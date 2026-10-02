import {
  ageBuckets, cohorts, interestWhatIf, loggingGap, monthlyBook, pledgeStats,
  redeemBuckets, sizeBands, weekdays,
} from "./pledgeBook";
import { buildPledgeRows } from "./pledges";
import { NOW, fixtureData } from "./fixture";

const rows = buildPledgeRows(fixtureData, NOW);

describe("pledgeStats", () => {
  it("sums the book", () => {
    const s = pledgeStats(rows);
    expect(s).toMatchObject({
      pledges: 9, open: 7, redeemed: 2, principal: 99000, openBook: 88000,
      redeemedPrincipal: 11000, customers: 7, avgPledge: 11000, medianPledge: 5000,
      medianDaysToRedeem: 180.5, meanDaysToRedeem: 180.5, openYearPlus: 15000, largestPledge: 50000,
    });
    expect(s.redeemedPct).toBeCloseTo(2 / 9);
    expect(s.openYearPlusShare).toBeCloseTo(15000 / 88000);
  });

  it("is all zeros with no pledges", () => {
    expect(pledgeStats([])).toMatchObject({
      pledges: 0, openBook: 0, avgPledge: 0, medianPledge: 0, redeemedPct: 0,
      medianDaysToRedeem: null, openYearPlusShare: 0, largestPledge: 0,
    });
  });
});

describe("monthlyBook", () => {
  const months = monthlyBook(rows, NOW);
  const at = (key: string) => months.find((m) => m.key === key)!;

  it("runs from the first month opened to this month", () => {
    expect(months).toHaveLength(26);
    expect(months[0]).toEqual({
      key: "2024-09", label: "Sep 24", opened: 10000, openedCount: 1, redeemed: 0, redeemedCount: 0, openAtEnd: 10000,
    });
    expect(months[25].key).toBe("2026-10");
  });

  it("tracks open principal at each month-end", () => {
    expect(at("2025-10").openAtEnd).toBe(23000);
    expect(at("2026-03")).toMatchObject({ redeemed: 8000, redeemedCount: 1, openAtEnd: 38000 });
    expect(at("2026-10").openAtEnd).toBe(88000);
  });

  it("is empty without pledges", () => {
    expect(monthlyBook([], NOW)).toEqual([]);
  });
});

describe("buckets", () => {
  it("groups open pledges by age", () => {
    expect(ageBuckets(rows)).toEqual([
      { label: "≤3 mo", count: 4, principal: 53000 },
      { label: "3–6 mo", count: 0, principal: 0 },
      { label: "6–12 mo", count: 1, principal: 20000 },
      { label: "1–2 yr", count: 1, principal: 5000 },
      { label: "2 yr +", count: 1, principal: 10000 },
    ]);
  });

  it("groups redeemed pledges by time taken", () => {
    expect(redeemBuckets(rows).map((b) => b.count)).toEqual([0, 2, 0, 0, 0]);
  });

  it("bands pledges by size", () => {
    expect(sizeBands(rows).map((b) => [b.label, b.count])).toEqual([
      ["<1K", 1], ["1–2.5K", 2], ["2.5–5K", 1], ["5–10K", 2], ["10–20K", 1], ["20–40K", 1], ["40K+", 1],
    ]);
  });
});

describe("cohorts", () => {
  it("summarises each year opened", () => {
    const c = cohorts(rows);
    expect(c.map((x) => x.year)).toEqual(["2024", "2025", "2026"]);
    expect(c[0]).toMatchObject({ pledges: 1, principal: 10000, stillOpen: 10000, redeemedPct: 0, medianDaysToRedeem: null, avgPledge: 10000 });
    expect(c[1]).toMatchObject({ pledges: 2, principal: 13000, stillOpen: 5000, redeemedPct: 0.5, medianDaysToRedeem: 180, avgPledge: 6500 });
    expect(c[2]).toMatchObject({ pledges: 6, principal: 76000, stillOpen: 73000, medianDaysToRedeem: 181 });
    expect(c[2].redeemedPct).toBeCloseTo(1 / 6);
  });
});

describe("weekdays", () => {
  it("counts pledges by day opened, Monday first", () => {
    expect(weekdays(rows)).toEqual([
      { label: "Mon", count: 1 }, { label: "Tue", count: 1 }, { label: "Wed", count: 1 },
      { label: "Thu", count: 1 }, { label: "Fri", count: 1 }, { label: "Sat", count: 2 }, { label: "Sun", count: 2 },
    ]);
  });
});

describe("interestWhatIf", () => {
  it("applies a monthly rate to the open book", () => {
    const w = interestWhatIf(rows, 0.02);
    expect(w.perMonth).toBeCloseTo(1760);
    expect(w.perYear).toBeCloseTo(21120);
    expect(w.accrued).toBeCloseTo(12157.33, 1);
  });
});

describe("loggingGap", () => {
  it("finds the longest run of months with no new pledge", () => {
    expect(loggingGap(rows)).toEqual({ from: "2024-10", to: "2025-05", months: 8 });
  });

  it("is null when there is no gap of two months or more", () => {
    expect(loggingGap(rows.filter((r) => r.year === "2026" && r.month >= "2026-08"))).toBeNull();
    expect(loggingGap([])).toBeNull();
  });
});

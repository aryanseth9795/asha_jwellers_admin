import {
  allPeriod,
  bucketKey,
  buckets,
  customPeriod,
  daysBetween,
  fyLabel,
  fyPeriod,
  fyStartYear,
  inPeriod,
  median,
  monthPeriod,
  periodFor,
  previousPeriod,
  quarterPeriod,
  samePeriodLastYear,
  series,
  shiftPeriod,
  sum,
  toDateEquivalent,
  weekPeriod,
} from "./periods";

const d = (y: number, m: number, day: number, h = 12) => new Date(y, m - 1, day, h);
const iso = (y: number, m: number, day: number, h = 12) => d(y, m, day, h).toISOString();
const midnight = (y: number, m: number, day: number) => new Date(y, m - 1, day).getTime();

describe("financial year", () => {
  it("starts on 1 April local time", () => {
    expect(fyStartYear(new Date(2027, 2, 31, 23, 59))).toBe(2026);
    expect(fyStartYear(new Date(2027, 3, 1, 0, 0))).toBe(2027);
  });

  it("labels as FY 2026-27", () => {
    expect(fyLabel(2026)).toBe("FY 2026-27");
    expect(fyLabel(1999)).toBe("FY 1999-00");
  });

  it("puts a 1 a.m. sale on 1 April into April of the new FY", () => {
    const early = iso(2027, 4, 1, 1);
    expect(inPeriod(early, fyPeriod(2027))).toBe(true);
    expect(inPeriod(early, fyPeriod(2026))).toBe(false);
    expect(bucketKey(early, fyPeriod(2027))).toBe("2027-04");
  });
});

describe("period constructors", () => {
  it("week runs Monday to Sunday with day bars", () => {
    const p = weekPeriod(d(2026, 10, 7)); // Wednesday
    expect(p.start.getTime()).toBe(midnight(2026, 10, 5));
    expect(p.end.getTime()).toBe(midnight(2026, 10, 12));
    expect(p.unit).toBe("day");
    expect(p.label).toBe("5 Oct – 11 Oct 2026");
    expect(buckets(p).map((b) => b.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });

  it("month uses week bars starting with the week that contains the 1st", () => {
    const p = monthPeriod(d(2026, 10, 7));
    expect(p.label).toBe("Oct 2026");
    expect(p.unit).toBe("week");
    expect(buckets(p)).toEqual([
      { key: "2026-09-28", label: "1 Oct" },
      { key: "2026-10-05", label: "5 Oct" },
      { key: "2026-10-12", label: "12 Oct" },
      { key: "2026-10-19", label: "19 Oct" },
      { key: "2026-10-26", label: "26 Oct" },
    ]);
  });

  it("quarters follow the financial year", () => {
    const q3 = quarterPeriod(d(2026, 10, 7));
    expect(q3.label).toBe("Q3 FY 2026-27");
    expect(q3.start.getTime()).toBe(midnight(2026, 10, 1));
    expect(q3.end.getTime()).toBe(midnight(2027, 1, 1));
    const q4 = quarterPeriod(d(2027, 2, 10));
    expect(q4.label).toBe("Q4 FY 2026-27");
    expect(q4.start.getTime()).toBe(midnight(2027, 1, 1));
    expect(quarterPeriod(d(2026, 4, 1)).label).toBe("Q1 FY 2026-27");
    expect(periodFor("quarter", d(2026, 10, 7)).label).toBe("Q3 FY 2026-27");
  });

  it("FY has Apr..Mar month bars", () => {
    const b = buckets(fyPeriod(2026));
    expect(b).toHaveLength(12);
    expect(b[0]).toEqual({ key: "2026-04", label: "Apr" });
    expect(b[11]).toEqual({ key: "2027-03", label: "Mar" });
  });

  it("custom range is inclusive, swaps a backwards pick, and sizes its bars", () => {
    const p = customPeriod(d(2026, 1, 10), d(2026, 1, 1));
    expect(p.start.getTime()).toBe(midnight(2026, 1, 1));
    expect(p.end.getTime()).toBe(midnight(2026, 1, 11));
    expect(p.label).toBe("1 Jan 2026 – 10 Jan 2026");
    expect(buckets(p).map((b) => b.label)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(customPeriod(d(2026, 1, 1), d(2026, 6, 30)).unit).toBe("week");
    const year = customPeriod(d(2026, 1, 1), d(2026, 12, 31));
    expect(year.unit).toBe("month");
    expect(buckets(year)[0].label).toBe("Jan 26");
  });

  it("all-time spans whole FYs of the data", () => {
    const p = allPeriod([iso(2024, 5, 1), iso(2026, 2, 1)]);
    expect(p.label).toBe("All time");
    expect(p.start.getTime()).toBe(midnight(2024, 4, 1));
    expect(p.end.getTime()).toBe(midnight(2026, 4, 1));
    expect(buckets(p)).toEqual([
      { key: "2024", label: "24-25" },
      { key: "2025", label: "25-26" },
    ]);
    expect(buckets(allPeriod([]))).toEqual([]);
  });
});

describe("moving between periods", () => {
  it("shifts by whole periods", () => {
    expect(shiftPeriod(monthPeriod(d(2026, 10, 7)), -1).label).toBe("Sep 2026");
    expect(shiftPeriod(quarterPeriod(d(2026, 10, 7)), -1).label).toBe("Q2 FY 2026-27");
    expect(shiftPeriod(quarterPeriod(d(2026, 4, 1)), -1).label).toBe("Q4 FY 2025-26");
    expect(previousPeriod(fyPeriod(2026))?.label).toBe("FY 2025-26");
  });

  it("compares a custom range with the same number of days just before it", () => {
    const prev = previousPeriod(customPeriod(d(2026, 1, 1), d(2026, 1, 10)))!;
    expect(prev.start.getTime()).toBe(midnight(2025, 12, 22));
    expect(prev.end.getTime()).toBe(midnight(2026, 1, 1));
  });

  it("has no previous period for all-time", () => {
    expect(previousPeriod(allPeriod([iso(2026, 1, 1)]))).toBeNull();
    expect(samePeriodLastYear(allPeriod([iso(2026, 1, 1)]))).toBeNull();
  });

  it("finds the same period last year", () => {
    expect(samePeriodLastYear(monthPeriod(d(2026, 10, 7)))?.label).toBe("Oct 2025");
    expect(samePeriodLastYear(quarterPeriod(d(2026, 10, 7)))?.label).toBe("Q3 FY 2025-26");
    expect(samePeriodLastYear(weekPeriod(d(2026, 10, 7)))?.start.getTime()).toBe(midnight(2025, 10, 6));
    const custom = samePeriodLastYear(customPeriod(d(2026, 1, 1), d(2026, 1, 10)))!;
    expect(custom.start.getTime()).toBe(midnight(2025, 1, 1));
    expect(custom.end.getTime()).toBe(midnight(2025, 1, 11));
  });
});

describe("inPeriod, series", () => {
  it("includes the last evening and excludes the next morning", () => {
    const oct = monthPeriod(d(2026, 10, 7));
    expect(inPeriod(iso(2026, 10, 31, 23), oct)).toBe(true);
    expect(inPeriod(iso(2026, 11, 1, 1), oct)).toBe(false);
    expect(inPeriod(iso(2026, 9, 30), oct)).toBe(false);
  });

  it("sums points into their buckets and drops points outside every bucket", () => {
    const fy = fyPeriod(2026);
    const values = series(buckets(fy), fy, [
      { date: iso(2026, 4, 3), value: 100 },
      { date: iso(2026, 4, 30), value: 50 },
      { date: iso(2027, 3, 31), value: 7 },
      { date: iso(2025, 4, 1), value: 999 },
    ]);
    expect(values[0]).toBe(150);
    expect(values[11]).toBe(7);
    expect(sum(values)).toBe(157);
  });
});

describe("day maths", () => {
  it("counts calendar days in local time", () => {
    expect(daysBetween(iso(2026, 3, 1, 23), iso(2026, 3, 2, 1))).toBe(1);
    expect(daysBetween(iso(2026, 1, 1), iso(2026, 12, 31))).toBe(364);
  });

  it("takes the median, null when empty", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("toDateEquivalent", () => {
  const now = d(2026, 10, 2, 12);

  it("cuts the previous period to the days elapsed in the current one", () => {
    const oct = monthPeriod(d(2026, 10, 7));
    const cut = toDateEquivalent(previousPeriod(oct)!, oct, now);
    expect(cut.start).toEqual(d(2026, 9, 1, 0));
    expect(cut.end).toEqual(d(2026, 9, 3, 0));
    expect(cut.label).toBe("1 Sep 2026 – 2 Sep 2026");
    expect(cut.grain).toBe("month");
    expect(cut.unit).toBe("week");
  });

  it("leaves the period alone when the current one is not in progress", () => {
    const sep = monthPeriod(d(2026, 9, 7));
    const aug = previousPeriod(sep)!;
    expect(toDateEquivalent(aug, sep, now)).toBe(aug);
    const nov = monthPeriod(d(2026, 11, 7));
    const oct = previousPeriod(nov)!;
    expect(toDateEquivalent(oct, nov, now)).toBe(oct);
  });

  it("never runs past the end of the other period", () => {
    const mar = monthPeriod(d(2027, 3, 1));
    const feb = previousPeriod(mar)!;
    const cut = toDateEquivalent(feb, mar, d(2027, 3, 31, 12));
    expect(cut.start).toEqual(feb.start);
    expect(cut.end).toEqual(feb.end);
  });
});

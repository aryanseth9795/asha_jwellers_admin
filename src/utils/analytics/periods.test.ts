import {
  buckets,
  bucketKey,
  currentPeriod,
  daysBetween,
  fyLabel,
  fyStartYear,
  inPeriod,
  median,
  series,
  sum,
} from "./periods";

const iso = (y: number, m: number, d: number, h = 12) =>
  new Date(y, m - 1, d, h).toISOString();

describe("financial year", () => {
  it("starts on 1 April local time", () => {
    expect(fyStartYear(new Date(2027, 2, 31, 23, 59))).toBe(2026);
    expect(fyStartYear(new Date(2027, 3, 1, 0, 0))).toBe(2027);
  });

  it("labels as FY 2026-27", () => {
    expect(fyLabel(2026)).toBe("FY 2026-27");
    expect(fyLabel(1999)).toBe("FY 1999-00");
  });

  it("buckets a 1 a.m. sale on 1 April into April of the new FY", () => {
    const earlyMorning = iso(2027, 4, 1, 1); // UTC instant may be 31 Mar
    expect(bucketKey(earlyMorning, { kind: "fy", startYear: 2027 })).toBe("2027-04");
    expect(inPeriod(earlyMorning, { kind: "fy", startYear: 2027 })).toBe(true);
    expect(inPeriod(earlyMorning, { kind: "fy", startYear: 2026 })).toBe(false);
  });

  it("currentPeriod is the FY containing now", () => {
    expect(currentPeriod(new Date(2026, 9, 2))).toEqual({ kind: "fy", startYear: 2026 });
  });

  it("all-time includes everything", () => {
    expect(inPeriod(iso(1990, 1, 1), { kind: "all" })).toBe(true);
  });
});

describe("buckets and series", () => {
  it("gives Apr..Mar for an FY", () => {
    const b = buckets({ kind: "fy", startYear: 2026 }, []);
    expect(b).toHaveLength(12);
    expect(b[0]).toEqual({ key: "2026-04", label: "Apr" });
    expect(b[11]).toEqual({ key: "2027-03", label: "Mar" });
  });

  it("gives one bucket per FY between the data's extremes for all-time", () => {
    const b = buckets({ kind: "all" }, [iso(2024, 5, 1), iso(2026, 2, 1)]);
    expect(b.map((x) => x.key)).toEqual(["2024", "2025"]);
    expect(b[0].label).toBe("24-25");
  });

  it("gives no all-time buckets without data", () => {
    expect(buckets({ kind: "all" }, [])).toEqual([]);
  });

  it("sums points into their buckets and ignores points outside", () => {
    const period = { kind: "fy", startYear: 2026 } as const;
    const values = series(buckets(period, []), period, [
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

  it("takes the median of odd and even lists, null when empty", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

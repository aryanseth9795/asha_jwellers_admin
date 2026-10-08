import {
  Period,
  allPeriod,
  bucketKey,
  buckets,
  customPeriod,
  dayNumber,
  daysBetween,
  daysSince,
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
  toTime,
  weekPeriod,
} from "../../../src/utils/analytics/periods";
import { daysBetweenDays, toDay } from "../../../src/utils/dates";
import { day, midnightIso } from "./report/fixture";

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

// Calendar dates are stored as plain `YYYY-MM-DD` days (the phone's local day); rows from before
// the migration are ISO timestamps. Every form of the same day must read as that day, so it lands
// in the same week, month, quarter and financial year whichever form it is stored in.
type Stamp = (y: number, m: number, dd: number) => string;
const FORMS: [string, Stamp][] = [
  ["a plain day", day],
  ["an ISO local-midnight timestamp", midnightIso],
  ["an ISO noon timestamp", (y, m, dd) => iso(y, m, dd)],
];

describe("toTime", () => {
  it("reads a plain day as local midnight, not UTC midnight", () => {
    const t = new Date(toTime("2026-10-01"));
    expect([
      t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), t.getMinutes(), t.getSeconds(), t.getMilliseconds(),
    ]).toEqual([2026, 9, 1, 0, 0, 0, 0]);
    expect(toTime("2026-10-01")).toBe(midnight(2026, 10, 1));
  });

  it("reads an ISO timestamp as the instant it names", () => {
    const stamp = iso(2026, 10, 1, 15);
    expect(toTime(stamp)).toBe(new Date(stamp).getTime());
  });

  it("gives a plain day and the ISO text of its own local midnight the same moment", () => {
    expect(toTime(day(2026, 10, 1))).toBe(toTime(midnightIso(2026, 10, 1)));
  });

  it("is NaN, never a throw, for text that is not a date", () => {
    for (const bad of ["", "garbage", "2026-13-01", "2026-02-30", "2025-02-29", "2026-04-31"]) expect(toTime(bad)).toBeNaN();
    expect(inPeriod("garbage", fyPeriod(2026))).toBe(false);
  });
});

describe.each(FORMS)("a date stored as %s", (_name, stored) => {
  const inside = (period: Period, ...days: [number, number, number][]) =>
    days.map(([y, m, dd]) => inPeriod(stored(y, m, dd), period));

  it("falls in the right week, Monday to Sunday", () => {
    const week = weekPeriod(d(2026, 10, 7)); // Mon 5 Oct to Sun 11 Oct
    expect(inside(week, [2026, 10, 4], [2026, 10, 5], [2026, 10, 7], [2026, 10, 11], [2026, 10, 12])).toEqual([
      false, true, true, true, false,
    ]);
    expect(bucketKey(stored(2026, 10, 5), week)).toBe("2026-10-05");
    expect(bucketKey(stored(2026, 10, 11), week)).toBe("2026-10-11");
  });

  it("falls in the right month on its first and last day", () => {
    const oct = monthPeriod(d(2026, 10, 7));
    expect(inside(oct, [2026, 9, 30], [2026, 10, 1], [2026, 10, 31], [2026, 11, 1])).toEqual([false, true, true, false]);
    // week bars: the first one starts on the Monday before the 1st
    expect(bucketKey(stored(2026, 10, 1), oct)).toBe("2026-09-28");
    expect(bucketKey(stored(2026, 10, 31), oct)).toBe("2026-10-26");
  });

  it("falls in the right financial-year quarter", () => {
    const q1 = quarterPeriod(d(2026, 4, 1)); // Apr to Jun 2026
    const q3 = quarterPeriod(d(2026, 10, 7)); // Oct to Dec 2026
    const q4 = quarterPeriod(d(2027, 2, 10)); // Jan to Mar 2027
    expect(inside(q1, [2026, 3, 31], [2026, 4, 1], [2026, 6, 30], [2026, 7, 1])).toEqual([false, true, true, false]);
    expect(inside(q3, [2026, 9, 30], [2026, 10, 1], [2026, 12, 31], [2027, 1, 1])).toEqual([false, true, true, false]);
    expect(inside(q4, [2026, 12, 31], [2027, 1, 1], [2027, 3, 31], [2027, 4, 1])).toEqual([false, true, true, false]);
  });

  it("falls in the right financial year, either side of 1 April", () => {
    const fy = fyPeriod(2026);
    expect(inside(fy, [2026, 3, 31], [2026, 4, 1], [2027, 3, 31], [2027, 4, 1])).toEqual([false, true, true, false]);
    expect(bucketKey(stored(2026, 4, 1), fy)).toBe("2026-04");
    expect(bucketKey(stored(2027, 3, 31), fy)).toBe("2027-03");
    expect(bucketKey(stored(2026, 4, 1), allPeriod([stored(2026, 4, 1)]))).toBe("2026");
    expect(bucketKey(stored(2026, 3, 31), allPeriod([stored(2026, 3, 31)]))).toBe("2025");
  });

  it("is summed into the right bar and dropped outside the period", () => {
    const fy = fyPeriod(2026);
    const values = series(buckets(fy), fy, [
      { date: stored(2026, 4, 1), value: 100 },
      { date: stored(2026, 4, 30), value: 50 },
      { date: stored(2026, 5, 1), value: 7 },
      { date: stored(2027, 3, 31), value: 3 },
      { date: stored(2026, 3, 31), value: 999 }, // the day before the year
      { date: stored(2027, 4, 1), value: 999 }, // the day after
    ]);
    expect(values[0]).toBe(150);
    expect(values[1]).toBe(7);
    expect(values[11]).toBe(3);
    expect(sum(values)).toBe(160);
  });

  it("builds an all-time period of whole financial years", () => {
    const p = allPeriod([stored(2024, 5, 1), stored(2026, 3, 31)]);
    expect(p.start.getTime()).toBe(midnight(2024, 4, 1));
    expect(p.end.getTime()).toBe(midnight(2026, 4, 1));
    expect(allPeriod([stored(2026, 4, 1)]).start.getTime()).toBe(midnight(2026, 4, 1));
    expect(allPeriod([stored(2026, 4, 1)]).end.getTime()).toBe(midnight(2027, 4, 1));
  });

  it("counts calendar days, also across the clock changes of a daylight-saving zone", () => {
    expect(daysBetween(stored(2026, 3, 1), stored(2026, 3, 2))).toBe(1);
    expect(daysBetween(stored(2026, 1, 1), stored(2026, 12, 31))).toBe(364);
    expect(daysBetween(stored(2026, 3, 7), stored(2026, 3, 9))).toBe(2);
    expect(daysBetween(stored(2026, 10, 31), stored(2026, 11, 2))).toBe(2);
    expect(dayNumber(stored(2026, 3, 2)) - dayNumber(stored(2026, 3, 1))).toBe(1);
  });
});

describe("stored days in mixed forms", () => {
  it("treats a plain day and the ISO text of its own local midnight as the same day", () => {
    expect(daysBetween(day(2026, 3, 1), midnightIso(2026, 3, 1))).toBe(0);
    expect(daysBetween(midnightIso(2026, 3, 1), day(2026, 3, 1))).toBe(0);
    expect(dayNumber(day(2026, 3, 1))).toBe(dayNumber(midnightIso(2026, 3, 1)));
  });

  it("counts days between one form and another", () => {
    expect(daysBetween(day(2026, 1, 1), midnightIso(2026, 12, 31))).toBe(364);
    expect(daysBetween(iso(2026, 3, 1, 23), day(2026, 3, 2))).toBe(1);
    expect(daysBetween(midnightIso(2026, 3, 1), iso(2026, 3, 2, 1))).toBe(1);
  });

  it("puts both forms of the first and last day of a period inside it", () => {
    const oct = monthPeriod(d(2026, 10, 7));
    for (const stamp of [day, midnightIso]) {
      expect(inPeriod(stamp(2026, 10, 1), oct)).toBe(true);
      expect(inPeriod(stamp(2026, 10, 31), oct)).toBe(true);
      expect(inPeriod(stamp(2026, 9, 30), oct)).toBe(false);
      expect(inPeriod(stamp(2026, 11, 1), oct)).toBe(false);
    }
  });
});

describe("daysSince", () => {
  // The same calendar day, early, midday and late: the count must not move with the time of day.
  const nows = [
    new Date(2026, 9, 2, 0, 0, 0, 0),
    new Date(2026, 9, 2, 0, 5),
    d(2026, 10, 2, 12),
    new Date(2026, 9, 2, 23, 59, 59, 999),
  ];

  it.each(FORMS)("counts whole calendar days from %s up to the day of now", (_name, stored) => {
    for (const now of nows) {
      expect(daysSince(stored(2026, 9, 20), now)).toBe(12);
      expect(daysSince(stored(2026, 10, 2), now)).toBe(0);
      expect(daysSince(stored(2026, 10, 3), now)).toBe(-1);
    }
  });

  it.each(FORMS)("agrees with daysBetweenDays for %s", (_name, stored) => {
    for (const now of nows) {
      expect(daysSince(stored(2026, 9, 20), now)).toBe(daysBetweenDays(stored(2026, 9, 20), toDay(now)));
    }
  });
});

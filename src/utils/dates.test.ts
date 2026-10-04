import { DAY_RE, isDay, normalizeDay, parseDay, toDay, todayDay, toLocalDate, daysBetweenDays } from "./dates";

// Jest runs in the machine's timezone (Asia/Kolkata here). Every expected value below is built
// from local constructors, never from a hard-coded UTC string, so the suite is correct anywhere.

describe("DAY_RE", () => {
  it("matches YYYY-MM-DD only", () => {
    expect(DAY_RE.test("2026-09-15")).toBe(true);
    expect(DAY_RE.test("2026-9-15")).toBe(false);
    expect(DAY_RE.test("2026-09-15T00:00:00.000Z")).toBe(false);
    expect(DAY_RE.test(" 2026-09-15")).toBe(false);
    expect(DAY_RE.test("2026-09-15\n")).toBe(false);
  });
});

describe("toDay", () => {
  it("returns the local calendar day, zero-padded", () => {
    expect(toDay(new Date(2026, 8, 15))).toBe("2026-09-15");
    expect(toDay(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toDay(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("ignores the time of day", () => {
    expect(toDay(new Date(2026, 8, 15, 0, 0, 0, 0))).toBe("2026-09-15");
    expect(toDay(new Date(2026, 8, 15, 12, 30))).toBe("2026-09-15");
    expect(toDay(new Date(2026, 8, 15, 23, 59, 59, 999))).toBe("2026-09-15");
  });

  it("pads years below 1000 to four digits", () => {
    const d = new Date(2000, 0, 1);
    d.setFullYear(5, 0, 1);
    expect(toDay(d)).toBe("0005-01-01");
    d.setFullYear(999, 10, 9);
    expect(toDay(d)).toBe("0999-11-09");
  });

  it("throws on an invalid Date instead of returning NaN text", () => {
    expect(() => toDay(new Date("nope"))).toThrow("Not a date");
  });
});

describe("normalizeDay", () => {
  it("passes a plain day through unchanged", () => {
    expect(normalizeDay("2026-09-15")).toBe("2026-09-15");
    expect(normalizeDay("2024-02-29")).toBe("2024-02-29");
  });

  it("turns a local-midnight instant and its ISO string into the same local day", () => {
    const localMidnight = new Date(2026, 8, 15); // 14 Sept 18:30Z in IST
    expect(normalizeDay(localMidnight.toISOString())).toBe("2026-09-15");
    expect(normalizeDay(localMidnight.toISOString())).toBe(toDay(localMidnight));
  });

  it("turns a noon timestamp into that local day", () => {
    const noon = new Date(2026, 8, 15, 12, 0, 0);
    expect(normalizeDay(noon.toISOString())).toBe("2026-09-15");
  });

  it("uses the local day of the instant, not the UTC day, near midnight", () => {
    const late = new Date(2026, 8, 15, 23, 59, 59, 999);
    const early = new Date(2026, 8, 15, 0, 0, 0, 1);
    expect(normalizeDay(late.toISOString())).toBe("2026-09-15");
    expect(normalizeDay(early.toISOString())).toBe("2026-09-15");
  });

  it("handles year and month boundaries", () => {
    expect(normalizeDay(new Date(2026, 0, 1).toISOString())).toBe("2026-01-01");
    expect(normalizeDay(new Date(2025, 11, 31).toISOString())).toBe("2025-12-31");
    expect(normalizeDay(new Date(2024, 1, 29).toISOString())).toBe("2024-02-29");
  });

  it("accepts an offset timestamp as the local day of that instant", () => {
    const value = "2026-09-15T10:00:00+05:30";
    expect(normalizeDay(value)).toBe(toDay(new Date(value)));
  });

  it("is idempotent", () => {
    const once = normalizeDay(new Date(2026, 8, 15).toISOString());
    expect(normalizeDay(once)).toBe(once);
  });

  it("rejects calendar days that do not exist", () => {
    expect(() => normalizeDay("2026-02-30")).toThrow("Not a date: 2026-02-30");
    expect(() => normalizeDay("2026-13-01")).toThrow("Not a date: 2026-13-01");
    expect(() => normalizeDay("2026-00-10")).toThrow("Not a date");
    expect(() => normalizeDay("2026-04-31")).toThrow("Not a date");
    expect(() => normalizeDay("2026-01-00")).toThrow("Not a date");
    expect(() => normalizeDay("2025-02-29")).toThrow("Not a date"); // not a leap year
  });

  it("rejects a timestamp whose date part does not exist instead of rolling it over", () => {
    expect(() => normalizeDay("2026-02-30T10:00:00.000Z")).toThrow("Not a date");
    expect(() => normalizeDay("2026-13-01T00:00:00.000Z")).toThrow("Not a date");
    expect(() => normalizeDay("2026-09-15T25:00:00.000Z")).toThrow("Not a date");
  });

  it("rejects garbage", () => {
    for (const bad of ["", " ", "garbage", "15/09/2026", "2026-9-5", "2026/09/15", "15 Sep 2026", "Thu Sep 17 2026", "T", "2026-09-15T"]) {
      expect(() => normalizeDay(bad)).toThrow(`Not a date: ${bad}`);
    }
  });

  it("rejects a day with stray whitespace", () => {
    expect(() => normalizeDay(" 2026-09-15")).toThrow("Not a date");
    expect(() => normalizeDay("2026-09-15 ")).toThrow("Not a date");
  });

  it("rejects non-string input at runtime", () => {
    expect(() => normalizeDay(null as unknown as string)).toThrow("Not a date");
    expect(() => normalizeDay(undefined as unknown as string)).toThrow("Not a date");
    expect(() => normalizeDay(20260915 as unknown as string)).toThrow("Not a date");
  });
});

describe("parseDay", () => {
  it("returns local midnight of that day", () => {
    const d = parseDay("2026-09-15");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
    expect(d.getTime()).toBe(new Date(2026, 8, 15).getTime());
  });

  it("round-trips with toDay", () => {
    for (const day of ["2026-09-15", "2026-01-01", "2026-12-31", "2024-02-29", "2000-03-01", "0005-01-01", "0999-11-09"]) {
      expect(toDay(parseDay(day))).toBe(day);
    }
    const d = new Date(2026, 5, 7);
    expect(parseDay(toDay(d)).getTime()).toBe(d.getTime());
  });

  it("keeps years below 100 as written, not as 19xx", () => {
    expect(parseDay("0005-01-01").getFullYear()).toBe(5);
  });

  it("throws on an invalid day", () => {
    expect(() => parseDay("2026-02-30")).toThrow("Not a date: 2026-02-30");
    expect(() => parseDay("2026-13-01")).toThrow("Not a date");
    expect(() => parseDay("garbage")).toThrow("Not a date");
    expect(() => parseDay("2026-09-15T00:00:00.000Z")).toThrow("Not a date");
    expect(() => parseDay("")).toThrow("Not a date");
  });
});

describe("todayDay", () => {
  it("returns the local day of the given instant", () => {
    expect(todayDay(new Date(2026, 8, 15, 23, 59))).toBe("2026-09-15");
    expect(todayDay(new Date(2026, 8, 15, 0, 0, 1))).toBe("2026-09-15");
  });

  it("defaults to now", () => {
    const before = toDay(new Date());
    const got = todayDay();
    const after = toDay(new Date());
    expect([before, after]).toContain(got);
    expect(DAY_RE.test(got)).toBe(true);
  });
});

describe("isDay", () => {
  it("is true only for real YYYY-MM-DD strings", () => {
    expect(isDay("2026-09-15")).toBe(true);
    expect(isDay("2024-02-29")).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("2026-13-01")).toBe(false);
    expect(isDay("2025-02-29")).toBe(false);
    expect(isDay("2026-09-15T00:00:00.000Z")).toBe(false);
    expect(isDay("garbage")).toBe(false);
    expect(isDay("")).toBe(false);
  });

  it("is false for non-strings", () => {
    expect(isDay(null)).toBe(false);
    expect(isDay(undefined)).toBe(false);
    expect(isDay(20260915)).toBe(false);
    expect(isDay(new Date(2026, 8, 15))).toBe(false);
    expect(isDay({})).toBe(false);
  });
});

describe("toLocalDate", () => {
  it("converts a plain day to local midnight of that day", () => {
    const result = toLocalDate("2026-09-15");
    const expected = new Date(2026, 8, 15);
    expect(result).not.toBeNull();
    expect(result?.getTime()).toBe(expected.getTime());
  });

  it("converts an ISO timestamp to a Date", () => {
    const timestamp = new Date(2026, 8, 15, 12, 30, 45).toISOString();
    const result = toLocalDate(timestamp);
    expect(result).not.toBeNull();
    expect(result?.getFullYear()).toBe(2026);
    expect(result?.getMonth()).toBe(8);
  });

  it("returns null for null input", () => {
    expect(toLocalDate(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(toLocalDate(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(toLocalDate("")).toBeNull();
  });

  it("returns null for garbage input", () => {
    expect(toLocalDate("not a date")).toBeNull();
    expect(toLocalDate("2026-13-01")).toBeNull();
  });

  it("never throws", () => {
    expect(() => toLocalDate(null)).not.toThrow();
    expect(() => toLocalDate(undefined)).not.toThrow();
    expect(() => toLocalDate("")).not.toThrow();
    expect(() => toLocalDate("invalid")).not.toThrow();
  });
});

describe("daysBetweenDays", () => {
  it("returns 0 for the same day in plain format", () => {
    expect(daysBetweenDays("2026-09-15", "2026-09-15")).toBe(0);
  });

  it("returns 0 for the same day given as ISO timestamps", () => {
    const timestamp = new Date(2026, 8, 15, 12, 30).toISOString();
    expect(daysBetweenDays(timestamp, timestamp)).toBe(0);
  });

  it("returns the correct count across a month boundary", () => {
    const result = daysBetweenDays("2026-08-31", "2026-09-05");
    expect(result).toBe(5);
  });

  it("handles negative differences", () => {
    const result = daysBetweenDays("2026-09-15", "2026-09-10");
    expect(result).toBe(-5);
  });

  it("mixes a plain day with an ISO timestamp of local midnight", () => {
    const plainDay = "2026-09-15";
    const midnight = new Date(2026, 8, 15).toISOString();
    expect(daysBetweenDays(plainDay, midnight)).toBe(0);
  });

  it("mixes a plain day with a timestamp of local midnight from the previous UTC day, resulting in 0", () => {
    // A Date created as new Date(y, m, d) is local midnight.
    // Its toISOString() may show the previous UTC day (e.g., 2026-09-14T18:30:00Z in IST for local 2026-09-15)
    const plainDay = "2026-09-15";
    const localMidnight = new Date(2026, 8, 15);
    const isoString = localMidnight.toISOString();
    expect(daysBetweenDays(plainDay, isoString)).toBe(0);
  });

  it("throws on an invalid date from normalizeDay", () => {
    expect(() => daysBetweenDays("2026-02-30", "2026-09-15")).toThrow("Not a date");
    expect(() => daysBetweenDays("2026-09-15", "invalid-date")).toThrow("Not a date");
  });
});

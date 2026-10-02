# Analytics Dashboard v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Analytics into a dynamic dashboard: Week/Month/Quarter/FY/Custom/All time frames, period-over-period and year-over-year comparison, auto insights, villages, categories, key customers, baaki aging and trends.

**Architecture:** Replace the FY-only `Period` with a general date-range `Period` (same function names, so the four existing view builders change only slightly). Add pure, Jest-tested modules under `src/utils/analytics/` (compare, baki, categories, villages, importance, trends, overview) that reuse the existing builders per period. The screen recomputes everything from live SQLite rows on every focus and on pull-to-refresh.

**Tech Stack:** React Native 0.81 + Expo 54, expo-sqlite, TypeScript 5.9, Jest 29 + ts-jest (node env, `src/**/*.test.ts` only).

**Spec:** `agent/2026-10-02-analytics-design.md` — §4 (metric definitions, unchanged) and §10 (this dashboard).

## Global Constraints

- No new dependencies; no native rebuild (OTA via expo-updates). Charts stay plain React Native views.
- All dates are handled in **device local time**; never slice UTC ISO strings.
- Periods: start inclusive, end exclusive, both local midnight. Week = Monday–Sunday. Quarters are FY quarters: Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar. FY = 1 Apr – 31 Mar, labelled `FY 2026-27`.
- Chart unit: Week → day, Month → week, Quarter → week, FY → month, All → year (FY), Custom → ≤ 31 days day, ≤ 184 week, ≤ 1100 month, else year.
- Previous period: Week/Month/Quarter/FY shift by one; Custom = same number of days immediately before; All → none. Same period last year is shown for Month and Quarter only.
- Change: `delta = current − previous`; `pct = delta / |previous|`, **null when previous is 0**.
- Up is good for sales, collected, collection rate, bills, avg bill, grams, new customers, rehan given; up is **bad** for baaki and old-return %.
- `metal` other than exactly `"gold"`/`"silver"` → unknown; never merged into gold or silver.
- Money is integer rupees; grams rounded to 3 decimals after summing.
- Nothing precomputed or stored: everything is derived from the rows `getAnalyticsData()` returns.
- Commits: plain messages, **no Co-Authored-By or any attribution/trailer lines** (owner's instruction).

## Review Focus

1. A custom range picked "backwards" (To before From) must not produce an empty or negative period → `customPeriod` swaps them (Task 1 test).
2. A month view's first chart bar belongs to a week that started in the previous month; data from those earlier days must not leak in (they are outside the period) → `inPeriod` filters before `series` (Task 1 test: Sep 30 not counted in Oct).
3. Customers whose address is blank or differently spaced/cased must group correctly and never crash → `villageKey` tests (Task 3).
4. Bills overpaid (jama > net) must not make reconstructed baaki negative → clamp test (Task 2).
5. A period with no data must show zeros / "—", never NaN or a crash: KPIs with null values, empty insights, empty trends rows → Tasks 5–6 tests.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/utils/analytics/periods.ts` (rewrite) | Range `Period`, constructors, shifting, buckets, series, day maths |
| `src/utils/analytics/compare.ts` (new) | `Change`, `change()` |
| `src/utils/analytics/format.ts` (modify) | add `formatInr`, `formatPct` |
| `src/utils/analytics/baki.ts` (new) | `baakiAt`, `baakiAging` |
| `src/utils/analytics/categories.ts` (new) | `categoryOf`, `buildCategoryView` |
| `src/utils/analytics/villages.ts` (new) | `villageName`, `villageKey`, `villageLabel`, `buildVillageView` |
| `src/utils/analytics/importance.ts` (new) | `buildImportanceView` |
| `src/utils/analytics/trends.ts` (new) | `buildTrends` |
| `src/utils/analytics/overview.ts` (new) | `buildOverview` (KPIs + insights + chart) |
| `src/utils/analytics/types.ts` (modify) | `UserRow.address?`, `SoldItemRow.purity?` |
| `src/utils/analytics/{sales,customers,rehan,metal}.ts` + tests (modify) | adopt new `Period` API |
| `src/database/analyticsQueries.ts` (modify) | select `address`, `purity` |
| `src/components/analytics/PeriodPicker.tsx` (new) | grain chips, ◀ label ▶, custom From/To |
| `src/components/analytics/KpiTile.tsx` (new) | `KpiTile`, `ChangeChip`, `formatKpi` |
| `src/components/analytics/{Overview,Villages,Trends}Section.tsx` (new) | new tabs |
| `src/components/analytics/{BaakiAgingCard,KeyCustomersCard,CategoriesCard}.tsx` (new) | cards added to Sales / Customers / Metal |
| `src/screen/AnalyticsScreen.tsx` (rewrite) | load + refresh, period state, 7 tabs |

---

### Task 1: Range-based periods, compare, format helpers

**Files:**
- Rewrite: `src/utils/analytics/periods.ts`, `src/utils/analytics/periods.test.ts`
- Create: `src/utils/analytics/compare.ts`, `src/utils/analytics/compare.test.ts`
- Modify: `src/utils/analytics/format.ts`, `src/utils/analytics/format.test.ts`
- Modify (adopt API): `src/utils/analytics/sales.ts`, `customers.ts`, `rehan.ts`, `metal.ts` and their `*.test.ts`; `src/screen/AnalyticsScreen.tsx` (temporary compile fix)

**Interfaces:**
- Produces: `Grain`, `Unit`, `Period {grain,start,end,unit,label}`, `Bucket`, `Point`, `sum`, `fyStartYear`, `fyLabel`, `weekPeriod`, `monthPeriod`, `quarterPeriod`, `fyPeriod`, `customPeriod`, `allPeriod`, `periodFor`, `shiftPeriod`, `previousPeriod`, `samePeriodLastYear`, `inPeriod`, `bucketKey`, `buckets(period)`, `series`, `dayNumber`, `daysBetween`, `median`; `Change`, `change`; `formatInr`, `formatPct`.
- Removed: `currentPeriod`, the `{kind: "fy" | "all"}` shape, and the second argument of `buckets`.

- [ ] **Step 1: Rewrite the tests** — replace `src/utils/analytics/periods.test.ts` entirely:

```ts
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
```

`src/utils/analytics/compare.test.ts`:

```ts
import { change } from "./compare";

describe("change", () => {
  it("gives delta and percent against the previous value", () => {
    expect(change(120, 100)).toEqual({ current: 120, previous: 100, delta: 20, pct: 0.2 });
    expect(change(80, 100).pct).toBeCloseTo(-0.2);
    expect(change(-50, -100).pct).toBeCloseTo(0.5);
  });

  it("has no percent when the previous value is zero", () => {
    expect(change(5, 0)).toEqual({ current: 5, previous: 0, delta: 5, pct: null });
    expect(change(0, 0).pct).toBeNull();
  });
});
```

Append to `src/utils/analytics/format.test.ts` (and add `formatInr, formatPct` to its import):

```ts
describe("formatInr", () => {
  it("uses Indian grouping with a rupee sign", () => {
    expect(formatInr(182500)).toBe("₹1,82,500");
    expect(formatInr(950)).toBe("₹950");
    expect(formatInr(-5000)).toBe("-₹5,000");
  });
});

describe("formatPct", () => {
  it("rounds to a whole percent", () => {
    expect(formatPct(0.1234)).toBe("12%");
    expect(formatPct(1)).toBe("100%");
    expect(formatPct(-0.4)).toBe("-40%");
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx jest src/utils/analytics/periods src/utils/analytics/compare src/utils/analytics/format` → FAIL (missing exports / modules).

- [ ] **Step 3: Implement** — replace `src/utils/analytics/periods.ts` entirely:

```ts
// Period maths for analytics. Everything is local time: ISO strings are
// stored in UTC, and a 1 a.m. IST sale must not slide into the previous day,
// week, month or financial year.

export type Grain = "week" | "month" | "quarter" | "fy" | "custom" | "all";
export type Unit = "day" | "week" | "month" | "year";

export interface Period {
  grain: Grain;
  start: Date; // inclusive, local midnight
  end: Date; // exclusive, local midnight
  unit: Unit; // chart bucket size
  label: string;
}

export interface Bucket {
  key: string;
  label: string;
}

export interface Point {
  date: string;
  value: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const APRIL = 3;

const pad = (n: number) => String(n).padStart(2, "0");

export const sum = (values: number[]): number =>
  values.reduce((total, value) => total + value, 0);

/** Indian financial year: 1 April starts a new one. */
export const fyStartYear = (date: Date): number =>
  date.getMonth() >= APRIL ? date.getFullYear() : date.getFullYear() - 1;

export const fyLabel = (startYear: number): string =>
  `FY ${startYear}-${pad((startYear + 1) % 100)}`;

// Date arithmetic through local calendar fields, so DST can't shift a day.
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const mondayOf = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
const dayLabel = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const spanDays = (start: Date, end: Date) =>
  Math.round(
    (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
      86400000,
  );

export const weekPeriod = (anchor: Date): Period => {
  const start = mondayOf(anchor);
  const last = addDays(start, 6);
  return {
    grain: "week",
    start,
    end: addDays(start, 7),
    unit: "day",
    label: `${dayLabel(start)} – ${dayLabel(last)} ${last.getFullYear()}`,
  };
};

export const monthPeriod = (anchor: Date): Period => {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  return {
    grain: "month",
    start,
    end: addMonths(start, 1),
    unit: "week",
    label: `${MONTHS[start.getMonth()]} ${start.getFullYear()}`,
  };
};

/** FY quarters: Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar. */
export const quarterPeriod = (anchor: Date): Period => {
  const fy = fyStartYear(anchor);
  const q = Math.floor(((anchor.getMonth() - APRIL + 12) % 12) / 3);
  const start = new Date(fy, APRIL + q * 3, 1);
  return {
    grain: "quarter",
    start,
    end: addMonths(start, 3),
    unit: "week",
    label: `Q${q + 1} ${fyLabel(fy)}`,
  };
};

export const fyPeriod = (startYear: number): Period => ({
  grain: "fy",
  start: new Date(startYear, APRIL, 1),
  end: new Date(startYear + 1, APRIL, 1),
  unit: "month",
  label: fyLabel(startYear),
});

/** From–To inclusive; a backwards pick is swapped. */
export const customPeriod = (from: Date, to: Date): Period => {
  let first = startOfDay(from);
  let last = startOfDay(to);
  if (last < first) [first, last] = [last, first];
  const end = addDays(last, 1);
  const days = spanDays(first, end);
  return {
    grain: "custom",
    start: first,
    end,
    unit: days <= 31 ? "day" : days <= 184 ? "week" : days <= 1100 ? "month" : "year",
    label: `${dayLabel(first)} ${first.getFullYear()} – ${dayLabel(last)} ${last.getFullYear()}`,
  };
};

/** Whole FYs from the earliest to the latest date given. */
export const allPeriod = (isos: string[]): Period => {
  if (isos.length === 0) {
    const today = startOfDay(new Date());
    return { grain: "all", start: today, end: today, unit: "year", label: "All time" };
  }
  const times = isos.map((iso) => new Date(iso).getTime());
  const first = times.reduce((a, b) => Math.min(a, b));
  const last = times.reduce((a, b) => Math.max(a, b));
  return {
    grain: "all",
    start: fyPeriod(fyStartYear(new Date(first))).start,
    end: fyPeriod(fyStartYear(new Date(last))).end,
    unit: "year",
    label: "All time",
  };
};

export const periodFor = (grain: "week" | "month" | "quarter" | "fy", anchor: Date): Period => {
  switch (grain) {
    case "week":
      return weekPeriod(anchor);
    case "month":
      return monthPeriod(anchor);
    case "quarter":
      return quarterPeriod(anchor);
    case "fy":
      return fyPeriod(fyStartYear(anchor));
  }
};

export const shiftPeriod = (period: Period, steps: number): Period => {
  switch (period.grain) {
    case "week":
      return weekPeriod(addDays(period.start, 7 * steps));
    case "month":
      return monthPeriod(addMonths(period.start, steps));
    case "quarter":
      return quarterPeriod(addMonths(period.start, 3 * steps));
    case "fy":
      return fyPeriod(period.start.getFullYear() + steps);
    case "custom": {
      const length = spanDays(period.start, period.end);
      return customPeriod(
        addDays(period.start, length * steps),
        addDays(period.end, length * steps - 1),
      );
    }
    case "all":
      return period;
  }
};

export const previousPeriod = (period: Period): Period | null =>
  period.grain === "all" ? null : shiftPeriod(period, -1);

export const samePeriodLastYear = (period: Period): Period | null => {
  switch (period.grain) {
    case "week":
      return weekPeriod(addDays(period.start, -364)); // 52 weeks keeps Monday
    case "month":
      return shiftPeriod(period, -12);
    case "quarter":
      return shiftPeriod(period, -4);
    case "fy":
      return shiftPeriod(period, -1);
    case "custom": {
      const last = addDays(period.end, -1);
      return customPeriod(
        new Date(period.start.getFullYear() - 1, period.start.getMonth(), period.start.getDate()),
        new Date(last.getFullYear() - 1, last.getMonth(), last.getDate()),
      );
    }
    case "all":
      return null;
  }
};

export const inPeriod = (iso: string, period: Period): boolean => {
  const t = new Date(iso).getTime();
  return t >= period.start.getTime() && t < period.end.getTime();
};

const keyOf = (date: Date, unit: Unit): string => {
  switch (unit) {
    case "day":
      return dayKey(date);
    case "week":
      return dayKey(mondayOf(date));
    case "month":
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    case "year":
      return String(fyStartYear(date));
  }
};

export const bucketKey = (iso: string, period: Period): string =>
  keyOf(new Date(iso), period.unit);

/** Every bucket from start to end; the first may begin before start (e.g. a week). */
export const buckets = (period: Period): Bucket[] => {
  const list: Bucket[] = [];
  let cursor = period.start;
  while (cursor < period.end) {
    let label: string;
    let next: Date;
    switch (period.unit) {
      case "day":
        label = period.grain === "week" ? WEEKDAYS[cursor.getDay()] : String(cursor.getDate());
        next = addDays(cursor, 1);
        break;
      case "week":
        label = dayLabel(cursor);
        next = addDays(mondayOf(cursor), 7);
        break;
      case "month":
        label =
          period.grain === "custom"
            ? `${MONTHS[cursor.getMonth()]} ${pad(cursor.getFullYear() % 100)}`
            : MONTHS[cursor.getMonth()];
        next = addMonths(cursor, 1);
        break;
      case "year": {
        const fy = fyStartYear(cursor);
        label = `${pad(fy % 100)}-${pad((fy + 1) % 100)}`;
        next = new Date(fy + 1, APRIL, 1);
        break;
      }
    }
    list.push({ key: keyOf(cursor, period.unit), label });
    cursor = next;
  }
  return list;
};

/** Sums points into the given buckets; points outside every bucket are dropped. */
export const series = (bucketList: Bucket[], period: Period, points: Point[]): number[] => {
  const index = new Map(bucketList.map((bucket, i) => [bucket.key, i]));
  const values = bucketList.map(() => 0);
  for (const point of points) {
    const i = index.get(bucketKey(point.date, period));
    if (i !== undefined) values[i] += point.value;
  }
  return values;
};

// Day index from local calendar fields, so DST and time-of-day can't shift it.
export const dayNumber = (iso: string): number => {
  const d = new Date(iso);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
};

export const daysBetween = (fromIso: string, toIso: string): number =>
  dayNumber(toIso) - dayNumber(fromIso);

export const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
```

Important: callers must filter with `inPeriod` before `series` for week/month periods, because the first bucket can start before `period.start` (Review Focus 2). The existing builders already filter.

`src/utils/analytics/compare.ts`:

```ts
export interface Change {
  current: number;
  previous: number;
  delta: number;
  pct: number | null; // null when there is no previous value to compare with
}

export const change = (current: number, previous: number): Change => ({
  current,
  previous,
  delta: current - previous,
  pct: previous === 0 ? null : (current - previous) / Math.abs(previous),
});
```

Append to `src/utils/analytics/format.ts`:

```ts
import { formatRupees } from "../billFormat";

/** 182500 -> "₹1,82,500"; for sentences and tiles. */
export const formatInr = (value: number): string =>
  `${value < 0 ? "-" : ""}₹${formatRupees(Math.abs(value)).replace(/\/-$/, "")}`;

export const formatPct = (ratio: number): string => `${Math.round(ratio * 100)}%`;
```
(Place the `import` at the top of the file.)

- [ ] **Step 4: Adopt the new API in the view builders and their tests**
  - `sales.ts`, `metal.ts`, `rehan.ts`: every `buckets(period, [...])` becomes `buckets(period)` (drop the second argument).
  - `rehan.ts`: replace
    ```ts
      const all: Period = { kind: "all" };
      const annualBuckets = buckets(all, [...givenPoints, ...recoveredPoints].map((p) => p.date));
    ```
    with
    ```ts
      const all = allPeriod([...givenPoints, ...recoveredPoints].map((p) => p.date));
      const annualBuckets = buckets(all);
    ```
    and import `allPeriod`.
  - Tests: in `sales.test.ts`, `rehan.test.ts`, `metal.test.ts`, `customers.test.ts` replace `const FY26 = { kind: "fy", startYear: 2026 } as const;` with `const FY26 = fyPeriod(2026);` (import `fyPeriod` from `./periods`). In `customers.test.ts` replace `const ALL = { kind: "all" } as const;` with nothing and, in the "fewer than three buyers" test, pass `allPeriod(data.lenden.map((l) => l.date))` instead of `ALL` (import `allPeriod`).
  - All existing expected values stay exactly as they are.

- [ ] **Step 5: Temporary compile fix in `src/screen/AnalyticsScreen.tsx`** (Task 7 rewrites this screen):
  - import `{ Period, allPeriod, periodFor, shiftPeriod }` instead of `{ Period, currentPeriod, fyLabel }`;
  - `const latestFy = periodFor("fy", new Date());`
  - `shiftYear = (delta) => period.grain === "fy" && setPeriod(shiftPeriod(period, delta));`
  - `atLatest = period.grain === "fy" && period.end.getTime() > Date.now();`
  - every `period.kind === "fy"` → `period.grain === "fy"`, `period.kind === "all"` → `period.grain === "all"`; the label shows `period.label`;
  - the All-time chip sets `allPeriod(data ? [...data.lenden.map((l) => l.date), ...data.rehan.map((r) => r.openDate)] : [])`.

- [ ] **Step 6: Run** — `npx jest` (all suites pass) and `npx tsc --noEmit` (clean).

- [ ] **Step 7: Commit** — `git commit -m "Generalise analytics periods to week, month, quarter, FY, custom and all"` (stage only the files listed in this task).

---

### Task 2: Baaki at a date and baaki aging

**Files:** Create `src/utils/analytics/baki.ts`, `src/utils/analytics/baki.test.ts`

**Interfaces:**
- Consumes: `AnalyticsData` (types), `daysBetween` (periods), `oldCreditByLenden` (sales).
- Produces: `baakiAt(data: AnalyticsData, at: Date): number`, `baakiAging(data: AnalyticsData, now?: Date): AgingBucket[]`, `interface AgingBucket { label: string; count: number; amount: number }`.

- [ ] **Step 1: Failing test** — `src/utils/analytics/baki.test.ts`:

```ts
import { baakiAging, baakiAt } from "./baki";
import { AnalyticsData, LendenRow } from "./types";

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const empty: AnalyticsData = {
  users: [], lenden: [], jama: [], rehan: [], rehanTx: [], soldItems: [], oldItems: [],
};
const bill = (o: Partial<LendenRow>): LendenRow => ({
  id: 1, userId: 1, date: iso(2026, 4, 5), amount: 0, discount: null,
  jama: null, baki: null, status: 0, ...o,
});

describe("baakiAt", () => {
  const data: AnalyticsData = {
    ...empty,
    lenden: [
      bill({ id: 1, date: iso(2026, 4, 5), amount: 100000, discount: 1000 }),
      bill({ id: 2, date: iso(2026, 5, 5), amount: 50000, jama: 20000 }), // legacy jama
      bill({ id: 3, date: iso(2026, 8, 1), amount: 1000 }), // overpaid
    ],
    jama: [
      { lendenId: 1, amount: 30000, date: iso(2026, 4, 5) },
      { lendenId: 1, amount: 50000, date: iso(2026, 6, 1) },
      { lendenId: 3, amount: 5000, date: iso(2026, 8, 1) },
    ],
    oldItems: [{ lendenId: 1, metal: "gold", weight: 3, value: 19000 }],
  };

  it("counts only bills and payments dated before the instant", () => {
    expect(baakiAt(data, new Date(2026, 3, 1))).toBe(0);
    expect(baakiAt(data, new Date(2026, 4, 1))).toBe(50000); // 80000 net − 30000
    expect(baakiAt(data, new Date(2026, 5, 1))).toBe(80000); // + bill 2: 50000 − legacy 20000
    expect(baakiAt(data, new Date(2026, 6, 1))).toBe(30000); // bill 1 fully paid
  });

  it("never lets an overpaid bill reduce the total", () => {
    expect(baakiAt(data, new Date(2026, 8, 1))).toBe(30000);
  });

  it("is zero with no data", () => {
    expect(baakiAt(empty, new Date())).toBe(0);
  });
});

describe("baakiAging", () => {
  it("groups open baaki by bill age", () => {
    const now = new Date(2026, 9, 2, 12);
    const data: AnalyticsData = {
      ...empty,
      lenden: [
        bill({ id: 1, date: iso(2026, 9, 20), baki: 1000 }), // 12 days
        bill({ id: 2, date: iso(2026, 7, 1), baki: 2000 }), // 93 days
        bill({ id: 3, date: iso(2026, 1, 1), baki: 3000 }), // 274 days
        bill({ id: 4, date: iso(2025, 6, 1), baki: 4000 }), // 488 days
        bill({ id: 5, date: iso(2026, 9, 1), baki: 0, status: 1 }),
        bill({ id: 6, date: iso(2026, 9, 1), baki: 0, status: 0 }),
      ],
    };
    expect(baakiAging(data, now)).toEqual([
      { label: "0–30 days", count: 1, amount: 1000 },
      { label: "31–90 days", count: 0, amount: 0 },
      { label: "91–180 days", count: 1, amount: 2000 },
      { label: "181–365 days", count: 1, amount: 3000 },
      { label: "> 1 year", count: 1, amount: 4000 },
    ]);
  });
});
```

- [ ] **Step 2: Run** — `npx jest src/utils/analytics/baki` → FAIL (module missing).

- [ ] **Step 3: Implement** — `src/utils/analytics/baki.ts`:

```ts
import { AnalyticsData } from "./types";
import { daysBetween } from "./periods";
import { oldCreditByLenden } from "./sales";

export interface AgingBucket {
  label: string;
  count: number;
  amount: number;
}

/**
 * Outstanding baaki at an instant, rebuilt from bill and payment dates
 * (spec §10.4). Legacy bills without jama_entries count lenden.jama as paid
 * on the bill date. An overpaid bill contributes 0, never a negative.
 */
export const baakiAt = (data: AnalyticsData, at: Date): number => {
  const t = at.getTime();
  const before = (iso: string) => new Date(iso).getTime() < t;
  const credit = oldCreditByLenden(data);
  const hasEntries = new Set(data.jama.map((j) => j.lendenId));
  const paid = new Map<number, number>();
  const pay = (id: number, amount: number) => paid.set(id, (paid.get(id) ?? 0) + amount);
  for (const j of data.jama) if (before(j.date)) pay(j.lendenId, j.amount);

  let total = 0;
  for (const bill of data.lenden) {
    if (!before(bill.date)) continue;
    if (!hasEntries.has(bill.id)) pay(bill.id, bill.jama ?? 0);
    const net = (bill.amount ?? 0) - (bill.discount ?? 0) - (credit.get(bill.id) ?? 0);
    total += Math.max(0, net - (paid.get(bill.id) ?? 0));
  }
  return total;
};

const AGING = [
  { label: "0–30 days", maxDays: 30 },
  { label: "31–90 days", maxDays: 90 },
  { label: "91–180 days", maxDays: 180 },
  { label: "181–365 days", maxDays: 365 },
  { label: "> 1 year", maxDays: Infinity },
];

/** Open entries' stored baki grouped by how old the bill is. */
export const baakiAging = (data: AnalyticsData, now: Date = new Date()): AgingBucket[] => {
  const buckets = AGING.map(({ label }) => ({ label, count: 0, amount: 0 }));
  const nowIso = now.toISOString();
  for (const bill of data.lenden) {
    const baki = bill.baki ?? 0;
    if ((bill.status ?? 0) !== 0 || baki <= 0) continue;
    const age = Math.max(0, daysBetween(bill.date, nowIso));
    const bucket = buckets[AGING.findIndex((a) => age <= a.maxDays)];
    bucket.count++;
    bucket.amount += baki;
  }
  return buckets;
};
```

- [ ] **Step 4: Run** — `npx jest src/utils/analytics/baki` → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** — `git commit -m "Add baaki-at-date and baaki aging"`

---

### Task 3: Categories and villages

**Files:**
- Modify: `src/utils/analytics/types.ts` — `UserRow` gains `address?: string | null;`, `SoldItemRow` gains `purity?: string | null;`
- Create: `src/utils/analytics/categories.ts`, `categories.test.ts`, `villages.ts`, `villages.test.ts`

**Interfaces:**
- Consumes: `Period`, `inPeriod` (periods); `Change`, `change` (compare); `roundGrams` (format).
- Produces: `categoryOf(metal, purity): Category`, `buildCategoryView(data, period, previous: Period | null): CategoryStat[]`, types `Category {key,label,metal}`, `CategoryStat`, `CategoryMetal`; `villageName(address)`, `villageKey(address)`, `villageLabel(address)`, `buildVillageView(data, period, previous: Period | null): VillageStat[]`, type `VillageStat`.

- [ ] **Step 1: Failing tests** — `src/utils/analytics/categories.test.ts`:

```ts
import { buildCategoryView, categoryOf } from "./categories";
import { fyPeriod } from "./periods";
import { AnalyticsData } from "./types";

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
```

`src/utils/analytics/villages.test.ts`:

```ts
import { buildVillageView, villageKey, villageLabel } from "./villages";
import { fyPeriod } from "./periods";
import { AnalyticsData, LendenRow } from "./types";

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const empty: AnalyticsData = {
  users: [], lenden: [], jama: [], rehan: [], rehanTx: [], soldItems: [], oldItems: [],
};
let nextId = 1;
const bill = (userId: number, date: string, amount: number, o: Partial<LendenRow> = {}): LendenRow => ({
  id: nextId++, userId, date, amount, discount: null, jama: null, baki: 0, status: 1, ...o,
});

describe("village names", () => {
  it("uses the text before the first comma, ignoring case and spacing", () => {
    expect(villageKey("Ramdaspur, Jaunpur")).toBe("ramdaspur");
    expect(villageKey("  ramdaspur  ,Jaunpur")).toBe("ramdaspur");
    expect(villageKey("Malhani   road")).toBe("malhani road");
    expect(villageKey(null)).toBe("");
    expect(villageKey(undefined)).toBe("");
    expect(villageLabel("Ramdaspur, Jaunpur")).toBe("Ramdaspur");
    expect(villageLabel("  ")).toBe("No address");
  });
});

describe("buildVillageView", () => {
  const data: AnalyticsData = {
    ...empty,
    users: [
      { id: 1, name: "A", address: "Ramdaspur, Jaunpur" },
      { id: 2, name: "B", address: "ramdaspur  ,Jaunpur" },
      { id: 3, name: "C", address: "Malhani" },
      { id: 4, name: "D", address: null },
      { id: 5, name: "E", address: "  Malhani road" },
    ],
    lenden: [
      bill(1, iso(2026, 5, 1), 100000, { baki: 20000, status: 0 }),
      bill(2, iso(2026, 6, 1), 50000),
      bill(3, iso(2026, 5, 1), 30000),
      bill(3, iso(2025, 5, 1), 10000),
      bill(4, iso(2026, 7, 1), 5000),
      bill(1, iso(2025, 5, 1), 40000),
    ],
  };
  const view = buildVillageView(data, fyPeriod(2026), fyPeriod(2025));

  it("ranks villages by sales and keeps villages without sales", () => {
    expect(view.map((v) => v.name)).toEqual(["Ramdaspur", "Malhani", "No address", "Malhani road"]);
  });

  it("counts customers, buyers, sales, share, open baaki and growth", () => {
    expect(view[0]).toMatchObject({
      key: "ramdaspur", customers: 2, buyers: 2, sales: 150000, openBaaki: 20000,
    });
    expect(view[0].share).toBeCloseTo(150000 / 185000);
    expect(view[0].growth?.pct).toBeCloseTo(2.75);
    expect(view[1].growth?.pct).toBeCloseTo(2);
    expect(view[2]).toMatchObject({ key: "", customers: 1, buyers: 1, sales: 5000 });
    expect(view[2].growth?.pct).toBeNull();
    expect(view[3]).toMatchObject({ customers: 1, buyers: 0, sales: 0, share: 0 });
  });

  it("has no growth without a previous period", () => {
    expect(buildVillageView(data, fyPeriod(2026), null)[0].growth).toBeNull();
  });
});
```

- [ ] **Step 2: Run** — `npx jest src/utils/analytics/categories src/utils/analytics/villages` → FAIL.

- [ ] **Step 3: Implement** — types first (`types.ts`): add `address?: string | null;` to `UserRow` and `purity?: string | null;` to `SoldItemRow`.

`src/utils/analytics/categories.ts`:

```ts
import { AnalyticsData } from "./types";
import { Period, inPeriod } from "./periods";
import { Change, change } from "./compare";
import { roundGrams } from "./format";

export type CategoryMetal = "gold" | "silver" | "unknown";

export interface Category {
  key: string;
  label: string;
  metal: CategoryMetal;
}

export interface CategoryStat extends Category {
  value: number; // rupees
  weight: number; // grams
  items: number;
  share: number; // of this period's sold value, 0..1
  growth: Change | null; // value vs previous period; null without one
}

/** Metal + purity. Only exact "gold"/"silver" count; legacy purity "Silver" means none. */
export const categoryOf = (metal: string | null, purity: string | null | undefined): Category => {
  if (metal !== "gold" && metal !== "silver") {
    return { key: "unknown", label: "Unknown metal", metal: "unknown" };
  }
  const trimmed = purity?.trim() ?? "";
  const grade = trimmed && trimmed !== "Silver" ? trimmed : null;
  const name = metal === "gold" ? "Gold" : "Silver";
  return { key: `${metal}:${grade ?? "-"}`, label: `${name} ${grade ?? "(no purity)"}`, metal };
};

interface Totals {
  category: Category;
  value: number;
  weight: number;
  items: number;
}

const totalsIn = (data: AnalyticsData, period: Period): Map<string, Totals> => {
  const dateOf = new Map(data.lenden.map((bill) => [bill.id, bill.date]));
  const totals = new Map<string, Totals>();
  for (const item of data.soldItems) {
    const date = dateOf.get(item.lendenId);
    if (!date || !inPeriod(date, period)) continue;
    const category = categoryOf(item.metal, item.purity);
    const t = totals.get(category.key) ?? { category, value: 0, weight: 0, items: 0 };
    t.value += item.total;
    t.weight = roundGrams(t.weight + (item.weight ?? 0));
    t.items += 1;
    totals.set(category.key, t);
  }
  return totals;
};

export const buildCategoryView = (
  data: AnalyticsData,
  period: Period,
  previous: Period | null,
): CategoryStat[] => {
  const current = totalsIn(data, period);
  const before = previous ? totalsIn(data, previous) : new Map<string, Totals>();
  const totalValue = [...current.values()].reduce((s, t) => s + t.value, 0);
  const keys = new Set([...current.keys(), ...before.keys()]);
  return [...keys]
    .map((key) => {
      const now = current.get(key);
      const prev = before.get(key);
      const value = now?.value ?? 0;
      return {
        ...(now ?? prev)!.category,
        value,
        weight: now?.weight ?? 0,
        items: now?.items ?? 0,
        share: totalValue ? value / totalValue : 0,
        growth: previous ? change(value, prev?.value ?? 0) : null,
      };
    })
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
};
```

`src/utils/analytics/villages.ts`:

```ts
import { AnalyticsData } from "./types";
import { Period, inPeriod } from "./periods";
import { Change, change } from "./compare";

export interface VillageStat {
  key: string; // "" = no address
  name: string; // most common spelling
  customers: number; // all-time
  buyers: number; // in the period
  sales: number;
  share: number; // of the period's sales, 0..1
  openBaaki: number; // as of today
  growth: Change | null;
}

/** The text before the first comma, with spacing collapsed. */
export const villageName = (address: string | null | undefined): string =>
  (address ?? "").split(",")[0].replace(/\s+/g, " ").trim();

export const villageKey = (address: string | null | undefined): string =>
  villageName(address).toLowerCase();

export const villageLabel = (address: string | null | undefined): string =>
  villageName(address) || "No address";

export const buildVillageView = (
  data: AnalyticsData,
  period: Period,
  previous: Period | null,
): VillageStat[] => {
  const villageOf = new Map<number, string>();
  const spellings = new Map<string, Map<string, number>>();
  const stats = new Map<string, VillageStat>();
  for (const user of data.users) {
    const name = villageName(user.address);
    const key = name.toLowerCase();
    villageOf.set(user.id, key);
    const counts = spellings.get(key) ?? new Map<string, number>();
    counts.set(name, (counts.get(name) ?? 0) + 1);
    spellings.set(key, counts);
    const stat = stats.get(key) ?? {
      key, name: "", customers: 0, buyers: 0, sales: 0, share: 0, openBaaki: 0, growth: null,
    };
    stat.customers++;
    stats.set(key, stat);
  }

  const buyers = new Map<string, Set<number>>();
  const previousSales = new Map<string, number>();
  for (const bill of data.lenden) {
    const key = villageOf.get(bill.userId);
    if (key === undefined) continue;
    const stat = stats.get(key)!;
    if (inPeriod(bill.date, period)) {
      stat.sales += bill.amount ?? 0;
      buyers.set(key, (buyers.get(key) ?? new Set<number>()).add(bill.userId));
    }
    if (previous && inPeriod(bill.date, previous)) {
      previousSales.set(key, (previousSales.get(key) ?? 0) + (bill.amount ?? 0));
    }
    if ((bill.status ?? 0) === 0 && (bill.baki ?? 0) > 0) stat.openBaaki += bill.baki ?? 0;
  }

  const total = [...stats.values()].reduce((s, v) => s + v.sales, 0);
  for (const stat of stats.values()) {
    let best = "";
    let bestCount = 0;
    for (const [spelling, count] of spellings.get(stat.key)!) {
      if (count > bestCount) {
        best = spelling;
        bestCount = count;
      }
    }
    stat.name = stat.key === "" ? "No address" : best;
    stat.buyers = buyers.get(stat.key)?.size ?? 0;
    stat.share = total ? stat.sales / total : 0;
    stat.growth = previous ? change(stat.sales, previousSales.get(stat.key) ?? 0) : null;
  }
  return [...stats.values()].sort((a, b) => b.sales - a.sales || b.customers - a.customers);
};
```

- [ ] **Step 4: Run** — `npx jest src/utils/analytics` → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** — `git commit -m "Add category and village analytics"`

---

### Task 4: Key customers

**Files:** Create `src/utils/analytics/importance.ts`, `importance.test.ts`

**Interfaces:**
- Consumes: `Period`, `inPeriod`, `dayNumber` (periods); `villageLabel` (villages).
- Produces: `buildImportanceView(data, period, limit = 10): ImportanceView`, types `KeyCustomer`, `ImportanceView`.

- [ ] **Step 1: Failing test** — `src/utils/analytics/importance.test.ts`:

```ts
import { buildImportanceView } from "./importance";
import { fyPeriod } from "./periods";
import { AnalyticsData, LendenRow } from "./types";

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
let nextId = 1;
const bill = (userId: number, date: string, amount: number, o: Partial<LendenRow> = {}): LendenRow => ({
  id: nextId++, userId, date, amount, discount: null, jama: null, baki: 0, status: 1, ...o,
});
const empty: AnalyticsData = {
  users: [], lenden: [], jama: [], rehan: [], rehanTx: [], soldItems: [], oldItems: [],
};

describe("buildImportanceView", () => {
  const data: AnalyticsData = {
    ...empty,
    users: [
      { id: 1, name: "A", address: "Ramdaspur, Jaunpur" },
      { id: 2, name: "B", address: "Malhani" },
      { id: 3, name: "C", address: null },
      { id: 4, name: "D", address: "Malhani" },
      { id: 5, name: "E", address: "Malhani" },
    ],
    lenden: [
      bill(1, iso(2026, 5, 1), 100000),
      bill(1, iso(2026, 5, 1), 0), // same day: one visit
      bill(2, iso(2026, 6, 1), 50000, { baki: 10000, status: 0 }),
      bill(3, iso(2026, 7, 1), 30000),
      bill(4, iso(2026, 8, 1), 15000),
      bill(5, iso(2026, 9, 1), 5000),
      bill(1, iso(2025, 5, 1), 40000),
    ],
  };
  const view = buildImportanceView(data, fyPeriod(2026));

  it("ranks buyers by sales in the period", () => {
    expect(view.buyers).toBe(5);
    expect(view.top.map((c) => c.name)).toEqual(["A", "B", "C", "D", "E"]);
    expect(view.top[0]).toMatchObject({
      village: "Ramdaspur", periodSales: 100000, share: 0.5, lifetimeSales: 140000, visits: 1,
    });
    expect(view.top[1].openBaaki).toBe(10000);
    expect(view.top[2].village).toBe("No address");
  });

  it("measures how concentrated sales are in the top 20% of buyers", () => {
    expect(view.topFifthShare).toBe(0.5);
  });

  it("respects the limit and handles no data", () => {
    expect(buildImportanceView(data, fyPeriod(2026), 3).top).toHaveLength(3);
    expect(buildImportanceView(empty, fyPeriod(2026))).toEqual({ buyers: 0, topFifthShare: 0, top: [] });
  });
});
```

- [ ] **Step 2: Run** — FAIL (module missing).

- [ ] **Step 3: Implement** — `src/utils/analytics/importance.ts`:

```ts
import { AnalyticsData } from "./types";
import { Period, dayNumber, inPeriod } from "./periods";
import { villageLabel } from "./villages";

export interface KeyCustomer {
  userId: number;
  name: string;
  village: string;
  periodSales: number;
  share: number; // of the period's sales, 0..1
  lifetimeSales: number;
  openBaaki: number; // as of today
  visits: number; // distinct purchase days in the period
}

export interface ImportanceView {
  buyers: number;
  topFifthShare: number; // share of sales from the top 20% of buyers (rounded up)
  top: KeyCustomer[];
}

export const buildImportanceView = (
  data: AnalyticsData,
  period: Period,
  limit = 10,
): ImportanceView => {
  const users = new Map(data.users.map((u) => [u.id, u]));
  const lifetime = new Map<number, number>();
  const owed = new Map<number, number>();
  const inP = new Map<number, { sales: number; days: Set<number> }>();
  for (const bill of data.lenden) {
    const amount = bill.amount ?? 0;
    lifetime.set(bill.userId, (lifetime.get(bill.userId) ?? 0) + amount);
    if ((bill.status ?? 0) === 0 && (bill.baki ?? 0) > 0) {
      owed.set(bill.userId, (owed.get(bill.userId) ?? 0) + (bill.baki ?? 0));
    }
    if (!inPeriod(bill.date, period)) continue;
    const p = inP.get(bill.userId) ?? { sales: 0, days: new Set<number>() };
    p.sales += amount;
    p.days.add(dayNumber(bill.date));
    inP.set(bill.userId, p);
  }

  const total = [...inP.values()].reduce((s, p) => s + p.sales, 0);
  const ranked: KeyCustomer[] = [...inP]
    .map(([userId, p]) => ({
      userId,
      name: users.get(userId)?.name ?? "Unknown",
      village: villageLabel(users.get(userId)?.address),
      periodSales: p.sales,
      share: total ? p.sales / total : 0,
      lifetimeSales: lifetime.get(userId) ?? 0,
      openBaaki: owed.get(userId) ?? 0,
      visits: p.days.size,
    }))
    .sort((a, b) => b.periodSales - a.periodSales);

  const fifth = Math.ceil(ranked.length * 0.2);
  const fifthSales = ranked.slice(0, fifth).reduce((s, c) => s + c.periodSales, 0);
  return {
    buyers: ranked.length,
    topFifthShare: total ? fifthSales / total : 0,
    top: ranked.slice(0, limit),
  };
};
```

- [ ] **Step 4: Run** — PASS; tsc clean.
- [ ] **Step 5: Commit** — `git commit -m "Add key customer analytics"`

---

### Task 5: Trends

**Files:** Create `src/utils/analytics/trends.ts`, `trends.test.ts`

**Interfaces:**
- Consumes: `Period`, `periodFor`, `shiftPeriod`; `change`, `Change`; `buildSalesView`; `buildMetalView`; `baakiAt`.
- Produces: `TrendGrain = "week" | "month" | "quarter" | "fy"`, `TREND_COUNTS`, `TrendRow`, `buildTrends(data, grain, now?, count?)`.

- [ ] **Step 1: Failing test** — `src/utils/analytics/trends.test.ts`:

```ts
import { buildTrends } from "./trends";
import { AnalyticsData, LendenRow } from "./types";

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const NOW = new Date(2026, 9, 2, 12);
const bill = (o: Partial<LendenRow>): LendenRow => ({
  id: 1, userId: 1, date: iso(2026, 8, 10), amount: 0, discount: null,
  jama: null, baki: null, status: 0, ...o,
});
const empty: AnalyticsData = {
  users: [], lenden: [], jama: [], rehan: [], rehanTx: [], soldItems: [], oldItems: [],
};
const data: AnalyticsData = {
  ...empty,
  lenden: [
    bill({ id: 1, date: iso(2026, 8, 10), amount: 100000 }),
    bill({ id: 2, date: iso(2026, 9, 15), amount: 50000 }),
    bill({ id: 3, date: iso(2026, 10, 1), amount: 30000 }),
  ],
  jama: [
    { lendenId: 1, amount: 40000, date: iso(2026, 8, 10) },
    { lendenId: 2, amount: 50000, date: iso(2026, 9, 20) },
  ],
  soldItems: [
    { lendenId: 1, metal: "gold", purity: "22KT", weight: 10, total: 100000 },
    { lendenId: 2, metal: "silver", purity: "Desi", weight: 200, total: 50000 },
    { lendenId: 3, metal: "gold", purity: "22KT", weight: 3, total: 30000 },
  ],
};

describe("buildTrends", () => {
  const rows = buildTrends(data, "month", NOW, 3);

  it("lists the last N periods oldest first, ending with the current one", () => {
    expect(rows.map((r) => r.label)).toEqual(["Aug 2026", "Sep 2026", "Oct 2026"]);
  });

  it("fills each period's figures", () => {
    expect(rows[0]).toMatchObject({
      bills: 1, sales: 100000, collected: 40000, collectionRate: 0.4,
      baakiAtEnd: 60000, goldGrams: 10, silverGrams: 0, oldReturned: 0,
    });
    expect(rows[1]).toMatchObject({ sales: 50000, collected: 50000, collectionRate: 1, baakiAtEnd: 60000, silverGrams: 200 });
    // the current period is measured up to now, not to its end
    expect(rows[2]).toMatchObject({ sales: 30000, collected: 0, collectionRate: 0, baakiAtEnd: 90000, goldGrams: 3 });
  });

  it("compares each row with the one before", () => {
    expect(rows[0].change.sales).toBeNull();
    expect(rows[1].change.baakiAtEnd?.pct).toBe(0);
    expect(rows[2].change.sales?.pct).toBeCloseTo(-0.4);
    expect(rows[2].change.baakiAtEnd?.pct).toBeCloseTo(0.5);
    expect(rows[2].change.goldGrams?.pct).toBeNull(); // nothing in Sep
  });

  it("uses default counts per grain and survives no data", () => {
    expect(buildTrends(data, "week", NOW)).toHaveLength(8);
    const fys = buildTrends(empty, "fy", NOW);
    expect(fys).toHaveLength(5);
    expect(fys[4].label).toBe("FY 2026-27");
    expect(fys[4]).toMatchObject({ sales: 0, collectionRate: null, baakiAtEnd: 0 });
  });
});
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** — `src/utils/analytics/trends.ts`:

```ts
import { AnalyticsData } from "./types";
import { Period, periodFor, shiftPeriod } from "./periods";
import { Change, change } from "./compare";
import { buildSalesView } from "./sales";
import { buildMetalView } from "./metal";
import { baakiAt } from "./baki";

export type TrendGrain = "week" | "month" | "quarter" | "fy";

export const TREND_COUNTS: Record<TrendGrain, number> = { week: 8, month: 6, quarter: 4, fy: 5 };

export interface TrendRow {
  period: Period;
  label: string;
  bills: number;
  sales: number;
  collected: number;
  collectionRate: number | null; // collected ÷ net sales; null when net sales is 0
  oldReturned: number;
  baakiAtEnd: number; // at period end, or now for the current period
  goldGrams: number;
  silverGrams: number;
  change: {
    sales: Change | null;
    collected: Change | null;
    baakiAtEnd: Change | null;
    goldGrams: Change | null;
    silverGrams: Change | null;
  };
}

/** The last `count` periods of a grain, oldest first, ending with the one containing `now`. */
export const buildTrends = (
  data: AnalyticsData,
  grain: TrendGrain,
  now: Date = new Date(),
  count: number = TREND_COUNTS[grain],
): TrendRow[] => {
  const latest = periodFor(grain, now);
  const rows: TrendRow[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const period = shiftPeriod(latest, -i);
    const sales = buildSalesView(data, period);
    const metal = buildMetalView(data, period);
    const at = new Date(Math.min(period.end.getTime(), now.getTime()));
    const prev = rows[rows.length - 1];
    const row: TrendRow = {
      period,
      label: period.label,
      bills: sales.bills,
      sales: sales.sales,
      collected: sales.collected,
      collectionRate: sales.netSales > 0 ? sales.collected / sales.netSales : null,
      oldReturned: sales.oldCredit,
      baakiAtEnd: baakiAt(data, at),
      goldGrams: metal.sold.gold.weight,
      silverGrams: metal.sold.silver.weight,
      change: { sales: null, collected: null, baakiAtEnd: null, goldGrams: null, silverGrams: null },
    };
    if (prev) {
      row.change = {
        sales: change(row.sales, prev.sales),
        collected: change(row.collected, prev.collected),
        baakiAtEnd: change(row.baakiAtEnd, prev.baakiAtEnd),
        goldGrams: change(row.goldGrams, prev.goldGrams),
        silverGrams: change(row.silverGrams, prev.silverGrams),
      };
    }
    rows.push(row);
  }
  return rows;
};
```

- [ ] **Step 4: Run** — PASS; tsc clean.
- [ ] **Step 5: Commit** — `git commit -m "Add period-by-period trends"`

---

### Task 6: Overview KPIs and insights

**Files:** Create `src/utils/analytics/overview.ts`, `overview.test.ts`

**Interfaces:**
- Consumes: Tasks 1–5 plus `buildSalesView`, `buildMetalView`, `buildCustomersView`, `buildRehanView`.
- Produces: `KpiFormat`, `Kpi`, `Insight`, `OverviewView`, `buildOverview(data, period, previous, lastYear, now?)`.

- [ ] **Step 1: Failing test** — `src/utils/analytics/overview.test.ts`:

```ts
import { buildOverview } from "./overview";
import { monthPeriod, previousPeriod, samePeriodLastYear } from "./periods";
import { AnalyticsData, LendenRow } from "./types";

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
      { tone: "good", text: "Sales up 100% vs Sep 2026 (₹1,00,000 → ₹2,00,000)" },
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
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** — `src/utils/analytics/overview.ts`:

```ts
import { AnalyticsData } from "./types";
import { Bucket, Period, Unit } from "./periods";
import { Change, change } from "./compare";
import { formatInr, formatPct } from "./format";
import { buildSalesView } from "./sales";
import { buildMetalView } from "./metal";
import { buildCustomersView } from "./customers";
import { buildRehanView } from "./rehan";
import { baakiAging, baakiAt } from "./baki";
import { buildCategoryView } from "./categories";
import { buildVillageView } from "./villages";
import { buildImportanceView } from "./importance";

export type KpiFormat = "rupees" | "grams" | "percent" | "count";

export interface Kpi {
  key: string;
  label: string;
  value: number | null;
  format: KpiFormat;
  upIsGood: boolean;
  change: Change | null; // vs previous period
  yoy: Change | null; // vs same period last year
}

export interface Insight {
  tone: "good" | "bad" | "info";
  text: string;
}

export interface OverviewView {
  kpis: Kpi[];
  insights: Insight[];
  buckets: Bucket[];
  salesSeries: number[];
  previousSalesSeries: number[] | null; // aligned to `buckets` by position
}

interface Figures {
  sales: number;
  collected: number;
  collectionRate: number | null;
  bills: number;
  avgBill: number;
  baakiEnd: number;
  goldSold: number;
  silverSold: number;
  oldReturnPct: number | null;
  newCustomers: number;
  rehanGiven: number;
}

const KPIS: { key: keyof Figures; label: string; format: KpiFormat; upIsGood: boolean }[] = [
  { key: "sales", label: "Sales", format: "rupees", upIsGood: true },
  { key: "collected", label: "Collected", format: "rupees", upIsGood: true },
  { key: "collectionRate", label: "Collection rate", format: "percent", upIsGood: true },
  { key: "bills", label: "Bills", format: "count", upIsGood: true },
  { key: "avgBill", label: "Avg bill", format: "rupees", upIsGood: true },
  { key: "baakiEnd", label: "Baaki (period end)", format: "rupees", upIsGood: false },
  { key: "goldSold", label: "Gold sold", format: "grams", upIsGood: true },
  { key: "silverSold", label: "Silver sold", format: "grams", upIsGood: true },
  { key: "oldReturnPct", label: "Old jewellery returned", format: "percent", upIsGood: false },
  { key: "newCustomers", label: "New customers", format: "count", upIsGood: true },
  { key: "rehanGiven", label: "Rehan given", format: "rupees", upIsGood: true },
];

const UNIT_WORD: Record<Unit, string> = { day: "day", week: "week", month: "month", year: "year" };

const fit = (values: number[], length: number) =>
  Array.from({ length }, (_, i) => values[i] ?? 0);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const buildOverview = (
  data: AnalyticsData,
  period: Period,
  previous: Period | null,
  lastYear: Period | null,
  now: Date = new Date(),
): OverviewView => {
  const figures = (p: Period): Figures => {
    const sales = buildSalesView(data, p);
    const metal = buildMetalView(data, p);
    // The current period is measured up to now, not to its future end.
    const at = new Date(Math.min(p.end.getTime(), now.getTime()));
    return {
      sales: sales.sales,
      collected: sales.collected,
      collectionRate: sales.netSales > 0 ? sales.collected / sales.netSales : null,
      bills: sales.bills,
      avgBill: sales.avgBill,
      baakiEnd: baakiAt(data, at),
      goldSold: metal.sold.gold.weight,
      silverSold: metal.sold.silver.weight,
      oldReturnPct: sales.sales > 0 ? sales.oldCredit / sales.sales : null,
      newCustomers: buildCustomersView(data, p, now).newInPeriod,
      rehanGiven: buildRehanView(data, p).given,
    };
  };

  const cur = figures(period);
  const prev = previous ? figures(previous) : null;
  const ly = lastYear ? figures(lastYear) : null;
  const compareWith = (other: Figures | null, key: keyof Figures): Change | null => {
    if (!other) return null;
    const a = cur[key];
    const b = other[key];
    return a === null || b === null ? null : change(a, b);
  };
  const kpis: Kpi[] = KPIS.map((def) => ({
    ...def,
    value: cur[def.key],
    change: compareWith(prev, def.key),
    yoy: compareWith(ly, def.key),
  }));

  const salesView = buildSalesView(data, period);
  const bucketList = salesView.buckets;
  const salesSeries = salesView.salesSeries;
  const previousSalesSeries = previous
    ? fit(buildSalesView(data, previous).salesSeries, bucketList.length)
    : null;

  const insights: Insight[] = [];

  if (previous && prev && prev.sales > 0) {
    const pct = change(cur.sales, prev.sales).pct!;
    const span = `${formatInr(prev.sales)} → ${formatInr(cur.sales)}`;
    if (Math.abs(pct) < 0.02) {
      insights.push({ tone: "info", text: `Sales flat vs ${previous.label} (${span})` });
    } else {
      insights.push({
        tone: pct > 0 ? "good" : "bad",
        text: `Sales ${pct > 0 ? "up" : "down"} ${formatPct(Math.abs(pct))} vs ${previous.label} (${span})`,
      });
    }
  }

  const best = Math.max(0, ...salesSeries);
  if (bucketList.length > 1 && best > 0) {
    const i = salesSeries.indexOf(best);
    insights.push({
      tone: "info",
      text: `Best ${UNIT_WORD[period.unit]}: ${bucketList[i].label} with ${formatInr(best)}`,
    });
  }

  const categories = buildCategoryView(data, period, previous);
  const topCategory = categories.find((c) => c.value > 0);
  if (topCategory) {
    insights.push({
      tone: "info",
      text: `${topCategory.label} is the top seller: ${formatPct(topCategory.share)} of sales`,
    });
  }
  const withPct = categories.filter((c) => c.growth?.pct !== null && c.growth?.pct !== undefined);
  const growing = withPct
    .filter((c) => c.growth!.pct! > 0)
    .sort((a, b) => b.growth!.pct! - a.growth!.pct!)[0];
  if (growing) {
    insights.push({ tone: "good", text: `${growing.label} grew fastest: +${formatPct(growing.growth!.pct!)}` });
  }
  const falling = withPct
    .filter((c) => c.growth!.pct! < -0.1)
    .sort((a, b) => a.growth!.pct! - b.growth!.pct!)[0];
  if (falling) {
    insights.push({ tone: "bad", text: `${falling.label} fell ${formatPct(Math.abs(falling.growth!.pct!))}` });
  }

  const village = buildVillageView(data, period, previous).find((v) => v.sales > 0);
  if (village && village.key !== "") {
    insights.push({
      tone: "info",
      text: `${village.name} brings ${formatPct(village.share)} of sales (${plural(village.buyers, "buyer")})`,
    });
  }

  const importance = buildImportanceView(data, period);
  if (importance.buyers >= 5) {
    insights.push({
      tone: "info",
      text: `Top 20% of buyers bring ${formatPct(importance.topFifthShare)} of sales`,
    });
  }

  if (prev) {
    const delta = cur.baakiEnd - prev.baakiEnd;
    if (delta > 0) {
      insights.push({ tone: "bad", text: `Baaki rose by ${formatInr(delta)} to ${formatInr(cur.baakiEnd)}` });
    } else if (delta < 0) {
      insights.push({ tone: "good", text: `Baaki fell by ${formatInr(-delta)} to ${formatInr(cur.baakiEnd)}` });
    }
  }

  const stale = baakiAging(data, now).slice(3); // older than 180 days
  const staleAmount = stale.reduce((s, b) => s + b.amount, 0);
  if (staleAmount > 0) {
    const bills = stale.reduce((s, b) => s + b.count, 0);
    insights.push({
      tone: "bad",
      text: `${formatInr(staleAmount)} of baaki is over 6 months old (${plural(bills, "bill")})`,
    });
  }

  if (cur.collectionRate !== null && cur.collectionRate < 0.6) {
    insights.push({ tone: "bad", text: `Only ${formatPct(cur.collectionRate)} of net sales collected so far` });
  }

  if (cur.oldReturnPct !== null && cur.oldReturnPct >= 0.15) {
    insights.push({ tone: "info", text: `Old jewellery covered ${formatPct(cur.oldReturnPct)} of sales value` });
  }

  return { kpis, insights, buckets: bucketList, salesSeries, previousSalesSeries };
};
```

- [ ] **Step 4: Run** — `npx jest src/utils/analytics/overview` PASS; full `npx jest`; tsc clean.
- [ ] **Step 5: Commit** — `git commit -m "Add overview KPIs with comparisons and generated insights"`

---

### Task 7: Dashboard UI

**Files:**
- Modify: `src/database/analyticsQueries.ts` (users select `id, name, address`; sold items select `lendenId, metal, purity, weight, total`)
- Create: `src/components/analytics/PeriodPicker.tsx`, `KpiTile.tsx`, `OverviewSection.tsx`, `VillagesSection.tsx`, `TrendsSection.tsx`, `BaakiAgingCard.tsx`, `KeyCustomersCard.tsx`, `CategoriesCard.tsx`
- Rewrite: `src/screen/AnalyticsScreen.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–6; existing `SalesSection`, `CustomersSection`, `RehanSection`, `MetalSection`, `BarChart`, `StatTile` (`StatTile`, `StatGrid`, `AnalyticsCard`), `CustomDatePicker` (`visible, selectedDate, onClose, onDateSelect, minimumDate?, maximumDate?`), `formatGrams`, `formatCompactRupees`.
- Produces: no new exports used elsewhere.

UI is verified by `npx tsc --noEmit` plus the device checklist (Jest runs `.ts` only).

- [ ] **Step 1: Query** — in `src/database/analyticsQueries.ts` change the users query to `"SELECT id, name, address FROM users"` and the sold-items query to `"SELECT lendenId, metal, purity, weight, total FROM lenden_items"`.

- [ ] **Step 2: `src/components/analytics/KpiTile.tsx`**

```tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Change } from "../../utils/analytics/compare";
import { KpiFormat } from "../../utils/analytics/overview";
import { formatGrams, formatInr, formatPct } from "../../utils/analytics/format";

export const formatKpi = (value: number | null, format: KpiFormat): string => {
  if (value === null) return "—";
  switch (format) {
    case "rupees":
      return formatInr(value);
    case "grams":
      return formatGrams(value);
    case "percent":
      return formatPct(value);
    case "count":
      return String(Math.round(value));
  }
};

const GOOD = "#2E7D32";
const BAD = "#C62828";
const NEUTRAL = "#888";

/** ▲/▼ with % (or the raw difference when there is no previous value), coloured by meaning. */
export const ChangeChip: React.FC<{
  change: Change | null;
  format: KpiFormat;
  upIsGood: boolean;
  prefix?: string;
}> = ({ change, format, upIsGood, prefix = "" }) => {
  if (!change || change.delta === 0) {
    return change ? <Text style={[styles.chip, { color: NEUTRAL }]}>{prefix}no change</Text> : null;
  }
  const up = change.delta > 0;
  const color = up === upIsGood ? GOOD : BAD;
  const amount =
    change.pct === null
      ? formatKpi(Math.abs(change.delta), format)
      : formatPct(Math.abs(change.pct));
  return (
    <Text style={[styles.chip, { color }]}>
      {prefix}
      {up ? "▲" : "▼"} {amount}
    </Text>
  );
};

export const KpiTile: React.FC<{
  label: string;
  value: number | null;
  format: KpiFormat;
  upIsGood: boolean;
  change: Change | null;
  yoy: Change | null;
}> = ({ label, value, format, upIsGood, change, yoy }) => (
  <View style={styles.tile}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
      {formatKpi(value, format)}
    </Text>
    <ChangeChip change={change} format={format} upIsGood={upIsGood} />
    <ChangeChip change={yoy} format={format} upIsGood={upIsGood} prefix="LY " />
  </View>
);

const styles = StyleSheet.create({
  tile: {
    width: "48%",
    flexGrow: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EEF0F2",
  },
  label: { fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  value: { fontSize: 19, fontWeight: "800", color: "#1A1A1A" },
  chip: { fontSize: 12, fontWeight: "700", marginTop: 3 },
});
```

- [ ] **Step 3: `src/components/analytics/OverviewSection.tsx`**

```tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { OverviewView } from "../../utils/analytics/overview";
import { formatCompactRupees } from "../../utils/analytics/format";
import BarChart, { ChartSeries } from "./BarChart";
import { AnalyticsCard, StatGrid } from "./StatTile";
import { KpiTile } from "./KpiTile";

const TONE = {
  good: { icon: "trending-up", color: "#2E7D32" },
  bad: { icon: "alert-circle", color: "#C62828" },
  info: { icon: "bulb", color: "#B8860B" },
} as const;

const OverviewSection: React.FC<{
  view: OverviewView;
  previousLabel: string | null;
  lastYearLabel: string | null;
}> = ({ view, previousLabel, lastYearLabel }) => {
  const series: ChartSeries[] = [{ label: "This period", color: "#B8860B", values: view.salesSeries }];
  if (view.previousSalesSeries) {
    series.push({ label: previousLabel ?? "Previous", color: "#E3D3B0", values: view.previousSalesSeries });
  }
  return (
    <View>
      {(previousLabel || lastYearLabel) && (
        <Text style={styles.legend}>
          {previousLabel ? `▲▼ vs ${previousLabel}` : ""}
          {lastYearLabel ? `  ·  LY = ${lastYearLabel}` : ""}
        </Text>
      )}
      <StatGrid>
        {view.kpis.map((k) => (
          <KpiTile
            key={k.key}
            label={k.label}
            value={k.value}
            format={k.format}
            upIsGood={k.upIsGood}
            change={k.change}
            yoy={k.yoy}
          />
        ))}
      </StatGrid>

      <AnalyticsCard title="Insights">
        {view.insights.length === 0 ? (
          <Text style={styles.muted}>Not enough data in this period yet</Text>
        ) : (
          view.insights.map((insight, i) => (
            <View key={i} style={styles.insight}>
              <Ionicons name={TONE[insight.tone].icon} size={18} color={TONE[insight.tone].color} />
              <Text style={styles.insightText}>{insight.text}</Text>
            </View>
          ))
        )}
      </AnalyticsCard>

      <AnalyticsCard title="Sales">
        <BarChart buckets={view.buckets} series={series} formatValue={formatCompactRupees} />
      </AnalyticsCard>
    </View>
  );
};

const styles = StyleSheet.create({
  legend: { fontSize: 12, color: "#777", marginBottom: 8 },
  muted: { color: "#999", fontSize: 13 },
  insight: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 7 },
  insightText: { flex: 1, fontSize: 14, color: "#1A1A1A", lineHeight: 20 },
});

export default OverviewSection;
```

- [ ] **Step 4: `src/components/analytics/VillagesSection.tsx`**

```tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { VillageStat } from "../../utils/analytics/villages";
import { formatInr, formatPct } from "../../utils/analytics/format";
import { AnalyticsCard } from "./StatTile";
import { ChangeChip } from "./KpiTile";

const VillagesSection: React.FC<{ villages: VillageStat[] }> = ({ villages }) => (
  <AnalyticsCard title="Villages by sales">
    {villages.length === 0 ? (
      <Text style={styles.muted}>No customers yet</Text>
    ) : (
      villages.map((v) => (
        <View key={v.key || "none"} style={styles.row}>
          <View style={styles.top}>
            <Text style={styles.name} numberOfLines={1}>{v.name}</Text>
            <Text style={styles.sales}>{formatInr(v.sales)}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { flex: v.share }]} />
            <View style={{ flex: 1 - v.share }} />
          </View>
          <View style={styles.bottom}>
            <Text style={styles.sub}>
              {formatPct(v.share)} · {v.buyers}/{v.customers} customers bought
              {v.openBaaki > 0 ? ` · baaki ${formatInr(v.openBaaki)}` : ""}
            </Text>
            <ChangeChip change={v.growth} format="rupees" upIsGood />
          </View>
        </View>
      ))
    )}
  </AnalyticsCard>
);

const styles = StyleSheet.create({
  muted: { color: "#999", fontSize: 13 },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F2F5" },
  top: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  sales: { fontSize: 15, fontWeight: "800", color: "#7C4A08" },
  track: { flexDirection: "row", height: 6, borderRadius: 3, backgroundColor: "#F2F2F2", overflow: "hidden", marginVertical: 6 },
  fill: { backgroundColor: "#B8860B" },
  bottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  sub: { flex: 1, fontSize: 12, color: "#777" },
});

export default VillagesSection;
```

- [ ] **Step 5: `src/components/analytics/TrendsSection.tsx`**

```tsx
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { TrendRow } from "../../utils/analytics/trends";
import { formatCompactRupees, formatGrams, formatInr, formatPct } from "../../utils/analytics/format";
import { Change } from "../../utils/analytics/compare";
import BarChart from "./BarChart";
import { AnalyticsCard } from "./StatTile";

const pctText = (c: Change | null, upIsGood: boolean) => {
  if (!c || c.pct === null || c.delta === 0) return { text: "", color: "#888" };
  const up = c.delta > 0;
  return { text: `${up ? "▲" : "▼"}${formatPct(Math.abs(c.pct))}`, color: up === upIsGood ? "#2E7D32" : "#C62828" };
};

const COLUMNS = [
  { title: "Period", width: 120 },
  { title: "Bills", width: 50 },
  { title: "Sales", width: 110 },
  { title: "Collected", width: 110 },
  { title: "Rate", width: 56 },
  { title: "Old ret.", width: 90 },
  { title: "Baaki end", width: 110 },
  { title: "Gold", width: 90 },
  { title: "Silver", width: 90 },
];

const Cell: React.FC<{ width: number; text: string; change?: { text: string; color: string }; bold?: boolean }> = ({
  width, text, change, bold,
}) => (
  <View style={[styles.cell, { width }]}>
    <Text style={[styles.cellText, bold && styles.bold]} numberOfLines={1}>{text}</Text>
    {change?.text ? <Text style={[styles.change, { color: change.color }]}>{change.text}</Text> : null}
  </View>
);

const TrendsSection: React.FC<{ rows: TrendRow[] }> = ({ rows }) => {
  const newestFirst = [...rows].reverse();
  return (
    <View>
      <AnalyticsCard title="Sales and collections">
        <BarChart
          buckets={rows.map((r) => ({ key: r.label, label: r.label.split(" ")[0] }))}
          series={[
            { label: "Sales", color: "#B8860B", values: rows.map((r) => r.sales) },
            { label: "Collected", color: "#2E7D32", values: rows.map((r) => r.collected) },
          ]}
          formatValue={formatCompactRupees}
        />
      </AnalyticsCard>

      <AnalyticsCard title="Period by period">
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={[styles.row, styles.header]}>
              {COLUMNS.map((c) => (
                <Text key={c.title} style={[styles.headerText, { width: c.width }]}>{c.title}</Text>
              ))}
            </View>
            {newestFirst.map((r) => (
              <View key={r.label} style={styles.row}>
                <Cell width={120} text={r.label} bold />
                <Cell width={50} text={String(r.bills)} />
                <Cell width={110} text={formatInr(r.sales)} change={pctText(r.change.sales, true)} />
                <Cell width={110} text={formatInr(r.collected)} change={pctText(r.change.collected, true)} />
                <Cell width={56} text={r.collectionRate === null ? "—" : formatPct(r.collectionRate)} />
                <Cell width={90} text={formatInr(r.oldReturned)} />
                <Cell width={110} text={formatInr(r.baakiAtEnd)} change={pctText(r.change.baakiAtEnd, false)} />
                <Cell width={90} text={formatGrams(r.goldGrams)} change={pctText(r.change.goldGrams, true)} />
                <Cell width={90} text={formatGrams(r.silverGrams)} change={pctText(r.change.silverGrams, true)} />
              </View>
            ))}
          </View>
        </ScrollView>
        <Text style={styles.note}>Newest first. ▲▼ compare with the period before. Baaki end of the current period is as of today.</Text>
      </AnalyticsCard>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#F0F2F5" },
  header: { backgroundColor: "#FAF1E2" },
  headerText: { fontSize: 11, fontWeight: "800", color: "#8C5B14", paddingVertical: 8, paddingHorizontal: 6 },
  cell: { paddingVertical: 8, paddingHorizontal: 6 },
  cellText: { fontSize: 13, color: "#1A1A1A" },
  bold: { fontWeight: "700" },
  change: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  note: { fontSize: 11, color: "#999", marginTop: 8 },
});

export default TrendsSection;
```

- [ ] **Step 6: `src/components/analytics/BaakiAgingCard.tsx`**

```tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AgingBucket } from "../../utils/analytics/baki";
import { formatInr } from "../../utils/analytics/format";
import { AnalyticsCard } from "./StatTile";

const BaakiAgingCard: React.FC<{ aging: AgingBucket[] }> = ({ aging }) => {
  const max = Math.max(1, ...aging.map((b) => b.amount));
  return (
    <AnalyticsCard title="How old is the baaki (as of today)">
      {aging.map((b, i) => (
        <View key={b.label} style={styles.row}>
          <Text style={styles.label}>{b.label}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { flex: b.amount / max, backgroundColor: i >= 3 ? "#C62828" : "#B8860B" }]} />
            <View style={{ flex: 1 - b.amount / max }} />
          </View>
          <Text style={styles.amount}>{formatInr(b.amount)}</Text>
          <Text style={styles.count}>{b.count}</Text>
        </View>
      ))}
      <Text style={styles.note}>Open bills by age; last column is the number of bills.</Text>
    </AnalyticsCard>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  label: { width: 84, fontSize: 12, color: "#555" },
  track: { flex: 1, height: 10, flexDirection: "row", borderRadius: 5, backgroundColor: "#F2F2F2", overflow: "hidden" },
  fill: {},
  amount: { width: 86, textAlign: "right", fontSize: 12, fontWeight: "700", color: "#1A1A1A" },
  count: { width: 24, textAlign: "right", fontSize: 12, color: "#888" },
  note: { fontSize: 11, color: "#999", marginTop: 6 },
});

export default BaakiAgingCard;
```

- [ ] **Step 7: `src/components/analytics/KeyCustomersCard.tsx`**

```tsx
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ImportanceView } from "../../utils/analytics/importance";
import { formatInr, formatPct } from "../../utils/analytics/format";
import { AnalyticsCard } from "./StatTile";

const KeyCustomersCard: React.FC<{
  view: ImportanceView;
  onCustomerPress: (userId: number, name: string) => void;
}> = ({ view, onCustomerPress }) => (
  <AnalyticsCard title="Most important customers">
    {view.buyers >= 5 && (
      <Text style={styles.headline}>
        Top 20% of buyers bring {formatPct(view.topFifthShare)} of sales
      </Text>
    )}
    {view.top.length === 0 ? (
      <Text style={styles.muted}>No purchases in this period</Text>
    ) : (
      view.top.map((c, i) => (
        <TouchableOpacity key={c.userId} style={styles.row} onPress={() => onCustomerPress(c.userId, c.name)}>
          <Text style={styles.rank}>{i + 1}</Text>
          <View style={styles.main}>
            <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {c.village} · {c.visits} {c.visits === 1 ? "visit" : "visits"} · lifetime {formatInr(c.lifetimeSales)}
              {c.openBaaki > 0 ? ` · baaki ${formatInr(c.openBaaki)}` : ""}
            </Text>
          </View>
          <View style={styles.side}>
            <Text style={styles.sales}>{formatInr(c.periodSales)}</Text>
            <Text style={styles.share}>{formatPct(c.share)}</Text>
          </View>
        </TouchableOpacity>
      ))
    )}
  </AnalyticsCard>
);

const styles = StyleSheet.create({
  headline: { fontSize: 13, color: "#7C4A08", fontWeight: "700", marginBottom: 8 },
  muted: { color: "#999", fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#F0F2F5" },
  rank: { width: 20, fontSize: 13, fontWeight: "800", color: "#B8860B" },
  main: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600", color: "#1A1A1A" },
  sub: { fontSize: 12, color: "#888", marginTop: 2 },
  side: { alignItems: "flex-end" },
  sales: { fontSize: 14, fontWeight: "800", color: "#7C4A08" },
  share: { fontSize: 11, color: "#888" },
});

export default KeyCustomersCard;
```

- [ ] **Step 8: `src/components/analytics/CategoriesCard.tsx`**

```tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { CategoryStat } from "../../utils/analytics/categories";
import { formatGrams, formatInr, formatPct } from "../../utils/analytics/format";
import { AnalyticsCard } from "./StatTile";
import { ChangeChip } from "./KpiTile";

const COLOR = { gold: "#D4A017", silver: "#9AA5B1", unknown: "#C9B8B8" } as const;

const CategoriesCard: React.FC<{ categories: CategoryStat[] }> = ({ categories }) => (
  <AnalyticsCard title="Categories (metal + purity)">
    {categories.length === 0 ? (
      <Text style={styles.muted}>No items sold in this period</Text>
    ) : (
      categories.map((c) => (
        <View key={c.key} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: COLOR[c.metal] }]} />
          <View style={styles.main}>
            <Text style={styles.name}>{c.label}</Text>
            <Text style={styles.sub}>
              {formatGrams(c.weight)} · {c.items} {c.items === 1 ? "item" : "items"} · {formatPct(c.share)}
            </Text>
          </View>
          <View style={styles.side}>
            <Text style={styles.value}>{formatInr(c.value)}</Text>
            <ChangeChip change={c.growth} format="rupees" upIsGood />
          </View>
        </View>
      ))
    )}
  </AnalyticsCard>
);

const styles = StyleSheet.create({
  muted: { color: "#999", fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#F0F2F5" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  main: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600", color: "#1A1A1A" },
  sub: { fontSize: 12, color: "#888", marginTop: 2 },
  side: { alignItems: "flex-end" },
  value: { fontSize: 14, fontWeight: "800", color: "#7C4A08" },
});

export default CategoriesCard;
```

- [ ] **Step 9: `src/components/analytics/PeriodPicker.tsx`**

```tsx
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomDatePicker from "../CustomDatePicker";
import { Grain, Period } from "../../utils/analytics/periods";

const GRAINS: { key: Grain; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
  { key: "fy", label: "FY" },
  { key: "custom", label: "Custom" },
  { key: "all", label: "All" },
];

const formatDay = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const PeriodPicker: React.FC<{
  grain: Grain;
  period: Period;
  canGoForward: boolean;
  customFrom: Date;
  customTo: Date;
  onGrainChange: (grain: Grain) => void;
  onStep: (steps: number) => void;
  onCustomChange: (from: Date, to: Date) => void;
}> = ({ grain, period, canGoForward, customFrom, customTo, onGrainChange, onStep, onCustomChange }) => {
  const [picking, setPicking] = useState<"from" | "to" | null>(null);
  return (
    <View>
      <View style={styles.chips}>
        {GRAINS.map((g) => (
          <TouchableOpacity
            key={g.key}
            style={[styles.chip, grain === g.key && styles.chipActive]}
            onPress={() => onGrainChange(g.key)}
          >
            <Text style={[styles.chipText, grain === g.key && styles.chipTextActive]}>{g.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {grain === "custom" && (
        <View style={styles.customRow}>
          {(["from", "to"] as const).map((which) => (
            <TouchableOpacity key={which} style={styles.dateButton} onPress={() => setPicking(which)}>
              <Text style={styles.dateLabel}>{which === "from" ? "From" : "To"}</Text>
              <Text style={styles.dateValue}>{formatDay(which === "from" ? customFrom : customTo)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.stepRow}>
        {grain !== "all" && (
          <TouchableOpacity style={styles.arrow} onPress={() => onStep(-1)}>
            <Ionicons name="chevron-back" size={20} color="#8C5B14" />
          </TouchableOpacity>
        )}
        <Text style={styles.periodLabel} numberOfLines={1}>{period.label}</Text>
        {grain !== "all" && (
          <TouchableOpacity style={styles.arrow} onPress={() => onStep(1)} disabled={!canGoForward}>
            <Ionicons name="chevron-forward" size={20} color={canGoForward ? "#8C5B14" : "#DDD"} />
          </TouchableOpacity>
        )}
      </View>

      <CustomDatePicker
        visible={picking !== null}
        selectedDate={picking === "to" ? customTo : customFrom}
        maximumDate={new Date()}
        onClose={() => setPicking(null)}
        onDateSelect={(date) => {
          if (picking === "from") onCustomChange(date, customTo);
          else onCustomChange(customFrom, date);
          setPicking(null);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  chips: { flexDirection: "row", gap: 6 },
  chip: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 9, borderWidth: 1.5, borderColor: "#E8D5AF", backgroundColor: "#fff" },
  chipActive: { backgroundColor: "#8C5B14", borderColor: "#8C5B14" },
  chipText: { fontSize: 11, fontWeight: "700", color: "#8C5B14" },
  chipTextActive: { color: "#fff" },
  customRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  dateButton: { flex: 1, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: "#E8D5AF", backgroundColor: "#fff" },
  dateLabel: { fontSize: 11, color: "#888" },
  dateValue: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 8 },
  arrow: { padding: 6 },
  periodLabel: { flexShrink: 1, fontSize: 16, fontWeight: "800", color: "#1A1A1A", marginHorizontal: 6 },
});

export default PeriodPicker;
```

- [ ] **Step 10: Rewrite `src/screen/AnalyticsScreen.tsx`**

```tsx
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { RootStackParamList } from "../types/entry";
import { getAnalyticsData } from "../database/analyticsQueries";
import { AnalyticsData } from "../utils/analytics/types";
import {
  Grain,
  Period,
  allPeriod,
  customPeriod,
  periodFor,
  previousPeriod,
  samePeriodLastYear,
  shiftPeriod,
} from "../utils/analytics/periods";
import { buildSalesView } from "../utils/analytics/sales";
import { buildCustomersView } from "../utils/analytics/customers";
import { buildRehanView } from "../utils/analytics/rehan";
import { buildMetalView } from "../utils/analytics/metal";
import { buildOverview } from "../utils/analytics/overview";
import { baakiAging } from "../utils/analytics/baki";
import { buildCategoryView } from "../utils/analytics/categories";
import { buildVillageView } from "../utils/analytics/villages";
import { buildImportanceView } from "../utils/analytics/importance";
import { TrendGrain, buildTrends } from "../utils/analytics/trends";
import PeriodPicker from "../components/analytics/PeriodPicker";
import OverviewSection from "../components/analytics/OverviewSection";
import SalesSection from "../components/analytics/SalesSection";
import BaakiAgingCard from "../components/analytics/BaakiAgingCard";
import CustomersSection from "../components/analytics/CustomersSection";
import KeyCustomersCard from "../components/analytics/KeyCustomersCard";
import VillagesSection from "../components/analytics/VillagesSection";
import RehanSection from "../components/analytics/RehanSection";
import MetalSection from "../components/analytics/MetalSection";
import CategoriesCard from "../components/analytics/CategoriesCard";
import TrendsSection from "../components/analytics/TrendsSection";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Analytics">;
};

const TABS = ["Overview", "Sales", "Customers", "Villages", "Rehan", "Metal", "Trends"] as const;
type Tab = (typeof TABS)[number];

const startOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const AnalyticsScreen: React.FC<Props> = ({ navigation }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("Overview");
  const [grain, setGrain] = useState<Grain>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [customFrom, setCustomFrom] = useState(startOfMonth);
  const [customTo, setCustomTo] = useState(() => new Date());

  // Every load re-reads the ledger, so new transactions show up on their own.
  const load = useCallback(async () => {
    try {
      setData(await getAnalyticsData());
      setFailed(false);
    } catch (error) {
      console.error("Error loading analytics:", error);
      setFailed(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const period: Period = useMemo(() => {
    if (grain === "all") {
      return allPeriod(
        data ? [...data.lenden.map((l) => l.date), ...data.rehan.map((r) => r.openDate)] : [],
      );
    }
    if (grain === "custom") return customPeriod(customFrom, customTo);
    return periodFor(grain, anchor);
  }, [grain, anchor, customFrom, customTo, data]);
  const previous = useMemo(() => previousPeriod(period), [period]);
  const lastYear = grain === "month" || grain === "quarter" ? samePeriodLastYear(period) : null;
  const canGoForward = grain !== "all" && period.end.getTime() <= Date.now();
  const trendGrain: TrendGrain =
    grain === "custom" ? "month" : grain === "all" ? "fy" : grain;

  const onStep = (steps: number) => {
    const next = shiftPeriod(period, steps);
    if (grain === "custom") {
      setCustomFrom(next.start);
      setCustomTo(new Date(next.end.getFullYear(), next.end.getMonth(), next.end.getDate() - 1));
    } else {
      setAnchor(next.start);
    }
  };

  const content = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const openCustomer = (userId: number, userName: string) =>
      navigation.navigate("UserTransactions", { userId, userName });
    switch (tab) {
      case "Overview":
        return (
          <OverviewSection
            view={buildOverview(data, period, previous, lastYear, now)}
            previousLabel={previous?.label ?? null}
            lastYearLabel={lastYear?.label ?? null}
          />
        );
      case "Sales":
        return (
          <>
            <SalesSection view={buildSalesView(data, period)} onCustomerPress={openCustomer} />
            <BaakiAgingCard aging={baakiAging(data, now)} />
          </>
        );
      case "Customers":
        return (
          <>
            <KeyCustomersCard view={buildImportanceView(data, period)} onCustomerPress={openCustomer} />
            <CustomersSection view={buildCustomersView(data, period, now)} onCustomerPress={openCustomer} />
          </>
        );
      case "Villages":
        return <VillagesSection villages={buildVillageView(data, period, previous)} />;
      case "Rehan":
        return <RehanSection view={buildRehanView(data, period)} />;
      case "Metal":
        return (
          <>
            <MetalSection view={buildMetalView(data, period)} />
            <CategoriesCard categories={buildCategoryView(data, period, previous)} />
          </>
        );
      case "Trends":
        return <TrendsSection rows={buildTrends(data, trendGrain, now)} />;
    }
  }, [data, tab, period, previous, lastYear, trendGrain, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TABS.map((t) => (
            <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {tab !== "Trends" && (
          <PeriodPicker
            grain={grain}
            period={period}
            canGoForward={canGoForward}
            customFrom={customFrom}
            customTo={customTo}
            onGrainChange={(g) => {
              setGrain(g);
              setAnchor(new Date());
            }}
            onStep={onStep}
            onCustomChange={(from, to) => {
              setCustomFrom(from);
              setCustomTo(to);
            }}
          />
        )}
        {tab === "Trends" && (
          <Text style={styles.trendNote}>
            Showing the last periods by {trendGrain === "fy" ? "financial year" : trendGrain}. Change the
            time frame on any other tab.
          </Text>
        )}
      </View>

      {failed ? (
        <View style={styles.centered}>
          <Text style={styles.error}>Could not load analytics. Pull down to try again.</Text>
        </View>
      ) : !data ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#8C5B14" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {content}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  header: { padding: 16, paddingBottom: 8, gap: 10 },
  tabs: { gap: 6 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: "#EFE6D6" },
  tabActive: { backgroundColor: "#8C5B14" },
  tabText: { fontSize: 13, fontWeight: "700", color: "#8C5B14" },
  tabTextActive: { color: "#fff" },
  trendNote: { fontSize: 12, color: "#777" },
  content: { padding: 16, paddingTop: 8, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: "#C62828", fontSize: 14, textAlign: "center" },
});

export default AnalyticsScreen;
```

Note: when "Trends" is selected and the user had "Custom" or "All", trends use months / FYs (spec §10.4).

- [ ] **Step 11: Verify** — `npx tsc --noEmit` clean; `npx jest` all pass.
- [ ] **Step 12: Commit** — `git commit -m "Build the dynamic analytics dashboard UI"` (stage only this task's files).

---

### Task 8: Verification and docs

- [ ] **Step 1:** `npx jest` and `npx tsc --noEmit` both pass.
- [ ] **Step 2:** Append "## 11. Dashboard v2 implementation notes (2026-10-02)" to `agent/2026-10-02-analytics-design.md` listing deviations from §10 (or "none") and these behaviours: Trends ignore Custom/All by using months/FYs; the Customers tab's tiers follow the selected time frame; baaki at period end is reconstructed and may differ slightly from stored baki if entries were hand-edited.
- [ ] **Step 3: Device checklist (owner):**
  1. Analytics opens on Overview for this month; each chip (Week, Month, Quarter, FY, Custom, All) changes the label and numbers; ◀ goes back; ▶ stops at the current period.
  2. Overview KPIs show ▲/▼ vs last period; Month and Quarter also show an "LY" line.
  3. Insights read sensibly against what you know about the period.
  4. Villages list matches customer addresses; Metal → Categories lists your purities; Customers → most important customers opens a customer on tap.
  5. Trends table scrolls sideways; add a test bill, pull down to refresh, and see it counted without reopening the app.
- [ ] **Step 4: Commit** — `git commit -m "Note dashboard v2 implementation details"`

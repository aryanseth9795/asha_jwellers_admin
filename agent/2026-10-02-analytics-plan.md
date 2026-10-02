# Analytics Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Analytics screen (Sales / Customers / Rehan / Metal) that answers every question in `analytics plan .md`, computed from the existing SQLite ledger.

**Architecture:** One query module fetches seven flat row sets. Pure TypeScript modules under `src/utils/analytics/` turn them into per-section view models; all of the logic lives there and is Jest-tested. The screen and chart components only render view models. Charts are plain React Native views.

**Tech Stack:** React Native 0.81 + Expo 54, expo-sqlite, TypeScript 5.9, Jest 29 + ts-jest (node env, `src/**/*.test.ts` only).

**Spec:** `agent/2026-10-02-analytics-design.md`

## Global Constraints

- No new dependencies; no native rebuild (must ship via expo-updates OTA).
- Period = Indian financial year, 1 Apr – 31 Mar, labelled `FY 2026-27`; plus "All time".
- Revenue is always three numbers: **Sales** (gross bill value), **Collected** (cash by payment date), **Baaki** (open, as of today).
- Dates are bucketed in **device local time**, never by slicing the UTC ISO string.
- Money is integer rupees. Grams are rounded to 3 decimals after summing.
- `metal` other than exactly `"gold"`/`"silver"` → **unknown** bucket; never merged into gold or silver.
- Tiers: recency (≤90 d = 3, ≤365 d = 2, else 1) + frequency thirds + monetary thirds; Good 8–9, Medium 6–7, Low 3–5; < 3 buyers → all Medium; ties go to the higher third.
- "High baaki" = open baki > 50 % of the customer's all-time net purchases; a badge, not a tier input.
- Commits: plain messages, **no co-author / attribution lines** (owner's instruction).

## Review Focus

1. A sale at 1 a.m. IST on 1 April is stored as `…-03-31T19:30Z`; it must land in April and the new FY → test in Task 1.
2. A legacy entry with `lenden.jama` **and** `jama_entries` rows must not be counted twice in Collected → test in Task 2.
3. An empty database, or an FY with no data: every number is 0 (never `NaN`), and the chart shows "No data for this period" → tests in Tasks 2–5, empty state in Task 6.
4. A rehan whose amount was hand-edited below its repayments must not show negative "given" → test in Task 4.
5. A line item with `metal` NULL or an unexpected string (e.g. legacy `"Silver"`) goes to unknown, never gold → test in Task 5.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/utils/analytics/types.ts` (new) | Raw row types and `AnalyticsData`; no logic |
| `src/utils/analytics/periods.ts` (new) | FY maths, buckets, series, day diffs, `sum`, `median` |
| `src/utils/analytics/format.ts` (new) | `formatCompactRupees`, `formatGrams`, `roundGrams` |
| `src/utils/analytics/sales.ts` (new) | `buildSalesView`, `payments`, `oldCreditByLenden` |
| `src/utils/analytics/customers.ts` (new) | `buildCustomersView`, tier scoring |
| `src/utils/analytics/rehan.ts` (new) | `buildRehanView`, `principalOf` |
| `src/utils/analytics/metal.ts` (new) | `buildMetalView` |
| `src/database/analyticsQueries.ts` (new) | `getAnalyticsData()` — 7 SELECTs |
| `src/components/analytics/BarChart.tsx` (new) | grouped/stacked bars |
| `src/components/analytics/StatTile.tsx` (new) | `StatTile`, `StatGrid`, `AnalyticsCard` |
| `src/components/analytics/{Sales,Customers,Rehan,Metal}Section.tsx` (new) | render one view model each |
| `src/screen/AnalyticsScreen.tsx` (new) | load, section + period state |
| `src/utils/oldJewelleryRegister.ts` (modify) | "This Year" → FY; reuse `roundGrams` |
| `src/types/entry.ts`, `App.tsx`, `src/screen/homeScreen.tsx`, `OldJewelleryRegisterScreen.tsx` (modify) | route + Home card + label |

---

### Task 1: Periods, formatting and row types

**Files:**
- Create: `src/utils/analytics/types.ts`, `src/utils/analytics/periods.ts`, `src/utils/analytics/format.ts`
- Test: `src/utils/analytics/periods.test.ts`, `src/utils/analytics/format.test.ts`

**Interfaces:**
- Produces: `Period`, `Bucket`, `Point`, `fyStartYear`, `fyLabel`, `currentPeriod`, `inPeriod`, `bucketKey`, `buckets`, `series`, `dayNumber`, `daysBetween`, `median`, `sum`; `formatCompactRupees`, `formatGrams`, `roundGrams`; all row types + `AnalyticsData`.

- [ ] **Step 1: Write row types** — `src/utils/analytics/types.ts`

```ts
// Flat rows fetched by analyticsQueries.ts. Pure types so the analytics
// modules stay importable from Jest without expo-sqlite.

export interface UserRow {
  id: number;
  name: string;
}

export interface LendenRow {
  id: number;
  userId: number;
  date: string;
  amount: number | null;
  discount: number | null;
  jama: number | null; // legacy total; duplicates jama_entries when they exist
  baki: number | null;
  status: number | null; // 0 open, 1 closed
}

export interface JamaRow {
  lendenId: number;
  amount: number;
  date: string;
}

export interface RehanRow {
  id: number;
  userId: number;
  openDate: string;
  closedDate: string | null;
  status: number | null;
  amount: number | null; // running balance, not the opening principal
}

export interface RehanTxRow {
  rehanId: number;
  type: string; // "jama" | "diya"
  amount: number;
  date: string;
}

// metal is the raw column: anything but "gold"/"silver" counts as unknown.
export interface SoldItemRow {
  lendenId: number;
  metal: string | null;
  weight: number | null;
  total: number;
}

export interface OldItemRow {
  lendenId: number;
  metal: string | null;
  weight: number | null;
  value: number;
}

export interface AnalyticsData {
  users: UserRow[];
  lenden: LendenRow[];
  jama: JamaRow[];
  rehan: RehanRow[];
  rehanTx: RehanTxRow[];
  soldItems: SoldItemRow[];
  oldItems: OldItemRow[];
}
```

- [ ] **Step 2: Write the failing tests** — `src/utils/analytics/periods.test.ts`

```ts
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
```

- [ ] **Step 3: Write the failing tests** — `src/utils/analytics/format.test.ts`

```ts
import { formatCompactRupees, formatGrams, roundGrams } from "./format";

describe("formatCompactRupees", () => {
  it("uses Indian units", () => {
    expect(formatCompactRupees(950)).toBe("950");
    expect(formatCompactRupees(45000)).toBe("45K");
    expect(formatCompactRupees(182500)).toBe("1.8L");
    expect(formatCompactRupees(12000000)).toBe("1.2Cr");
  });

  it("handles zero and negatives", () => {
    expect(formatCompactRupees(0)).toBe("0");
    expect(formatCompactRupees(-150000)).toBe("-1.5L");
  });
});

describe("formatGrams", () => {
  it("shows grams below a kilo and kilos above", () => {
    expect(formatGrams(12.5)).toBe("12.5 g");
    expect(formatGrams(0)).toBe("0 g");
    expect(formatGrams(1250)).toBe("1.25 kg");
  });
});

describe("roundGrams", () => {
  it("rounds to milligrams", () => {
    expect(roundGrams(0.1 + 0.2)).toBe(0.3);
    expect(roundGrams(1.23456)).toBe(1.235);
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `npx jest src/utils/analytics`
Expected: FAIL — `Cannot find module './periods'` / `'./format'`.

- [ ] **Step 5: Implement** — `src/utils/analytics/periods.ts`

```ts
// Period maths for analytics. Everything is local time: ISO strings are
// stored in UTC, and a 1 a.m. IST sale must not slide into the previous day,
// month or financial year.

export type Period = { kind: "fy"; startYear: number } | { kind: "all" };

export interface Bucket {
  key: string;
  label: string;
}

export interface Point {
  date: string;
  value: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const APRIL = 3;

const pad = (n: number) => String(n).padStart(2, "0");

export const sum = (values: number[]): number =>
  values.reduce((total, value) => total + value, 0);

/** Indian financial year: 1 April starts a new one. */
export const fyStartYear = (date: Date): number =>
  date.getMonth() >= APRIL ? date.getFullYear() : date.getFullYear() - 1;

export const fyLabel = (startYear: number): string =>
  `FY ${startYear}-${pad((startYear + 1) % 100)}`;

export const currentPeriod = (now: Date = new Date()): Period => ({
  kind: "fy",
  startYear: fyStartYear(now),
});

export const inPeriod = (iso: string, period: Period): boolean =>
  period.kind === "all" || fyStartYear(new Date(iso)) === period.startYear;

/** Month key within an FY, or the FY start year for all-time. */
export const bucketKey = (iso: string, period: Period): string => {
  const date = new Date(iso);
  return period.kind === "fy"
    ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
    : String(fyStartYear(date));
};

/** Apr..Mar for an FY; for all-time, one bucket per FY the data spans. */
export const buckets = (period: Period, isos: string[]): Bucket[] => {
  if (period.kind === "fy") {
    return Array.from({ length: 12 }, (_, i) => {
      const month = (APRIL + i) % 12;
      const year = period.startYear + (APRIL + i >= 12 ? 1 : 0);
      return { key: `${year}-${pad(month + 1)}`, label: MONTHS[month] };
    });
  }
  if (isos.length === 0) return [];
  const years = isos.map((iso) => fyStartYear(new Date(iso)));
  const first = years.reduce((a, b) => Math.min(a, b));
  const last = years.reduce((a, b) => Math.max(a, b));
  return Array.from({ length: last - first + 1 }, (_, i) => {
    const year = first + i;
    return { key: String(year), label: `${pad(year % 100)}-${pad((year + 1) % 100)}` };
  });
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

- [ ] **Step 6: Implement** — `src/utils/analytics/format.ts`

```ts
const trim = (value: number, decimals: number): string =>
  String(parseFloat(value.toFixed(decimals)));

/** 182500 -> "1.8L", 45000 -> "45K", 12000000 -> "1.2Cr". For chart axes. */
export const formatCompactRupees = (value: number): string => {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e7) return `${sign}${trim(abs / 1e7, 1)}Cr`;
  if (abs >= 1e5) return `${sign}${trim(abs / 1e5, 1)}L`;
  if (abs >= 1e3) return `${sign}${trim(abs / 1e3, 1)}K`;
  return `${sign}${Math.round(abs)}`;
};

export const formatGrams = (grams: number): string =>
  grams >= 1000 ? `${trim(grams / 1000, 2)} kg` : `${trim(grams, 3)} g`;

// Weights are entered to the milligram; rounding after each sum keeps float
// noise like 0.30000000000000004 out of the UI.
export const roundGrams = (grams: number): number => Math.round(grams * 1000) / 1000;
```

- [ ] **Step 7: Run to verify pass**

Run: `npx jest src/utils/analytics`
Expected: PASS (all periods + format tests).

- [ ] **Step 8: Commit**

```bash
git add src/utils/analytics
git commit -m "Add analytics period, bucket and format helpers"
```

---

### Task 2: Sales view

**Files:**
- Create: `src/utils/analytics/sales.ts`
- Test: `src/utils/analytics/sales.test.ts`

**Interfaces:**
- Consumes: Task 1 (`AnalyticsData`, `Period`, `Point`, `Bucket`, `buckets`, `series`, `inPeriod`, `sum`).
- Produces: `buildSalesView(data: AnalyticsData, period: Period): SalesView`, `payments(data): Point[]`, `oldCreditByLenden(data): Map<number, number>`, types `SalesView`, `BaakiCustomer`.

- [ ] **Step 1: Write the failing test** — `src/utils/analytics/sales.test.ts`

```ts
import { buildSalesView, payments } from "./sales";
import { AnalyticsData, LendenRow } from "./types";

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const FY26 = { kind: "fy", startYear: 2026 } as const;

const lenden = (o: Partial<LendenRow>): LendenRow => ({
  id: 1, userId: 1, date: iso(2026, 5, 10), amount: 0, discount: null,
  jama: null, baki: null, status: 0, ...o,
});

const empty: AnalyticsData = {
  users: [], lenden: [], jama: [], rehan: [], rehanTx: [], soldItems: [], oldItems: [],
};

describe("payments", () => {
  it("uses jama entries by their own date", () => {
    const data = { ...empty, lenden: [lenden({ id: 1, jama: 500 })],
      jama: [{ lendenId: 1, amount: 500, date: iso(2026, 7, 1) }] };
    expect(payments(data)).toEqual([{ date: iso(2026, 7, 1), value: 500 }]);
  });

  it("falls back to legacy lenden.jama at the bill date, never on top of entries", () => {
    const data = { ...empty,
      lenden: [lenden({ id: 1, jama: 300 }), lenden({ id: 2, jama: 800, date: iso(2026, 6, 1) })],
      jama: [{ lendenId: 1, amount: 300, date: iso(2026, 7, 1) }] };
    const result = payments(data);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ date: iso(2026, 6, 1), value: 800 });
  });
});

describe("buildSalesView", () => {
  const data: AnalyticsData = {
    ...empty,
    users: [{ id: 1, name: "Ram" }, { id: 2, name: "Sita" }],
    lenden: [
      lenden({ id: 1, userId: 1, amount: 100000, discount: 1000, baki: 20000, status: 0, date: iso(2026, 4, 5) }),
      lenden({ id: 2, userId: 2, amount: 50000, baki: 0, status: 1, date: iso(2026, 5, 5) }),
      lenden({ id: 3, userId: 2, amount: 9999, baki: 5000, status: 0, date: iso(2025, 5, 5) }),
    ],
    jama: [
      { lendenId: 1, amount: 60000, date: iso(2026, 4, 5) },
      { lendenId: 2, amount: 50000, date: iso(2026, 6, 1) },
    ],
    oldItems: [{ lendenId: 1, metal: "gold", weight: 3, value: 19000 }],
  };
  const view = buildSalesView(data, FY26);

  it("totals sales, deductions and net for bills dated in the FY", () => {
    expect(view.bills).toBe(2);
    expect(view.sales).toBe(150000);
    expect(view.discount).toBe(1000);
    expect(view.oldCredit).toBe(19000);
    expect(view.netSales).toBe(130000);
    expect(view.avgBill).toBe(75000);
  });

  it("counts collections by payment month", () => {
    expect(view.collected).toBe(110000);
    expect(view.collectedSeries[0]).toBe(60000); // Apr
    expect(view.collectedSeries[2]).toBe(50000); // Jun
    expect(view.salesSeries[1]).toBe(50000); // May
  });

  it("reports open baaki as of today regardless of period, top customers first", () => {
    expect(view.baakiOutstanding).toBe(25000);
    expect(view.topBaaki).toEqual([
      { userId: 1, name: "Ram", baki: 20000 },
      { userId: 2, name: "Sita", baki: 5000 },
    ]);
  });

  it("returns zeros, not NaN, with no data", () => {
    const blank = buildSalesView(empty, FY26);
    expect(blank.avgBill).toBe(0);
    expect(blank.sales).toBe(0);
    expect(blank.salesSeries.every((v) => v === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx jest src/utils/analytics/sales` → FAIL, module not found.

- [ ] **Step 3: Implement** — `src/utils/analytics/sales.ts`

```ts
import { AnalyticsData } from "./types";
import { Bucket, Period, Point, buckets, inPeriod, series, sum } from "./periods";

export interface BaakiCustomer {
  userId: number;
  name: string;
  baki: number;
}

export interface SalesView {
  bills: number;
  sales: number; // gross bill value
  oldCredit: number;
  discount: number;
  netSales: number;
  avgBill: number;
  collected: number; // cash by payment date
  baakiOutstanding: number; // open entries, as of today
  topBaaki: BaakiCustomer[];
  buckets: Bucket[];
  salesSeries: number[];
  collectedSeries: number[];
}

export const oldCreditByLenden = (data: AnalyticsData): Map<number, number> => {
  const credit = new Map<number, number>();
  for (const item of data.oldItems) {
    credit.set(item.lendenId, (credit.get(item.lendenId) ?? 0) + item.value);
  }
  return credit;
};

/**
 * Cash received, dated when it arrived. Entries created before jama_entries
 * existed only have the lenden.jama total, so that is used at the bill date;
 * it is never added on top of real entries because it duplicates them.
 */
export const payments = (data: AnalyticsData): Point[] => {
  const hasEntries = new Set(data.jama.map((j) => j.lendenId));
  const points: Point[] = data.jama.map((j) => ({ date: j.date, value: j.amount }));
  for (const entry of data.lenden) {
    const legacy = entry.jama ?? 0;
    if (!hasEntries.has(entry.id) && legacy > 0) {
      points.push({ date: entry.date, value: legacy });
    }
  }
  return points;
};

export const buildSalesView = (data: AnalyticsData, period: Period): SalesView => {
  const bills = data.lenden.filter((entry) => inPeriod(entry.date, period));
  const credit = oldCreditByLenden(data);
  const sales = sum(bills.map((entry) => entry.amount ?? 0));
  const discount = sum(bills.map((entry) => entry.discount ?? 0));
  const oldCredit = sum(bills.map((entry) => credit.get(entry.id) ?? 0));
  const periodPayments = payments(data).filter((p) => inPeriod(p.date, period));

  const names = new Map(data.users.map((u) => [u.id, u.name]));
  const owedByUser = new Map<number, number>();
  for (const entry of data.lenden) {
    const baki = entry.baki ?? 0;
    if ((entry.status ?? 0) === 0 && baki > 0) {
      owedByUser.set(entry.userId, (owedByUser.get(entry.userId) ?? 0) + baki);
    }
  }
  const topBaaki = [...owedByUser]
    .map(([userId, baki]) => ({ userId, name: names.get(userId) ?? "Unknown", baki }))
    .sort((a, b) => b.baki - a.baki)
    .slice(0, 5);

  const bucketList = buckets(period, [
    ...bills.map((entry) => entry.date),
    ...periodPayments.map((p) => p.date),
  ]);

  return {
    bills: bills.length,
    sales,
    oldCredit,
    discount,
    netSales: sales - oldCredit - discount,
    avgBill: bills.length ? Math.round(sales / bills.length) : 0,
    collected: sum(periodPayments.map((p) => p.value)),
    baakiOutstanding: sum([...owedByUser.values()]),
    topBaaki,
    buckets: bucketList,
    salesSeries: series(bucketList, period,
      bills.map((entry) => ({ date: entry.date, value: entry.amount ?? 0 }))),
    collectedSeries: series(bucketList, period, periodPayments),
  };
};
```

- [ ] **Step 4: Run to verify pass** — `npx jest src/utils/analytics/sales` → PASS.

- [ ] **Step 5: Commit** — `git add src/utils/analytics/sales*.ts && git commit -m "Add sales analytics view"`

---

### Task 3: Customers view and tiers

**Files:**
- Create: `src/utils/analytics/customers.ts`
- Test: `src/utils/analytics/customers.test.ts`

**Interfaces:**
- Consumes: Task 1, `oldCreditByLenden` from Task 2.
- Produces: `buildCustomersView(data, period, now?: Date): CustomersView`, `thirdPoints`, `recencyPoints`, `tierFor`, types `Tier`, `CustomerStat`, `GapBin`, `CustomersView`.

- [ ] **Step 1: Write the failing test** — `src/utils/analytics/customers.test.ts`

```ts
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
```

- [ ] **Step 2: Run to verify failure** — `npx jest src/utils/analytics/customers` → FAIL.

- [ ] **Step 3: Implement** — `src/utils/analytics/customers.ts`

```ts
import { AnalyticsData } from "./types";
import { Period, dayNumber, daysBetween, inPeriod, median } from "./periods";
import { oldCreditByLenden } from "./sales";

export type Tier = "good" | "medium" | "low";

export interface CustomerStat {
  userId: number;
  name: string;
  visits: number; // distinct purchase days in the period
  sales: number;
  daysSinceLastVisit: number;
  tier: Tier;
  highBaaki: boolean;
}

export interface GapBin {
  label: string;
  count: number;
}

export interface CustomersView {
  totalCustomers: number;
  activeInPeriod: number;
  newInPeriod: number;
  buyers: number;
  repeatCustomers: number;
  repeatRate: number; // 0..1
  medianGapDays: number | null;
  gapBins: GapBin[];
  tierCounts: Record<Tier, number>;
  customers: CustomerStat[]; // buyers in the period, highest sales first
}

const GAP_BINS = [
  { label: "< 1 mo", maxDays: 29 },
  { label: "1–3 mo", maxDays: 89 },
  { label: "3–6 mo", maxDays: 179 },
  { label: "6–12 mo", maxDays: 365 },
  { label: "> 12 mo", maxDays: Infinity },
];

/** 1–3 points by rank among peers; ties share the higher third. */
export const thirdPoints = (value: number, peers: number[]): 1 | 2 | 3 => {
  const share = peers.filter((p) => p <= value).length / peers.length;
  return share > 2 / 3 ? 3 : share > 1 / 3 ? 2 : 1;
};

export const recencyPoints = (days: number): 1 | 2 | 3 =>
  days <= 90 ? 3 : days <= 365 ? 2 : 1;

export const tierFor = (score: number): Tier =>
  score >= 8 ? "good" : score >= 6 ? "medium" : "low";

const latest = (dates: string[]) =>
  dates.reduce((a, b) => (new Date(a).getTime() >= new Date(b).getTime() ? a : b));
const earliest = (dates: string[]) =>
  dates.reduce((a, b) => (new Date(a).getTime() <= new Date(b).getTime() ? a : b));

export const buildCustomersView = (
  data: AnalyticsData,
  period: Period,
  now: Date = new Date(),
): CustomersView => {
  const names = new Map(data.users.map((u) => [u.id, u.name]));

  // All-time activity of any kind, for active / new / recency.
  const activity = new Map<number, string[]>();
  const record = (userId: number, date: string) =>
    activity.set(userId, [...(activity.get(userId) ?? []), date]);
  data.lenden.forEach((entry) => record(entry.userId, entry.date));
  data.rehan.forEach((entry) => record(entry.userId, entry.openDate));

  let activeInPeriod = 0;
  let newInPeriod = 0;
  for (const dates of activity.values()) {
    if (dates.some((d) => inPeriod(d, period))) activeInPeriod++;
    if (inPeriod(earliest(dates), period)) newInPeriod++;
  }

  // Purchases in the period. Two bills on one day are one visit.
  const purchases = new Map<number, { days: Set<number>; sales: number }>();
  for (const entry of data.lenden) {
    if (!inPeriod(entry.date, period)) continue;
    const p = purchases.get(entry.userId) ?? { days: new Set<number>(), sales: 0 };
    p.days.add(dayNumber(entry.date));
    p.sales += entry.amount ?? 0;
    purchases.set(entry.userId, p);
  }

  const gaps: number[] = [];
  for (const p of purchases.values()) {
    const days = [...p.days].sort((a, b) => a - b);
    for (let i = 1; i < days.length; i++) gaps.push(days[i] - days[i - 1]);
  }
  const gapBins = GAP_BINS.map(({ label }) => ({ label, count: 0 }));
  for (const gap of gaps) gapBins[GAP_BINS.findIndex((b) => gap <= b.maxDays)].count++;

  // High baaki compares open dues with all-time net purchases.
  const credit = oldCreditByLenden(data);
  const net = new Map<number, number>();
  const owed = new Map<number, number>();
  for (const entry of data.lenden) {
    const value = (entry.amount ?? 0) - (entry.discount ?? 0) - (credit.get(entry.id) ?? 0);
    net.set(entry.userId, (net.get(entry.userId) ?? 0) + value);
    if ((entry.status ?? 0) === 0) {
      owed.set(entry.userId, (owed.get(entry.userId) ?? 0) + (entry.baki ?? 0));
    }
  }

  const visitPeers = [...purchases.values()].map((p) => p.days.size);
  const salesPeers = [...purchases.values()].map((p) => p.sales);
  const tooFewToRank = purchases.size < 3;
  const nowIso = now.toISOString();

  const customers: CustomerStat[] = [...purchases]
    .map(([userId, p]) => {
      const daysSinceLastVisit = Math.max(0, daysBetween(latest(activity.get(userId)!), nowIso));
      const tier: Tier = tooFewToRank
        ? "medium"
        : tierFor(
            recencyPoints(daysSinceLastVisit) +
              thirdPoints(p.days.size, visitPeers) +
              thirdPoints(p.sales, salesPeers),
          );
      const netPurchases = net.get(userId) ?? 0;
      return {
        userId,
        name: names.get(userId) ?? "Unknown",
        visits: p.days.size,
        sales: p.sales,
        daysSinceLastVisit,
        tier,
        highBaaki: netPurchases > 0 && (owed.get(userId) ?? 0) > netPurchases * 0.5,
      };
    })
    .sort((a, b) => b.sales - a.sales);

  const repeatCustomers = customers.filter((c) => c.visits >= 2).length;
  const tierCounts: Record<Tier, number> = { good: 0, medium: 0, low: 0 };
  customers.forEach((c) => tierCounts[c.tier]++);

  return {
    totalCustomers: data.users.length,
    activeInPeriod,
    newInPeriod,
    buyers: customers.length,
    repeatCustomers,
    repeatRate: customers.length ? repeatCustomers / customers.length : 0,
    medianGapDays: median(gaps),
    gapBins,
    tierCounts,
    customers,
  };
};
```

Expected tier check (from the test data): buyers C1 (3 visits, 305000, 12 days ago), C2 (2, 40000, 93 days), C3 (1, 10000, 183 days). C1 = 3+3+3 = 9 good; C2 = 2+2+2 = 6 medium; C3 = 2+1+1 = 4 low. ✔

- [ ] **Step 4: Run to verify pass** — `npx jest src/utils/analytics/customers` → PASS.

- [ ] **Step 5: Commit** — `git add src/utils/analytics/customers*.ts && git commit -m "Add customer analytics with repeat gaps and tiers"`

---

### Task 4: Rehan view

**Files:**
- Create: `src/utils/analytics/rehan.ts`
- Test: `src/utils/analytics/rehan.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: `buildRehanView(data, period): RehanView`, `principalOf(rehan: RehanRow, txs: RehanTxRow[]): number`, types `RehanView`, `AnnualRehan`.

- [ ] **Step 1: Write the failing test** — `src/utils/analytics/rehan.test.ts`

```ts
import { buildRehanView, principalOf } from "./rehan";
import { AnalyticsData, RehanRow } from "./types";

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const FY26 = { kind: "fy", startYear: 2026 } as const;
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
```

(`iso(2025,4,1)` → `iso(2026,7,1)` is 456 days; `iso(2025,1,1)` is FY 24-25.)

- [ ] **Step 2: Run to verify failure** — `npx jest src/utils/analytics/rehan` → FAIL.

- [ ] **Step 3: Implement** — `src/utils/analytics/rehan.ts`

```ts
import { AnalyticsData, RehanRow, RehanTxRow } from "./types";
import { Bucket, Period, Point, buckets, daysBetween, inPeriod, median, series, sum } from "./periods";

export interface AnnualRehan {
  label: string;
  given: number;
  recovered: number;
  opened: number;
}

export interface RehanView {
  openCount: number; // as of today
  openBalance: number; // as of today
  opened: number;
  closed: number;
  given: number;
  recovered: number;
  medianDaysToClose: number | null;
  avgDaysToClose: number | null;
  buckets: Bucket[];
  givenSeries: number[];
  recoveredSeries: number[];
  annual: AnnualRehan[];
}

/**
 * The opening amount isn't stored: rehan.amount is a running balance that
 * diya raises and jama lowers. Clamped at 0 because a balance edited by hand
 * on the detail screen can make the reconstruction negative.
 */
export const principalOf = (entry: RehanRow, txs: RehanTxRow[]): number => {
  const diya = sum(txs.filter((t) => t.type === "diya").map((t) => t.amount));
  const jama = sum(txs.filter((t) => t.type === "jama").map((t) => t.amount));
  return Math.max(0, (entry.amount ?? 0) - diya + jama);
};

export const buildRehanView = (data: AnalyticsData, period: Period): RehanView => {
  const txByRehan = new Map<number, RehanTxRow[]>();
  for (const tx of data.rehanTx) {
    txByRehan.set(tx.rehanId, [...(txByRehan.get(tx.rehanId) ?? []), tx]);
  }

  const givenPoints: Point[] = [
    ...data.rehan.map((r) => ({ date: r.openDate, value: principalOf(r, txByRehan.get(r.id) ?? []) })),
    ...data.rehanTx.filter((t) => t.type === "diya").map((t) => ({ date: t.date, value: t.amount })),
  ];
  const recoveredPoints: Point[] = data.rehanTx
    .filter((t) => t.type === "jama")
    .map((t) => ({ date: t.date, value: t.amount }));
  const openedPoints: Point[] = data.rehan.map((r) => ({ date: r.openDate, value: 1 }));

  const inP = (p: Point) => inPeriod(p.date, period);
  const open = data.rehan.filter((r) => (r.status ?? 0) === 0);
  const closed = data.rehan.filter(
    (r): r is RehanRow & { closedDate: string } =>
      r.status === 1 && !!r.closedDate && inPeriod(r.closedDate, period),
  );
  const closeDays = closed
    .map((r) => daysBetween(r.openDate, r.closedDate))
    .filter((d) => d >= 0);

  const bucketList = buckets(period, [...givenPoints, ...recoveredPoints].filter(inP).map((p) => p.date));
  const all: Period = { kind: "all" };
  const annualBuckets = buckets(all, [...givenPoints, ...recoveredPoints].map((p) => p.date));
  const annualGiven = series(annualBuckets, all, givenPoints);
  const annualRecovered = series(annualBuckets, all, recoveredPoints);
  const annualOpened = series(annualBuckets, all, openedPoints);

  return {
    openCount: open.length,
    openBalance: sum(open.map((r) => r.amount ?? 0)),
    opened: openedPoints.filter(inP).length,
    closed: closed.length,
    given: sum(givenPoints.filter(inP).map((p) => p.value)),
    recovered: sum(recoveredPoints.filter(inP).map((p) => p.value)),
    medianDaysToClose: median(closeDays),
    avgDaysToClose: closeDays.length ? Math.round(sum(closeDays) / closeDays.length) : null,
    buckets: bucketList,
    givenSeries: series(bucketList, period, givenPoints),
    recoveredSeries: series(bucketList, period, recoveredPoints),
    annual: annualBuckets.map((b, i) => ({
      label: b.label,
      given: annualGiven[i],
      recovered: annualRecovered[i],
      opened: annualOpened[i],
    })),
  };
};
```

- [ ] **Step 4: Run to verify pass** — `npx jest src/utils/analytics/rehan` → PASS.

- [ ] **Step 5: Commit** — `git add src/utils/analytics/rehan*.ts && git commit -m "Add rehan analytics view"`

---

### Task 5: Metal view

**Files:**
- Create: `src/utils/analytics/metal.ts`
- Test: `src/utils/analytics/metal.test.ts`

**Interfaces:**
- Consumes: Task 1 (`roundGrams` from format).
- Produces: `buildMetalView(data, period): MetalView`, types `MetalView`, `MetalTotals`, `WeightValue`.

- [ ] **Step 1: Write the failing test** — `src/utils/analytics/metal.test.ts`

```ts
import { buildMetalView } from "./metal";
import { AnalyticsData } from "./types";

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const FY26 = { kind: "fy", startYear: 2026 } as const;
const empty: AnalyticsData = {
  users: [], lenden: [], jama: [], rehan: [], rehanTx: [], soldItems: [], oldItems: [],
};
const entry = (id: number, date: string) => ({
  id, userId: 1, date, amount: 0, discount: null, jama: null, baki: null, status: 1,
});

describe("buildMetalView", () => {
  const data: AnalyticsData = {
    ...empty,
    lenden: [entry(1, iso(2026, 4, 5)), entry(2, iso(2026, 5, 5)), entry(3, iso(2025, 5, 5))],
    soldItems: [
      { lendenId: 1, metal: "gold", weight: 10.1, total: 70000 },
      { lendenId: 1, metal: "gold", weight: 0.2, total: 1400 },
      { lendenId: 2, metal: "silver", weight: 250, total: 25000 },
      { lendenId: 2, metal: "Silver", weight: 5, total: 500 }, // unexpected value
      { lendenId: 2, metal: null, weight: null, total: 300 },
      { lendenId: 3, metal: "gold", weight: 99, total: 999999 }, // previous FY
    ],
    oldItems: [
      { lendenId: 1, metal: "gold", weight: 4, value: 20000 },
      { lendenId: 2, metal: null, weight: 2, value: 1000 },
    ],
  };
  const view = buildMetalView(data, FY26);

  it("totals sold weight and value per metal within the FY", () => {
    expect(view.sold.gold).toEqual({ weight: 10.3, value: 71400 });
    expect(view.sold.silver).toEqual({ weight: 250, value: 25000 });
  });

  it("keeps null and unexpected metal values out of gold and silver", () => {
    expect(view.sold.unknown).toEqual({ weight: 5, value: 800 });
    expect(view.received.unknown).toEqual({ weight: 2, value: 1000 });
    expect(view.received.gold).toEqual({ weight: 4, value: 20000 });
  });

  it("builds monthly weight series per metal", () => {
    expect(view.soldGold[0]).toBe(10.3); // Apr
    expect(view.soldSilver[1]).toBe(250); // May
    expect(view.receivedGold[0]).toBe(4);
  });

  it("returns zeros with no data", () => {
    const blank = buildMetalView(empty, FY26);
    expect(blank.sold.gold).toEqual({ weight: 0, value: 0 });
    expect(blank.soldGold.every((v) => v === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx jest src/utils/analytics/metal` → FAIL.

- [ ] **Step 3: Implement** — `src/utils/analytics/metal.ts`

```ts
import { AnalyticsData } from "./types";
import { Bucket, Period, buckets, inPeriod, series } from "./periods";
import { roundGrams } from "./format";

export interface WeightValue {
  weight: number; // grams
  value: number; // rupees
}

export interface MetalTotals {
  gold: WeightValue;
  silver: WeightValue;
  unknown: WeightValue;
}

export interface MetalView {
  sold: MetalTotals;
  received: MetalTotals;
  buckets: Bucket[];
  soldGold: number[];
  soldSilver: number[];
  receivedGold: number[];
  receivedSilver: number[];
}

interface MetalLine {
  date: string;
  metal: keyof MetalTotals;
  weight: number;
  value: number;
}

// Only exact "gold"/"silver" count; anything else must not inflate either.
const metalOf = (raw: string | null): keyof MetalTotals =>
  raw === "gold" || raw === "silver" ? raw : "unknown";

const totalsOf = (lines: MetalLine[]): MetalTotals => {
  const totals: MetalTotals = {
    gold: { weight: 0, value: 0 },
    silver: { weight: 0, value: 0 },
    unknown: { weight: 0, value: 0 },
  };
  for (const line of lines) {
    const t = totals[line.metal];
    t.weight = roundGrams(t.weight + line.weight);
    t.value += line.value;
  }
  return totals;
};

export const buildMetalView = (data: AnalyticsData, period: Period): MetalView => {
  const dateOf = new Map(data.lenden.map((entry) => [entry.id, entry.date]));
  const toLines = (rows: { lendenId: number; metal: string | null; weight: number | null }[],
    valueOf: (i: number) => number): MetalLine[] =>
    rows.flatMap((row, i) => {
      const date = dateOf.get(row.lendenId);
      if (!date || !inPeriod(date, period)) return [];
      return [{ date, metal: metalOf(row.metal), weight: row.weight ?? 0, value: valueOf(i) }];
    });

  const sold = toLines(data.soldItems, (i) => data.soldItems[i].total);
  const received = toLines(data.oldItems, (i) => data.oldItems[i].value);
  const bucketList = buckets(period, [...sold, ...received].map((l) => l.date));
  const weightSeries = (lines: MetalLine[], metal: keyof MetalTotals) =>
    series(bucketList, period,
      lines.filter((l) => l.metal === metal).map((l) => ({ date: l.date, value: l.weight })),
    ).map(roundGrams);

  return {
    sold: totalsOf(sold),
    received: totalsOf(received),
    buckets: bucketList,
    soldGold: weightSeries(sold, "gold"),
    soldSilver: weightSeries(sold, "silver"),
    receivedGold: weightSeries(received, "gold"),
    receivedSilver: weightSeries(received, "silver"),
  };
};
```

- [ ] **Step 4: Run to verify pass** — `npx jest src/utils/analytics/metal` → PASS.

- [ ] **Step 5: Commit** — `git add src/utils/analytics/metal*.ts && git commit -m "Add metal analytics view"`

---

### Task 6: Query, chart components, sections and screen

**Files:**
- Create: `src/database/analyticsQueries.ts`, `src/components/analytics/BarChart.tsx`, `src/components/analytics/StatTile.tsx`, `src/components/analytics/SalesSection.tsx`, `src/components/analytics/CustomersSection.tsx`, `src/components/analytics/RehanSection.tsx`, `src/components/analytics/MetalSection.tsx`, `src/screen/AnalyticsScreen.tsx`
- Modify: `src/types/entry.ts` (`Analytics: undefined` in `RootStackParamList`), `App.tsx` (register screen), `src/screen/homeScreen.tsx` (card)

**Interfaces:**
- Consumes: every `build*View` from Tasks 2–5; `Period`, `currentPeriod`, `fyLabel` from Task 1; `formatCompactRupees`, `formatGrams`; `formatRupees` from `src/utils/billFormat.ts`.
- Produces: `getAnalyticsData(): Promise<AnalyticsData>`; route `Analytics`.

UI is not unit-testable here (Jest runs `.ts` in node only); verification is `tsc` plus the device checklist in Task 8.

- [ ] **Step 1: Query** — `src/database/analyticsQueries.ts`

```ts
import * as SQLite from "expo-sqlite";
import {
  AnalyticsData,
  JamaRow,
  LendenRow,
  OldItemRow,
  RehanRow,
  RehanTxRow,
  SoldItemRow,
  UserRow,
} from "../utils/analytics/types";

// entryDatabase.ts owns schema creation; this module only reads.
let db: SQLite.SQLiteDatabase | null = null;

const openDatabase = async () => {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("aj_database.db");
  return db;
};

/** Flat rows for every analytics section; only the columns the views need. */
export const getAnalyticsData = async (): Promise<AnalyticsData> => {
  const database = await openDatabase();
  return {
    users: await database.getAllAsync<UserRow>("SELECT id, name FROM users"),
    lenden: await database.getAllAsync<LendenRow>(
      "SELECT id, userId, date, amount, discount, jama, baki, status FROM lenden",
    ),
    jama: await database.getAllAsync<JamaRow>("SELECT lendenId, amount, date FROM jama_entries"),
    rehan: await database.getAllAsync<RehanRow>(
      "SELECT id, userId, openDate, closedDate, status, amount FROM rehan",
    ),
    rehanTx: await database.getAllAsync<RehanTxRow>(
      "SELECT rehanId, type, amount, date FROM rehan_transactions",
    ),
    soldItems: await database.getAllAsync<SoldItemRow>(
      "SELECT lendenId, metal, weight, total FROM lenden_items",
    ),
    oldItems: await database.getAllAsync<OldItemRow>(
      "SELECT lendenId, metal, weight, value FROM lenden_old_jewellery_items",
    ),
  };
};
```

- [ ] **Step 2: Bar chart** — `src/components/analytics/BarChart.tsx`

```tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Bucket } from "../../utils/analytics/periods";

export interface ChartSeries {
  label: string;
  color: string;
  values: number[];
}

interface BarChartProps {
  buckets: Bucket[];
  series: ChartSeries[];
  stacked?: boolean;
  formatValue: (value: number) => string;
  height?: number;
}

const BarChart: React.FC<BarChartProps> = ({
  buckets,
  series,
  stacked = false,
  formatValue,
  height = 140,
}) => {
  const columnTotals = buckets.map((_, i) =>
    stacked
      ? series.reduce((total, s) => total + s.values[i], 0)
      : Math.max(0, ...series.map((s) => s.values[i])),
  );
  const max = Math.max(0, ...columnTotals);

  if (max <= 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No data for this period</Text>
      </View>
    );
  }

  const barHeight = (value: number) => (value > 0 ? Math.max(2, (value / max) * height) : 0);

  return (
    <View>
      <Text style={styles.maxLabel}>{formatValue(max)}</Text>
      <View style={[styles.plot, { height }]}>
        {buckets.map((bucket, i) => (
          <View key={bucket.key} style={styles.column}>
            <View style={stacked ? styles.stack : styles.group}>
              {series.map((s) => (
                <View
                  key={s.label}
                  style={[
                    stacked ? styles.stackSegment : styles.bar,
                    { height: barHeight(s.values[i]), backgroundColor: s.color },
                  ]}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
      <View style={styles.labels}>
        {buckets.map((bucket) => (
          <Text key={bucket.key} style={styles.label} numberOfLines={1}>
            {bucket.label}
          </Text>
        ))}
      </View>
      {series.length > 1 && (
        <View style={styles.legend}>
          {series.map((s) => (
            <View key={s.label} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: s.color }]} />
              <Text style={styles.legendText}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  maxLabel: { fontSize: 11, color: "#999", marginBottom: 4 },
  plot: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  column: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  group: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  stack: { flexDirection: "column-reverse", alignItems: "center" },
  bar: { width: 7, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  stackSegment: { width: 14 },
  labels: { flexDirection: "row", marginTop: 4 },
  label: { flex: 1, fontSize: 9, color: "#777", textAlign: "center" },
  legend: { flexDirection: "row", gap: 14, marginTop: 10, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 12, color: "#555" },
  empty: { paddingVertical: 32, alignItems: "center" },
  emptyText: { color: "#999", fontSize: 13 },
});

export default BarChart;
```

- [ ] **Step 3: Tiles and cards** — `src/components/analytics/StatTile.tsx`

```tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export type TileTone = "default" | "good" | "warn" | "gold" | "silver";

const TONES: Record<TileTone, { bg: string; fg: string }> = {
  default: { bg: "#fff", fg: "#1A1A1A" },
  good: { bg: "#EEF8EF", fg: "#2E7D32" },
  warn: { bg: "#FDF0F0", fg: "#C62828" },
  gold: { bg: "#FFF8E8", fg: "#8A6500" },
  silver: { bg: "#F3F5F8", fg: "#4A5562" },
};

export const StatTile: React.FC<{
  label: string;
  value: string;
  hint?: string;
  tone?: TileTone;
}> = ({ label, value, hint, tone = "default" }) => (
  <View style={[styles.tile, { backgroundColor: TONES[tone].bg }]}>
    <Text style={styles.tileLabel}>{label}</Text>
    <Text style={[styles.tileValue, { color: TONES[tone].fg }]} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
    {hint ? <Text style={styles.tileHint}>{hint}</Text> : null}
  </View>
);

export const StatGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.grid}>{children}</View>
);

export const AnalyticsCard: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{title}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  tile: {
    width: "48%",
    flexGrow: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEF0F2",
  },
  tileLabel: {
    fontSize: 11,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tileValue: { fontSize: 19, fontWeight: "800" },
  tileHint: { fontSize: 11, color: "#999", marginTop: 3 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EEF0F2",
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1A1A1A", marginBottom: 10 },
});
```

- [ ] **Step 4: Sales section** — `src/components/analytics/SalesSection.tsx`

```tsx
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SalesView } from "../../utils/analytics/sales";
import { formatCompactRupees } from "../../utils/analytics/format";
import { formatRupees } from "../../utils/billFormat";
import BarChart from "./BarChart";
import { AnalyticsCard, StatGrid, StatTile } from "./StatTile";

const SalesSection: React.FC<{
  view: SalesView;
  onCustomerPress: (userId: number, name: string) => void;
}> = ({ view, onCustomerPress }) => (
  <View>
    <StatGrid>
      <StatTile label="Sales" value={formatRupees(view.sales)} hint={`${view.bills} bills`} tone="gold" />
      <StatTile label="Collected" value={formatRupees(view.collected)} hint="by payment date" tone="good" />
      <StatTile
        label="Net sales"
        value={formatRupees(view.netSales)}
        hint={`after old ${formatCompactRupees(view.oldCredit)} · discount ${formatCompactRupees(view.discount)}`}
      />
      <StatTile label="Avg bill" value={formatRupees(view.avgBill)} />
      <StatTile label="Baaki (open)" value={formatRupees(view.baakiOutstanding)} hint="as of today" tone="warn" />
    </StatGrid>

    <AnalyticsCard title="Sales vs collected">
      <BarChart
        buckets={view.buckets}
        series={[
          { label: "Sales", color: "#B8860B", values: view.salesSeries },
          { label: "Collected", color: "#2E7D32", values: view.collectedSeries },
        ]}
        formatValue={formatCompactRupees}
      />
    </AnalyticsCard>

    <AnalyticsCard title="Highest baaki">
      {view.topBaaki.length === 0 ? (
        <Text style={styles.muted}>No open baaki</Text>
      ) : (
        view.topBaaki.map((c) => (
          <TouchableOpacity key={c.userId} style={styles.row} onPress={() => onCustomerPress(c.userId, c.name)}>
            <Text style={styles.name}>{c.name}</Text>
            <Text style={styles.baki}>{formatRupees(c.baki)}</Text>
          </TouchableOpacity>
        ))
      )}
    </AnalyticsCard>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F5",
  },
  name: { fontSize: 15, color: "#1A1A1A", fontWeight: "600" },
  baki: { fontSize: 15, color: "#C62828", fontWeight: "700" },
  muted: { color: "#999", fontSize: 13 },
});

export default SalesSection;
```

- [ ] **Step 5: Customers section** — `src/components/analytics/CustomersSection.tsx`

```tsx
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CustomersView, Tier } from "../../utils/analytics/customers";
import { formatRupees } from "../../utils/billFormat";
import { AnalyticsCard, StatGrid, StatTile } from "./StatTile";

const TIERS: { key: Tier; label: string; color: string }[] = [
  { key: "good", label: "Good", color: "#2E7D32" },
  { key: "medium", label: "Medium", color: "#F9A825" },
  { key: "low", label: "Low", color: "#9E9E9E" },
];

const CustomersSection: React.FC<{
  view: CustomersView;
  onCustomerPress: (userId: number, name: string) => void;
}> = ({ view, onCustomerPress }) => {
  const [tier, setTier] = useState<Tier>("good");
  const maxGap = Math.max(1, ...view.gapBins.map((b) => b.count));
  const listed = view.customers.filter((c) => c.tier === tier).slice(0, 25);

  return (
    <View>
      <StatGrid>
        <StatTile label="Customers" value={String(view.totalCustomers)} hint="all time" />
        <StatTile label="Active" value={String(view.activeInPeriod)} hint={`${view.newInPeriod} new`} tone="good" />
        <StatTile label="Buyers" value={String(view.buyers)} />
        <StatTile
          label="Repeat"
          value={`${Math.round(view.repeatRate * 100)}%`}
          hint={`${view.repeatCustomers} came back`}
          tone="gold"
        />
      </StatGrid>

      <AnalyticsCard title="Time before buying again">
        <Text style={styles.muted}>
          {view.medianGapDays === null
            ? "No repeat purchases yet"
            : `Typical gap: ${Math.round(view.medianGapDays)} days`}
        </Text>
        {view.gapBins.map((bin) => (
          <View key={bin.label} style={styles.gapRow}>
            <Text style={styles.gapLabel}>{bin.label}</Text>
            <View style={styles.gapTrack}>
              <View style={[styles.gapFill, { flex: bin.count / maxGap }]} />
              <View style={{ flex: 1 - bin.count / maxGap }} />
            </View>
            <Text style={styles.gapCount}>{bin.count}</Text>
          </View>
        ))}
      </AnalyticsCard>

      <AnalyticsCard title="Customer nature">
        {view.buyers > 0 && (
          <View style={styles.tierBar}>
            {TIERS.map((t) =>
              view.tierCounts[t.key] > 0 ? (
                <View key={t.key} style={{ flex: view.tierCounts[t.key], backgroundColor: t.color }} />
              ) : null,
            )}
          </View>
        )}
        <View style={styles.chips}>
          {TIERS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.chip, tier === t.key && { backgroundColor: t.color, borderColor: t.color }]}
              onPress={() => setTier(t.key)}
            >
              <Text style={[styles.chipText, tier === t.key && styles.chipTextActive]}>
                {t.label} · {view.tierCounts[t.key]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {listed.length === 0 ? (
          <Text style={styles.muted}>No customers in this group</Text>
        ) : (
          listed.map((c) => (
            <TouchableOpacity key={c.userId} style={styles.row} onPress={() => onCustomerPress(c.userId, c.name)}>
              <View style={styles.rowMain}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.sub}>
                  {c.visits} {c.visits === 1 ? "visit" : "visits"} · last {c.daysSinceLastVisit} days ago
                </Text>
              </View>
              {c.highBaaki && <Text style={styles.baakiBadge}>High baaki</Text>}
              <Text style={styles.sales}>{formatRupees(c.sales)}</Text>
            </TouchableOpacity>
          ))
        )}
        <Text style={styles.footnote}>
          Score = recent visit + how often + how much, compared with your other customers.
        </Text>
      </AnalyticsCard>
    </View>
  );
};

const styles = StyleSheet.create({
  muted: { color: "#777", fontSize: 13, marginBottom: 8 },
  gapRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  gapLabel: { width: 58, fontSize: 12, color: "#555" },
  gapTrack: { flex: 1, height: 10, flexDirection: "row", backgroundColor: "#F2F2F2", borderRadius: 5, overflow: "hidden" },
  gapFill: { backgroundColor: "#B8860B" },
  gapCount: { width: 28, textAlign: "right", fontSize: 12, color: "#333", fontWeight: "700" },
  tierBar: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 12 },
  chips: { flexDirection: "row", gap: 8, marginBottom: 8 },
  chip: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: "#DDD" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#555" },
  chipTextActive: { color: "#fff" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F2F5" },
  rowMain: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600", color: "#1A1A1A" },
  sub: { fontSize: 12, color: "#888", marginTop: 2 },
  sales: { fontSize: 14, fontWeight: "700", color: "#7C4A08" },
  baakiBadge: { fontSize: 10, fontWeight: "700", color: "#C62828", backgroundColor: "#FDF0F0", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden" },
  footnote: { fontSize: 11, color: "#999", marginTop: 10 },
});

export default CustomersSection;
```

- [ ] **Step 6: Rehan section** — `src/components/analytics/RehanSection.tsx`

```tsx
import React from "react";
import { View } from "react-native";
import { RehanView } from "../../utils/analytics/rehan";
import { formatCompactRupees } from "../../utils/analytics/format";
import { formatRupees } from "../../utils/billFormat";
import BarChart from "./BarChart";
import { AnalyticsCard, StatGrid, StatTile } from "./StatTile";

const GIVEN = "#E65100";
const RECOVERED = "#2E7D32";

const RehanSection: React.FC<{ view: RehanView }> = ({ view }) => (
  <View>
    <StatGrid>
      <StatTile label="Open rehan" value={String(view.openCount)} hint="as of today" />
      <StatTile label="Open balance" value={formatRupees(view.openBalance)} hint="as of today" tone="warn" />
      <StatTile label="Given" value={formatRupees(view.given)} hint={`${view.opened} opened`} tone="gold" />
      <StatTile label="Recovered" value={formatRupees(view.recovered)} hint={`${view.closed} closed`} tone="good" />
      <StatTile
        label="Days to close"
        value={view.medianDaysToClose === null ? "—" : String(Math.round(view.medianDaysToClose))}
        hint={view.avgDaysToClose === null ? "no closed rehan" : `typical · avg ${view.avgDaysToClose}`}
      />
    </StatGrid>

    <AnalyticsCard title="Given vs recovered">
      <BarChart
        buckets={view.buckets}
        series={[
          { label: "Given", color: GIVEN, values: view.givenSeries },
          { label: "Recovered", color: RECOVERED, values: view.recoveredSeries },
        ]}
        formatValue={formatCompactRupees}
      />
    </AnalyticsCard>

    <AnalyticsCard title="Year by year">
      <BarChart
        buckets={view.annual.map((a) => ({ key: a.label, label: a.label }))}
        series={[
          { label: "Given", color: GIVEN, values: view.annual.map((a) => a.given) },
          { label: "Recovered", color: RECOVERED, values: view.annual.map((a) => a.recovered) },
        ]}
        formatValue={formatCompactRupees}
      />
    </AnalyticsCard>
  </View>
);

export default RehanSection;
```

- [ ] **Step 7: Metal section** — `src/components/analytics/MetalSection.tsx`

```tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { MetalView, WeightValue } from "../../utils/analytics/metal";
import { formatGrams } from "../../utils/analytics/format";
import { formatRupees } from "../../utils/billFormat";
import BarChart from "./BarChart";
import { AnalyticsCard, StatGrid, StatTile } from "./StatTile";

const GOLD = "#D4A017";
const SILVER = "#9AA5B1";

const tileHint = (t: WeightValue) => formatRupees(t.value);

const MetalSection: React.FC<{ view: MetalView }> = ({ view }) => (
  <View>
    <StatGrid>
      <StatTile label="Gold sold" value={formatGrams(view.sold.gold.weight)} hint={tileHint(view.sold.gold)} tone="gold" />
      <StatTile label="Silver sold" value={formatGrams(view.sold.silver.weight)} hint={tileHint(view.sold.silver)} tone="silver" />
      <StatTile label="Old gold in" value={formatGrams(view.received.gold.weight)} hint={tileHint(view.received.gold)} tone="gold" />
      <StatTile label="Old silver in" value={formatGrams(view.received.silver.weight)} hint={tileHint(view.received.silver)} tone="silver" />
    </StatGrid>

    {(view.sold.unknown.value > 0 || view.received.unknown.value > 0) && (
      <Text style={styles.note}>
        Not counted above (metal not set): sold {formatRupees(view.sold.unknown.value)}, old received{" "}
        {formatRupees(view.received.unknown.value)}.
      </Text>
    )}

    <AnalyticsCard title="New jewellery sold (weight)">
      <BarChart
        stacked
        buckets={view.buckets}
        series={[
          { label: "Gold", color: GOLD, values: view.soldGold },
          { label: "Silver", color: SILVER, values: view.soldSilver },
        ]}
        formatValue={formatGrams}
      />
    </AnalyticsCard>

    <AnalyticsCard title="Old jewellery received (weight)">
      <BarChart
        stacked
        buckets={view.buckets}
        series={[
          { label: "Gold", color: GOLD, values: view.receivedGold },
          { label: "Silver", color: SILVER, values: view.receivedSilver },
        ]}
        formatValue={formatGrams}
      />
    </AnalyticsCard>
  </View>
);

const styles = StyleSheet.create({
  note: { fontSize: 12, color: "#7A4545", backgroundColor: "#FDF3F3", padding: 10, borderRadius: 10, marginBottom: 14 },
});

export default MetalSection;
```

Note: silver and gold share one stacked axis in grams. Silver sells in far larger weights, so gold can look small; the tiles give exact numbers. Acceptable for v1 (spec §6.5).

- [ ] **Step 8: Screen** — `src/screen/AnalyticsScreen.tsx`

```tsx
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "../types/entry";
import { getAnalyticsData } from "../database/analyticsQueries";
import { AnalyticsData } from "../utils/analytics/types";
import { Period, currentPeriod, fyLabel } from "../utils/analytics/periods";
import { buildSalesView } from "../utils/analytics/sales";
import { buildCustomersView } from "../utils/analytics/customers";
import { buildRehanView } from "../utils/analytics/rehan";
import { buildMetalView } from "../utils/analytics/metal";
import SalesSection from "../components/analytics/SalesSection";
import CustomersSection from "../components/analytics/CustomersSection";
import RehanSection from "../components/analytics/RehanSection";
import MetalSection from "../components/analytics/MetalSection";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Analytics">;
};

const SECTIONS = ["Sales", "Customers", "Rehan", "Metal"] as const;
type Section = (typeof SECTIONS)[number];

const AnalyticsScreen: React.FC<Props> = ({ navigation }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [failed, setFailed] = useState(false);
  const [section, setSection] = useState<Section>("Sales");
  const latestFy = currentPeriod();
  const [period, setPeriod] = useState<Period>(latestFy);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getAnalyticsData()
        .then((result) => {
          if (!active) return;
          setData(result);
          setFailed(false);
        })
        .catch((error) => {
          console.error("Error loading analytics:", error);
          if (active) setFailed(true);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  // Only the visible section is computed.
  const content = useMemo(() => {
    if (!data) return null;
    const openCustomer = (userId: number, userName: string) =>
      navigation.navigate("UserTransactions", { userId, userName });
    switch (section) {
      case "Sales":
        return <SalesSection view={buildSalesView(data, period)} onCustomerPress={openCustomer} />;
      case "Customers":
        return <CustomersSection view={buildCustomersView(data, period)} onCustomerPress={openCustomer} />;
      case "Rehan":
        return <RehanSection view={buildRehanView(data, period)} />;
      case "Metal":
        return <MetalSection view={buildMetalView(data, period)} />;
    }
  }, [data, period, section, navigation]);

  const shiftYear = (delta: number) =>
    period.kind === "fy" && setPeriod({ kind: "fy", startYear: period.startYear + delta });
  const atLatest = period.kind === "fy" && latestFy.kind === "fy" && period.startYear >= latestFy.startYear;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.segment}>
          {SECTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.segmentItem, section === s && styles.segmentActive]}
              onPress={() => setSection(s)}
            >
              <Text style={[styles.segmentText, section === s && styles.segmentTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.periodRow}>
          {period.kind === "fy" ? (
            <>
              <TouchableOpacity onPress={() => shiftYear(-1)} style={styles.arrow}>
                <Ionicons name="chevron-back" size={20} color="#8C5B14" />
              </TouchableOpacity>
              <Text style={styles.periodLabel}>{fyLabel(period.startYear)}</Text>
              <TouchableOpacity onPress={() => shiftYear(1)} style={styles.arrow} disabled={atLatest}>
                <Ionicons name="chevron-forward" size={20} color={atLatest ? "#DDD" : "#8C5B14"} />
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.periodLabel}>All time</Text>
          )}
          <TouchableOpacity
            style={[styles.allChip, period.kind === "all" && styles.allChipActive]}
            onPress={() => setPeriod(period.kind === "all" ? latestFy : { kind: "all" })}
          >
            <Text style={[styles.allText, period.kind === "all" && styles.allTextActive]}>All time</Text>
          </TouchableOpacity>
        </View>
      </View>

      {failed ? (
        <View style={styles.centered}>
          <Text style={styles.error}>Could not load analytics. Go back and try again.</Text>
        </View>
      ) : !data ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#8C5B14" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>{content}</ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  header: { padding: 16, paddingBottom: 8, backgroundColor: "#F8F9FA" },
  segment: { flexDirection: "row", backgroundColor: "#EFE6D6", borderRadius: 12, padding: 3 },
  segmentItem: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  segmentActive: { backgroundColor: "#fff" },
  segmentText: { fontSize: 13, fontWeight: "700", color: "#8C5B14" },
  segmentTextActive: { color: "#1A1A1A" },
  periodRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  arrow: { padding: 6 },
  periodLabel: { fontSize: 16, fontWeight: "800", color: "#1A1A1A", marginHorizontal: 4 },
  allChip: { marginLeft: "auto", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1.5, borderColor: "#E8D5AF" },
  allChipActive: { backgroundColor: "#8C5B14", borderColor: "#8C5B14" },
  allText: { fontSize: 12, fontWeight: "700", color: "#8C5B14" },
  allTextActive: { color: "#fff" },
  content: { padding: 16, paddingTop: 8, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: "#C62828", fontSize: 14, textAlign: "center" },
});

export default AnalyticsScreen;
```

- [ ] **Step 9: Route + Home card**

`src/types/entry.ts` — in `RootStackParamList`, after `OldJewelleryRegister: undefined;`:
```ts
  Analytics: undefined;
```

`App.tsx` — import after the register import, and register after the `OldJewelleryRegister` screen:
```tsx
import AnalyticsScreen from "./src/screen/AnalyticsScreen";
```
```tsx
          <Stack.Screen
            name="Analytics"
            component={AnalyticsScreen}
            options={{ title: "Analytics" }}
          />
```

`src/screen/homeScreen.tsx` — after the Old Jewellery card:
```tsx
            <TouchableOpacity
              style={[styles.card, styles.cardBhav]}
              onPress={() => navigation.navigate("Analytics")}
              activeOpacity={0.9}
            >
              <View style={[styles.cardIconContainer, styles.iconContainerAnalytics]}>
                <Ionicons name="bar-chart" size={32} color="#2E7D32" />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, styles.textDark]}>Analytics</Text>
                <Text style={[styles.cardSubtitle, styles.textDarkDim]}>
                  Sales, customers, rehan & metal
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#2E7D32" />
            </TouchableOpacity>
```
and in styles, after `iconContainerOld`:
```ts
  iconContainerAnalytics: {
    backgroundColor: "#EEF8EF",
  },
```

- [ ] **Step 10: Typecheck** — `npx tsc --noEmit` → no output, exit 0.

- [ ] **Step 11: Commit**

```bash
git add src/database/analyticsQueries.ts src/components/analytics src/screen/AnalyticsScreen.tsx src/types/entry.ts App.tsx src/screen/homeScreen.tsx
git commit -m "Add Analytics screen with sales, customers, rehan and metal sections"
```

---

### Task 7: Register uses the financial year

**Files:**
- Modify: `src/utils/oldJewelleryRegister.ts`, `src/utils/oldJewelleryRegister.test.ts`, `src/screen/OldJewelleryRegisterScreen.tsx`

**Interfaces:**
- Consumes: `fyStartYear` (Task 1), `roundGrams` (Task 1).
- Produces: unchanged API; `period: "year"` now means the current FY.

- [ ] **Step 1: Update the test** — in `src/utils/oldJewelleryRegister.test.ts` replace the calendar-year test:

```ts
  it("limits to the current financial year (Apr–Mar)", () => {
    expect(ids(filterRegister(rows, { metal: "all", period: "year" }, NOW))).toEqual([
      1, 2,
    ]);
  });
```
(Row 3 is 1 Jan 2026 = FY 2025-26; NOW is 2 Oct 2026 = FY 2026-27.)

- [ ] **Step 2: Run to verify failure** — `npx jest src/utils/oldJewelleryRegister` → FAIL (returns `[1, 2, 3]`).

- [ ] **Step 3: Implement** — in `src/utils/oldJewelleryRegister.ts`:
  - add imports:
    ```ts
    import { fyStartYear } from "./analytics/periods";
    import { roundGrams } from "./analytics/format";
    ```
  - delete the local `roundGrams` const and its comment;
  - replace `inPeriod` with:
    ```ts
    // "year" is the Indian financial year, matching Analytics.
    const inPeriod = (dateString: string, period: RegisterPeriod, now: Date) => {
      if (period === "all") return true;
      const date = new Date(dateString);
      if (period === "year") return fyStartYear(date) === fyStartYear(now);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    };
    ```

- [ ] **Step 4: Label** — in `src/screen/OldJewelleryRegisterScreen.tsx` change `{ key: "year", label: "This Year" }` to `{ key: "year", label: "This FY" }`.

- [ ] **Step 5: Run** — `npx jest src/utils/oldJewelleryRegister && npx tsc --noEmit` → PASS, no errors.

- [ ] **Step 6: Commit** — `git commit -am "Use the financial year in the Old Jewellery register"`

---

### Task 8: Full verification and docs

- [ ] **Step 1:** `npx jest` → all suites pass. `npx tsc --noEmit` → exit 0.
- [ ] **Step 2:** Append an "Implementation notes" section to `agent/2026-10-02-analytics-design.md` listing any deviations made during implementation (or "none").
- [ ] **Step 3: Device checklist** (owner):
  1. Home → Analytics opens on Sales for the current FY; ◀ goes back a year, ▶ is disabled at the current FY; All time switches the charts to per-year bars.
  2. Sales: the figure matches a hand sum of this FY's bill totals; Collected for one known month matches the jama entries dated in that month.
  3. Customers: a known regular appears as Good; tapping a row opens their transactions.
  4. Rehan: open count equals open rehan in the customer list.
  5. Metal: gold sold grams for one month matches the items on that month's bills.
- [ ] **Step 4: Commit** — `git commit -am "Note analytics implementation deviations"`

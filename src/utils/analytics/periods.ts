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

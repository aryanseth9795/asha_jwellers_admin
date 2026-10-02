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

import { PledgeRow } from "./pledges";
import { median, sum, toTime } from "../periods";

export interface PledgeStats {
  pledges: number;
  open: number;
  redeemed: number;
  principal: number;
  openBook: number;
  redeemedPrincipal: number;
  customers: number;
  avgPledge: number;
  medianPledge: number;
  redeemedPct: number; // 0..1
  medianDaysToRedeem: number | null;
  meanDaysToRedeem: number | null;
  openYearPlus: number; // open principal a year old or more
  openYearPlusShare: number; // of the open book, 0..1
  largestPledge: number;
}

export interface MonthPoint {
  key: string; // "2026-01"
  label: string; // "Jan 26"
  opened: number;
  openedCount: number;
  redeemed: number;
  redeemedCount: number;
  openAtEnd: number; // principal still open at month-end
}

export interface CountBucket {
  label: string;
  count: number;
  principal: number;
}

export interface Cohort {
  year: string;
  pledges: number;
  principal: number;
  stillOpen: number;
  redeemedPct: number;
  medianDaysToRedeem: number | null;
  avgPledge: number;
}

export interface InterestWhatIf {
  perMonth: number;
  perYear: number;
  accrued: number; // simple interest on open pledges to date
}

export interface LoggingGap {
  from: string; // "2024-10"
  to: string;
  months: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-01" → "Jan 26" */
export const monthLabel = (key: string): string =>
  `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`;

/** "2026-01" → "Jan 2026" */
export const monthLabelLong = (key: string): string =>
  `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

const monthKeysBetween = (first: string, last: string): string[] => {
  const keys: string[] = [];
  let y = Number(first.slice(0, 4));
  let m = Number(first.slice(5, 7));
  const endY = Number(last.slice(0, 4));
  const endM = Number(last.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    keys.push(`${y}-${pad(m)}`);
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return keys;
};

export const pledgeStats = (rows: PledgeRow[]): PledgeStats => {
  const open = rows.filter((r) => r.open);
  const principals = rows.map((r) => r.principal);
  const principal = sum(principals);
  const openBook = sum(open.map((r) => r.principal));
  const redeemDays = rows.filter((r) => r.daysToRedeem !== null).map((r) => r.daysToRedeem as number);
  const openYearPlus = sum(open.filter((r) => (r.daysOpen ?? 0) >= 365).map((r) => r.principal));
  return {
    pledges: rows.length,
    open: open.length,
    redeemed: rows.length - open.length,
    principal,
    openBook,
    redeemedPrincipal: principal - openBook,
    customers: new Set(rows.map((r) => r.userId)).size,
    avgPledge: rows.length ? principal / rows.length : 0,
    medianPledge: median(principals) ?? 0,
    redeemedPct: rows.length ? (rows.length - open.length) / rows.length : 0,
    medianDaysToRedeem: median(redeemDays),
    meanDaysToRedeem: redeemDays.length ? sum(redeemDays) / redeemDays.length : null,
    openYearPlus,
    openYearPlusShare: openBook ? openYearPlus / openBook : 0,
    largestPledge: principals.reduce((a, b) => Math.max(a, b), 0),
  };
};

/** Opened, redeemed and still-open principal for every month from the first pledge to now. */
export const monthlyBook = (rows: PledgeRow[], now: Date): MonthPoint[] => {
  if (rows.length === 0) return [];
  const first = rows.map((r) => r.month).sort()[0];
  const last = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  return monthKeysBetween(first, last > first ? last : first).map((key) => {
    const y = Number(key.slice(0, 4));
    const m = Number(key.slice(5, 7)) - 1;
    const start = new Date(y, m, 1).getTime();
    const end = new Date(y, m + 1, 1).getTime();
    const opened = rows.filter((r) => r.month === key);
    const redeemed = rows.filter(
      (r) => !r.open && r.closedDate && toTime(r.closedDate) >= start && toTime(r.closedDate) < end,
    );
    const openAtEnd = rows.filter(
      (r) => toTime(r.openDate) < end && (r.open || !r.closedDate || toTime(r.closedDate) >= end),
    );
    return {
      key,
      label: monthLabel(key),
      opened: sum(opened.map((r) => r.principal)),
      openedCount: opened.length,
      redeemed: sum(redeemed.map((r) => r.principal)),
      redeemedCount: redeemed.length,
      openAtEnd: sum(openAtEnd.map((r) => r.principal)),
    };
  });
};

export const AGE_LABELS = ["≤3 mo", "3–6 mo", "6–12 mo", "1–2 yr", "2 yr +"];
const AGE_MAX_DAYS = [91, 182, 364, 729, Infinity];

const byDays = (rows: PledgeRow[], days: (r: PledgeRow) => number | null): CountBucket[] => {
  const buckets = AGE_LABELS.map((label) => ({ label, count: 0, principal: 0 }));
  for (const r of rows) {
    const d = days(r);
    if (d === null) continue;
    const b = buckets[AGE_MAX_DAYS.findIndex((max) => d <= max)];
    b.count++;
    b.principal += r.principal;
  }
  return buckets;
};

/** Open pledges by how long they have been open. */
export const ageBuckets = (rows: PledgeRow[]) => byDays(rows, (r) => r.daysOpen);

/** Redeemed pledges by how long they took. */
export const redeemBuckets = (rows: PledgeRow[]) => byDays(rows, (r) => r.daysToRedeem);

export const SIZE_LABELS = ["<1K", "1–2.5K", "2.5–5K", "5–10K", "10–20K", "20–40K", "40K+"];
const SIZE_MIN = [0, 1000, 2500, 5000, 10000, 20000, 40000];

export const sizeBands = (rows: PledgeRow[]): CountBucket[] => {
  const bands = SIZE_LABELS.map((label) => ({ label, count: 0, principal: 0 }));
  for (const r of rows) {
    let i = SIZE_MIN.length - 1;
    while (i > 0 && r.principal < SIZE_MIN[i]) i--;
    bands[i].count++;
    bands[i].principal += r.principal;
  }
  return bands;
};

export const cohorts = (rows: PledgeRow[]): Cohort[] =>
  [...new Set(rows.map((r) => r.year))].sort().map((year) => {
    const s = pledgeStats(rows.filter((r) => r.year === year));
    return {
      year,
      pledges: s.pledges,
      principal: s.principal,
      stillOpen: s.openBook,
      redeemedPct: s.redeemedPct,
      medianDaysToRedeem: s.medianDaysToRedeem,
      avgPledge: s.avgPledge,
    };
  });

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const weekdays = (rows: PledgeRow[]) =>
  WEEKDAYS.map((label, i) => ({
    label,
    count: rows.filter((r) => r.weekday === (i + 1) % 7).length,
  }));

/** Illustration only: interest terms are not recorded (spec §12.2). */
export const interestWhatIf = (rows: PledgeRow[], ratePerMonth: number): InterestWhatIf => {
  const open = rows.filter((r) => r.open);
  const perMonth = sum(open.map((r) => r.principal)) * ratePerMonth;
  return {
    perMonth,
    perYear: perMonth * 12,
    accrued: sum(open.map((r) => (r.principal * ratePerMonth * (r.daysOpen ?? 0)) / 30)),
  };
};

/** Longest run (≥ 2 months) with no pledge opened, between the first and last month that have one. */
export const loggingGap = (rows: PledgeRow[]): LoggingGap | null => {
  if (rows.length === 0) return null;
  const has = new Set(rows.map((r) => r.month));
  const sorted = [...has].sort();
  const keys = monthKeysBetween(sorted[0], sorted[sorted.length - 1]);
  let best: LoggingGap | null = null;
  let i = 0;
  while (i < keys.length) {
    if (has.has(keys[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < keys.length && !has.has(keys[j + 1])) j++;
    const months = j - i + 1;
    if (months >= 2 && (!best || months > best.months)) best = { from: keys[i], to: keys[j], months };
    i = j + 1;
  }
  return best;
};

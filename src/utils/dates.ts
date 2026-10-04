// Calendar dates are stored as plain `YYYY-MM-DD` strings: the phone's local calendar day.
// A picked date is a day, not an instant, so it must not shift when the timezone changes or
// when it is cut out of a UTC timestamp. These helpers are pure and timezone independent
// except where they deliberately read or build a LOCAL day.

export const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// An ISO timestamp as written by Date.prototype.toISOString (or any ISO 8601 date-time).
const TIMESTAMP_RE = /^(\d{4})-(\d{2})-(\d{2})T/;

const notADate = (value: unknown): Error => new Error(`Not a date: ${String(value)}`);

const pad = (n: number, width: number): string => String(n).padStart(width, "0");

// True when y-m-d is a real calendar day (month 1-12, day within that month, leap years
// honoured). Uses UTC arithmetic only, so the host timezone cannot change the answer.
function isRealDay(y: number, m: number, d: number): boolean {
  const t = new Date(Date.UTC(2000, 0, 1));
  t.setUTCFullYear(y, m - 1, d);
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Local `YYYY-MM-DD` of a Date, zero-padded. Throws on an invalid Date. */
export function toDay(d: Date): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) throw notADate(d);
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;
}

/** True only for a string that is a real calendar day written as `YYYY-MM-DD`. */
export function isDay(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DAY_RE.exec(value);
  return m !== null && isRealDay(Number(m[1]), Number(m[2]), Number(m[3]));
}

/**
 * Turns a stored or imported date into a plain day.
 * - `YYYY-MM-DD` is validated as a real calendar date and returned unchanged.
 * - An ISO timestamp becomes the local calendar day of that instant (so the stored local
 *   midnight `…-14T18:30:00.000Z` in IST becomes the 15th, the day that was picked).
 *   Its date part must also be a real day: V8 would silently roll `2026-02-30T…` to 2 March.
 * - Anything else throws `Error("Not a date: <value>")`.
 */
export function normalizeDay(value: string): string {
  if (typeof value !== "string") throw notADate(value);
  if (DAY_RE.test(value)) {
    if (!isDay(value)) throw notADate(value);
    return value;
  }
  const ts = TIMESTAMP_RE.exec(value);
  if (ts && isRealDay(Number(ts[1]), Number(ts[2]), Number(ts[3]))) {
    const instant = new Date(value);
    if (!Number.isNaN(instant.getTime())) return toDay(instant);
  }
  throw notADate(value);
}

/** Local midnight of a `YYYY-MM-DD` day. Throws on an invalid day. */
export function parseDay(day: string): Date {
  if (!isDay(day)) throw notADate(day);
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  // new Date(y, ...) treats 0-99 as 1900-1999; setFullYear keeps the year as written.
  if (y < 100) date.setFullYear(y, m - 1, d);
  return date;
}

/** Today's local `YYYY-MM-DD`. */
export function todayDay(now: Date = new Date()): string {
  return toDay(now);
}

/**
 * Converts a value to a local Date, or null if it cannot be parsed.
 * - If the value is a plain `YYYY-MM-DD` that `isDay` accepts, returns `parseDay(value)` (local midnight).
 * - Otherwise tries `new Date(value)` and returns it if valid.
 * - Returns null for empty, null, undefined, or invalid input.
 * - Never throws.
 */
export function toLocalDate(value: string | null | undefined): Date | null {
  // Handle null and undefined
  if (value == null || value === "") return null;

  // Try as a plain day first
  if (isDay(value)) {
    try {
      return parseDay(value);
    } catch {
      return null;
    }
  }

  // Try as an ISO timestamp or other date format
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date;
  }

  return null;
}

/**
 * Calculates the number of whole calendar days from `from` to `to`.
 * - Each value can be a plain `YYYY-MM-DD` or an ISO timestamp.
 * - Uses local calendar days.
 * - Returns the rounded difference in milliseconds divided by 86400000.
 * - Throws if either value is not a valid date (same error as `normalizeDay`).
 */
export function daysBetweenDays(from: string, to: string): number {
  const normalizedFrom = normalizeDay(from);
  const normalizedTo = normalizeDay(to);

  const dateFrom = parseDay(normalizedFrom);
  const dateTo = parseDay(normalizedTo);

  return Math.round((dateTo.getTime() - dateFrom.getTime()) / 86400000);
}

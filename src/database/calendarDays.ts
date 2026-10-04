/**
 * Calendar dates stored as plain `YYYY-MM-DD` days (hardening plan, Task 3a).
 *
 * The five columns below hold the phone's local calendar day, not an instant. The app used to store a picked date as a
 * UTC timestamp (`selectedDate.toISOString()`), so local midnight of 15 September in IST was stored as
 * `2026-09-14T18:30:00.000Z`. migrateCalendarDays rewrites those old values once.
 *
 * The rewrite is done in JS with normalizeDay, not with SQLite's date(..., 'localtime'), because SQLite's timezone
 * handling cannot be trusted on every Android build.
 */
import type { SQLiteDatabase } from "expo-sqlite";
import { isDay, normalizeDay } from "../utils/dates";

/** Every column that holds a calendar day. users.createdAt and every updatedAt stay full timestamps. */
export const CALENDAR_DAY_COLUMNS = [
  { table: "rehan", column: "openDate" },
  { table: "rehan", column: "closedDate" },
  { table: "lenden", column: "date" },
  { table: "jama_entries", column: "date" },
  { table: "rehan_transactions", column: "date" },
] as const;

/** PRAGMA user_version once the calendar columns hold plain days. Nothing else in the app uses user_version. */
export const CALENDAR_DAYS_VERSION = 1;

/** Ids per UPDATE, well below SQLite's oldest bound-parameter limit (999). */
const IDS_PER_UPDATE = 500;

export interface CalendarDayMigration {
  /** Values rewritten as plain days. */
  rewritten: number;
  /** Values that are not a date, left exactly as they were, counted per "table.column". */
  unreadable: Record<string, number>;
}

type Db = Pick<SQLiteDatabase, "getFirstAsync" | "getAllAsync" | "runAsync" | "execAsync" | "withTransactionAsync">;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Rewrites every stored value of the five calendar columns that is not already a plain day as the local calendar day
 * of that instant, then sets user_version, all in one transaction: a failure part way rolls everything back and the
 * next start runs it again. It runs only while user_version is below CALENDAR_DAYS_VERSION, so the ledger is scanned
 * once.
 *
 * - NULL (the closedDate of an open rehan) stays NULL.
 * - A value normalizeDay cannot read is left unchanged and counted; it never aborts the migration. The readers accept
 *   both forms, so such a row still shows as it did before.
 * - updatedAt is not touched: this is a change of format, not an edit.
 *
 * Returns null when the database is already done. Logs one message with the counts when it changed or skipped a value.
 * Rejects, after the rollback, if a statement fails.
 */
export const migrateCalendarDays = async (database: Db): Promise<CalendarDayMigration | null> => {
  const version = await database.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  if ((version?.user_version ?? 0) >= CALENDAR_DAYS_VERSION) return null;

  let result: CalendarDayMigration = { rewritten: 0, unreadable: {} };
  await database.withTransactionAsync(async () => {
    const counts: CalendarDayMigration = { rewritten: 0, unreadable: {} };
    for (const { table, column } of CALENDAR_DAY_COLUMNS) {
      const stored = await database.getAllAsync<{ id: number; value: unknown }>(
        `SELECT id, ${column} AS value FROM ${table} WHERE ${column} IS NOT NULL`,
      );
      // Rows that need the same day are rewritten together.
      const idsByDay = new Map<string, number[]>();
      for (const { id, value } of stored) {
        if (isDay(value)) continue;
        let day: string;
        try {
          day = normalizeDay(value as string);
        } catch {
          const key = `${table}.${column}`;
          counts.unreadable[key] = (counts.unreadable[key] ?? 0) + 1;
          continue;
        }
        const ids = idsByDay.get(day);
        if (ids) ids.push(id);
        else idsByDay.set(day, [id]);
      }
      for (const [day, ids] of idsByDay) {
        for (let i = 0; i < ids.length; i += IDS_PER_UPDATE) {
          const chunk = ids.slice(i, i + IDS_PER_UPDATE);
          const r = await database.runAsync(
            `UPDATE ${table} SET ${column} = ? WHERE id IN (${chunk.map(() => "?").join(", ")})`,
            day,
            ...chunk,
          );
          counts.rewritten += r.changes;
        }
      }
    }
    // Same transaction: the database is marked done only together with the rewritten values.
    await database.execAsync(`PRAGMA user_version = ${CALENDAR_DAYS_VERSION}`);
    result = counts;
  });

  const unreadable = Object.entries(result.unreadable);
  const left = unreadable.reduce((n, [, count]) => n + count, 0);
  const rewrote = `Calendar dates: rewrote ${plural(result.rewritten, "stored value", "stored values")} as plain days`;
  if (left > 0) {
    const where = unreadable.map(([key, count]) => `${key} ${count}`).join(", ");
    console.warn(`${rewrote}; left ${plural(left, "value", "values")} that are not dates unchanged (${where})`);
  } else if (result.rewritten > 0) {
    console.log(rewrote);
  }
  return result;
};

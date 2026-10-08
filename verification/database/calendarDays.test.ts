/**
 * Calendar dates stored as plain `YYYY-MM-DD` (hardening plan, Task 3a): the one-time migration in initDatabase and
 * the database writes, orderings and filters that use the five calendar columns.
 *
 * Runs the real database layer on node:sqlite through the shared expo-sqlite stand-in; skipped where node:sqlite is
 * not available. Every expected day is built with toDay(new Date(...)), so the suite is right in any timezone. It runs
 * in Asia/Kolkata here, where 2026-09-14T18:30:00.000Z is local midnight of 15 September.
 */

jest.mock("expo-sqlite", () => require("../support/sqliteStandIn").createSqliteStandIn());

import {
  closeRehan,
  createJamaEntry,
  createLenden,
  createRehan,
  createRehanTransaction,
  createUser,
  editJamaEntry,
  filterUsersWithCounts,
  getAllLenden,
  getAllRehan,
  getAllTransactions,
  getJamaEntriesByLendenId,
  getLendenByUserId,
  getRehanByUserId,
  getRehanTransactionsByRehanId,
  getTransactionsByUserId,
  initDatabase,
  searchTransactions,
} from "../../src/database/entryDatabase";
import { toDay, todayDay } from "../../src/utils/dates";
import type { SqliteStandIn } from "../support/sqliteStandIn";

const sqliteMock = jest.requireMock("expo-sqlite") as SqliteStandIn;
const describeDb = sqliteMock.__available ? describe : describe.skip;

type Row = Record<string, unknown>;
const raw = () => sqliteMock.__raw();
const rows = (sql: string, ...params: unknown[]): Row[] =>
  raw()
    .prepare(sql)
    .all(...params)
    .map((r) => ({ ...r }));
const one = (sql: string, ...params: unknown[]): Row => rows(sql, ...params)[0];
const userVersion = () => one("PRAGMA user_version").user_version;

/** Local midnight of 15 September on a phone in IST, as the old app stored a picked date. */
const IST_MIDNIGHT = "2026-09-14T18:30:00.000Z";
/** A noon timestamp, as written by the old createRehan default. */
const NOON = new Date(2026, 8, 10, 12, 0, 0).toISOString();
/** 01:30 on 26 September in IST, as written by the old closeRehan: its UTC day is the 25th. */
const LATE_EVENING_UTC = "2026-09-25T20:00:00.000Z";
const PLAIN = "2026-09-01";
const CREATED = "2026-08-01T09:00:00.000Z";
const UPDATED = "2026-09-30T10:00:00.000Z";
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** The five calendar columns, every row, in id order. */
const calendarColumns = () => ({
  rehan: rows("SELECT id, openDate, closedDate, updatedAt FROM rehan ORDER BY id"),
  lenden: rows("SELECT id, date, updatedAt FROM lenden ORDER BY id"),
  jama: rows("SELECT id, date, updatedAt FROM jama_entries ORDER BY id"),
  rehanTx: rows("SELECT id, date, updatedAt FROM rehan_transactions ORDER BY id"),
});

/**
 * A phone from before this change: rows as the old app wrote them (timestamps), a few already plain, three values
 * that are not dates at all, and user_version never set.
 */
const oldPhone = async () => {
  sqliteMock.__reset();
  await initDatabase();
  raw().exec(`
    INSERT INTO users (id, name, createdAt, uuid, updatedAt) VALUES (1, 'Ram', '${CREATED}', 'u-1', '${UPDATED}');
    INSERT INTO rehan (id, userId, media, status, openDate, closedDate, uuid, updatedAt) VALUES
      (1, 1, '[]', 0, '${IST_MIDNIGHT}', NULL, 'r-1', '${UPDATED}'),
      (2, 1, '[]', 1, '${NOON}', '${LATE_EVENING_UTC}', 'r-2', '${UPDATED}'),
      (3, 1, '[]', 1, '${PLAIN}', 'garbage', 'r-3', '${UPDATED}');
    INSERT INTO lenden (id, userId, date, media, uuid, updatedAt) VALUES
      (1, 1, '${IST_MIDNIGHT}', '[]', 'l-1', '${UPDATED}'),
      (2, 1, 'not a date', '[]', 'l-2', '${UPDATED}'),
      (3, 1, '${PLAIN}', '[]', 'l-3', '${UPDATED}');
    INSERT INTO jama_entries (id, lendenId, amount, date, uuid, updatedAt) VALUES
      (1, 1, 100, '${NOON}', 'j-1', '${UPDATED}'),
      (2, 1, 200, '${PLAIN}', 'j-2', '${UPDATED}');
    INSERT INTO rehan_transactions (id, rehanId, type, amount, date, uuid, updatedAt) VALUES
      (1, 1, 'diya', 50, '${IST_MIDNIGHT}', 'rt-1', '${UPDATED}'),
      (2, 1, 'jama', 20, '2026-02-30', 'rt-2', '${UPDATED}');
    PRAGMA user_version = 0;
  `);
};

/** What the migration must leave: every readable date as its local day, everything else exactly as it was. */
const migrated = () => ({
  rehan: [
    { id: 1, openDate: toDay(new Date(IST_MIDNIGHT)), closedDate: null, updatedAt: UPDATED },
    { id: 2, openDate: toDay(new Date(NOON)), closedDate: toDay(new Date(LATE_EVENING_UTC)), updatedAt: UPDATED },
    { id: 3, openDate: PLAIN, closedDate: "garbage", updatedAt: UPDATED },
  ],
  lenden: [
    { id: 1, date: toDay(new Date(IST_MIDNIGHT)), updatedAt: UPDATED },
    { id: 2, date: "not a date", updatedAt: UPDATED },
    { id: 3, date: PLAIN, updatedAt: UPDATED },
  ],
  jama: [
    { id: 1, date: toDay(new Date(NOON)), updatedAt: UPDATED },
    { id: 2, date: PLAIN, updatedAt: UPDATED },
  ],
  rehanTx: [
    { id: 1, date: toDay(new Date(IST_MIDNIGHT)), updatedAt: UPDATED },
    { id: 2, date: "2026-02-30", updatedAt: UPDATED },
  ],
});

/** Every console call whose text mentions the calendar-date migration. */
const migrationMessages = (...spies: jest.SpyInstance[]): string[] =>
  spies.flatMap((s) => s.mock.calls.map((args) => args.map(String).join(" "))).filter((m) => /calendar dates/i.test(m));

describeDb("calendar-date migration in initDatabase", () => {
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;
  beforeEach(() => {
    log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    error = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    log.mockRestore();
    warn.mockRestore();
    error.mockRestore();
  });

  it("rewrites every stored timestamp as its local day, leaves the rest alone and marks the database done", async () => {
    await oldPhone();
    log.mockClear();
    warn.mockClear();

    await initDatabase();

    expect(calendarColumns()).toEqual(migrated());
    // The picked day survives: IST local midnight of the 15th is stored as the 15th, not the UTC day (the 14th).
    if (new Date(IST_MIDNIGHT).getTimezoneOffset() === -330) {
      expect(calendarColumns().rehan[0].openDate).toBe("2026-09-15");
      expect(calendarColumns().rehan[1].closedDate).toBe("2026-09-26");
    }
    expect(userVersion()).toBe(1);
    // One message with the counts: 6 rewritten; "garbage", "not a date" and "2026-02-30" left as they were.
    const messages = migrationMessages(log, warn);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("rewrote 6");
    expect(messages[0]).toContain("left 3");
    expect(error).not.toHaveBeenCalled();
  });

  it("is idempotent: a second start changes nothing and logs nothing", async () => {
    await oldPhone();
    await initDatabase();
    const once = calendarColumns();
    log.mockClear();
    warn.mockClear();

    await initDatabase();

    expect(calendarColumns()).toEqual(once);
    expect(calendarColumns()).toEqual(migrated());
    expect(userVersion()).toBe(1);
    expect(migrationMessages(log, warn)).toEqual([]);
  });

  it("runs once: values written after the migration are not scanned again", async () => {
    await oldPhone();
    await initDatabase();
    // Not something the app writes any more; it only shows the guard skips the scan.
    raw().exec(`UPDATE lenden SET date = '${IST_MIDNIGHT}' WHERE id = 3`);

    await initDatabase();

    expect(one("SELECT date FROM lenden WHERE id = 3").date).toBe(IST_MIDNIGHT);
  });

  it("leaves a value that is not a date unchanged and never aborts the migration for it", async () => {
    await oldPhone();
    await initDatabase();
    expect(one("SELECT closedDate FROM rehan WHERE id = 3").closedDate).toBe("garbage");
    expect(one("SELECT date FROM lenden WHERE id = 2").date).toBe("not a date");
    expect(one("SELECT date FROM rehan_transactions WHERE id = 2").date).toBe("2026-02-30");
    // The readable values in the same tables were still rewritten.
    expect(one("SELECT date FROM lenden WHERE id = 1").date).toBe(toDay(new Date(IST_MIDNIGHT)));
  });

  it("marks a fresh install done without a message", async () => {
    sqliteMock.__reset();
    await initDatabase();
    expect(userVersion()).toBe(1);
    expect(migrationMessages(log, warn)).toEqual([]);
  });

  it("does not stop the app when it fails, rolls every column back and runs again on the next start", async () => {
    await oldPhone();
    const before = calendarColumns();
    // The last of the five columns cannot be written, so the first four were already rewritten in the transaction.
    raw().exec(
      "CREATE TRIGGER fail_day_rewrite BEFORE UPDATE OF date ON rehan_transactions BEGIN SELECT RAISE(ABORT, 'disk I/O error'); END",
    );

    await expect(initDatabase()).resolves.toBeUndefined();

    expect(calendarColumns()).toEqual(before);
    expect(userVersion()).toBe(0);
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/calendar dates/i), expect.anything());

    raw().exec("DROP TRIGGER fail_day_rewrite");
    await initDatabase();
    expect(calendarColumns()).toEqual(migrated());
    expect(userVersion()).toBe(1);
  });
});

describeDb("database writes store plain days", () => {
  let error: jest.SpyInstance;
  let log: jest.SpyInstance;
  beforeEach(async () => {
    log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    sqliteMock.__reset();
    await initDatabase();
  });
  afterEach(() => {
    log.mockRestore();
    error.mockRestore();
  });

  it("createRehan defaults the open date to today and stores a given date as its local day", async () => {
    const userId = await createUser({ name: "Ram" });
    const before = todayDay();
    const byDefault = await createRehan({ userId });
    const after = todayDay();
    const fromTimestamp = await createRehan({ userId, openDate: IST_MIDNIGHT });
    const plain = await createRehan({ userId, openDate: PLAIN });

    const stored = (id: number) => one("SELECT openDate, updatedAt FROM rehan WHERE id = ?", id);
    expect([before, after]).toContain(stored(byDefault).openDate);
    expect(stored(fromTimestamp).openDate).toBe(toDay(new Date(IST_MIDNIGHT)));
    expect(stored(plain).openDate).toBe(PLAIN);
    for (const id of [byDefault, fromTimestamp, plain]) expect(stored(id).updatedAt).toMatch(TIMESTAMP);
  });

  it("closeRehan stores today as the closed day and a full timestamp as updatedAt", async () => {
    const userId = await createUser({ name: "Ram" });
    const rehanId = await createRehan({ userId, openDate: PLAIN });
    const before = todayDay();
    await closeRehan(rehanId);
    const after = todayDay();

    const row = one("SELECT status, closedDate, updatedAt FROM rehan WHERE id = ?", rehanId);
    expect(row.status).toBe(1);
    expect([before, after]).toContain(row.closedDate);
    expect(row.updatedAt).toMatch(TIMESTAMP);
  });

  it("createLenden, createJamaEntry, createRehanTransaction and editJamaEntry store the local day", async () => {
    const userId = await createUser({ name: "Ram" });
    const rehanId = await createRehan({ userId, openDate: PLAIN });
    const lendenId = await createLenden({ userId, date: IST_MIDNIGHT, remaining: 1000 });
    const plainBill = await createLenden({ userId, date: PLAIN, remaining: 1000 });
    const jamaId = await createJamaEntry({ lendenId, amount: 100, date: IST_MIDNIGHT });
    const txId = await createRehanTransaction({ rehanId, type: "diya", amount: 50, date: NOON });

    expect(one("SELECT date FROM lenden WHERE id = ?", lendenId).date).toBe(toDay(new Date(IST_MIDNIGHT)));
    expect(one("SELECT date FROM lenden WHERE id = ?", plainBill).date).toBe(PLAIN);
    expect(one("SELECT date FROM jama_entries WHERE id = ?", jamaId).date).toBe(toDay(new Date(IST_MIDNIGHT)));
    expect(one("SELECT date FROM rehan_transactions WHERE id = ?", txId).date).toBe(toDay(new Date(NOON)));

    await editJamaEntry(jamaId, 150, LATE_EVENING_UTC);
    const edited = one("SELECT amount, date, updatedAt FROM jama_entries WHERE id = ?", jamaId);
    expect(edited).toMatchObject({ amount: 150, date: toDay(new Date(LATE_EVENING_UTC)) });
    expect(edited.updatedAt).toMatch(TIMESTAMP);
  });

  it("rejects a date that is not a date instead of storing it", async () => {
    const userId = await createUser({ name: "Ram" });
    await expect(createLenden({ userId, date: "someday" })).rejects.toThrow("Not a date");
    expect(rows("SELECT id FROM lenden")).toEqual([]);
  });
});

describeDb("lists sorted by a calendar day", () => {
  let log: jest.SpyInstance;
  beforeAll(() => {
    log = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });
  afterAll(() => log.mockRestore());

  /** Two records on the 15th, then one on the 14th created last, so id order is not date order. */
  const seed = async () => {
    sqliteMock.__reset();
    await initDatabase();
    const userId = await createUser({ name: "Ram" });
    const r1 = await createRehan({ userId, openDate: "2026-09-15" });
    const r2 = await createRehan({ userId, openDate: "2026-09-15" });
    const r0 = await createRehan({ userId, openDate: "2026-09-14" });
    const l1 = await createLenden({ userId, date: "2026-09-15" });
    const l2 = await createLenden({ userId, date: "2026-09-15" });
    const l0 = await createLenden({ userId, date: "2026-09-14" });
    const t1 = await createRehanTransaction({ rehanId: r1, type: "diya", amount: 1, date: "2026-09-16" });
    const t2 = await createRehanTransaction({ rehanId: r1, type: "jama", amount: 1, date: "2026-09-16" });
    const t0 = await createRehanTransaction({ rehanId: r1, type: "diya", amount: 1, date: "2026-09-15" });
    const j1 = await createJamaEntry({ lendenId: l1, amount: 1, date: "2026-09-16" });
    const j2 = await createJamaEntry({ lendenId: l1, amount: 1, date: "2026-09-16" });
    const j0 = await createJamaEntry({ lendenId: l1, amount: 1, date: "2026-09-15" });
    return { userId, r0, r1, r2, l0, l1, l2, t0, t1, t2, j0, j1, j2 };
  };

  it("rehan, len-den and rehan transactions: newest day first, then newest record first", async () => {
    const s = await seed();
    const ids = (list: { id: number }[]) => list.map((x) => x.id);
    expect(ids(await getRehanByUserId(s.userId))).toEqual([s.r2, s.r1, s.r0]);
    expect(ids(await getAllRehan())).toEqual([s.r2, s.r1, s.r0]);
    expect(ids(await getLendenByUserId(s.userId))).toEqual([s.l2, s.l1, s.l0]);
    expect(ids(await getAllLenden())).toEqual([s.l2, s.l1, s.l0]);
    expect(ids(await getRehanTransactionsByRehanId(s.r1))).toEqual([s.t2, s.t1, s.t0]);
  });

  it("jama entries: oldest day first, then oldest record first (the running baki reads them in this order)", async () => {
    const s = await seed();
    expect((await getJamaEntriesByLendenId(s.l1)).map((j) => j.id)).toEqual([s.j0, s.j1, s.j2]);
  });

  it("the combined customer lists: newest day first; on one day rehan then len-den, newest first", async () => {
    const s = await seed();
    const expected = [`rehan:${s.r2}`, `rehan:${s.r1}`, `lenden:${s.l2}`, `lenden:${s.l1}`, `rehan:${s.r0}`, `lenden:${s.l0}`];
    const keys = (list: { type: string; id: number }[]) => list.map((t) => `${t.type}:${t.id}`);
    expect(keys(await getTransactionsByUserId(s.userId))).toEqual(expected);
    expect(keys(await getAllTransactions())).toEqual(expected);
    expect(keys(await searchTransactions("Ram"))).toEqual(expected);
  });
});

describeDb("filterUsersWithCounts compares plain days directly", () => {
  let log: jest.SpyInstance;
  let error: jest.SpyInstance;
  beforeAll(() => {
    log = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });
  afterAll(() => log.mockRestore());
  beforeEach(() => {
    error = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => error.mockRestore());

  /** A: rehan on the 15th. B: len-den on the 16th. C: rehan on the 14th. D: len-den on the 17th. */
  const seed = async () => {
    sqliteMock.__reset();
    await initDatabase();
    const a = await createUser({ name: "A" });
    const b = await createUser({ name: "B" });
    const c = await createUser({ name: "C" });
    const d = await createUser({ name: "D" });
    await createRehan({ userId: a, openDate: "2026-09-15" });
    await createLenden({ userId: b, date: "2026-09-16" });
    await createRehan({ userId: c, openDate: "2026-09-14" });
    await createLenden({ userId: d, date: "2026-09-17" });
  };
  const names = async (filters: Parameters<typeof filterUsersWithCounts>[0]) =>
    (await filterUsersWithCounts(filters)).map((u) => u.name).sort();

  it("includes both ends of the range and nothing outside it", async () => {
    await seed();
    expect(await names({ dateFrom: "2026-09-15", dateTo: "2026-09-16" })).toEqual(["A", "B"]);
    expect(await names({ dateFrom: "2026-09-15", dateTo: "2026-09-15" })).toEqual(["A"]);
    expect(await names({ transactionType: "rehan", dateFrom: "2026-09-15" })).toEqual(["A"]);
    expect(await names({ transactionType: "rehan", dateTo: "2026-09-14" })).toEqual(["C"]);
    expect(await names({ transactionType: "lenden", dateTo: "2026-09-16" })).toEqual(["B"]);
    expect(await names({ transactionType: "lenden", dateFrom: "2026-09-17", dateTo: "2026-09-17" })).toEqual(["D"]);
  });

  it("reads a picked date passed as a timestamp as its local day", async () => {
    await seed();
    const picked = new Date(2026, 8, 15).toISOString(); // local midnight of the 15th
    expect(await names({ dateFrom: picked, dateTo: picked })).toEqual(["A"]);
  });

  it("rejects a filter date that is not a date instead of matching nothing", async () => {
    await seed();
    await expect(filterUsersWithCounts({ dateFrom: "15/09/2026" })).rejects.toThrow("Not a date");
    expect(error).toHaveBeenCalled();
  });
});

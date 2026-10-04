/**
 * A stand-in for expo-sqlite on top of node:sqlite, shared by the database tests.
 *
 * Use it from a test with:
 *
 *   jest.mock("expo-sqlite", () => require("../test/sqliteStandIn").createSqliteStandIn());
 *   const sqliteMock = jest.requireMock("expo-sqlite") as SqliteStandIn;
 *
 * The stand-in refuses any statement sent to the module-level connection while an exclusive transaction is open, so
 * a test also proves every statement of such a transaction goes through the transaction object. Where node:sqlite is
 * not available `__available` is false and the tests that need it are skipped.
 */

type Row = Record<string, unknown>;
type Statement = {
  run: (...p: unknown[]) => { lastInsertRowid: number | bigint; changes: number | bigint };
  all: (...p: unknown[]) => Row[];
  get: (...p: unknown[]) => Row | undefined;
};
export type RawDb = { exec: (sql: string) => void; prepare: (sql: string) => Statement; close: () => void };

/** What a test sees when it loads the mock with jest.requireMock("expo-sqlite"). */
export interface SqliteStandIn {
  __available: boolean;
  /** Swaps in a brand-new empty in-memory database. */
  __reset: () => void;
  /** The live node:sqlite connection (to seed rows, read them back, or break it). */
  __raw: () => RawDb;
}

export const createSqliteStandIn = () => {
  let sqlite: { DatabaseSync: new (path: string) => RawDb } | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sqlite = require("node:sqlite");
  } catch {
    sqlite = null;
  }
  const state: { db: RawDb | null; exclusive: boolean } = { db: null, exclusive: false };
  const reset = () => {
    state.db = sqlite ? new sqlite.DatabaseSync(":memory:") : null;
    // As on the phone (backup spec §4.4): foreign keys are off, so "customer not on file" rows (userId 0) exist.
    state.db?.exec("PRAGMA foreign_keys = OFF");
    state.exclusive = false;
  };
  reset();
  const args = (p: unknown[]) => (p.length === 1 && Array.isArray(p[0]) ? (p[0] as unknown[]) : p);
  const plain = (row: Row | undefined) => (row ? { ...row } : null);
  const make = (isTxn: boolean): Record<string, unknown> => {
    const db = () => {
      if (state.exclusive && !isTxn) throw new Error("statement sent outside the exclusive transaction");
      return state.db as RawDb;
    };
    return {
      execAsync: async (sql: string) => db().exec(sql),
      runAsync: async (sql: string, ...p: unknown[]) => {
        const r = db().prepare(sql).run(...args(p));
        return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
      },
      getAllAsync: async (sql: string, ...p: unknown[]) => db().prepare(sql).all(...args(p)).map((r) => plain(r)),
      getFirstAsync: async (sql: string, ...p: unknown[]) => plain(db().prepare(sql).get(...args(p))),
      withTransactionAsync: async (task: () => Promise<void>) => {
        db().exec("BEGIN");
        try {
          await task();
          db().exec("COMMIT");
        } catch (e) {
          db().exec("ROLLBACK");
          throw e;
        }
      },
      withExclusiveTransactionAsync: async (task: (txn: unknown) => Promise<void>) => {
        const raw = db();
        raw.exec("BEGIN");
        state.exclusive = true;
        try {
          await task(make(true));
          raw.exec("COMMIT");
        } catch (e) {
          raw.exec("ROLLBACK");
          throw e;
        } finally {
          state.exclusive = false;
        }
      },
    };
  };
  const main = make(false);
  return {
    openDatabaseAsync: async () => main,
    __available: sqlite !== null,
    __reset: reset,
    __raw: () => state.db as RawDb,
  };
};

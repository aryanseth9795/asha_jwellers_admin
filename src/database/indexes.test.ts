/**
 * Indexes for the ledger tables (hardening plan, Task 2 item 6).
 *
 * Runs on node:sqlite directly (the same engine family the app's expo-sqlite uses), with a tiny execAsync wrapper.
 * The seven tables are created with the same columns as the CREATE TABLE statements in entryDatabase.ts, then
 * ensureIndexes is applied and EXPLAIN QUERY PLAN shows which index each of the app's queries uses.
 * Skipped where node:sqlite is not available.
 */

import { INDEX_STATEMENTS, ensureIndexes } from "./indexes";

type Row = Record<string, unknown>;
type Sync = {
  exec: (sql: string) => void;
  prepare: (sql: string) => { all: (...p: unknown[]) => Row[] };
};

let DatabaseSync: (new (path: string) => Sync) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  DatabaseSync = require("node:sqlite").DatabaseSync;
} catch {
  DatabaseSync = null;
}
const describeDb = DatabaseSync ? describe : describe.skip;

// Same columns as entryDatabase.ts initDatabase (CREATE TABLE statements only).
const TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    mobileNumber TEXT,
    nickname TEXT,
    createdAt TEXT NOT NULL,
    uuid TEXT,
    updatedAt TEXT
  );
  CREATE TABLE IF NOT EXISTS rehan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    media TEXT NOT NULL,
    status INTEGER DEFAULT 0,
    openDate TEXT NOT NULL,
    closedDate TEXT,
    productName TEXT,
    category TEXT,
    amount INTEGER,
    uuid TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS lenden (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    date TEXT NOT NULL,
    media TEXT NOT NULL,
    amount INTEGER,
    discount INTEGER,
    remaining INTEGER,
    jama INTEGER,
    baki INTEGER,
    uuid TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS jama_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lendenId INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    date TEXT NOT NULL,
    uuid TEXT,
    updatedAt TEXT,
    FOREIGN KEY (lendenId) REFERENCES lenden(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS lenden_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lendenId INTEGER NOT NULL,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    metal TEXT,
    purity TEXT,
    weight REAL,
    qty INTEGER DEFAULT 1,
    rate INTEGER,
    total INTEGER NOT NULL,
    uuid TEXT,
    updatedAt TEXT,
    FOREIGN KEY (lendenId) REFERENCES lenden(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS lenden_old_jewellery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lendenId INTEGER NOT NULL,
    position INTEGER NOT NULL,
    description TEXT NOT NULL,
    metal TEXT,
    purity TEXT,
    weight REAL,
    value INTEGER NOT NULL,
    uuid TEXT,
    updatedAt TEXT,
    FOREIGN KEY (lendenId) REFERENCES lenden(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS rehan_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rehanId INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    date TEXT NOT NULL,
    uuid TEXT,
    updatedAt TEXT,
    FOREIGN KEY (rehanId) REFERENCES rehan(id) ON DELETE CASCADE
  );
`;

const EXPECTED_INDEXES = [
  "idx_jama_entries_lendenId",
  "idx_lenden_date",
  "idx_lenden_items_lendenId",
  "idx_lenden_old_jewellery_items_lendenId",
  "idx_lenden_userId",
  "idx_rehan_openDate",
  "idx_rehan_transactions_rehanId",
  "idx_rehan_userId",
  "idx_users_name",
];

const open = () => {
  const raw = new (DatabaseSync as new (path: string) => Sync)(":memory:");
  raw.exec(TABLES_SQL);
  const db = { execAsync: async (sql: string) => raw.exec(sql) };
  return { raw, db };
};

const indexRows = (raw: Sync) =>
  raw
    .prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name")
    .all();

/** The `detail` column of EXPLAIN QUERY PLAN, one string per plan row. */
const plan = (raw: Sync, sql: string, ...params: unknown[]): string[] =>
  raw
    .prepare(`EXPLAIN QUERY PLAN ${sql}`)
    .all(...params)
    .map((r) => String(r.detail));

describe("INDEX_STATEMENTS", () => {
  it("is one CREATE INDEX IF NOT EXISTS per index, so it is safe on fresh installs and old ones", () => {
    expect(INDEX_STATEMENTS).toHaveLength(EXPECTED_INDEXES.length);
    for (const sql of INDEX_STATEMENTS) {
      expect(sql).toMatch(/^\s*CREATE INDEX IF NOT EXISTS idx_\w+ ON \w+\(/);
    }
    const names = INDEX_STATEMENTS.map((s) => (s.match(/IF NOT EXISTS (\w+)/) as RegExpMatchArray)[1]);
    expect([...names].sort()).toEqual(EXPECTED_INDEXES);
  });
});

describe("ensureIndexes (call order)", () => {
  it("runs every statement once, in order", async () => {
    const seen: string[] = [];
    await ensureIndexes({
      execAsync: async (sql: string) => {
        seen.push(sql);
      },
    });
    expect(seen).toEqual(INDEX_STATEMENTS);
  });

  it("stops at the first failure and rejects", async () => {
    const seen: string[] = [];
    await expect(
      ensureIndexes({
        execAsync: async (sql: string) => {
          seen.push(sql);
          if (seen.length === 2) throw new Error("disk full");
        },
      }),
    ).rejects.toThrow("disk full");
    expect(seen).toHaveLength(2);
  });
});

describeDb("ensureIndexes on SQLite", () => {
  it("creates every index and is idempotent", async () => {
    const { raw, db } = open();
    expect(indexRows(raw)).toHaveLength(0);

    await ensureIndexes(db);
    const first = indexRows(raw);
    expect(first.map((r) => r.name)).toEqual(EXPECTED_INDEXES);

    // Second and third runs: no error, nothing added, nothing changed.
    await ensureIndexes(db);
    await ensureIndexes(db);
    expect(indexRows(raw)).toEqual(first);
  });

  it("puts each index on the table the plan names", async () => {
    const { raw, db } = open();
    await ensureIndexes(db);
    const tableOf = Object.fromEntries(indexRows(raw).map((r) => [r.name, r.tbl_name]));
    expect(tableOf).toEqual({
      idx_rehan_userId: "rehan",
      idx_lenden_userId: "lenden",
      idx_jama_entries_lendenId: "jama_entries",
      idx_rehan_transactions_rehanId: "rehan_transactions",
      idx_lenden_items_lendenId: "lenden_items",
      idx_lenden_old_jewellery_items_lendenId: "lenden_old_jewellery_items",
      idx_users_name: "users",
      idx_rehan_openDate: "rehan",
      idx_lenden_date: "lenden",
    });
  });

  it("works on a database that already holds rows (an existing install)", async () => {
    const { raw, db } = open();
    raw.exec(`
      INSERT INTO users (name, createdAt) VALUES ('Ram', '2026-01-01T00:00:00.000Z');
      INSERT INTO rehan (userId, media, openDate) VALUES (1, 'a.jpg', '2026-01-02');
      INSERT INTO lenden (userId, date, media) VALUES (1, '2026-01-03', 'b.jpg');
      INSERT INTO jama_entries (lendenId, amount, date) VALUES (1, 100, '2026-01-04');
    `);
    await ensureIndexes(db);
    expect(indexRows(raw).map((r) => r.name)).toEqual(EXPECTED_INDEXES);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM rehan").all()[0].n).toBe(1);
  });
});

describeDb("query plans use the indexes", () => {
  const setup = async () => {
    const { raw, db } = open();
    await ensureIndexes(db);
    return raw;
  };

  // A table SCAN means a full pass over every row. "SCAN t USING INDEX" is an ordered pass over an index and is
  // only accepted for the whole-table listings below, which have no WHERE to search with.
  const noTableScan = (details: string[], tables: string[]) => {
    for (const table of tables) {
      expect(details.filter((d) => new RegExp(`^SCAN ${table}( |$)`).test(d))).toEqual([]);
    }
  };
  const usesIndex = (details: string[], table: string, index?: string) => {
    const pattern = new RegExp(`^SEARCH ${table} USING (COVERING )?INDEX ${index ?? "idx_\\w+"} `);
    expect(details.some((d) => pattern.test(d))).toBe(true);
  };
  const noTempBTree = (details: string[]) => {
    expect(details.filter((d) => /TEMP B-TREE/.test(d))).toEqual([]);
  };

  it("rehan by customer, newest first: searched by index, no sort step", async () => {
    const raw = await setup();
    const d = plan(raw, "SELECT * FROM rehan WHERE userId = ? ORDER BY openDate DESC", 1);
    noTableScan(d, ["rehan"]);
    usesIndex(d, "rehan", "idx_rehan_userId");
    noTempBTree(d);
  });

  it("lenden by customer, newest first: searched by index, no sort step", async () => {
    const raw = await setup();
    const d = plan(raw, "SELECT * FROM lenden WHERE userId = ? ORDER BY date DESC", 1);
    noTableScan(d, ["lenden"]);
    usesIndex(d, "lenden", "idx_lenden_userId");
    noTempBTree(d);
  });

  it("a later 'id DESC' tie-break on those orderings still needs no sort step", async () => {
    const raw = await setup();
    const r = plan(raw, "SELECT * FROM rehan WHERE userId = ? ORDER BY openDate DESC, id DESC", 1);
    noTableScan(r, ["rehan"]);
    noTempBTree(r);
    const l = plan(raw, "SELECT * FROM lenden WHERE userId = ? ORDER BY date DESC, id DESC", 1);
    noTableScan(l, ["lenden"]);
    noTempBTree(l);
    const t = plan(raw, "SELECT * FROM rehan_transactions WHERE rehanId = ? ORDER BY date DESC, id DESC", 1);
    noTableScan(t, ["rehan_transactions"]);
    noTempBTree(t);
    const j = plan(raw, "SELECT * FROM jama_entries WHERE lendenId = ? ORDER BY date ASC, id ASC", 1);
    noTableScan(j, ["jama_entries"]);
    noTempBTree(j);
  });

  it("jama entries of a bill", async () => {
    const raw = await setup();
    const d = plan(raw, "SELECT * FROM jama_entries WHERE lendenId = ?", 1);
    noTableScan(d, ["jama_entries"]);
    usesIndex(d, "jama_entries", "idx_jama_entries_lendenId");
    // The screen's actual query also sorts by date.
    const sorted = plan(raw, "SELECT * FROM jama_entries WHERE lendenId = ? ORDER BY date ASC", 1);
    noTableScan(sorted, ["jama_entries"]);
    noTempBTree(sorted);
    // And the paid-so-far total.
    const total = plan(raw, "SELECT COALESCE(SUM(amount), 0) as total FROM jama_entries WHERE lendenId = ?", 1);
    noTableScan(total, ["jama_entries"]);
    usesIndex(total, "jama_entries", "idx_jama_entries_lendenId");
  });

  it("rehan transactions of a rehan", async () => {
    const raw = await setup();
    const d = plan(raw, "SELECT * FROM rehan_transactions WHERE rehanId = ?", 1);
    noTableScan(d, ["rehan_transactions"]);
    usesIndex(d, "rehan_transactions", "idx_rehan_transactions_rehanId");
    const sorted = plan(raw, "SELECT * FROM rehan_transactions WHERE rehanId = ? ORDER BY date DESC", 1);
    noTableScan(sorted, ["rehan_transactions"]);
    noTempBTree(sorted);
  });

  it("items of a bill", async () => {
    const raw = await setup();
    const d = plan(raw, "SELECT * FROM lenden_items WHERE lendenId = ?", 1);
    noTableScan(d, ["lenden_items"]);
    usesIndex(d, "lenden_items", "idx_lenden_items_lendenId");
    const sorted = plan(raw, "SELECT * FROM lenden_items WHERE lendenId = ? ORDER BY position ASC", 1);
    noTableScan(sorted, ["lenden_items"]);
    noTempBTree(sorted);
  });

  it("old jewellery items of a bill", async () => {
    const raw = await setup();
    const d = plan(raw, "SELECT * FROM lenden_old_jewellery_items WHERE lendenId = ?", 1);
    noTableScan(d, ["lenden_old_jewellery_items"]);
    usesIndex(d, "lenden_old_jewellery_items", "idx_lenden_old_jewellery_items_lendenId");
    const sorted = plan(raw, "SELECT * FROM lenden_old_jewellery_items WHERE lendenId = ? ORDER BY position ASC", 1);
    noTableScan(sorted, ["lenden_old_jewellery_items"]);
    noTempBTree(sorted);
  });

  it("getUsersWithCounts subqueries count by index", async () => {
    const raw = await setup();
    const r = plan(raw, "SELECT COUNT(*) FROM rehan WHERE userId = ?", 1);
    noTableScan(r, ["rehan"]);
    usesIndex(r, "rehan", "idx_rehan_userId");
    const l = plan(raw, "SELECT COUNT(*) FROM lenden WHERE userId = ?", 1);
    noTableScan(l, ["lenden"]);
    usesIndex(l, "lenden", "idx_lenden_userId");

    // The whole query: one pass over users, and a seek into rehan and lenden for each of them.
    const whole = plan(
      raw,
      `SELECT u.id, u.name, u.address, u.mobileNumber, u.nickname, u.createdAt,
              (SELECT COUNT(*) FROM rehan WHERE userId = u.id) as rehanCount,
              (SELECT COUNT(*) FROM lenden WHERE userId = u.id) as lendenCount
       FROM users u ORDER BY u.createdAt DESC`,
    );
    noTableScan(whole, ["rehan", "lenden"]);
    usesIndex(whole, "rehan", "idx_rehan_userId");
    usesIndex(whole, "lenden", "idx_lenden_userId");
  });

  it("the filterUsersWithCounts date subqueries seek by customer and day range in one index search", async () => {
    // The stored days are plain YYYY-MM-DD, compared directly: the range is part of the index search. (The old
    // date(openDate) >= date(?) form could only seek by customer and then test every row of that customer.)
    const raw = await setup();
    const r = plan(
      raw,
      "SELECT * FROM users u WHERE (SELECT COUNT(*) FROM rehan WHERE userId = u.id AND openDate >= ? AND openDate <= ?) > 0",
      "2026-01-01",
      "2026-12-31",
    );
    noTableScan(r, ["rehan"]);
    usesIndex(r, "rehan", "idx_rehan_userId");
    expect(r.some((d) => d.includes("(userId=? AND openDate>? AND openDate<?)"))).toBe(true);
    const l = plan(
      raw,
      "SELECT * FROM users u WHERE (SELECT COUNT(*) FROM lenden WHERE userId = u.id AND date >= ?) > 0",
      "2026-01-01",
    );
    noTableScan(l, ["lenden"]);
    usesIndex(l, "lenden", "idx_lenden_userId");
    expect(l.some((d) => d.includes("(userId=? AND date>?)"))).toBe(true);
  });

  it("deleting a customer finds its bills and rehans by index", async () => {
    const raw = await setup();
    const stmts = [
      "DELETE FROM rehan_transactions WHERE rehanId IN (SELECT id FROM rehan WHERE userId = ?)",
      "DELETE FROM jama_entries WHERE lendenId IN (SELECT id FROM lenden WHERE userId = ?)",
      "DELETE FROM lenden_items WHERE lendenId IN (SELECT id FROM lenden WHERE userId = ?)",
      "DELETE FROM lenden_old_jewellery_items WHERE lendenId IN (SELECT id FROM lenden WHERE userId = ?)",
    ];
    for (const sql of stmts) {
      const d = plan(raw, sql, 1);
      noTableScan(d, ["rehan", "lenden", "jama_entries", "rehan_transactions", "lenden_items", "lenden_old_jewellery_items"].filter((t) => sql.startsWith(`DELETE FROM ${t} `)));
      expect(d.some((x) => /^SEARCH \w+ USING (COVERING )?INDEX idx_/.test(x))).toBe(true);
    }
  });

  it("the whole-table listings (getAllRehan, getAllLenden) are read in date order straight off the date index", async () => {
    const raw = await setup();
    const r = plan(raw, "SELECT * FROM rehan ORDER BY openDate DESC");
    expect(r).toEqual(["SCAN rehan USING INDEX idx_rehan_openDate"]);
    const l = plan(raw, "SELECT * FROM lenden ORDER BY date DESC");
    expect(l).toEqual(["SCAN lenden USING INDEX idx_lenden_date"]);
    // The app's ", id DESC" tie-break is answered by the same backward walk.
    expect(plan(raw, "SELECT * FROM rehan ORDER BY openDate DESC, id DESC")).toEqual(r);
    expect(plan(raw, "SELECT * FROM lenden ORDER BY date DESC, id DESC")).toEqual(l);
  });

  it("the joined lists in getAllTransactions and searchTransactions are also read in date order, no sort step", async () => {
    const raw = await setup();
    const rehanJoin = `SELECT r.id, r.userId, r.media, r.status, r.openDate, r.productName, r.amount,
              u.name, u.address, u.mobileNumber, u.nickname
       FROM rehan r
       JOIN users u ON r.userId = u.id`;
    const lendenJoin = `SELECT l.id, l.userId, l.media, l.date, l.amount, l.discount, l.remaining, l.jama, l.baki,
              u.name, u.address, u.mobileNumber, u.nickname
       FROM lenden l
       JOIN users u ON l.userId = u.id`;
    const search = "WHERE u.name LIKE ? OR u.address LIKE ? OR u.mobileNumber LIKE ? OR u.nickname LIKE ?";
    const like = ["%a%", "%a%", "%a%", "%a%"];
    for (const [d, idx] of [
      [plan(raw, `${rehanJoin} ORDER BY r.openDate DESC`), "idx_rehan_openDate"],
      [plan(raw, `${rehanJoin} ${search} ORDER BY r.openDate DESC`, ...like), "idx_rehan_openDate"],
      [plan(raw, `${lendenJoin} ORDER BY l.date DESC`), "idx_lenden_date"],
      [plan(raw, `${lendenJoin} ${search} ORDER BY l.date DESC`, ...like), "idx_lenden_date"],
      // As the app sends them, with the id tie-break.
      [plan(raw, `${rehanJoin} ORDER BY r.openDate DESC, r.id DESC`), "idx_rehan_openDate"],
      [plan(raw, `${rehanJoin} ${search} ORDER BY r.openDate DESC, r.id DESC`, ...like), "idx_rehan_openDate"],
      [plan(raw, `${lendenJoin} ORDER BY l.date DESC, l.id DESC`), "idx_lenden_date"],
      [plan(raw, `${lendenJoin} ${search} ORDER BY l.date DESC, l.id DESC`, ...like), "idx_lenden_date"],
    ] as [string[], string][]) {
      expect(d.some((x) => x.includes(`USING INDEX ${idx}`))).toBe(true);
      noTempBTree(d);
    }
  });

  it("idx_users_name serves case-insensitive name lookups", async () => {
    const raw = await setup();
    const d = plan(raw, "SELECT * FROM users WHERE name = ? COLLATE NOCASE", "ram");
    noTableScan(d, ["users"]);
    usesIndex(d, "users", "idx_users_name");
  });
});

/**
 * A failed read must reject, never come back as an empty list, "not found", false or 0 (hardening plan, task 1).
 * Runs the real database layer on node:sqlite through the shared expo-sqlite stand-in; skipped where node:sqlite is
 * not available. "Not found" is a successful query with no row, so it still resolves with null / [] / false.
 */

jest.mock("expo-sqlite", () => require("../support/sqliteStandIn").createSqliteStandIn());

import {
  checkDuplicateUser,
  createJamaEntry,
  createLenden,
  createRehan,
  createRehanTransaction,
  createUser,
  filterUsersWithCounts,
  getAllLenden,
  getAllRehan,
  getAllTransactions,
  getAllUsers,
  getJamaEntriesByLendenId,
  getLendenById,
  getLendenByUserId,
  getRehanById,
  getRehanByUserId,
  getRehanTransactionsByRehanId,
  getTotalJamaByLendenId,
  getTransactionsByUserId,
  getUserById,
  getUsersWithCounts,
  initDatabase,
  searchTransactions,
  searchUsers,
  searchUsersWithCounts,
  updateLendenBaki,
} from "../../src/database/entryDatabase";
import { getLendenItems, replaceLendenItems } from "../../src/database/lendenItems";
import { getLendenOldJewelleryItems, replaceLendenOldJewelleryItems } from "../../src/database/lendenOldJewelleryItems";
import type { SqliteStandIn } from "../support/sqliteStandIn";

const sqliteMock = jest.requireMock("expo-sqlite") as SqliteStandIn;
const describeDb = sqliteMock.__available ? describe : describe.skip;

const DAY = "2026-09-15T00:00:00.000Z";

/** A small phone with one record of every kind. */
const seed = async () => {
  sqliteMock.__reset();
  await initDatabase();
  const userId = await createUser({ name: "Ram", address: "Manwal", mobileNumber: "9876543210" });
  const rehanId = await createRehan({ userId, openDate: DAY, productName: "Chain", amount: 1000 });
  await createRehanTransaction({ rehanId, type: "diya", amount: 200, date: DAY });
  const lendenId = await createLenden({ userId, date: DAY, amount: 1500, remaining: 1000, status: 0 });
  await replaceLendenItems(lendenId, [{ name: "Ring", total: 1500 }]);
  await replaceLendenOldJewelleryItems(lendenId, [{ description: "Old ring", value: 500 }]);
  await createJamaEntry({ lendenId, amount: 300, date: DAY });
  await updateLendenBaki(lendenId);
  return { userId, rehanId, lendenId };
};

const storedBill = (lendenId: number) =>
  sqliteMock
    .__raw()
    .prepare("SELECT baki, status, updatedAt FROM lenden WHERE id = ?")
    .get(lendenId) as { baki: number; status: number; updatedAt: string };

describeDb("failed reads reject instead of returning a default", () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  beforeAll(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });
  afterAll(() => logSpy.mockRestore());
  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => errorSpy.mockRestore());

  type Ids = { userId: number; rehanId: number; lendenId: number };
  /** Each read, and what it must resolve with on the seeded phone (one record of every kind). */
  type Reads = [string, (ids: Ids) => Promise<unknown>, (value: unknown, ids: Ids) => void][];

  /** A list of at least one row, the seeded record among them. */
  const listWith = (value: unknown, expected: Record<string, unknown>) => {
    expect(Array.isArray(value)).toBe(true);
    expect((value as unknown[]).length).toBeGreaterThanOrEqual(1);
    expect(value).toContainEqual(expect.objectContaining(expected));
  };
  /** The seeded customer with one rehan and one len-den. */
  const ramWithCounts = (v: unknown, { userId }: Ids) => listWith(v, { id: userId, name: "Ram", rehanCount: 1, lendenCount: 1 });
  /** Both of Ram's records in a combined list. */
  const bothRecords = (v: unknown, { userId, rehanId, lendenId }: Ids) => {
    listWith(v, { type: "rehan", id: rehanId, userId, userName: "Ram" });
    listWith(v, { type: "lenden", id: lendenId, userId, userName: "Ram" });
  };

  const reads: Reads = [
    ["checkDuplicateUser", () => checkDuplicateUser("Ram", "Manwal", "9876543210"), (v) => expect(v).toBe(true)],
    [
      "getUserById",
      ({ userId }) => getUserById(userId),
      (v, { userId }) => {
        expect(v).not.toBeNull();
        expect(v).toMatchObject({ id: userId, name: "Ram", address: "Manwal", mobileNumber: "9876543210" });
      },
    ],
    [
      "getRehanById",
      ({ rehanId }) => getRehanById(rehanId),
      (v, { userId, rehanId }) => {
        expect(v).not.toBeNull();
        // 1000 plus the 200 diya.
        expect(v).toMatchObject({ id: rehanId, userId, productName: "Chain", amount: 1200 });
      },
    ],
    [
      "getLendenById",
      ({ lendenId }) => getLendenById(lendenId),
      (v, { userId, lendenId }) => {
        expect(v).not.toBeNull();
        expect(v).toMatchObject({ id: lendenId, userId, amount: 1500, remaining: 1000, baki: 700, status: 0 });
      },
    ],
    ["getAllUsers", () => getAllUsers(), (v, { userId }) => listWith(v, { id: userId, name: "Ram" })],
    ["searchUsers", () => searchUsers("Ram"), (v, { userId }) => listWith(v, { id: userId, name: "Ram" })],
    ["getRehanByUserId", ({ userId }) => getRehanByUserId(userId), (v, { rehanId }) => listWith(v, { id: rehanId })],
    ["getAllRehan", () => getAllRehan(), (v, { rehanId }) => listWith(v, { id: rehanId })],
    [
      "getRehanTransactionsByRehanId",
      ({ rehanId }) => getRehanTransactionsByRehanId(rehanId),
      (v, { rehanId }) => listWith(v, { rehanId, type: "diya", amount: 200 }),
    ],
    ["getLendenByUserId", ({ userId }) => getLendenByUserId(userId), (v, { lendenId }) => listWith(v, { id: lendenId })],
    ["getAllLenden", () => getAllLenden(), (v, { lendenId }) => listWith(v, { id: lendenId })],
    ["getAllTransactions", () => getAllTransactions(), bothRecords],
    ["searchTransactions", () => searchTransactions("Ram"), bothRecords],
    ["getUsersWithCounts", () => getUsersWithCounts(), ramWithCounts],
    ["searchUsersWithCounts", () => searchUsersWithCounts("Ram"), ramWithCounts],
    ["filterUsersWithCounts", () => filterUsersWithCounts({ name: "Ram", dateFrom: "2026-09-01" }), ramWithCounts],
    ["getTransactionsByUserId", ({ userId }) => getTransactionsByUserId(userId), bothRecords],
    [
      "getJamaEntriesByLendenId",
      ({ lendenId }) => getJamaEntriesByLendenId(lendenId),
      (v, { lendenId }) => listWith(v, { lendenId, amount: 300 }),
    ],
    [
      "getLendenItems",
      ({ lendenId }) => getLendenItems(lendenId),
      (v, { lendenId }) => listWith(v, { lendenId, name: "Ring", total: 1500 }),
    ],
    [
      "getLendenOldJewelleryItems",
      ({ lendenId }) => getLendenOldJewelleryItems(lendenId),
      (v, { lendenId }) => listWith(v, { lendenId, description: "Old ring", value: 500 }),
    ],
    ["getTotalJamaByLendenId", ({ lendenId }) => getTotalJamaByLendenId(lendenId), (v) => expect(v).toBe(300)],
  ];

  it.each(reads)("%s resolves with the real data while the database is healthy", async (_name, read, check) => {
    const ids = await seed();
    check(await read(ids), ids);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it.each(reads)("%s logs the error and rejects when the database is unreadable", async (_name, read) => {
    const ids = await seed();
    sqliteMock.__raw().close();
    await expect(read(ids)).rejects.toThrow();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("still resolves with null / [] / false / 0 for a record that is simply not there", async () => {
    await seed();
    await expect(getUserById(9999)).resolves.toBeNull();
    await expect(getRehanById(9999)).resolves.toBeNull();
    await expect(getLendenById(9999)).resolves.toBeNull();
    await expect(checkDuplicateUser("Nobody")).resolves.toBe(false);
    await expect(getTransactionsByUserId(9999)).resolves.toEqual([]);
    await expect(getRehanTransactionsByRehanId(9999)).resolves.toEqual([]);
    await expect(getJamaEntriesByLendenId(9999)).resolves.toEqual([]);
    await expect(getLendenItems(9999)).resolves.toEqual([]);
    await expect(getLendenOldJewelleryItems(9999)).resolves.toEqual([]);
    await expect(getTotalJamaByLendenId(9999)).resolves.toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  describe("updateLendenBaki", () => {
    it("recomputes baki from the jama entries while the database is healthy", async () => {
      const { lendenId } = await seed();
      expect(storedBill(lendenId)).toMatchObject({ baki: 700, status: 0 });
      await createJamaEntry({ lendenId, amount: 700, date: DAY });
      await updateLendenBaki(lendenId);
      expect(storedBill(lendenId)).toMatchObject({ baki: 0, status: 1 });
    });

    it("rejects and leaves the stored baki and status alone when the jama total cannot be read", async () => {
      const { lendenId } = await seed();
      const before = storedBill(lendenId);
      expect(before).toMatchObject({ baki: 700, status: 0 });

      // Reading the jama total fails; the old code took that as "no payments" and wrote baki = remaining (1000).
      sqliteMock.__raw().exec("DROP TABLE jama_entries");
      await expect(updateLendenBaki(lendenId)).rejects.toThrow();

      expect(storedBill(lendenId)).toEqual(before);
      expect(errorSpy).toHaveBeenCalled();
    });

    it("does not close or reopen a bill when the jama total cannot be read", async () => {
      const { lendenId } = await seed();
      // A paid-up bill: baki 0, closed.
      await createJamaEntry({ lendenId, amount: 700, date: DAY });
      await updateLendenBaki(lendenId);
      const closed = storedBill(lendenId);
      expect(closed).toMatchObject({ baki: 0, status: 1 });

      sqliteMock.__raw().exec("DROP TABLE jama_entries");
      await expect(updateLendenBaki(lendenId)).rejects.toThrow();

      expect(storedBill(lendenId)).toEqual(closed);
    });

    it("rejects when the bill cannot be read", async () => {
      const { lendenId } = await seed();
      sqliteMock.__raw().close();
      await expect(updateLendenBaki(lendenId)).rejects.toThrow();
    });

    it("still does nothing for a bill that does not exist", async () => {
      await seed();
      await expect(updateLendenBaki(9999)).resolves.toBeUndefined();
    });
  });
});

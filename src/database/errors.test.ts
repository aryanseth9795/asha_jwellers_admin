/**
 * A failed read must reject, never come back as an empty list, "not found", false or 0 (hardening plan, task 1).
 * Runs the real database layer on node:sqlite through the shared expo-sqlite stand-in; skipped where node:sqlite is
 * not available. "Not found" is a successful query with no row, so it still resolves with null / [] / false.
 */

jest.mock("expo-sqlite", () => require("../test/sqliteStandIn").createSqliteStandIn());

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
} from "./entryDatabase";
import { getLendenItems, replaceLendenItems } from "./lendenItems";
import { getLendenOldJewelleryItems, replaceLendenOldJewelleryItems } from "./lendenOldJewelleryItems";
import type { SqliteStandIn } from "../test/sqliteStandIn";

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

  type Reads = [string, (ids: { userId: number; rehanId: number; lendenId: number }) => Promise<unknown>][];
  const reads: Reads = [
    ["checkDuplicateUser", () => checkDuplicateUser("Ram", "Manwal", "9876543210")],
    ["getUserById", ({ userId }) => getUserById(userId)],
    ["getRehanById", ({ rehanId }) => getRehanById(rehanId)],
    ["getLendenById", ({ lendenId }) => getLendenById(lendenId)],
    ["getAllUsers", () => getAllUsers()],
    ["searchUsers", () => searchUsers("Ram")],
    ["getRehanByUserId", ({ userId }) => getRehanByUserId(userId)],
    ["getAllRehan", () => getAllRehan()],
    ["getRehanTransactionsByRehanId", ({ rehanId }) => getRehanTransactionsByRehanId(rehanId)],
    ["getLendenByUserId", ({ userId }) => getLendenByUserId(userId)],
    ["getAllLenden", () => getAllLenden()],
    ["getAllTransactions", () => getAllTransactions()],
    ["searchTransactions", () => searchTransactions("Ram")],
    ["getUsersWithCounts", () => getUsersWithCounts()],
    ["searchUsersWithCounts", () => searchUsersWithCounts("Ram")],
    ["filterUsersWithCounts", () => filterUsersWithCounts({ name: "Ram", dateFrom: "2026-09-01" })],
    ["getTransactionsByUserId", ({ userId }) => getTransactionsByUserId(userId)],
    ["getJamaEntriesByLendenId", ({ lendenId }) => getJamaEntriesByLendenId(lendenId)],
    ["getLendenItems", ({ lendenId }) => getLendenItems(lendenId)],
    ["getLendenOldJewelleryItems", ({ lendenId }) => getLendenOldJewelleryItems(lendenId)],
    ["getTotalJamaByLendenId", ({ lendenId }) => getTotalJamaByLendenId(lendenId)],
  ];

  it.each(reads)("%s resolves with the real data while the database is healthy", async (_name, read) => {
    const ids = await seed();
    await expect(read(ids)).resolves.toBeDefined();
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

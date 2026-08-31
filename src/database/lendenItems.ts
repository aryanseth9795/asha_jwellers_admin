import * as SQLite from "expo-sqlite";
import { LendenItem, NewLendenItem, Purity } from "../types/entry";

// entryDatabase.ts owns schema creation; this module only reads and writes rows.
let db: SQLite.SQLiteDatabase | null = null;

const openDatabase = async () => {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("aj_database.db");
  return db;
};

interface LendenItemRow {
  id: number;
  lendenId: number;
  position: number;
  name: string;
  purity: string | null;
  weight: number | null;
  rate: number | null;
  total: number;
}

const toLendenItem = (row: LendenItemRow): LendenItem => ({
  id: row.id,
  lendenId: row.lendenId,
  position: row.position,
  name: row.name,
  purity: (row.purity as Purity | null) ?? null,
  weight: row.weight,
  rate: row.rate,
  total: row.total,
});

/** Items for one Len-Den entry, ordered by their printed क्रं. */
export const getLendenItems = async (
  lendenId: number,
): Promise<LendenItem[]> => {
  try {
    const database = await openDatabase();
    const rows = await database.getAllAsync<LendenItemRow>(
      "SELECT * FROM lenden_items WHERE lendenId = ? ORDER BY position ASC",
      lendenId,
    );
    return rows.map(toLendenItem);
  } catch (error) {
    console.error("Error getting Lenden items:", error);
    return [];
  }
};

/**
 * Replaces every item on an entry, renumbering position from 1.
 * Delete-then-insert keeps the क्रं. column contiguous with no gaps.
 */
export const replaceLendenItems = async (
  lendenId: number,
  items: NewLendenItem[],
): Promise<void> => {
  try {
    const database = await openDatabase();
    await database.withTransactionAsync(async () => {
      await database.runAsync(
        "DELETE FROM lenden_items WHERE lendenId = ?",
        lendenId,
      );
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await database.runAsync(
          "INSERT INTO lenden_items (lendenId, position, name, purity, weight, rate, total) VALUES (?, ?, ?, ?, ?, ?, ?)",
          lendenId,
          i + 1,
          item.name,
          item.purity ?? null,
          item.weight ?? null,
          item.rate ?? null,
          item.total,
        );
      }
    });
  } catch (error) {
    console.error("Error replacing Lenden items:", error);
    throw error;
  }
};

/** Next bill number in the shop's series. Typing one in makes the series continue from there. */
export const getNextBillNo = async (): Promise<number> => {
  try {
    const database = await openDatabase();
    const row = await database.getFirstAsync<{ maxBillNo: number | null }>(
      "SELECT MAX(billNo) as maxBillNo FROM lenden",
    );
    return (row?.maxBillNo ?? 0) + 1;
  } catch (error) {
    console.error("Error getting next bill number:", error);
    return 1;
  }
};

export const setLendenBillNo = async (
  lendenId: number,
  billNo: number,
): Promise<void> => {
  try {
    const database = await openDatabase();
    await database.runAsync(
      "UPDATE lenden SET billNo = ? WHERE id = ?",
      billNo,
      lendenId,
    );
  } catch (error) {
    console.error("Error setting bill number:", error);
    throw error;
  }
};

/**
 * Separate from updateLendenDetails so that function's signature — and its
 * existing callers — stay untouched.
 */
export const setLendenAmountOverridden = async (
  lendenId: number,
  overridden: number,
): Promise<void> => {
  try {
    const database = await openDatabase();
    await database.runAsync(
      "UPDATE lenden SET amountOverridden = ? WHERE id = ?",
      overridden,
      lendenId,
    );
  } catch (error) {
    console.error("Error setting amountOverridden:", error);
    throw error;
  }
};

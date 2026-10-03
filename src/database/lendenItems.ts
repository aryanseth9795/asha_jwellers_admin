import * as SQLite from "expo-sqlite";
import {
  JewelleryMetal,
  LendenItem,
  NewLendenItem,
  Purity,
} from "../types/entry";
import { UUID_SQL, reusableUuid } from "./uuidSql";

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
  category: string | null;
  metal: string | null;
  purity: string | null;
  weight: number | null;
  qty: number | null;
  rate: number | null;
  total: number;
  uuid: string;
  updatedAt: string;
}

const toLendenItem = (row: LendenItemRow): LendenItem => ({
  id: row.id,
  lendenId: row.lendenId,
  position: row.position,
  name: row.name,
  category: row.category ?? null,
  metal: (row.metal as JewelleryMetal | null) ?? null,
  purity: (row.purity as Purity | null) ?? null,
  weight: row.weight,
  qty: row.qty ?? 1,
  rate: row.rate,
  total: row.total,
  uuid: row.uuid,
  updatedAt: row.updatedAt,
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
    const now = new Date().toISOString();
    // An item passed in with a uuid keeps it (its identity survives an edit);
    // anything else, or a uuid repeated in this call, gets a fresh one.
    const taken = new Set<string>();
    await database.withTransactionAsync(async () => {
      await database.runAsync(
        "DELETE FROM lenden_items WHERE lendenId = ?",
        lendenId,
      );
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const keepUuid = reusableUuid(item.uuid, taken);
        await database.runAsync(
          `INSERT INTO lenden_items (lendenId, position, name, category, metal, purity, weight, qty, rate, total, uuid, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, ${UUID_SQL}), ?)`,
          lendenId,
          i + 1,
          item.name,
          item.category || null,
          item.metal ?? null,
          item.purity ?? null,
          item.weight ?? null,
          item.qty ?? 1,
          item.rate ?? null,
          item.total,
          keepUuid,
          now,
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
    throw error;
  }
};

export const setLendenBillNo = async (
  lendenId: number,
  billNo: number,
): Promise<void> => {
  try {
    const database = await openDatabase();
    await database.runAsync(
      "UPDATE lenden SET billNo = ?, updatedAt = ? WHERE id = ?",
      billNo,
      new Date().toISOString(),
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
      "UPDATE lenden SET amountOverridden = ?, updatedAt = ? WHERE id = ?",
      overridden,
      new Date().toISOString(),
      lendenId,
    );
  } catch (error) {
    console.error("Error setting amountOverridden:", error);
    throw error;
  }
};

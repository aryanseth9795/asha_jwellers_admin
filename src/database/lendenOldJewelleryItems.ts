import * as SQLite from "expo-sqlite";
import {
  JewelleryMetal,
  NewOldJewelleryItem,
  OldJewelleryItem,
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

interface OldJewelleryItemRow {
  id: number;
  lendenId: number;
  position: number;
  description: string;
  metal: string | null;
  purity: string | null;
  weight: number | null;
  value: number;
  uuid: string;
  updatedAt: string;
}

// Anything other than a known metal is treated as untracked, never guessed.
const toMetal = (value: string | null): JewelleryMetal | null =>
  value === "gold" || value === "silver" ? value : null;

const toOldJewelleryItem = (row: OldJewelleryItemRow): OldJewelleryItem => ({
  id: row.id,
  lendenId: row.lendenId,
  position: row.position,
  description: row.description,
  metal: toMetal(row.metal),
  purity: (row.purity as Purity | null) ?? null,
  weight: row.weight,
  value: row.value,
  uuid: row.uuid,
  updatedAt: row.updatedAt,
});

export const getLendenOldJewelleryItems = async (
  lendenId: number,
): Promise<OldJewelleryItem[]> => {
  try {
    const database = await openDatabase();
    const rows = await database.getAllAsync<OldJewelleryItemRow>(
      "SELECT * FROM lenden_old_jewellery_items WHERE lendenId = ? ORDER BY position ASC",
      lendenId,
    );
    return rows.map(toOldJewelleryItem);
  } catch (error) {
    console.error("Error getting old jewellery items:", error);
    throw error;
  }
};

/** Replaces an entry's old-jewellery items and keeps their display order contiguous. */
export const replaceLendenOldJewelleryItems = async (
  lendenId: number,
  items: NewOldJewelleryItem[],
): Promise<void> => {
  try {
    const database = await openDatabase();
    const now = new Date().toISOString();
    // An item passed in with a uuid keeps it (its identity survives an edit);
    // anything else, or a uuid repeated in this call, gets a fresh one.
    const taken = new Set<string>();
    await database.withTransactionAsync(async () => {
      await database.runAsync(
        "DELETE FROM lenden_old_jewellery_items WHERE lendenId = ?",
        lendenId,
      );

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const keepUuid = reusableUuid(item.uuid, taken);
        await database.runAsync(
          `INSERT INTO lenden_old_jewellery_items (lendenId, position, description, metal, purity, weight, value, uuid, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, ${UUID_SQL}), ?)`,
          lendenId,
          i + 1,
          item.description.trim(),
          item.metal ?? null,
          item.purity ?? null,
          item.weight ?? null,
          item.value,
          keepUuid,
          now,
        );
      }
    });
  } catch (error) {
    console.error("Error replacing old jewellery items:", error);
    throw error;
  }
};

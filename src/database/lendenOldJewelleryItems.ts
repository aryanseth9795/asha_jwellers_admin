import * as SQLite from "expo-sqlite";
import {
  NewOldJewelleryItem,
  OldJewelleryItem,
} from "../types/entry";

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
  weight: number | null;
  value: number;
}

const toOldJewelleryItem = (row: OldJewelleryItemRow): OldJewelleryItem => ({
  id: row.id,
  lendenId: row.lendenId,
  position: row.position,
  description: row.description,
  weight: row.weight,
  value: row.value,
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
    return [];
  }
};

/** Replaces an entry's old-jewellery items and keeps their display order contiguous. */
export const replaceLendenOldJewelleryItems = async (
  lendenId: number,
  items: NewOldJewelleryItem[],
): Promise<void> => {
  try {
    const database = await openDatabase();
    await database.withTransactionAsync(async () => {
      await database.runAsync(
        "DELETE FROM lenden_old_jewellery_items WHERE lendenId = ?",
        lendenId,
      );

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await database.runAsync(
          "INSERT INTO lenden_old_jewellery_items (lendenId, position, description, weight, value) VALUES (?, ?, ?, ?, ?)",
          lendenId,
          i + 1,
          item.description.trim(),
          item.weight ?? null,
          item.value,
        );
      }
    });
  } catch (error) {
    console.error("Error replacing old jewellery items:", error);
    throw error;
  }
};

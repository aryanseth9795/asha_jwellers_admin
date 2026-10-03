import * as SQLite from "expo-sqlite";
import { categoryOptions } from "../utils/itemCategories";

// entryDatabase.ts owns schema creation; this module only reads rows (own connection, like villages.ts).
let db: SQLite.SQLiteDatabase | null = null;

const openDatabase = async () => {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("aj_database.db");
  return db;
};

/** Every stored category, one entry per rehan or bill item (null for records saved before categories). */
export const getStoredCategories = async (): Promise<(string | null)[]> => {
  const database = await openDatabase();
  const rows = await database.getAllAsync<{ category: string | null }>(
    "SELECT category FROM rehan UNION ALL SELECT category FROM lenden_items",
  );
  return rows.map((r) => r.category);
};

/** The dropdown list: base categories, then the custom ones already stored. */
export const getCategoryOptions = async (): Promise<string[]> => categoryOptions(await getStoredCategories());

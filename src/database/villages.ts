import * as SQLite from "expo-sqlite";
import { canonicalVillages, Village } from "../utils/villageNames";

// entryDatabase.ts owns schema creation; this module only reads rows (own connection, like lendenItems.ts).
let db: SQLite.SQLiteDatabase | null = null;

const openDatabase = async () => {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("aj_database.db");
  return db;
};

/** Distinct village names from the customers' address field, most used first. */
export const getVillages = async (): Promise<Village[]> => {
  const database = await openDatabase();
  const rows = await database.getAllAsync<{ address: string | null }>("SELECT address FROM users");
  return canonicalVillages(rows.map((r) => r.address));
};

import * as SQLite from "expo-sqlite";
import {
  AnalyticsData,
  JamaRow,
  LendenRow,
  OldItemRow,
  RehanRow,
  RehanTxRow,
  SoldItemRow,
  UserRow,
} from "../utils/analytics/types";

// entryDatabase.ts owns schema creation; this module only reads.
let db: SQLite.SQLiteDatabase | null = null;

const openDatabase = async () => {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("aj_database.db");
  return db;
};

/** Flat rows for every analytics section; only the columns the views need. */
export const getAnalyticsData = async (): Promise<AnalyticsData> => {
  const database = await openDatabase();
  return {
    users: await database.getAllAsync<UserRow>(
      "SELECT id, name, address, mobileNumber, createdAt FROM users",
    ),
    lenden: await database.getAllAsync<LendenRow>(
      "SELECT id, userId, date, amount, discount, remaining, jama, baki, status, billNo, amountOverridden, media FROM lenden",
    ),
    jama: await database.getAllAsync<JamaRow>("SELECT lendenId, amount, date FROM jama_entries"),
    rehan: await database.getAllAsync<RehanRow>(
      "SELECT id, userId, openDate, closedDate, status, amount, productName, category, media FROM rehan",
    ),
    rehanTx: await database.getAllAsync<RehanTxRow>(
      "SELECT rehanId, type, amount, date FROM rehan_transactions",
    ),
    soldItems: await database.getAllAsync<SoldItemRow>(
      "SELECT lendenId, metal, purity, weight, total FROM lenden_items",
    ),
    oldItems: await database.getAllAsync<OldItemRow>(
      "SELECT lendenId, metal, weight, value FROM lenden_old_jewellery_items",
    ),
  };
};

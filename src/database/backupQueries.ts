import * as SQLite from "expo-sqlite";
import {
  BackupData,
  LocalCustomer,
  LocalJamaEntry,
  LocalLenden,
  LocalLendenItem,
  LocalOldJewellery,
  LocalRehan,
  LocalRehanTransaction,
  LocalSnapshot,
  MergePlan,
  TABLE_KEYS,
  TableKey,
} from "../backup/format";
import { normalizeDay } from "../utils/dates";
import { UUID_SQL } from "./uuidSql";

/**
 * Whole-ledger reads and writes for backup export and import (backup spec §5, §6.1, §6.2).
 * entryDatabase.ts owns the schema; this module only reads and writes rows (own connection, like lendenItems.ts).
 *
 * Every read and every apply runs inside ONE withExclusiveTransactionAsync, and every statement in it goes through the
 * transaction object (`txn`), never the module-level connection, so nothing escapes the transaction.
 */
let db: SQLite.SQLiteDatabase | null = null;

const openDatabase = async () => {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("aj_database.db");
  return db;
};

/** The transaction handed to withExclusiveTransactionAsync has the SQLiteDatabase interface. */
type Txn = SQLite.SQLiteDatabase;

/** Key of one photo in the media map: a photo belongs to one record, even when two records name the same file. */
export const mediaKey = (recordUuid: string, relativePath: string): string => `${recordUuid}|${relativePath}`;

const parseMedia = (value: unknown): string[] => {
  if (typeof value !== "string" || value === "") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string" && p !== "") : [];
  } catch {
    return [];
  }
};

type WithMediaText<T> = Omit<T, "media"> & { media: string | null };

/** A consistent read of all 7 ledger tables, rows in id (insertion) order. */
export const readSnapshot = async (): Promise<LocalSnapshot> => {
  const database = await openDatabase();
  let snapshot: LocalSnapshot | null = null;
  await database.withExclusiveTransactionAsync(async (txn: Txn) => {
    const customers = await txn.getAllAsync<LocalCustomer>(
      "SELECT id, uuid, name, address, mobileNumber, nickname, createdAt, updatedAt FROM users ORDER BY id",
    );
    const rehan = await txn.getAllAsync<WithMediaText<LocalRehan>>(
      "SELECT id, uuid, userId, productName, category, amount, status, openDate, closedDate, media, updatedAt FROM rehan ORDER BY id",
    );
    const rehanTransactions = await txn.getAllAsync<LocalRehanTransaction>(
      "SELECT id, uuid, rehanId, type, amount, date, updatedAt FROM rehan_transactions ORDER BY id",
    );
    const lenden = await txn.getAllAsync<WithMediaText<LocalLenden>>(
      "SELECT id, uuid, userId, date, amount, discount, remaining, jama, baki, status, billNo, amountOverridden, media, updatedAt FROM lenden ORDER BY id",
    );
    const lendenItems = await txn.getAllAsync<LocalLendenItem>(
      "SELECT id, uuid, lendenId, position, name, category, metal, purity, weight, qty, rate, total, updatedAt FROM lenden_items ORDER BY id",
    );
    const oldJewellery = await txn.getAllAsync<LocalOldJewellery>(
      "SELECT id, uuid, lendenId, position, description, metal, purity, weight, value, updatedAt FROM lenden_old_jewellery_items ORDER BY id",
    );
    const jamaEntries = await txn.getAllAsync<LocalJamaEntry>(
      "SELECT id, uuid, lendenId, amount, date, updatedAt FROM jama_entries ORDER BY id",
    );
    snapshot = {
      customers,
      rehan: rehan.map((r) => ({ ...r, media: parseMedia(r.media) })),
      rehanTransactions,
      lenden: lenden.map((l) => ({ ...l, media: parseMedia(l.media) })),
      lendenItems,
      oldJewellery,
      jamaEntries,
    };
  });
  if (!snapshot) throw new Error("Could not read the ledger");
  return snapshot;
};

/** Fresh lower-case v4 uuids from SQLite (no JS crypto dependency), used when converting an old backup. */
export const newUuids = async (count: number): Promise<string[]> => {
  if (count <= 0) return [];
  const database = await openDatabase();
  const rows = await database.getAllAsync<{ uuid: string }>(
    `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?) SELECT ${UUID_SQL} AS uuid FROM n`,
    count,
  );
  return rows.map((r) => r.uuid);
};

const zeroCounts = (): Record<TableKey, number> =>
  Object.fromEntries(TABLE_KEYS.map((k) => [k, 0])) as Record<TableKey, number>;

/** Absolute photo paths for a record, in order. Every photo must have been copied before the database is touched. */
const localMedia = (recordUuid: string, media: string[], mediaMap: Map<string, string>): string => {
  const paths = media.map((rel) => {
    const path = mediaMap.get(mediaKey(recordUuid, rel));
    if (!path) throw new Error(`Photo ${rel} was not copied`);
    return path;
  });
  return JSON.stringify(paths);
};

/**
 * Inserts rows as they are (stored values, uuid, updatedAt), parents first. Parent uuids resolve through the ids
 * inserted in this run, then through the rows already on the phone. A customerUuid of null gives userId 0
 * ("customer not on file"). Any unresolved parent throws, which rolls the whole transaction back.
 *
 * The calendar fields (rehan openDate/closedDate, every other date) are stored as plain local days, whatever the
 * caller hands in, so no import path can write a timestamp into them. validateBackup and convertLegacy already give
 * plain days; a value that is not a date throws here and rolls everything back.
 */
const insertRows = async (
  txn: Txn,
  data: BackupData,
  mediaMap: Map<string, string>,
): Promise<Record<TableKey, number>> => {
  const counts = zeroCounts();
  const inserted = {
    users: new Map<string, number>(),
    rehan: new Map<string, number>(),
    lenden: new Map<string, number>(),
  };
  const idOf = async (table: keyof typeof inserted, uuid: string): Promise<number> => {
    const fresh = inserted[table].get(uuid);
    if (fresh !== undefined) return fresh;
    const row = await txn.getFirstAsync<{ id: number }>(`SELECT id FROM ${table} WHERE uuid = ?`, uuid);
    if (!row) throw new Error(`Record ${uuid} is not in ${table}`);
    return row.id;
  };
  const customerId = async (uuid: string | null) => (uuid === null ? 0 : idOf("users", uuid));

  for (const c of data.customers) {
    const r = await txn.runAsync(
      "INSERT INTO users (uuid, name, address, mobileNumber, nickname, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      c.uuid,
      c.name,
      c.address,
      c.mobileNumber,
      c.nickname,
      c.createdAt,
      c.updatedAt,
    );
    inserted.users.set(c.uuid, r.lastInsertRowId);
    counts.customers++;
  }

  for (const x of data.rehan) {
    const r = await txn.runAsync(
      "INSERT INTO rehan (uuid, userId, productName, category, amount, status, openDate, closedDate, media, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      x.uuid,
      await customerId(x.customerUuid),
      x.productName,
      x.category,
      x.amount,
      x.status,
      normalizeDay(x.openDate),
      x.closedDate == null ? null : normalizeDay(x.closedDate),
      localMedia(x.uuid, x.media, mediaMap),
      x.updatedAt,
    );
    inserted.rehan.set(x.uuid, r.lastInsertRowId);
    counts.rehan++;
  }

  for (const t of data.rehanTransactions) {
    await txn.runAsync(
      "INSERT INTO rehan_transactions (uuid, rehanId, type, amount, date, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      t.uuid,
      await idOf("rehan", t.rehanUuid),
      t.type,
      t.amount,
      normalizeDay(t.date),
      t.updatedAt,
    );
    counts.rehanTransactions++;
  }

  for (const l of data.lenden) {
    const r = await txn.runAsync(
      "INSERT INTO lenden (uuid, userId, date, amount, discount, remaining, jama, baki, status, billNo, amountOverridden, media, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      l.uuid,
      await customerId(l.customerUuid),
      normalizeDay(l.date),
      l.amount,
      l.discount,
      l.remaining,
      l.jama,
      l.baki,
      l.status,
      l.billNo,
      l.amountOverridden,
      localMedia(l.uuid, l.media, mediaMap),
      l.updatedAt,
    );
    inserted.lenden.set(l.uuid, r.lastInsertRowId);
    counts.lenden++;
  }

  for (const i of data.lendenItems) {
    await txn.runAsync(
      "INSERT INTO lenden_items (uuid, lendenId, position, name, category, metal, purity, weight, qty, rate, total, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      i.uuid,
      await idOf("lenden", i.lendenUuid),
      i.position,
      i.name,
      i.category,
      i.metal,
      i.purity,
      i.weight,
      i.qty,
      i.rate,
      i.total,
      i.updatedAt,
    );
    counts.lendenItems++;
  }

  for (const o of data.oldJewellery) {
    await txn.runAsync(
      "INSERT INTO lenden_old_jewellery_items (uuid, lendenId, position, description, metal, purity, weight, value, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      o.uuid,
      await idOf("lenden", o.lendenUuid),
      o.position,
      o.description,
      o.metal,
      o.purity,
      o.weight,
      o.value,
      o.updatedAt,
    );
    counts.oldJewellery++;
  }

  for (const j of data.jamaEntries) {
    await txn.runAsync(
      "INSERT INTO jama_entries (uuid, lendenId, amount, date, updatedAt) VALUES (?, ?, ?, ?, ?)",
      j.uuid,
      await idOf("lenden", j.lendenUuid),
      j.amount,
      normalizeDay(j.date),
      j.updatedAt,
    );
    counts.jamaEntries++;
  }

  return counts;
};

/**
 * Replace and restore (spec §6.2): deletes every ledger row, then inserts the backup exactly as stored (calendar days
 * as plain days, see insertRows). Recalculates nothing. `mediaMap` maps mediaKey(recordUuid, relative path) to the
 * copied photo's absolute path.
 */
export const applyReplace = async (
  data: BackupData,
  mediaMap: Map<string, string>,
): Promise<Record<TableKey, number>> => {
  const database = await openDatabase();
  let counts = zeroCounts();
  await database.withExclusiveTransactionAsync(async (txn: Txn) => {
    // Children first, so no step ever leaves a row pointing at a deleted parent.
    for (const table of [
      "rehan_transactions",
      "jama_entries",
      "lenden_items",
      "lenden_old_jewellery_items",
      "rehan",
      "lenden",
      "users",
    ]) {
      await txn.runAsync(`DELETE FROM ${table}`);
    }
    counts = await insertRows(txn, data, mediaMap);
  });
  return counts;
};

/**
 * Safe merge (spec §6.1): inserts the planned rows, applies new diya/jama to rehan already on the phone (as
 * createRehanTransaction does) and recalculates baki for bills already on the phone that received payments (as
 * updateLendenBaki does). One transaction: a failure anywhere changes nothing.
 */
export const applyMerge = async (
  plan: MergePlan,
  mediaMap: Map<string, string>,
): Promise<Record<TableKey, number>> => {
  const database = await openDatabase();
  let counts = zeroCounts();
  await database.withExclusiveTransactionAsync(async (txn: Txn) => {
    counts = await insertRows(txn, plan.insert, mediaMap);

    // Mirrors createRehanTransaction: diya adds to the balance, jama takes from it.
    const txByUuid = new Map(plan.insert.rehanTransactions.map((t) => [t.uuid, t]));
    for (const uuid of plan.applyToBalance) {
      const t = txByUuid.get(uuid);
      if (!t) throw new Error(`Rehan transaction ${uuid} is not in the merge`);
      const operator = t.type === "diya" ? "+" : "-";
      const r = await txn.runAsync(
        `UPDATE rehan SET amount = amount ${operator} ?, updatedAt = ? WHERE uuid = ?`,
        t.amount,
        new Date().toISOString(),
        t.rehanUuid,
      );
      if (r.changes !== 1) throw new Error(`Rehan ${t.rehanUuid} is not on this phone`);
    }

    // Mirrors updateLendenBaki: baki = remaining − Σ jama entries, never below 0; a bill at 0 is closed.
    for (const uuid of plan.recomputeLenden) {
      const lenden = await txn.getFirstAsync<{ id: number; remaining: number | null }>(
        "SELECT id, remaining FROM lenden WHERE uuid = ?",
        uuid,
      );
      if (!lenden) throw new Error(`Len-den ${uuid} is not on this phone`);
      const row = await txn.getFirstAsync<{ total: number }>(
        "SELECT COALESCE(SUM(amount), 0) as total FROM jama_entries WHERE lendenId = ?",
        lenden.id,
      );
      const totalJama = row?.total ?? 0;
      const remaining = lenden.remaining || 0;
      const baki = remaining - totalJama;
      const finalBaki = baki >= 0 ? baki : 0;
      const status = finalBaki === 0 ? 1 : 0;
      await txn.runAsync(
        "UPDATE lenden SET baki = ?, status = ?, updatedAt = ? WHERE id = ?",
        finalBaki,
        status,
        new Date().toISOString(),
        lenden.id,
      );
    }
  });
  return counts;
};

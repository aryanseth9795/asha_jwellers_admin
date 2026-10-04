import * as SQLite from "expo-sqlite";
import {
  User,
  NewUser,
  Rehan,
  NewRehan,
  Lenden,
  NewLenden,
  JamaEntry,
  NewJamaEntry,
} from "../types/entry";
import { UUID_SQL } from "./uuidSql";
import { ensureIndexes } from "./indexes";

let db: SQLite.SQLiteDatabase | null = null;

// Open database connection
const openDatabase = async () => {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("aj_database.db");
  return db;
};

// Tables that carry a permanent uuid + updatedAt, with the column whose value
// seeds updatedAt for rows that already exist (null = no usable date, use now).
const IDENTITY_TABLES: { table: string; dateColumn: string | null }[] = [
  { table: "users", dateColumn: "createdAt" },
  { table: "rehan", dateColumn: "openDate" },
  { table: "rehan_transactions", dateColumn: "date" },
  { table: "lenden", dateColumn: "date" },
  { table: "lenden_items", dateColumn: null },
  { table: "lenden_old_jewellery_items", dateColumn: null },
  { table: "jama_entries", dateColumn: "date" },
];

const ensureIdentityColumns = async (database: SQLite.SQLiteDatabase) => {
  for (const { table, dateColumn } of IDENTITY_TABLES) {
    const columns = (
      await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)
    ).map((c) => c.name);

    if (!columns.includes("uuid")) {
      // DATA SAFETY: the ALTERs and both backfills MUST be one atomic unit (same
      // reasoning as amountOverridden above). If the uuid column landed but the
      // backfill did not, the guard above would be satisfied on the next launch
      // and the backfill would NEVER RUN AGAIN, leaving rows with NULL uuids that
      // a backup cannot identify. In a transaction a failure rolls everything
      // back, so the next launch retries from the original table.
      const now = new Date().toISOString();
      await database.withTransactionAsync(async () => {
        await database.execAsync(`ALTER TABLE ${table} ADD COLUMN uuid TEXT`);
        // updatedAt may already exist if a previous build added it; only add it when missing.
        if (!columns.includes("updatedAt")) {
          await database.execAsync(
            `ALTER TABLE ${table} ADD COLUMN updatedAt TEXT`,
          );
        }
        await database.execAsync(
          `UPDATE ${table} SET uuid = ${UUID_SQL} WHERE uuid IS NULL`,
        );
        await database.runAsync(
          dateColumn
            ? `UPDATE ${table} SET updatedAt = COALESCE(${dateColumn}, ?) WHERE updatedAt IS NULL`
            : `UPDATE ${table} SET updatedAt = ? WHERE updatedAt IS NULL`,
          now,
        );
      });
      console.log(`Added uuid and updatedAt to ${table} and backfilled existing rows`);
    }

    // Always runs: a no-op once the index exists. Created after the backfill so
    // existing rows are already unique.
    await database.execAsync(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_uuid ON ${table}(uuid)`,
    );
  }
};

// Item category (backup spec section 11). Records saved before this column existed
// keep NULL; analytics fall back to the keyword rule for them. Like the identity
// columns, this is deliberately NOT inside the swallowing migration try/catch: a
// single ALTER ... ADD COLUMN is atomic, and a swallowed failure would let the app
// run with INSERTs that name a column that does not exist.
const ensureCategoryColumns = async (database: SQLite.SQLiteDatabase) => {
  for (const table of ["rehan", "lenden_items"]) {
    const columns = (
      await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)
    ).map((c) => c.name);
    if (!columns.includes("category")) {
      await database.execAsync(`ALTER TABLE ${table} ADD COLUMN category TEXT`);
      console.log(`Added category to ${table} table`);
    }
  }
};

// Initialize database (create tables if not exist)
export const initDatabase = async () => {
  try {
    const database = await openDatabase();

    // Create Users table
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        mobileNumber TEXT,
        nickname TEXT,
        createdAt TEXT NOT NULL,
        uuid TEXT,
        updatedAt TEXT
      );
    `);

    // Create Rehan table
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS rehan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        media TEXT NOT NULL,
        status INTEGER DEFAULT 0,
        openDate TEXT NOT NULL,
        closedDate TEXT,
        productName TEXT,
        category TEXT,
        amount INTEGER,
        uuid TEXT,
        updatedAt TEXT,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Create Lenden table
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS lenden (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        date TEXT NOT NULL,
        media TEXT NOT NULL,
        amount INTEGER,
        discount INTEGER,
        remaining INTEGER,
        jama INTEGER,
        baki INTEGER,
        uuid TEXT,
        updatedAt TEXT,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Create Jama Entries table (multiple jama payments per lenden)
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS jama_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lendenId INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        date TEXT NOT NULL,
        uuid TEXT,
        updatedAt TEXT,
        FOREIGN KEY (lendenId) REFERENCES lenden(id) ON DELETE CASCADE
      );
    `);

    // Create Lenden Items table (jewellery line items per lenden)
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS lenden_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lendenId INTEGER NOT NULL,
        position INTEGER NOT NULL,
        name TEXT NOT NULL,
        category TEXT,
        metal TEXT,
        purity TEXT,
        weight REAL,
        qty INTEGER DEFAULT 1,
        rate INTEGER,
        total INTEGER NOT NULL,
        uuid TEXT,
        updatedAt TEXT,
        FOREIGN KEY (lendenId) REFERENCES lenden(id) ON DELETE CASCADE
      );
    `);

    // Old jewellery received as credit against a Len-Den sale.
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS lenden_old_jewellery_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lendenId INTEGER NOT NULL,
        position INTEGER NOT NULL,
        description TEXT NOT NULL,
        metal TEXT,
        purity TEXT,
        weight REAL,
        value INTEGER NOT NULL,
        uuid TEXT,
        updatedAt TEXT,
        FOREIGN KEY (lendenId) REFERENCES lenden(id) ON DELETE CASCADE
      );
    `);

    // Create Rehan Transactions table
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS rehan_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rehanId INTEGER NOT NULL,
        type TEXT NOT NULL, 
        amount INTEGER NOT NULL,
        date TEXT NOT NULL,
        uuid TEXT,
        updatedAt TEXT,
        FOREIGN KEY (rehanId) REFERENCES rehan(id) ON DELETE CASCADE
      );
    `);

    // Migrations to add columns if they don't exist (for existing app installs)
    try {
      // Check if columns exist in rehan, if not add them
      const rehanInfo = await database.getAllAsync<{ name: string }>(
        "PRAGMA table_info(rehan)",
      );
      const rehanColumns = rehanInfo.map((c) => c.name);

      if (!rehanColumns.includes("productName")) {
        await database.execAsync(
          "ALTER TABLE rehan ADD COLUMN productName TEXT",
        );
        console.log("Added productName to rehan table");
      }
      if (!rehanColumns.includes("amount")) {
        await database.execAsync("ALTER TABLE rehan ADD COLUMN amount INTEGER");
        console.log("Added amount to rehan table");
      }

      // Check if columns exist in lenden, if not add them
      const lendenInfo = await database.getAllAsync<{ name: string }>(
        "PRAGMA table_info(lenden)",
      );
      const lendenColumns = lendenInfo.map((c) => c.name);

      if (!lendenColumns.includes("amount")) {
        await database.execAsync(
          "ALTER TABLE lenden ADD COLUMN amount INTEGER",
        );
        console.log("Added amount to lenden table");
      }
      if (!lendenColumns.includes("discount")) {
        await database.execAsync(
          "ALTER TABLE lenden ADD COLUMN discount INTEGER",
        );
        console.log("Added discount to lenden table");
      }
      if (!lendenColumns.includes("remaining")) {
        await database.execAsync(
          "ALTER TABLE lenden ADD COLUMN remaining INTEGER",
        );
        console.log("Added remaining to lenden table");
      }
      if (!lendenColumns.includes("jama")) {
        await database.execAsync("ALTER TABLE lenden ADD COLUMN jama INTEGER");
        console.log("Added jama to lenden table");
      }
      if (!lendenColumns.includes("baki")) {
        await database.execAsync("ALTER TABLE lenden ADD COLUMN baki INTEGER");
        console.log("Added baki to lenden table");
      }
      if (!lendenColumns.includes("status")) {
        await database.execAsync(
          "ALTER TABLE lenden ADD COLUMN status INTEGER DEFAULT 0",
        );
        console.log("Added status to lenden table");
      }
      if (!lendenColumns.includes("billNo")) {
        await database.execAsync("ALTER TABLE lenden ADD COLUMN billNo INTEGER");
        console.log("Added billNo to lenden table");
      }
      if (!lendenColumns.includes("amountOverridden")) {
        // DATA SAFETY: every row that exists at this instant predates line
        // items, so its stored amount is authoritative. Without this backfill
        // resolveEffectiveAmount would recompute historical amounts from an
        // empty item list and rewrite them all to 0.
        //
        // The ALTER and the UPDATE MUST be atomic. If the column lands and the
        // backfill does not, the surrounding migration block's catch swallows
        // the error, the column-existence guard above is now satisfied, and the
        // backfill NEVER RUNS AGAIN — leaving every historical row at
        // amountOverridden = 0, protected only by the items.length === 0
        // fallback, which stops protecting them the moment anyone adds a line
        // item to an old entry.
        await database.withTransactionAsync(async () => {
          await database.execAsync(
            "ALTER TABLE lenden ADD COLUMN amountOverridden INTEGER DEFAULT 0",
          );
          await database.execAsync("UPDATE lenden SET amountOverridden = 1");
        });
        console.log(
          "Added amountOverridden to lenden table and backfilled existing rows",
        );
      }

      const lendenItemColumns = (
        await database.getAllAsync<{ name: string }>(
          "PRAGMA table_info(lenden_items)",
        )
      ).map((c) => c.name);
      if (!lendenItemColumns.includes("metal")) {
        await database.withTransactionAsync(async () => {
          await database.execAsync(
            "ALTER TABLE lenden_items ADD COLUMN metal TEXT",
          );
          // Old items stored Silver as a purity value. All other historical
          // purity values are gold, so existing bills stay meaningful.
          await database.execAsync(
            "UPDATE lenden_items SET metal = CASE WHEN purity = 'Silver' THEN 'silver' ELSE 'gold' END WHERE metal IS NULL",
          );
        });
        console.log("Added metal to lenden_items table");
      }

      if (!lendenItemColumns.includes("qty")) {
        await database.execAsync(
          "ALTER TABLE lenden_items ADD COLUMN qty INTEGER DEFAULT 1",
        );
        console.log("Added qty to lenden_items table");
      }
    } catch (migrationError) {
      console.error("Migration error:", migrationError);
      // Continue anyway as tables might be fresh
    }

    // Migration for metal/purity in old jewellery items
    try {
      const oldJewelleryColumns = (
        await database.getAllAsync<{ name: string }>(
          "PRAGMA table_info(lenden_old_jewellery_items)",
        )
      ).map((c) => c.name);
      // Existing rows keep metal NULL: guessing from the description could
      // push silver into gold totals, so they surface as "Unknown" instead.
      if (!oldJewelleryColumns.includes("metal")) {
        await database.execAsync(
          "ALTER TABLE lenden_old_jewellery_items ADD COLUMN metal TEXT",
        );
        console.log("Added metal to lenden_old_jewellery_items table");
      }
      if (!oldJewelleryColumns.includes("purity")) {
        await database.execAsync(
          "ALTER TABLE lenden_old_jewellery_items ADD COLUMN purity TEXT",
        );
        console.log("Added purity to lenden_old_jewellery_items table");
      }
    } catch (error) {
      console.error("Error migrating old jewellery items table:", error);
    }

    // Migration for nickname in users table
    try {
      const userColumns = (
        await database.getAllAsync<{ name: string }>("PRAGMA table_info(users)")
      ).map((c) => c.name);

      if (!userColumns.includes("nickname")) {
        await database.execAsync("ALTER TABLE users ADD COLUMN nickname TEXT");
        console.log("Added nickname to users table");
      }
    } catch (error) {
      console.error("Error migrating users table:", error);
    }

    await ensureCategoryColumns(database);

    // Permanent identity (uuid) + updatedAt on every table. Deliberately NOT
    // wrapped in a swallowing try/catch: each table migrates atomically, so a
    // failure leaves that table untouched and throws to the outer catch. The
    // next launch retries from a clean state. Swallowing it would let the app
    // run with INSERTs that reference a column that does not exist.
    await ensureIdentityColumns(database);

    // Index creation is non-fatal: indexes only affect speed, so a failure must
    // never stop the app from opening.
    try {
      await ensureIndexes(database);
    } catch (error) {
      console.error("Index creation failed (app continues, retried next launch):", error);
    }

    console.log("SQLite database initialized with User, Rehan, Lenden tables");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
};

// ============ USER CRUD ============

// Read functions log a failure and rethrow it, so a failed read never looks like real data (an empty list, "not
// found", false or 0). null / [] / false / 0 are returned only for a successful query that found nothing.

// Check if user with same name, address, and mobile exists
export const checkDuplicateUser = async (
  name: string,
  address?: string,
  mobileNumber?: string,
): Promise<boolean> => {
  try {
    const database = await openDatabase();
    const row = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM users 
       WHERE name = ? 
       AND (address = ? OR (address IS NULL AND ? IS NULL))
       AND (mobileNumber = ? OR (mobileNumber IS NULL AND ? IS NULL))`,
      name,
      address || null,
      address || null,
      mobileNumber || null,
      mobileNumber || null,
    );
    return (row?.count ?? 0) > 0;
  } catch (error) {
    console.error("Error checking duplicate user:", error);
    throw error;
  }
};

// Create new user
export const createUser = async (user: NewUser): Promise<number> => {
  try {
    const database = await openDatabase();
    const createdAt = new Date().toISOString();

    const result = await database.runAsync(
      `INSERT INTO users (name, address, mobileNumber, nickname, createdAt, uuid, updatedAt) VALUES (?, ?, ?, ?, ?, ${UUID_SQL}, ?)`,
      user.name,
      user.address || null,
      user.mobileNumber || null,
      user.nickname || null,
      createdAt,
      createdAt,
    );

    return result.lastInsertRowId;
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
};

// Get user by ID
export const getUserById = async (id: number): Promise<User | null> => {
  try {
    const database = await openDatabase();
    const row = await database.getFirstAsync<User>(
      "SELECT * FROM users WHERE id = ?",
      id,
    );
    return row || null;
  } catch (error) {
    console.error("Error getting user by ID:", error);
    throw error;
  }
};

// Get all users
export const getAllUsers = async (): Promise<User[]> => {
  try {
    const database = await openDatabase();
    const rows = await database.getAllAsync<User>(
      "SELECT * FROM users ORDER BY createdAt DESC",
    );
    return rows;
  } catch (error) {
    console.error("Error getting all users:", error);
    throw error;
  }
};

// Search users by name, address, or mobile
export const searchUsers = async (query: string): Promise<User[]> => {
  try {
    const database = await openDatabase();
    const searchQuery = `%${query}%`;
    const rows = await database.getAllAsync<User>(
      `SELECT * FROM users 
       WHERE name LIKE ? OR address LIKE ? OR mobileNumber LIKE ?
       ORDER BY createdAt DESC`,
      searchQuery,
      searchQuery,
      searchQuery,
    );
    return rows;
  } catch (error) {
    console.error("Error searching users:", error);
    throw error;
  }
};

// Delete user (cascades to rehan and lenden)
export const deleteUser = async (id: number): Promise<void> => {
  try {
    const database = await openDatabase();
    // Delete every dependent row explicitly, in one transaction, so a user is
    // never left half-deleted and nothing depends on foreign-key cascades.
    await database.withTransactionAsync(async () => {
      await database.runAsync(
        "DELETE FROM rehan_transactions WHERE rehanId IN (SELECT id FROM rehan WHERE userId = ?)",
        id,
      );
      await database.runAsync("DELETE FROM rehan WHERE userId = ?", id);
      await database.runAsync(
        "DELETE FROM jama_entries WHERE lendenId IN (SELECT id FROM lenden WHERE userId = ?)",
        id,
      );
      await database.runAsync(
        "DELETE FROM lenden_items WHERE lendenId IN (SELECT id FROM lenden WHERE userId = ?)",
        id,
      );
      await database.runAsync(
        "DELETE FROM lenden_old_jewellery_items WHERE lendenId IN (SELECT id FROM lenden WHERE userId = ?)",
        id,
      );
      await database.runAsync("DELETE FROM lenden WHERE userId = ?", id);
      await database.runAsync("DELETE FROM users WHERE id = ?", id);
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
};

// Update user details
export const updateUser = async (
  id: number,
  name: string,
  address?: string,
  mobileNumber?: string,
  nickname?: string,
): Promise<void> => {
  try {
    const database = await openDatabase();
    await database.runAsync(
      "UPDATE users SET name = ?, address = ?, mobileNumber = ?, nickname = ?, updatedAt = ? WHERE id = ?",
      name,
      address || null,
      mobileNumber || null,
      nickname || null,
      new Date().toISOString(),
      id,
    );
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
};

// ============ REHAN CRUD ============

// Create new Rehan entry
export const createRehan = async (rehan: NewRehan): Promise<number> => {
  try {
    const database = await openDatabase();
    const openDate = rehan.openDate || new Date().toISOString();
    const media = JSON.stringify(rehan.media || []);

    const result = await database.runAsync(
      `INSERT INTO rehan (userId, media, status, openDate, productName, category, amount, uuid, updatedAt) VALUES (?, ?, 0, ?, ?, ?, ?, ${UUID_SQL}, ?)`,
      rehan.userId,
      media,
      openDate,
      rehan.productName || null,
      rehan.category || null,
      rehan.amount || null,
      new Date().toISOString(),
    );

    return result.lastInsertRowId;
  } catch (error) {
    console.error("Error creating Rehan entry:", error);
    throw error;
  }
};

// Get Rehan by ID
export const getRehanById = async (id: number): Promise<Rehan | null> => {
  try {
    const database = await openDatabase();
    const row = await database.getFirstAsync<Rehan>(
      "SELECT * FROM rehan WHERE id = ?",
      id,
    );
    return row || null;
  } catch (error) {
    console.error("Error getting Rehan by ID:", error);
    throw error;
  }
};

// Get all Rehan entries for a user
export const getRehanByUserId = async (userId: number): Promise<Rehan[]> => {
  try {
    const database = await openDatabase();
    const rows = await database.getAllAsync<Rehan>(
      "SELECT * FROM rehan WHERE userId = ? ORDER BY openDate DESC",
      userId,
    );
    return rows;
  } catch (error) {
    console.error("Error getting Rehan by user ID:", error);
    throw error;
  }
};

// Get all Rehan entries
export const getAllRehan = async (): Promise<Rehan[]> => {
  try {
    const database = await openDatabase();
    const rows = await database.getAllAsync<Rehan>(
      "SELECT * FROM rehan ORDER BY openDate DESC",
    );
    return rows;
  } catch (error) {
    console.error("Error getting all Rehan:", error);
    throw error;
  }
};

// Update Rehan details (media, productName, amount, category).
// category undefined = leave the stored category alone (callers that do not know
// about categories must not wipe it); a string or null sets it.
export const updateRehanDetails = async (
  id: number,
  media: string[],
  productName?: string,
  amount?: number,
  category?: string | null,
): Promise<void> => {
  try {
    const database = await openDatabase();
    const mediaJson = JSON.stringify(media);
    const now = new Date().toISOString();
    if (category === undefined) {
      await database.runAsync(
        "UPDATE rehan SET media = ?, productName = ?, amount = ?, updatedAt = ? WHERE id = ?",
        mediaJson,
        productName || null,
        amount || null,
        now,
        id,
      );
    } else {
      await database.runAsync(
        "UPDATE rehan SET media = ?, productName = ?, amount = ?, category = ?, updatedAt = ? WHERE id = ?",
        mediaJson,
        productName || null,
        amount || null,
        category || null,
        now,
        id,
      );
    }
  } catch (error) {
    console.error("Error updating Rehan details:", error);
    throw error;
  }
};

// Update Rehan status (close it)
export const closeRehan = async (id: number): Promise<void> => {
  try {
    const database = await openDatabase();
    const closedDate = new Date().toISOString();
    await database.runAsync(
      "UPDATE rehan SET status = 1, closedDate = ?, updatedAt = ? WHERE id = ?",
      closedDate,
      closedDate,
      id,
    );
  } catch (error) {
    console.error("Error closing Rehan:", error);
    throw error;
  }
};

// Delete Rehan entry
export const deleteRehan = async (id: number): Promise<void> => {
  try {
    const database = await openDatabase();
    await database.runAsync(
      "DELETE FROM rehan_transactions WHERE rehanId = ?",
      id,
    );
    await database.runAsync("DELETE FROM rehan WHERE id = ?", id);
  } catch (error) {
    console.error("Error deleting Rehan:", error);
    throw error;
  }
};

// ============ REHAN TRANSACTIONS ============

import { RehanTransaction, NewRehanTransaction } from "../types/entry";

export const createRehanTransaction = async (
  transaction: NewRehanTransaction,
): Promise<number> => {
  try {
    const database = await openDatabase();

    // 1. Insert transaction
    const result = await database.runAsync(
      `INSERT INTO rehan_transactions (rehanId, type, amount, date, uuid, updatedAt) VALUES (?, ?, ?, ?, ${UUID_SQL}, ?)`,
      transaction.rehanId,
      transaction.type,
      transaction.amount,
      transaction.date,
      new Date().toISOString(),
    );

    // 2. Update Rehan Balance (Amount)
    // If 'diya' (took more) -> Increase amount
    // If 'jama' (paid) -> Decrease amount
    const operator = transaction.type === "diya" ? "+" : "-";
    await database.runAsync(
      `UPDATE rehan SET amount = amount ${operator} ?, updatedAt = ? WHERE id = ?`,
      transaction.amount,
      new Date().toISOString(),
      transaction.rehanId,
    );

    return result.lastInsertRowId;
  } catch (error) {
    console.error("Error creating Rehan Transaction:", error);
    throw error;
  }
};

export const getRehanTransactionsByRehanId = async (
  rehanId: number,
): Promise<RehanTransaction[]> => {
  try {
    const database = await openDatabase();
    const rows = await database.getAllAsync<RehanTransaction>(
      "SELECT * FROM rehan_transactions WHERE rehanId = ? ORDER BY date DESC",
      rehanId,
    );
    return rows;
  } catch (error) {
    console.error("Error getting Rehan Transactions:", error);
    throw error;
  }
};

export const deleteRehanTransaction = async (id: number): Promise<void> => {
  try {
    const database = await openDatabase();

    // 1. Get transaction details to reverse the balance effect
    const transaction = await database.getFirstAsync<RehanTransaction>(
      "SELECT * FROM rehan_transactions WHERE id = ?",
      id,
    );

    if (!transaction) return;

    // 2. Delete transaction
    await database.runAsync("DELETE FROM rehan_transactions WHERE id = ?", id);

    // 3. Reverse Rehan Balance
    // If original was 'diya' (+), now we subtract (-)
    // If original was 'jama' (-), now we add (+)
    const operator = transaction.type === "diya" ? "-" : "+";
    await database.runAsync(
      `UPDATE rehan SET amount = amount ${operator} ?, updatedAt = ? WHERE id = ?`,
      transaction.amount,
      new Date().toISOString(),
      transaction.rehanId,
    );
  } catch (error) {
    console.error("Error deleting Rehan Transaction:", error);
    throw error;
  }
};

// ============ LENDEN CRUD ============

// Create new Lenden entry
export const createLenden = async (lenden: NewLenden): Promise<number> => {
  try {
    const database = await openDatabase();
    const media = JSON.stringify(lenden.media || []);

    const result = await database.runAsync(
      `INSERT INTO lenden (userId, date, media, amount, discount, remaining, jama, baki, status, amountOverridden, uuid, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${UUID_SQL}, ?)`,
      lenden.userId,
      lenden.date,
      media,
      lenden.amount || null,
      lenden.discount || null,
      lenden.remaining || null,
      lenden.jama || null,
      lenden.baki || null,
      lenden.status ?? 0,
      lenden.amountOverridden ?? 0,
      new Date().toISOString(),
    );

    return result.lastInsertRowId;
  } catch (error) {
    console.error("Error creating Lenden entry:", error);
    throw error;
  }
};

// Get Lenden by ID
export const getLendenById = async (id: number): Promise<Lenden | null> => {
  try {
    const database = await openDatabase();
    const row = await database.getFirstAsync<Lenden>(
      "SELECT * FROM lenden WHERE id = ?",
      id,
    );
    return row || null;
  } catch (error) {
    console.error("Error getting Lenden by ID:", error);
    throw error;
  }
};

// Get all Lenden entries for a user
export const getLendenByUserId = async (userId: number): Promise<Lenden[]> => {
  try {
    const database = await openDatabase();
    const rows = await database.getAllAsync<Lenden>(
      "SELECT * FROM lenden WHERE userId = ? ORDER BY date DESC",
      userId,
    );
    return rows;
  } catch (error) {
    console.error("Error getting Lenden by user ID:", error);
    throw error;
  }
};

// Get all Lenden entries
export const getAllLenden = async (): Promise<Lenden[]> => {
  try {
    const database = await openDatabase();
    const rows = await database.getAllAsync<Lenden>(
      "SELECT * FROM lenden ORDER BY date DESC",
    );
    return rows;
  } catch (error) {
    console.error("Error getting all Lenden:", error);
    throw error;
  }
};

// Update Lenden details (media, amount, discount, remaining, jama, baki)
export const updateLendenDetails = async (
  id: number,
  media: string[],
  amount?: number,
  discount?: number,
  remaining?: number,
  jama?: number,
  baki?: number,
): Promise<void> => {
  try {
    const database = await openDatabase();
    const mediaJson = JSON.stringify(media);
    await database.runAsync(
      "UPDATE lenden SET media = ?, amount = ?, discount = ?, remaining = ?, jama = ?, baki = ?, updatedAt = ? WHERE id = ?",
      mediaJson,
      amount || null,
      discount || null,
      remaining || null,
      jama || null,
      baki || null,
      new Date().toISOString(),
      id,
    );
  } catch (error) {
    console.error("Error updating Lenden details:", error);
    throw error;
  }
};

// Delete Lenden entry
export const deleteLenden = async (id: number): Promise<void> => {
  try {
    const database = await openDatabase();
    // Delete associated jama entries first
    await database.runAsync("DELETE FROM jama_entries WHERE lendenId = ?", id);
    await database.runAsync("DELETE FROM lenden_items WHERE lendenId = ?", id);
    await database.runAsync(
      "DELETE FROM lenden_old_jewellery_items WHERE lendenId = ?",
      id,
    );
    await database.runAsync("DELETE FROM lenden WHERE id = ?", id);
  } catch (error) {
    console.error("Error deleting Lenden:", error);
    throw error;
  }
};

// ============ COMBINED TRANSACTIONS ============

export interface Transaction {
  id: number;
  type: "rehan" | "lenden";
  userId: number;
  userName: string;
  userAddress: string | null;

  userMobileNumber: string | null;
  userNickname: string | null;
  date: string;
  media: string;
  status?: number; // Only for Rehan
  productName?: string;
  amount?: number;
  // Lenden-specific fields
  discount?: number;
  remaining?: number;
  jama?: number;
  baki?: number;
}

// Get all transactions (Rehan + Lenden) with user info, sorted by date
export const getAllTransactions = async (): Promise<Transaction[]> => {
  try {
    const database = await openDatabase();

    // Get Rehan entries with user info
    const rehanRows = await database.getAllAsync<{
      id: number;
      userId: number;
      media: string;
      status: number;
      openDate: string;
      name: string;
      address: string | null;
      mobileNumber: string | null;
      nickname: string | null;
      productName?: string;
      amount?: number;
    }>(
      `SELECT r.id, r.userId, r.media, r.status, r.openDate, r.productName, r.amount,
              u.name, u.address, u.mobileNumber, u.nickname
       FROM rehan r
       JOIN users u ON r.userId = u.id
       ORDER BY r.openDate DESC`,
    );

    // Get Lenden entries with user info
    const lendenRows = await database.getAllAsync<{
      id: number;
      userId: number;
      media: string;
      date: string;
      name: string;
      address: string | null;
      mobileNumber: string | null;
      nickname: string | null;
      amount?: number;
      discount?: number;
      remaining?: number;
      jama?: number;
      baki?: number;
      status?: number; // Add status type
    }>(
      `SELECT l.id, l.userId, l.media, l.date, l.status, l.amount, l.discount, l.remaining, l.jama, l.baki,
              u.name, u.address, u.mobileNumber, u.nickname
       FROM lenden l
       JOIN users u ON l.userId = u.id
       ORDER BY l.date DESC`,
    );

    // Combine and format
    const transactions: Transaction[] = [
      ...rehanRows.map((r) => ({
        id: r.id,
        type: "rehan" as const,
        userId: r.userId,
        userName: r.name,
        userAddress: r.address,
        userMobileNumber: r.mobileNumber,
        userNickname: r.nickname,
        date: r.openDate,
        media: r.media,
        status: r.status,
        productName: r.productName,
        amount: r.amount,
      })),
      ...lendenRows.map((l) => ({
        id: l.id,
        type: "lenden" as const,
        userId: l.userId,
        userName: l.name,
        userAddress: l.address,
        userMobileNumber: l.mobileNumber,
        userNickname: l.nickname,
        date: l.date,
        media: l.media,
        status: l.status,
        amount: l.amount,
        discount: l.discount,
        remaining: l.remaining,
        jama: l.jama,
        baki: l.baki,
      })),
    ];

    // Sort by date descending
    transactions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return transactions;
  } catch (error) {
    console.error("Error getting all transactions:", error);
    throw error;
  }
};

// Search transactions by name, address, or mobile number
export const searchTransactions = async (
  query: string,
): Promise<Transaction[]> => {
  try {
    const database = await openDatabase();
    const searchPattern = `%${query}%`;

    // Get matching Rehan entries
    const rehanRows = await database.getAllAsync<{
      id: number;
      userId: number;
      media: string;
      status: number;
      openDate: string;
      name: string;
      address: string | null;
      mobileNumber: string | null;
      nickname: string | null; // Added nickname
      productName?: string;
      amount?: number;
    }>(
      `SELECT r.id, r.userId, r.media, r.status, r.openDate, r.productName, r.amount,
              u.name, u.address, u.mobileNumber, u.nickname
       FROM rehan r
       JOIN users u ON r.userId = u.id
       WHERE u.name LIKE ? OR u.address LIKE ? OR u.mobileNumber LIKE ? OR u.nickname LIKE ?
       ORDER BY r.openDate DESC`,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
    );

    // Get matching Lenden entries
    const lendenRows = await database.getAllAsync<{
      id: number;
      userId: number;
      media: string;
      date: string;
      name: string;
      address: string | null;
      mobileNumber: string | null;
      nickname: string | null; // Added nickname
      amount?: number;
      discount?: number;
      remaining?: number;
      jama?: number;
      baki?: number;
      status?: number; // Add status type
    }>(
      `SELECT l.id, l.userId, l.media, l.date, l.status, l.amount, l.discount, l.remaining, l.jama, l.baki,
              u.name, u.address, u.mobileNumber, u.nickname
       FROM lenden l
       JOIN users u ON l.userId = u.id
       WHERE u.name LIKE ? OR u.address LIKE ? OR u.mobileNumber LIKE ? OR u.nickname LIKE ?
       ORDER BY l.date DESC`,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
    );

    // Combine and format
    const transactions: Transaction[] = [
      ...rehanRows.map((r) => ({
        id: r.id,
        type: "rehan" as const,
        userId: r.userId,
        userName: r.name,
        userAddress: r.address,
        userMobileNumber: r.mobileNumber,
        userNickname: r.nickname,
        date: r.openDate,
        media: r.media,
        status: r.status,
        productName: r.productName,
        amount: r.amount,
      })),
      ...lendenRows.map((l) => ({
        id: l.id,
        type: "lenden" as const,
        userId: l.userId,
        userName: l.name,
        userAddress: l.address,
        userMobileNumber: l.mobileNumber,
        userNickname: l.nickname,
        date: l.date,
        media: l.media,
        status: l.status,
        amount: l.amount,
        discount: l.discount,
        remaining: l.remaining,
        jama: l.jama,
        baki: l.baki,
      })),
    ];

    // Sort by date descending
    transactions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return transactions;
  } catch (error) {
    console.error("Error searching transactions:", error);
    throw error;
  }
};

// ============ USER WITH COUNTS ============

export interface UserWithCounts {
  id: number;
  name: string;
  address: string | null;
  mobileNumber: string | null;
  nickname: string | null;
  createdAt: string;
  rehanCount: number;
  lendenCount: number;
}

// Get all users with their Rehan and Lenden transaction counts
export const getUsersWithCounts = async (): Promise<UserWithCounts[]> => {
  try {
    const database = await openDatabase();
    const rows = await database.getAllAsync<UserWithCounts>(
      `SELECT u.id, u.name, u.address, u.mobileNumber, u.nickname, u.createdAt,
              (SELECT COUNT(*) FROM rehan WHERE userId = u.id) as rehanCount,
              (SELECT COUNT(*) FROM lenden WHERE userId = u.id) as lendenCount
       FROM users u
       ORDER BY u.createdAt DESC`,
    );
    return rows;
  } catch (error) {
    console.error("Error getting users with counts:", error);
    throw error;
  }
};

// Search users with counts by name, address, or mobile
export const searchUsersWithCounts = async (
  query: string,
): Promise<UserWithCounts[]> => {
  try {
    const database = await openDatabase();
    const searchPattern = `%${query}%`;
    const rows = await database.getAllAsync<UserWithCounts>(
      `SELECT u.id, u.name, u.address, u.mobileNumber, u.nickname, u.createdAt,
              (SELECT COUNT(*) FROM rehan WHERE userId = u.id) as rehanCount,
              (SELECT COUNT(*) FROM lenden WHERE userId = u.id) as lendenCount
       FROM users u
       WHERE u.name LIKE ? OR u.address LIKE ? OR u.mobileNumber LIKE ?
       ORDER BY u.createdAt DESC`,
      searchPattern,
      searchPattern,
      searchPattern,
    );
    return rows;
  } catch (error) {
    console.error("Error searching users with counts:", error);
    throw error;
  }
};

// Filter options interface for advanced filtering
export interface UserFilterOptions {
  name?: string;
  address?: string;
  mobileNumber?: string;
  dateFrom?: string;
  dateTo?: string;
  transactionType?: "rehan" | "lenden" | "both";
}

// Filter users with counts based on multiple criteria
export const filterUsersWithCounts = async (
  filters: UserFilterOptions,
): Promise<UserWithCounts[]> => {
  try {
    const database = await openDatabase();

    // Build dynamic WHERE clause
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    // Name filter
    if (filters.name && filters.name.trim()) {
      conditions.push("u.name LIKE ?");
      params.push(`%${filters.name.trim()}%`);
    }

    // Address filter
    if (filters.address && filters.address.trim()) {
      conditions.push("u.address LIKE ?");
      params.push(`%${filters.address.trim()}%`);
    }

    // Mobile number filter
    if (filters.mobileNumber && filters.mobileNumber.trim()) {
      conditions.push("u.mobileNumber LIKE ?");
      params.push(`%${filters.mobileNumber.trim()}%`);
    }

    // Transaction type filter - only include users with transactions of the specified type
    if (filters.transactionType && filters.transactionType !== "both") {
      if (filters.transactionType === "rehan") {
        // Date filter for rehan
        if (filters.dateFrom || filters.dateTo) {
          let dateCondition = "(SELECT COUNT(*) FROM rehan WHERE userId = u.id";
          if (filters.dateFrom) {
            dateCondition += " AND date(openDate) >= date(?)";
            params.push(filters.dateFrom);
          }
          if (filters.dateTo) {
            dateCondition += " AND date(openDate) <= date(?)";
            params.push(filters.dateTo);
          }
          dateCondition += ") > 0";
          conditions.push(dateCondition);
        } else {
          conditions.push(
            "(SELECT COUNT(*) FROM rehan WHERE userId = u.id) > 0",
          );
        }
      } else if (filters.transactionType === "lenden") {
        // Date filter for lenden
        if (filters.dateFrom || filters.dateTo) {
          let dateCondition =
            "(SELECT COUNT(*) FROM lenden WHERE userId = u.id";
          if (filters.dateFrom) {
            dateCondition += " AND date(date) >= date(?)";
            params.push(filters.dateFrom);
          }
          if (filters.dateTo) {
            dateCondition += " AND date(date) <= date(?)";
            params.push(filters.dateTo);
          }
          dateCondition += ") > 0";
          conditions.push(dateCondition);
        } else {
          conditions.push(
            "(SELECT COUNT(*) FROM lenden WHERE userId = u.id) > 0",
          );
        }
      }
    } else if (filters.dateFrom || filters.dateTo) {
      // Date filter for both transaction types
      let rehanCondition = "(SELECT COUNT(*) FROM rehan WHERE userId = u.id";
      let lendenCondition = "(SELECT COUNT(*) FROM lenden WHERE userId = u.id";

      if (filters.dateFrom) {
        rehanCondition += " AND date(openDate) >= date(?)";
        lendenCondition += " AND date(date) >= date(?)";
      }
      if (filters.dateTo) {
        rehanCondition += " AND date(openDate) <= date(?)";
        lendenCondition += " AND date(date) <= date(?)";
      }

      rehanCondition += ")";
      lendenCondition += ")";

      // Add parameters in the correct order
      const dateParams: string[] = [];
      if (filters.dateFrom) dateParams.push(filters.dateFrom);
      if (filters.dateTo) dateParams.push(filters.dateTo);

      // Params for rehan condition
      params.push(...dateParams);
      // Params for lenden condition
      params.push(...dateParams);

      conditions.push(`(${rehanCondition} > 0 OR ${lendenCondition} > 0)`);
    }

    // Build the final query
    let query = `SELECT u.id, u.name, u.address, u.mobileNumber, u.nickname, u.createdAt,
              (SELECT COUNT(*) FROM rehan WHERE userId = u.id) as rehanCount,
              (SELECT COUNT(*) FROM lenden WHERE userId = u.id) as lendenCount
       FROM users u`;

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += " ORDER BY u.createdAt DESC";

    const rows = await database.getAllAsync<UserWithCounts>(query, ...params);
    return rows;
  } catch (error) {
    console.error("Error filtering users with counts:", error);
    throw error;
  }
};

// Get all transactions for a specific user
export const getTransactionsByUserId = async (
  userId: number,
): Promise<Transaction[]> => {
  try {
    const database = await openDatabase();

    // Get user info first
    const user = await getUserById(userId);
    if (!user) return [];

    // Get Rehan entries
    const rehanRows = await database.getAllAsync<Rehan>(
      "SELECT * FROM rehan WHERE userId = ? ORDER BY openDate DESC",
      userId,
    );

    // Get Lenden entries
    const lendenRows = await database.getAllAsync<Lenden>(
      "SELECT * FROM lenden WHERE userId = ? ORDER BY date DESC",
      userId,
    );

    // Combine and format
    const transactions: Transaction[] = [
      ...rehanRows.map((r) => ({
        id: r.id,
        type: "rehan" as const,
        userId: r.userId,
        userName: user.name,
        userAddress: user.address,
        userMobileNumber: user.mobileNumber,
        userNickname: user.nickname,
        date: r.openDate,
        media: r.media,
        status: r.status,
        productName: r.productName,
        amount: r.amount,
      })),
      ...lendenRows.map((l) => ({
        id: l.id,
        type: "lenden" as const,
        userId: l.userId,
        userName: user.name,
        userAddress: user.address,
        userMobileNumber: user.mobileNumber,
        userNickname: user.nickname,
        date: l.date,
        media: l.media,
        status: l.status, // Add status
        amount: l.amount,
        discount: l.discount,
        remaining: l.remaining,
        jama: l.jama,
        baki: l.baki,
      })),
    ];

    // Sort by date descending
    transactions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return transactions;
  } catch (error) {
    console.error("Error getting transactions by user ID:", error);
    throw error;
  }
};

// ============ JAMA ENTRIES CRUD ============

// Create new Jama Entry
export const createJamaEntry = async (entry: NewJamaEntry): Promise<number> => {
  try {
    const database = await openDatabase();
    const result = await database.runAsync(
      `INSERT INTO jama_entries (lendenId, amount, date, uuid, updatedAt) VALUES (?, ?, ?, ${UUID_SQL}, ?)`,
      entry.lendenId,
      entry.amount,
      entry.date,
      new Date().toISOString(),
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error("Error creating jama entry:", error);
    throw error;
  }
};

// Get all Jama Entries for a Lenden
export const getJamaEntriesByLendenId = async (
  lendenId: number,
): Promise<JamaEntry[]> => {
  try {
    const database = await openDatabase();
    const rows = await database.getAllAsync<JamaEntry>(
      "SELECT * FROM jama_entries WHERE lendenId = ? ORDER BY date ASC",
      lendenId,
    );
    return rows;
  } catch (error) {
    console.error("Error getting jama entries:", error);
    throw error;
  }
};

// Delete a Jama Entry
export const deleteJamaEntry = async (id: number): Promise<void> => {
  try {
    const database = await openDatabase();
    await database.runAsync("DELETE FROM jama_entries WHERE id = ?", id);
  } catch (error) {
    console.error("Error deleting jama entry:", error);
    throw error;
  }
};

// Get total Jama amount for a Lenden. A failed read rejects: 0 must only ever mean "no payments".
export const getTotalJamaByLendenId = async (
  lendenId: number,
): Promise<number> => {
  try {
    const database = await openDatabase();
    const row = await database.getFirstAsync<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM jama_entries WHERE lendenId = ?",
      lendenId,
    );
    return row?.total ?? 0;
  } catch (error) {
    console.error("Error getting total jama:", error);
    throw error;
  }
};

// Update Lenden baki based on jama entries and auto-close if baki = 0.
// If the bill or its jama total cannot be read this rejects before anything is written, never a guessed baki.
export const updateLendenBaki = async (lendenId: number): Promise<void> => {
  try {
    const database = await openDatabase();
    const lenden = await getLendenById(lendenId);
    if (!lenden) return;

    const totalJama = await getTotalJamaByLendenId(lendenId);
    const remaining = lenden.remaining || 0;
    const baki = remaining - totalJama;
    const finalBaki = baki >= 0 ? baki : 0;

    // Auto-close if baki becomes 0
    const status = finalBaki === 0 ? 1 : 0;

    await database.runAsync(
      "UPDATE lenden SET baki = ?, status = ?, updatedAt = ? WHERE id = ?",
      finalBaki,
      status,
      new Date().toISOString(),
      lendenId,
    );
  } catch (error) {
    console.error("Error updating lenden baki:", error);
    throw error;
  }
};

// Edit a Jama Entry
export const editJamaEntry = async (
  id: number,
  amount: number,
  date: string,
): Promise<void> => {
  try {
    const database = await openDatabase();
    await database.runAsync(
      "UPDATE jama_entries SET amount = ?, date = ?, updatedAt = ? WHERE id = ?",
      amount,
      date,
      new Date().toISOString(),
      id,
    );
  } catch (error) {
    console.error("Error editing jama entry:", error);
    throw error;
  }
};

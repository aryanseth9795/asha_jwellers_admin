import * as SQLite from "expo-sqlite";
import {
  User,
  NewUser,
  Rehan,
  NewRehan,
  Lenden,
  NewLenden,
} from "../types/entry";

let db: SQLite.SQLiteDatabase | null = null;

// Open database connection
const openDatabase = async () => {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("aj_database.db");
  return db;
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
        createdAt TEXT NOT NULL
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
        amount INTEGER,
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
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Migrations to add columns if they don't exist (for existing app installs)
    try {
      // Check if columns exist in rehan, if not add them
      const rehanInfo = await database.getAllAsync<{ name: string }>(
        "PRAGMA table_info(rehan)"
      );
      const rehanColumns = rehanInfo.map((c) => c.name);

      if (!rehanColumns.includes("productName")) {
        await database.execAsync(
          "ALTER TABLE rehan ADD COLUMN productName TEXT"
        );
        console.log("Added productName to rehan table");
      }
      if (!rehanColumns.includes("amount")) {
        await database.execAsync("ALTER TABLE rehan ADD COLUMN amount INTEGER");
        console.log("Added amount to rehan table");
      }

      // Check if columns exist in lenden, if not add them
      const lendenInfo = await database.getAllAsync<{ name: string }>(
        "PRAGMA table_info(lenden)"
      );
      const lendenColumns = lendenInfo.map((c) => c.name);

      if (!lendenColumns.includes("amount")) {
        await database.execAsync(
          "ALTER TABLE lenden ADD COLUMN amount INTEGER"
        );
        console.log("Added amount to lenden table");
      }
      if (!lendenColumns.includes("discount")) {
        await database.execAsync(
          "ALTER TABLE lenden ADD COLUMN discount INTEGER"
        );
        console.log("Added discount to lenden table");
      }
      if (!lendenColumns.includes("remaining")) {
        await database.execAsync(
          "ALTER TABLE lenden ADD COLUMN remaining INTEGER"
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
    } catch (migrationError) {
      console.error("Migration error:", migrationError);
      // Continue anyway as tables might be fresh
    }

    console.log("SQLite database initialized with User, Rehan, Lenden tables");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
};

// ============ USER CRUD ============

// Check if user with same name, address, and mobile exists
export const checkDuplicateUser = async (
  name: string,
  address?: string,
  mobileNumber?: string
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
      mobileNumber || null
    );
    return (row?.count ?? 0) > 0;
  } catch (error) {
    console.error("Error checking duplicate user:", error);
    return false;
  }
};

// Create new user
export const createUser = async (user: NewUser): Promise<number> => {
  try {
    const database = await openDatabase();
    const createdAt = new Date().toISOString();

    const result = await database.runAsync(
      "INSERT INTO users (name, address, mobileNumber, createdAt) VALUES (?, ?, ?, ?)",
      user.name,
      user.address || null,
      user.mobileNumber || null,
      createdAt
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
      id
    );
    return row || null;
  } catch (error) {
    console.error("Error getting user by ID:", error);
    return null;
  }
};

// Get all users
export const getAllUsers = async (): Promise<User[]> => {
  try {
    const database = await openDatabase();
    const rows = await database.getAllAsync<User>(
      "SELECT * FROM users ORDER BY createdAt DESC"
    );
    return rows;
  } catch (error) {
    console.error("Error getting all users:", error);
    return [];
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
      searchQuery
    );
    return rows;
  } catch (error) {
    console.error("Error searching users:", error);
    return [];
  }
};

// Delete user (cascades to rehan and lenden)
export const deleteUser = async (id: number): Promise<void> => {
  try {
    const database = await openDatabase();
    await database.runAsync("DELETE FROM users WHERE id = ?", id);
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
  mobileNumber?: string
): Promise<void> => {
  try {
    const database = await openDatabase();
    await database.runAsync(
      "UPDATE users SET name = ?, address = ?, mobileNumber = ? WHERE id = ?",
      name,
      address || null,
      mobileNumber || null,
      id
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
    const media = JSON.stringify(rehan.media);

    const result = await database.runAsync(
      "INSERT INTO rehan (userId, media, status, openDate, productName, amount) VALUES (?, ?, 0, ?, ?, ?)",
      rehan.userId,
      media,
      openDate,
      rehan.productName || null,
      rehan.amount || null
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
      id
    );
    return row || null;
  } catch (error) {
    console.error("Error getting Rehan by ID:", error);
    return null;
  }
};

// Get all Rehan entries for a user
export const getRehanByUserId = async (userId: number): Promise<Rehan[]> => {
  try {
    const database = await openDatabase();
    const rows = await database.getAllAsync<Rehan>(
      "SELECT * FROM rehan WHERE userId = ? ORDER BY openDate DESC",
      userId
    );
    return rows;
  } catch (error) {
    console.error("Error getting Rehan by user ID:", error);
    return [];
  }
};

// Get all Rehan entries
export const getAllRehan = async (): Promise<Rehan[]> => {
  try {
    const database = await openDatabase();
    const rows = await database.getAllAsync<Rehan>(
      "SELECT * FROM rehan ORDER BY openDate DESC"
    );
    return rows;
  } catch (error) {
    console.error("Error getting all Rehan:", error);
    return [];
  }
};

// Update Rehan details (media, productName, amount)
export const updateRehanDetails = async (
  id: number,
  media: string[],
  productName?: string,
  amount?: number
): Promise<void> => {
  try {
    const database = await openDatabase();
    const mediaJson = JSON.stringify(media);
    await database.runAsync(
      "UPDATE rehan SET media = ?, productName = ?, amount = ? WHERE id = ?",
      mediaJson,
      productName || null,
      amount || null,
      id
    );
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
      "UPDATE rehan SET status = 1, closedDate = ? WHERE id = ?",
      closedDate,
      id
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
    await database.runAsync("DELETE FROM rehan WHERE id = ?", id);
  } catch (error) {
    console.error("Error deleting Rehan:", error);
    throw error;
  }
};

// ============ LENDEN CRUD ============

// Create new Lenden entry
export const createLenden = async (lenden: NewLenden): Promise<number> => {
  try {
    const database = await openDatabase();
    const media = JSON.stringify(lenden.media);

    const result = await database.runAsync(
      "INSERT INTO lenden (userId, date, media, amount, discount, remaining, jama, baki) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      lenden.userId,
      lenden.date,
      media,
      lenden.amount || null,
      lenden.discount || null,
      lenden.remaining || null,
      lenden.jama || null,
      lenden.baki || null
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
      id
    );
    return row || null;
  } catch (error) {
    console.error("Error getting Lenden by ID:", error);
    return null;
  }
};

// Get all Lenden entries for a user
export const getLendenByUserId = async (userId: number): Promise<Lenden[]> => {
  try {
    const database = await openDatabase();
    const rows = await database.getAllAsync<Lenden>(
      "SELECT * FROM lenden WHERE userId = ? ORDER BY date DESC",
      userId
    );
    return rows;
  } catch (error) {
    console.error("Error getting Lenden by user ID:", error);
    return [];
  }
};

// Get all Lenden entries
export const getAllLenden = async (): Promise<Lenden[]> => {
  try {
    const database = await openDatabase();
    const rows = await database.getAllAsync<Lenden>(
      "SELECT * FROM lenden ORDER BY date DESC"
    );
    return rows;
  } catch (error) {
    console.error("Error getting all Lenden:", error);
    return [];
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
  baki?: number
): Promise<void> => {
  try {
    const database = await openDatabase();
    const mediaJson = JSON.stringify(media);
    await database.runAsync(
      "UPDATE lenden SET media = ?, amount = ?, discount = ?, remaining = ?, jama = ?, baki = ? WHERE id = ?",
      mediaJson,
      amount || null,
      discount || null,
      remaining || null,
      jama || null,
      baki || null,
      id
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
      productName?: string;
      amount?: number;
    }>(
      `SELECT r.id, r.userId, r.media, r.status, r.openDate, r.productName, r.amount,
              u.name, u.address, u.mobileNumber
       FROM rehan r
       JOIN users u ON r.userId = u.id
       ORDER BY r.openDate DESC`
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
      amount?: number;
      discount?: number;
      remaining?: number;
      jama?: number;
      baki?: number;
    }>(
      `SELECT l.id, l.userId, l.media, l.date, l.amount, l.discount, l.remaining, l.jama, l.baki,
              u.name, u.address, u.mobileNumber
       FROM lenden l
       JOIN users u ON l.userId = u.id
       ORDER BY l.date DESC`
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
        date: l.date,
        media: l.media,
        amount: l.amount,
        discount: l.discount,
        remaining: l.remaining,
        jama: l.jama,
        baki: l.baki,
      })),
    ];

    // Sort by date descending
    transactions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return transactions;
  } catch (error) {
    console.error("Error getting all transactions:", error);
    return [];
  }
};

// Search transactions by name, address, or mobile number
export const searchTransactions = async (
  query: string
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
      productName?: string;
      amount?: number;
    }>(
      `SELECT r.id, r.userId, r.media, r.status, r.openDate, r.productName, r.amount,
              u.name, u.address, u.mobileNumber
       FROM rehan r
       JOIN users u ON r.userId = u.id
       WHERE u.name LIKE ? OR u.address LIKE ? OR u.mobileNumber LIKE ?
       ORDER BY r.openDate DESC`,
      searchPattern,
      searchPattern,
      searchPattern
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
      amount?: number;
      discount?: number;
      remaining?: number;
      jama?: number;
      baki?: number;
    }>(
      `SELECT l.id, l.userId, l.media, l.date, l.amount, l.discount, l.remaining, l.jama, l.baki,
              u.name, u.address, u.mobileNumber
       FROM lenden l
       JOIN users u ON l.userId = u.id
       WHERE u.name LIKE ? OR u.address LIKE ? OR u.mobileNumber LIKE ?
       ORDER BY l.date DESC`,
      searchPattern,
      searchPattern,
      searchPattern
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
        date: l.date,
        media: l.media,
        amount: l.amount,
        discount: l.discount,
        remaining: l.remaining,
        jama: l.jama,
        baki: l.baki,
      })),
    ];

    // Sort by date descending
    transactions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return transactions;
  } catch (error) {
    console.error("Error searching transactions:", error);
    return [];
  }
};

// ============ USER WITH COUNTS ============

export interface UserWithCounts {
  id: number;
  name: string;
  address: string | null;
  mobileNumber: string | null;
  createdAt: string;
  rehanCount: number;
  lendenCount: number;
}

// Get all users with their Rehan and Lenden transaction counts
export const getUsersWithCounts = async (): Promise<UserWithCounts[]> => {
  try {
    const database = await openDatabase();
    const rows = await database.getAllAsync<UserWithCounts>(
      `SELECT u.id, u.name, u.address, u.mobileNumber, u.createdAt,
              (SELECT COUNT(*) FROM rehan WHERE userId = u.id) as rehanCount,
              (SELECT COUNT(*) FROM lenden WHERE userId = u.id) as lendenCount
       FROM users u
       ORDER BY u.createdAt DESC`
    );
    return rows;
  } catch (error) {
    console.error("Error getting users with counts:", error);
    return [];
  }
};

// Search users with counts by name, address, or mobile
export const searchUsersWithCounts = async (
  query: string
): Promise<UserWithCounts[]> => {
  try {
    const database = await openDatabase();
    const searchPattern = `%${query}%`;
    const rows = await database.getAllAsync<UserWithCounts>(
      `SELECT u.id, u.name, u.address, u.mobileNumber, u.createdAt,
              (SELECT COUNT(*) FROM rehan WHERE userId = u.id) as rehanCount,
              (SELECT COUNT(*) FROM lenden WHERE userId = u.id) as lendenCount
       FROM users u
       WHERE u.name LIKE ? OR u.address LIKE ? OR u.mobileNumber LIKE ?
       ORDER BY u.createdAt DESC`,
      searchPattern,
      searchPattern,
      searchPattern
    );
    return rows;
  } catch (error) {
    console.error("Error searching users with counts:", error);
    return [];
  }
};

// Get all transactions for a specific user
export const getTransactionsByUserId = async (
  userId: number
): Promise<Transaction[]> => {
  try {
    const database = await openDatabase();

    // Get user info first
    const user = await getUserById(userId);
    if (!user) return [];

    // Get Rehan entries
    const rehanRows = await database.getAllAsync<Rehan>(
      "SELECT * FROM rehan WHERE userId = ? ORDER BY openDate DESC",
      userId
    );

    // Get Lenden entries
    const lendenRows = await database.getAllAsync<Lenden>(
      "SELECT * FROM lenden WHERE userId = ? ORDER BY date DESC",
      userId
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
        date: l.date,
        media: l.media,
        amount: l.amount,
        discount: l.discount,
        remaining: l.remaining,
        jama: l.jama,
        baki: l.baki,
      })),
    ];

    // Sort by date descending
    transactions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return transactions;
  } catch (error) {
    console.error("Error getting transactions by user ID:", error);
    return [];
  }
};

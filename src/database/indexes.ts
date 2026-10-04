/**
 * Indexes for the ledger tables (hardening plan, Task 2 item 6).
 *
 * Every statement is CREATE INDEX IF NOT EXISTS, so ensureIndexes is safe on a fresh install and on an old one, and
 * can run on every start.
 *
 * Each foreign-key index also carries the column the app sorts that list by, so "WHERE userId = ? ORDER BY openDate
 * DESC" is answered by one index seek and a backward walk, with no temporary B-tree for the sort. A single-column
 * (userId) index leaves that sort step in the plan. The leading column is still the foreign key, so the plain
 * "WHERE userId = ?" lookups, the per-customer COUNT(*) subqueries and the cascade deletes use the same index. A
 * later "..., id DESC" tie-break is also covered, because SQLite stores the row id at the end of every index entry.
 *
 * idx_rehan_openDate and idx_lenden_date stay as single-column indexes for the listings that sort the whole table by
 * date with no customer to narrow by (getAllRehan, getAllLenden and the two joined lists in getAllTransactions).
 */
export const INDEX_STATEMENTS: string[] = [
  "CREATE INDEX IF NOT EXISTS idx_rehan_userId ON rehan(userId, openDate)",
  "CREATE INDEX IF NOT EXISTS idx_lenden_userId ON lenden(userId, date)",
  "CREATE INDEX IF NOT EXISTS idx_jama_entries_lendenId ON jama_entries(lendenId, date)",
  "CREATE INDEX IF NOT EXISTS idx_rehan_transactions_rehanId ON rehan_transactions(rehanId, date)",
  "CREATE INDEX IF NOT EXISTS idx_lenden_items_lendenId ON lenden_items(lendenId, position)",
  "CREATE INDEX IF NOT EXISTS idx_lenden_old_jewellery_items_lendenId ON lenden_old_jewellery_items(lendenId, position)",
  "CREATE INDEX IF NOT EXISTS idx_users_name ON users(name COLLATE NOCASE)",
  "CREATE INDEX IF NOT EXISTS idx_rehan_openDate ON rehan(openDate)",
  "CREATE INDEX IF NOT EXISTS idx_lenden_date ON lenden(date)",
];

/** Creates every index above, in order. Rejects on the first failure (the caller decides what a failed start means). */
export const ensureIndexes = async (db: { execAsync(sql: string): Promise<void> }): Promise<void> => {
  for (const sql of INDEX_STATEMENTS) {
    await db.execAsync(sql);
  }
};

# Code hardening — items 2, 6, 9, 8, 10 (owner's order)

**Branch:** `feat/code-hardening`, created from `feat/import-export-module`.
**Source:** the 2026-10-04 consultant review. The owner chose the items and their order.
**Behaviour:** no change except the fixes stated below.

## Global constraints

- Commit messages are plain with no trailer. Stage explicit paths. Never stage `docs/` or `Rehan & Lenden Insights.html`.
- No new dependencies.
- Text, TextInput and messages come from `src/ui` (`notify` / `confirm`). The source-audit rules must keep passing.
- Keep each file's line endings: CRLF stays CRLF, and new files are LF.
- Every task ends with `npx tsc --noEmit` clean and the full `npx jest` passing.
- Database tests run on the node:sqlite stand-in for expo-sqlite in `src/backup/roundtrip.test.ts`. If a second test needs it, move that stand-in into `src/test/sqliteStandIn.ts` and reuse it.

---

## Task 1 — item 2: errors never turn into wrong numbers or "no data"

**Problem:** these read functions in `src/database/*` catch errors and return a default, so a failure looks like real data:

| Default returned | Functions |
|---|---|
| `false` | `checkDuplicateUser` |
| `null` | `getUserById`, `getRehanById`, `getLendenById` |
| `[]` | `getAllUsers`, `searchUsers`, `getRehanByUserId`, `getAllRehan`, `getRehanTransactionsByRehanId`, `getLendenByUserId`, `getAllLenden`, `getAllTransactions`, `searchTransactions`, `getUsersWithCounts`, `searchUsersWithCounts`, `filterUsersWithCounts`, `getTransactionsByUserId`, `getJamaEntriesByLendenId`, `getLendenItems`, `getLendenOldJewelleryItems` |
| `0` | `getTotalJamaByLendenId` |

The worst case is `getTotalJamaByLendenId`. When it returns 0 on error, `updateLendenBaki` writes `baki = remaining` and can change the bill's status.

**Fix:**
- **Database:** every function above logs the error and rethrows it. `null` stays only for "not found", which is a successful query with no row.
- **Screens:** every screen load that calls them (UserTransactions, ExistingCustomers, TransactionDetail, BillPreview, NewCustomer, and any others `tsc` or `grep` find) catches the error and shows:
  - `notify.error("Couldn't load …", "Pull down to try again.")`
  - an inline error state with a Retry button where the screen would otherwise look empty
- **Behaviour on failure:**
  - Screens never show an empty list or "not found" for a failed read.
  - A failed duplicate check stops the save with an error banner, instead of silently allowing it.
  - Actions that recompute baki surface the error. They never write a guessed value.
- **Tests** (node:sqlite stand-in, `src/database/errors.test.ts`): make the database throw, for example with a closed handle or a dropped table, and check that:
  - each changed read rejects
  - `updateLendenBaki` rejects and leaves the stored baki unchanged

## Task 2 — items 6 and 9: indexes and photo size

- **Item 6:** in `initDatabase`, after the identity migration, an idempotent `ensureIndexes` creates:
  - `idx_rehan_userId` and `idx_lenden_userId`
  - `idx_jama_entries_lendenId`, `idx_rehan_transactions_rehanId`, `idx_lenden_items_lendenId` and `idx_lenden_old_jewellery_items_lendenId`
  - `idx_users_name` on `users(name COLLATE NOCASE)`
  - `idx_rehan_openDate` and `idx_lenden_date`
  - Use `CREATE INDEX IF NOT EXISTS` for each, and add them to fresh installs as well.
  - Test on node:sqlite that the indexes exist after `initDatabase`, and that `EXPLAIN QUERY PLAN` for the customer-transactions queries uses them, with no `SCAN` of rehan, lenden or jama_entries.
- **Item 9:** every `ImagePicker` call for ledger photos (AddTransaction, NewCustomer, TransactionDetail) uses `quality: 0.6`. Category and product photos stay at 0.8.

## Task 3 — item 8: calendar dates stored as plain dates

**Problem:** calendar dates are stored as full UTC timestamps (`selectedDate.toISOString()`), so a date picked as local midnight on 15 Sept is stored as `…-14T18:30:00.000Z`. One real bug already follows from this: the Existing Customers date filter uses `toISOString().split("T")[0]` and is off by one day.

**Design:**
- **Columns that become plain dates (`YYYY-MM-DD`, the phone's local calendar day):** `rehan.openDate`, `rehan.closedDate`, `lenden.date`, `jama_entries.date` and `rehan_transactions.date`.
- **Columns that stay full timestamps:** `users.createdAt` and every `updatedAt`.
- **`src/utils/dates.ts` (pure, tested):**
  - `toDay(d: Date): string`: the local `YYYY-MM-DD`.
  - `normalizeDay(value: string): string`: `YYYY-MM-DD` passes through unchanged, and an ISO timestamp becomes the local calendar day of that instant. Anything else throws.
  - `parseDay(day: string): Date`: local midnight of that day.
  - `todayDay()`
- **Migration** (`initDatabase`, after the indexes, guarded so it runs once):
  - in one `withTransactionAsync`, read every value in the five columns and rewrite it with `normalizeDay` when it is not already `YYYY-MM-DD`
  - this is done in JS, because SQLite's `localtime` cannot be trusted on every Android build
  - record completion in a `PRAGMA user_version` bump, or a small `meta` table if user_version is in use
  - test it on node:sqlite with mixed old values
- **Writes:**
  - every screen and database write of those five fields uses `toDay(...)`
  - defaults (`createRehan`, `closeRehan`) use `todayDay()`
  - ordering that sorts on these columns adds `, id DESC` (or `ASC` to match) as a tie-break
- **Reads:**
  - every place that turns a stored day into a `Date` for a picker or a calculation uses `parseDay`, or `new Date(...)` where a UTC-midnight instant is harmless
  - fix the Existing Customers filter to use `toDay`
  - check every analytics string comparison against `now.toISOString()`, and use `toDay(now)` where a day is compared with a day
- **Backups:**
  - import normalises these five fields with `normalizeDay`, so older v2 backups and refined v1 data with ISO timestamps land as plain dates
  - export writes whatever is stored, which after migration is plain dates
  - `validate.ts` accepts both forms
  - the round-trip and refined-backup tests must keep passing
- **Tests:** `dates.test.ts` covers an IST midnight timestamp becoming the same calendar day, a noon timestamp, a pass-through, and invalid input. Add a migration test, and an analytics test that a plain-date row lands in the right month or period.

## Task 4 — item 10: split the five biggest screens (no behaviour change)

**Screens** (lines): TransactionDetailScreen (1,908), ExistingCustomersScreen (1,146), AddEditProductScreen (987), UserTransactionsScreen (971) and AddTransactionScreen (939).

**Approach:** each screen gets a folder `src/screen/<ScreenName>/` containing:
- `use<ScreenName>.ts`: state, data loading and save or delete actions
- view components, one per card or section and modal
- `styles.ts`
- `index.tsx`: wires them together

`src/screen/<ScreenName>.tsx` stays as a one-line re-export, so `App.tsx` and navigation are unchanged.

**Rules:**
- Move code without changing it. The JSX output, handlers, texts and styles stay identical.
- No component over about 300 lines.
- One agent per screen, in parallel, each touching only its own screen.

**Checks:**
- `tsc` and jest stay green, and the source audit still passes. The audit globs for `<Screen` in `src/screen`, so it must be updated to look inside the folders.
- Each split is reviewed by diffing the old file against the new folder for lost or changed logic.

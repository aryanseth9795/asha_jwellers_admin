# Data-layer audit — Asha jewellery ledger

Branch `feat/lenden-itemised-billing` @ `ed02ebe`. Scope: `src/database/entryDatabase.ts`, `src/types/entry.ts`, `src/storage/fileStorage.ts`, `src/services/ExportService.ts`, plus §4 of `agent/2026-08-31-lenden-bill-design.md`. Callers in `src/screen/` were read only to establish failure paths.

**Summary.** The schema itself is sound-ish, but the layer around it is not. Three things stand out. (1) A duplicated `address TEXT` column in the `users` DDL (introduced by commit `0984546`) makes `initDatabase()` throw on any *fresh* install while existing installs sail past it silently — verified empirically against SQLite. (2) `PRAGMA foreign_keys` is never set anywhere in the codebase, so every `ON DELETE CASCADE` in the DDL is decorative; `deleteUser` therefore deletes nothing but the user row while the UI tells the shopkeeper "Customer and all transactions deleted", and the incoming `lenden_items` table in §4.1 will inherit the same trap. (3) Two independent code paths own the `lenden.baki` column and disagree — `updateLendenBaki` computes it from `jama_entries`, while `updateLendenDetails` overwrites it from a stale UI field that reads the *legacy* `jama` column — so opening an entry in edit mode and saving silently erases every payment recorded after creation. Secondary but pervasive: `||` is used instead of `??` in every single CRUD write (12 sites), turning legitimate `0` into `NULL`; nothing is wrapped in a transaction; `catch` blocks return `[]`/`0`/`false` that callers then persist as fact; and `deleteImage`/`deleteImages` in `fileStorage.ts` are dead code — no image file is ever removed, from anywhere.

Counts: **5 Critical**, **6 Important**, **5 Minor**.

---

# CRITICAL

## C1 — Duplicate `address` column: fresh installs cannot start the app

**File:** `src/database/entryDatabase.ts:28-37` (the offending duplicate is lines 32-33)

**What.**
```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,          -- line 32
  address TEXT,          -- line 33  <-- duplicate
  mobileNumber TEXT,
  nickname TEXT,
  createdAt TEXT NOT NULL
);
```
`git log -L 28,36` pins this to commit `0984546` ("rehan table updated"), which added both `address TEXT` (again) and `nickname TEXT` in the same hunk.

**Failure scenario.** Verified empirically with `node:sqlite` (same SQLite engine semantics):

| DB state | Result |
|---|---|
| fresh (no `users` table) | `SqliteError: duplicate column name: address` |
| `users` already exists | no error, statement silently skipped |

This asymmetry is not luck — SQLite's `sqlite3StartTable` bails out early when `IF NOT EXISTS` matches an existing table, leaving `pParse->pNewTable == NULL`, so `sqlite3AddColumn` returns before it can run its duplicate check. On an *existing* install the whole column list is never validated.

Concretely: a new phone, a reinstall, or "Clear data" on the shop's device → `execAsync` rejects → the outer `catch` at line 168 rethrows → `initDatabase()` (called un-awaited at `App.tsx:74`, with no `.catch`) rejects unhandled → **no tables are ever created**. The splash screen still fades out after its fixed 1 s timer, the app renders, and every screen shows an empty ledger because each query's `catch` returns `[]`. The shop cannot enter a single record and gets no error message.

This also means the app is currently **unrecoverable from its own backup path**: if the device is lost, installing the app on a new phone produces a dead app.

**Suggested fix.** Delete line 33.

**Data-migration risk.** None on existing installs — they never parsed the bad column list, and their `users` table already has one `address`. Deleting the line makes fresh installs match existing installs exactly. This is the rare fix with zero migration cost; ship it alone, not bundled.

---

## C2 — `ON DELETE CASCADE` never fires; `deleteUser` orphans every child row

**File:** `src/database/entryDatabase.ts:277-283` (`deleteUser`), FK declarations at lines 50, 65, 76, 87. `PRAGMA foreign_keys` appears nowhere: `grep -rn "PRAGMA" src/` returns only the three `table_info` calls (lines 98, 115, 159).

**What.**
```js
// Delete user (cascades to rehan and lenden)
export const deleteUser = async (id: number): Promise<void> => {
    await database.runAsync("DELETE FROM users WHERE id = ?", id);
```
The comment asserts a cascade that cannot happen. SQLite defaults `foreign_keys` to OFF per connection; `openDatabase()` (lines 16-20) issues no pragma, and expo-sqlite `^16.0.10` sets none in its JS/Kotlin layer (`grep -rl foreign_keys node_modules/expo-sqlite` matches only the compiled `.so`/`.framework` binaries — i.e. the SQLite library's own keyword table, not any call site).

Corroborating evidence from the codebase itself: `deleteRehan` (line 421) and `deleteLenden` (line 619) both delete their children *manually* before the parent — which would be redundant if cascades worked. The author hit this and patched around it in two of three places.

**Failure scenario.** `ExistingCustomersScreen.tsx:195-221`: the confirm dialog says *"This will also delete all N associated transactions. This action cannot be undone."*, `deleteUser` runs, then the app reports *"Customer and all transactions deleted."* In fact `rehan`, `lenden`, `jama_entries` and `rehan_transactions` rows all survive with a dangling `userId`. They vanish from every user-facing view (all read paths `JOIN users`), so the shopkeeper believes the deletion worked — but:
- The rows and their images consume storage forever.
- **`ExportService` does not join `users`** (`getAllRehan`/`getAllLenden`, lines 31-32) so the deleted customer's entries **reappear in every subsequent export** with a `userId` that matches nobody.

Mitigating: `users.id` is `AUTOINCREMENT`, so ids are never reused and orphans cannot silently re-attach to a *different* customer.

**Forward-looking — this is about to get worse.** §4.1 of the design doc declares `lenden_items` with `FOREIGN KEY (lendenId) REFERENCES lenden(id) ON DELETE CASCADE`, following "the existing `jama_entries` child-table pattern". If the implementer trusts that clause, deleting a Len-Den entry will leave its bill line items orphaned — and because `lenden.id` is also `AUTOINCREMENT`… fine today, but any future rebuild of `lenden` that renumbers ids would attach a dead customer's items to a live bill.

**Suggested fix.** Run `await database.execAsync("PRAGMA foreign_keys = ON;")` inside `openDatabase()` immediately after `openDatabaseAsync`, **and** add explicit child deletes to `deleteUser` regardless (defence in depth, and it fixes existing installs which the pragma will not). Add `DELETE FROM lenden_items WHERE lendenId = ?` to `deleteLenden` when §4.1 lands.

**Data-migration risk. High — do not turn the pragma on naively.** Existing installs already contain orphan rows from past deletions. Enabling `foreign_keys` does *not* retroactively delete them (FK checks run on write), so nothing breaks immediately — but:
- Any subsequent `PRAGMA foreign_key_check`, or a table rebuild (the 12-step `ALTER TABLE` dance), will now **fail or drop rows**.
- Writes touching an orphan row (e.g. `updateLendenDetails` on an orphaned `lenden`) will start throwing `FOREIGN KEY constraint failed` where they previously succeeded, and those throws propagate to the UI.

Correct order: (1) ship a one-time orphan sweep guarded by a version marker (`DELETE FROM rehan WHERE userId NOT IN (SELECT id FROM users)`, same for `lenden`, then `jama_entries`/`rehan_transactions` whose parents are gone), collecting their `media` paths for file cleanup first; (2) *then* enable the pragma. Reversing that order leaves the app throwing on legitimate edits.

---

## C3 — Entering edit mode and saving erases every payment recorded after creation

**Files:** `src/database/entryDatabase.ts:592-615` (`updateLendenDetails`) and `:1180-1205` (`updateLendenBaki`); driven by `src/screen/TransactionDetailScreen.tsx:122-130`, `:216-219`, `:342-350`.

**What.** Two functions own `lenden.baki` and they disagree about where the truth lives.

`updateLendenBaki` (the authority) derives it from the `jama_entries` child table and never touches the legacy `jama` column:
```js
const totalJama = await getTotalJamaByLendenId(lendenId);
const remaining = lenden.remaining || 0;
const baki = remaining - totalJama;
const finalBaki = baki >= 0 ? baki : 0;
const status = finalBaki === 0 ? 1 : 0;
await database.runAsync("UPDATE lenden SET baki = ?, status = ? WHERE id = ?", ...);
```

`updateLendenDetails` blindly writes whatever the screen hands it:
```js
"UPDATE lenden SET media = ?, amount = ?, discount = ?, remaining = ?, jama = ?, baki = ? WHERE id = ?",
```
and the screen recomputes `baki` from the **stale legacy `jama` column**, not from `jama_entries`:
```js
// TransactionDetailScreen.tsx:122-130 — fires on isEditMode false→true, no typing needed
const rem = parseInt(editRemaining, 10) || 0;
const jam = parseInt(editJama, 10) || 0;   // editJama comes from lenden.jama (line 216), never updated by updateLendenBaki
setEditBaki(calc >= 0 ? calc.toString() : "0");
```

**Failure scenario (verified end-to-end by reading both paths).**
1. New Len-Den: amount ₹50,000, no discount, no payment yet. `AddTransactionScreen.tsx:175-184` writes `remaining=50000, jama=NULL (0||null), baki=50000, status=0`.
2. Customer pays ₹20,000. `AddJamaModal` → `createJamaEntry` → `updateLendenBaki` → DB now `baki=30000`, `status=0`. **`lenden.jama` is still NULL.**
3. Shopkeeper opens the entry and taps **Edit** — to attach a photo of the receipt, nothing more.
   - `loadData` (line 216) sets `editJama = ""` because `lenden.jama` is NULL; `editBaki = "30000"`.
   - `isEditMode` flips to `true`, the effect at line 122 runs *without any user input*: `rem = 50000`, `jam = 0` → `setEditBaki("50000")`.
   - `hasChanges` becomes true (`"50000" !== "30000"`), so the Save button is live and the read-only Baki field on screen already shows **₹50,000**.
4. Save → `updateLendenDetails(..., jama: undefined, baki: 50000)` → DB `baki=50000`, `jama=NULL`.

**Outcome: the ₹20,000 payment is erased from the balance.** The `jama_entries` row survives, so the Payment Summary list still shows the ₹20,000 payment sitting directly above a Baki of ₹50,000 — a ledger that contradicts itself. The customer is asked to pay ₹20,000 twice. `status` is left untouched by `updateLendenDetails`, so an entry auto-closed by `updateLendenBaki` can end up `status=1` with a non-zero `baki`.

The same effect at line 114-120 clobbers `remaining` with `amount - discount`, discarding any manually adjusted `remaining`.

**Suggested fix.** Make `jama_entries` the single source of truth. Remove `jama` and `baki` from `updateLendenDetails`'s SET list entirely, and have the caller invoke `updateLendenBaki(id)` after saving `amount`/`discount`/`remaining`. Seed `editJama` from `getTotalJamaByLendenId()`, not from `lenden.jama`.

**Data-migration risk.** Rows already corrupted by this path are recoverable — `baki` can be recomputed as `remaining - SUM(jama_entries.amount)` for every row, since the payment rows themselves were never deleted. Do that recompute as a one-time guarded migration *after* the fix, otherwise the next edit re-corrupts. Rows whose `remaining` was also clobbered in step 3 are **not** recoverable from the DB alone (the original `remaining` is gone); those need `amount - discount` as a best-effort, and the discrepancy should be surfaced, not silently rewritten.

---

## C4 — `UPDATE rehan SET amount = amount ± ?` turns an existing NULL balance into a permanent NULL

**File:** `src/database/entryDatabase.ts:455-461` (`createRehanTransaction`), same bug at `:503-509` (`deleteRehanTransaction`)

**What.**
```js
const operator = transaction.type === "diya" ? "+" : "-";
await database.runAsync(
  `UPDATE rehan SET amount = amount ${operator} ? WHERE id = ?`,
  transaction.amount, transaction.rehanId,
);
```
In SQL, `NULL + 50000` is `NULL`. Verified: `UPDATE r SET amount = amount + 50000` on a row with `amount IS NULL` yields `NULL`.

**Failure scenario.** Two independent ways a `rehan.amount` is NULL, both of which affect real installs:
- **Every rehan row created before the `amount` column existed.** Line 109: `ALTER TABLE rehan ADD COLUMN amount INTEGER` — **no `DEFAULT`**, so SQLite backfills every pre-existing pawn entry with NULL. Any install that predates that migration has NULL amounts on its historical rehans.
- `createRehan` line 326: `rehan.amount || null` converts a legitimate `0` to NULL (see C5).

Sequence: shopkeeper opens an old pawn entry (created before the migration), records a `diya` of ₹50,000 via `AddRehanTransactionModal`. The `rehan_transactions` row is inserted correctly. The balance update evaluates `NULL + 50000 = NULL`. `TransactionDetailScreen` renders `rehan?.amount` — falsy — so **the balance simply disappears from the screen**, and every later transaction keeps it NULL. The pawn balance is unrecoverable from the `amount` column, and it cannot be reconstructed from `rehan_transactions` either because the *opening principal* was never recorded as a transaction.

**Suggested fix.** `UPDATE rehan SET amount = COALESCE(amount, 0) ${operator} ?`.

**Data-migration risk.** Fixing the arithmetic does not restore already-NULLed balances — the principal is gone. A migration that sets `amount = 0 WHERE amount IS NULL` would be **actively harmful**: it makes "unknown balance" indistinguishable from "settled, owes nothing", and once a `jama` is applied it goes negative without anyone noticing. Leave existing NULLs as NULL, fix the arithmetic going forward, and surface NULL as "balance not recorded" in the UI so the shopkeeper can re-enter it deliberately.

---

## C5 — `||` instead of `??` across every CRUD write: legitimate `0` becomes `NULL`

**File:** `src/database/entryDatabase.ts` — lines 326 (`rehan.amount`), 394 (`amount`), 529-533 (`lenden.amount/discount/remaining/jama/baki`), 604-608 (same five in `updateLendenDetails`). Contrast line 534, which gets it right: `lenden.status ?? 0`.

**What.**
```js
// createLenden, lines 529-533
lenden.amount || null,
lenden.discount || null,
lenden.remaining || null,
lenden.jama || null,
lenden.baki || null,
```
`0 || null` is `null`. Twelve write sites; one (`status`) uses `??`, which shows the author knows the distinction.

**Failure scenario.** The most common transaction in a jewellery shop — a cash sale paid in full:
- `AddTransactionScreen.tsx:167-184` computes `discountVal = 0`, `bakiVal = 0`, `status = 1`.
- `createLenden` stores `discount = NULL` and `baki = NULL` instead of `0`.

Consequences that follow, all verified:
1. `TransactionDetailScreen.tsx:688` — `lenden?.baki ?` is falsy, so the Baki row is **not rendered at all**. "Paid in full, ₹0 outstanding" and "we never recorded a balance" look identical on screen.
2. `TransactionDetailScreen.tsx:218` — `setEditBaki(lendenData.baki ? ... : "")`, so a stored `0` round-trips back to the DB as NULL on the next save. The `0` can never be re-established through the UI.
3. `updateLendenBaki:1189` — `const remaining = lenden.remaining || 0` applies the same coercion on read, so a NULL `remaining` (from a zero-value write) makes `baki = 0 - totalJama` → clamped to `0` → **`status` auto-flips to 1 (closed)**. An open entry silently marks itself settled the moment a payment is recorded against it.
4. Aggregates: `NULL` is skipped by `SUM`, so any future "total outstanding" report silently excludes these rows rather than adding zero. (Suspected — no such aggregate exists in the current code.)

**Suggested fix.** Replace `X || null` with `X ?? null` at all twelve sites, and `lenden.remaining || 0` with `?? 0` at line 1189. Fix `TransactionDetailScreen.tsx:210-219` to use `!= null` checks rather than truthiness when seeding the edit fields.

**Data-migration risk.** Real, and the trap is a backfill. `UPDATE lenden SET baki = 0 WHERE baki IS NULL` is **wrong** — it cannot distinguish "was 0, got coerced" from "was genuinely never filled in" (rows predating the column migration at line 142, which added `baki` with no DEFAULT). Both are NULL today. Do not backfill. Fix the writes, leave historical NULLs alone, and read them as "not recorded". `status` has `DEFAULT 0` (line 147) so it did backfill correctly and needs nothing.

---

# IMPORTANT

## I1 — No transactions anywhere: multi-statement writes can half-commit

**File:** `src/database/entryDatabase.ts:441-465` (`createRehanTransaction`), `:490-514` (`deleteRehanTransaction`), `:617-627` (`deleteLenden`), `:419-430` (`deleteRehan`). `withTransactionAsync` is never called in the file.

**What.** Every multi-statement operation runs as independent auto-committed statements.

**Failure scenario.** `createRehanTransaction`: the INSERT at line 448 commits, then the balance UPDATE at line 458 fails (device storage full — plausible, given every bill is photographed and no image is ever deleted, see I3). The `catch` rethrows, `TransactionDetailScreen.tsx:831` shows *"Failed to add transaction"*, and the shopkeeper retries. Now there are **two `rehan_transactions` rows for one ₹50,000 payment**, and the balance has moved by ₹0 or ₹50,000 depending on which retry's UPDATE landed. The transaction list — which is what the shop shows the customer — is wrong.

`deleteLenden` is the mirror image: line 622 deletes the `jama_entries` (the payment history), line 623 fails to delete the parent. The entry remains, its recorded payments are gone, and `updateLendenBaki` will next compute `baki = remaining - 0` = the full amount. **A partially deleted entry resurrects the whole debt.**

**Suggested fix.** Wrap each in `database.withTransactionAsync(async () => { ... })`.

**Data-migration risk.** None — behavioural change only. But note that `withTransactionAsync` will surface latent errors that are currently swallowed by partial success; expect previously "working" flows to start reporting failures honestly.

## I2 — Swallowed errors return defaults that the next write persists as fact

**File:** `src/database/entryDatabase.ts:1177` (`getTotalJamaByLendenId` → `return 0`), and 12 more `return []` sites (lines 252, 272, 362, 376, 482, 570, 584, 746, 856, 887, 912, 1043, 1113, 1149) plus `return false` at 201.

**What.**
```js
// getTotalJamaByLendenId, lines 1163-1179
} catch (error) {
    console.error("Error getting total jama:", error);
    return 0;
}
```

**Failure scenario.** `updateLendenBaki:1188` calls it and writes the result unconditionally:
```js
const totalJama = await getTotalJamaByLendenId(lendenId);   // 0 on any DB error
const baki = remaining - totalJama;                          // = full remaining
await database.runAsync("UPDATE lenden SET baki = ?, status = ? WHERE id = ?", ...);
```
Any transient failure on the `jama_entries` read (lock contention from the double-connection race in M1, a corrupt page) makes the function **write the customer's full original debt back into `baki` and reopen the entry**, wiping the accounting effect of every payment. The `jama_entries` rows survive, so this is recoverable — but only if someone notices.

`checkDuplicateUser:201` returning `false` on error means an error is reported as "no duplicate exists" and `NewCustomerScreen` creates a second copy of an existing customer, splitting their ledger across two records.

**Suggested fix.** `getTotalJamaByLendenId` must throw, not return 0; `updateLendenBaki` must not write when it cannot read. For the read-only `return []` paths the default is defensible for display but should distinguish "empty" from "failed" so the UI can say "couldn't load" instead of showing a blank ledger.

**Data-migration risk.** None.

## I3 — `deleteImage`/`deleteImages` are dead code: no image file is ever deleted

**File:** `src/storage/fileStorage.ts:48-63`. `grep -rn "deleteImage" src/screen src/components src/services` → zero matches; only `saveImages` is imported (3 call sites).

**What.** Both delete helpers are exported and never called. Combined with:
- `deleteRehan`/`deleteLenden`/`deleteUser` (`entryDatabase.ts:419, 617, 277`) — delete rows, never the files listed in `media`.
- `TransactionDetailScreen.tsx:303` — removing a photo in the editor is `mediaPaths.filter(...)` + `setMediaPaths(updated)`. The path leaves the JSON array; **the file stays on disk with nothing referencing it.**
- `TransactionDetailScreen.tsx:321` — `saveImages` runs *before* the DB write; if `updateLendenDetails` throws, the copied files are orphaned immediately.

**Failure scenario.** A shop photographing every paper bill accumulates unreferenced JPEGs in `documentDirectory/images/` forever — every deleted entry, every deleted customer, every photo the user swapped out during an edit. There is no cleanup path and no way to find them (filenames are `Date.now()_random.jpg`, so the only index is the `media` JSON in rows that have since been deleted). Eventually the device fills, at which point `copyAsync` and SQLite writes start failing — which is exactly the precondition for I1's half-committed writes.

**Suggested fix.** Read `media` before deleting a row and pass it to `deleteImages`; call `deleteImage` from the editor's remove handler *after* the DB write succeeds, not before. Add a sweep that lists `images/` and deletes anything not referenced by any `media` column.

**Data-migration risk.** The sweep is the dangerous part: it must enumerate `media` from `rehan` **and** `lenden` (and any future table) before deleting, and must not run while an edit is in flight — a file saved by `saveImages` but not yet written to a row would be deleted mid-flow. Run it only at cold start, before any screen mounts.

## I4 — Export omits `jama_entries` and `rehan_transactions` entirely

**File:** `src/services/ExportService.ts:30-49`

**What.** The export writes `users.json`, `rehan.json`, `lenden.json` and nothing else. `jama_entries` (every Len-Den payment) and `rehan_transactions` (every pawn jama/diya) are not read, not written, not zipped.

**Failure scenario.** The shopkeeper takes what the app presents as a full backup. The zip contains balances but no payment history. Since C3 shows `lenden.baki` can be desynchronised from the payment rows, and C4 shows `rehan.amount` can be NULL, the exported balances are the *only* record of anything — and they are the least trustworthy field in the schema. Reconstructing "who paid what, when" from this backup is impossible.

There is also **no import path anywhere in the codebase** (`grep -rn "importData\|restore\|unzip" src/` → no matches), so the export has never been round-tripped; nothing verifies it is restorable.

**Suggested fix.** Add `jama_entries` and `rehan_transactions` (and `lenden_items` when §4 lands) to the export. Bump an explicit `schemaVersion` field into the zip so a future importer knows what it is reading.

**Data-migration risk.** Old zips already in the shopkeeper's possession lack these tables and lack a version marker. Any future importer must treat a missing `schemaVersion` as "pre-v1, payment history absent" and refuse to silently import balances as authoritative.

## I5 — A failed export produces an empty zip that reports success

**File:** `src/services/ExportService.ts:30-32`

**What.**
```js
const users = await getAllUsers();
const rehan = await getAllRehan();
const lenden = await getAllLenden();
```
All three swallow errors and `return []` (`entryDatabase.ts:252, 362, 570`).

**Failure scenario.** If the DB read fails for any reason — including the C1 case where `initDatabase` threw and no tables exist — `exportData` proceeds happily, writes `[]` into all three JSON files, zips them, and hands the user a share sheet. **The backup silently contains zero records and the app reports success.** The shopkeeper has no way to tell this zip apart from a good one without unzipping and reading it. If they then reset the device trusting that backup, everything is gone.

**Suggested fix.** Have the export use throwing variants (or assert non-empty against `getUsersWithCounts` totals), and refuse to produce a zip whose record count is zero when the DB reports rows.

**Data-migration risk.** None.

## I6 — Un-awaited `initDatabase()` races the first query

**File:** `App.tsx:72-76`, `src/database/entryDatabase.ts:16-20`

**What.**
```js
useEffect(() => {
    initDatabase();        // not awaited, no .catch
    checkForUpdates();
    const timer = setTimeout(() => { ... setIsLoading(false); }, 1000);
```
The splash dismisses on a fixed 1 s timer with no dependency on the DB being ready. `openDatabase()` guards with `if (db) return db` but that check happens *before* the first `await`, so two concurrent first-callers both see `null` and both call `SQLite.openDatabaseAsync`, producing two connections (the second assignment wins; the first leaks).

**Failure scenario.** On a cold start where the migration block at lines 92-155 takes longer than 1 s — first launch after an upgrade that adds columns, or a slow/full device — `HomeScreen` mounts and calls `getAllTransactions`, whose SQL selects `l.status`. If the `status` ALTER (line 147) has not completed, SQLite raises `no such column: status`, the `catch` at line 745 returns `[]`, and **the shopkeeper sees an empty ledger on the first launch after an update**. Pull-to-refresh fixes it, but the first impression is "the update deleted all my data".

The double-connection race additionally makes `database is locked` possible during that window, which then feeds I1 and I2.

**Suggested fix.** Await `initDatabase()` (with a `.catch` that surfaces a real error screen) and gate `setIsLoading(false)` on it, not on a timer. In `openDatabase`, memoise the *promise* rather than the resolved handle so concurrent callers share one connection.

**Data-migration risk.** None — but gating the splash on `initDatabase` means C1's throw becomes a visible hang/error screen rather than a silent empty app. That is an improvement, but fix C1 first or new installs will hang at the splash.

---

# MINOR

## M1 — Migration block's `catch` continues into queries that will fail
`src/database/entryDatabase.ts:151-155`: the single `try` wraps all eleven ALTERs; its `catch` logs *"Continue anyway as tables might be fresh"* and proceeds. If e.g. the `status` ALTER fails, `initDatabase` reports success and every `getAllTransactions` call thereafter dies on `no such column: status` → `return []` → permanently empty ledger with no error shown. Each ALTER is individually guarded by the `table_info` check so a retry on next launch would recover — but nothing prompts a retry, and the user has no signal. Split the `try` per-statement, or let it propagate.

## M2 — `lenden` DDL omits `status`; it exists only via ALTER
`src/database/entryDatabase.ts:54-67` creates `lenden` without `status`; line 145-149 adds it. A fresh install therefore depends on the "for existing app installs" migration block to produce a correct schema. Meanwhile `Lenden.status` is declared non-optional in `src/types/entry.ts:63`. Anyone who later prunes the migration block as "legacy" breaks fresh installs. Add `status INTEGER DEFAULT 0` to the `CREATE TABLE` (harmless — `IF NOT EXISTS` skips it on upgrades) and keep the ALTER.

## M3 — Overpayment is clamped to zero and lost
`src/database/entryDatabase.ts:1191`: `const finalBaki = baki >= 0 ? baki : 0;`. If a customer pays ₹52,000 against a ₹50,000 balance, the ₹2,000 credit is discarded and the entry closes at zero. The `jama_entries` rows preserve the arithmetic, so it is recoverable by hand, but the ledger will not show that the shop owes ₹2,000 back. Whether this is intentional shop practice is unclear — flagging it, not prescribing.

## M4 — Export zips accumulate in `documentDirectory` forever
`src/services/ExportService.ts:53`: `export_${Date.now()}.zip`. The staging dir is cleaned (line 68) but the zip is not — the comment acknowledges this. Every export permanently adds a full copy of the database and all images to internal storage. Combined with I3, storage growth is unbounded in two directions.

## M5 — `JSON.parse(entry.media)` is unguarded in the export loop
`src/services/ExportService.ts:80`. One malformed `media` value aborts the entire export via the outer `catch`, so a single bad row makes backups impossible with an opaque "Export failed". **Suspected, not confirmed** — I could find no write path that stores non-JSON into `media` (every writer goes through `JSON.stringify`), so this may be unreachable today. Cheap to harden regardless. The same unguarded parse exists at `TransactionDetailScreen.tsx:186` and `:191`, where it would blank the detail screen.

---

# Notes on §4 of the design doc (forward-looking, nothing to fix yet)

The doc's §4.3 already identifies the right hazard ("**Migration safety — this is the one that can destroy data**") and the two-layer defence is sound. Two things to watch when it lands:

1. **The backfill's guard is not self-limiting.** `UPDATE lenden SET amountOverridden = 1 WHERE amountOverridden IS NULL OR amountOverridden = 0` matches every *new* row too, because the column is declared `DEFAULT 0`. It is only safe because the doc says to run it once inside the column-add branch. Given that the surrounding migration block (`entryDatabase.ts:92-155`) is a flat sequence of `if (!columns.includes(...))` blocks, it will be very easy to write the `ALTER` and the `UPDATE` as two sibling statements and have the `UPDATE` run on every launch — which permanently freezes every entry as "user-overridden", so editing items would silently stop updating the amount. Put the backfill **inside** the `if (!lendenColumns.includes("amountOverridden"))` branch, and wrap the ALTER+UPDATE pair in `withTransactionAsync` so a failure between them cannot leave the column present but unbackfilled. Note that if that pair half-completes today, the migration block's `catch` (M1) swallows it and the backfill never runs again — every historical row would then be at `amountOverridden = 0`, protected only by the `items.length === 0` fallback, which stops protecting them the moment anyone adds a line item to an old entry.
2. **`lenden_items`' `ON DELETE CASCADE` will not fire** — see C2. `deleteLenden` must gain an explicit `DELETE FROM lenden_items WHERE lendenId = ?`, and it needs to be inside the same transaction as the parent delete (I1).
3. §4.4's `nextBillNo = MAX(billNo) + 1` computed and persisted in two steps has the same non-atomicity as I1. Single-user app, so a collision needs two screens open at once — low risk, but `INSERT`-then-read or a transaction costs nothing.

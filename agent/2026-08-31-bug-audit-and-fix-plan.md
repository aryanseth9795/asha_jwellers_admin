# Asha Jewellers — Bug Audit & Remediation Plan

**Date:** 2026-08-31
**Scope:** whole repository, three independent parallel audits (data layer / screens / services)
**Branch audited:** `feat/lenden-itemised-billing`
**Deduplicated totals:** **15 Critical · 24 Important · 17 Minor**

---

## 1. Executive summary

Three things are costing you money or data **right now**:

**① Every fresh install of your app is dead on arrival.**
`src/database/entryDatabase.ts:33` declares the `address` column twice in the `users` table. Two auditors independently reproduced this against real SQLite: on a database that already exists the statement is skipped silently, but on a **new** one it throws `duplicate column name: address`. It is the first statement in `initDatabase()`, so *no tables are created at all*. And because `App.tsx:74` calls `initDatabase()` without `await` and without `.catch()`, nothing notices — the splash screen fades on its 1-second timer and the app opens looking perfectly healthy, with every screen showing an empty ledger.

The practical meaning: **if that phone is lost or wiped, installing the app on a new phone gives you a permanently empty app.** You currently have no working path back from a device loss. This has gone unnoticed since commit `0984546` because your existing install was created before the typo.

**② Tapping "Edit" on a Len-Den erases every payment the customer has made.**
You open an entry just to attach a photo of a receipt. Before you type anything, the Save button lights up on its own and the outstanding balance has already reset to the pre-payment figure. One tap and a ₹400 payment is gone from the balance — while the payment receipt still sits visible in the list right above it, so the entry contradicts itself. You then bill the customer ₹400 they already paid. Found independently by two auditors from opposite directions (the database side and the screen side), which is strong evidence it is real.

**③ Your backup does not contain your payment history.**
`ExportService` writes `users`, `rehan` and `lenden` — and omits `jama_entries` and `rehan_transactions` entirely. Every payment record is missing. Worse, if the database read fails the export writes empty JSON files, zips them, and reports success — a backup that looks identical to a good one and contains nothing. There is no import path anywhere in the codebase, so this export has never once been round-tripped.

**Do not take a backup with the in-app export button and trust it.** Phase 0 of the plan below addresses this before anything else touches your data.

Beyond those: a hardcoded admin key is in your public-facing git history and inside the shipped app binary; it grants full delete access to your product catalogue and **write access to the gold/silver rates your billing is priced from**. And the money model is implemented three separate times with three different formulas that disagree with each other.

The good news: the feature branch in flight already fixes ① at the DDL level, and its Tasks 1–3 are committed and green. Most of the rest are small, surgical fixes. The dangerous part is not the fixes — it is the order they land in.

---

## 2. Full findings table

Legend for **Data effect**: **Inert** = pure code change, stored rows untouched · **Repairs** = corrects rows that are already wrong · **Migration** = needs a schema change or backfill · **DANGEROUS** = can alter or destroy existing rows if applied naively.

| ID | Finding | Location | Sev | Data effect | In-flight branch fixes? |
|---|---|---|---|---|---|
| **B1** | Duplicate `address` column → fresh installs create zero tables | `entryDatabase.ts:33` | Critical | Inert | ✅ Task 5 step 4 |
| **B2** | `initDatabase()` unawaited + uncaught → DDL failure becomes silent empty app | `App.tsx:74` | Critical | Inert | ❌ |
| **B3** | Edit mode resets `baki` from stale `lenden.jama`, erasing payments | `TransactionDetailScreen.tsx:123-130,216,342` | Critical | Repairs | ❌ |
| **B4** | Rehan edit writes NULL over product name and running balance | `TransactionDetailScreen.tsx:175-188,334` | Critical | DANGEROUS | ❌ |
| **B5** | `amount = amount ± ?` turns a NULL balance permanently NULL | `entryDatabase.ts:457,505` | Critical | Inert | ❌ |
| **B6** | `\|\|` instead of `??` at 12 write sites → legitimate `0` stored as NULL | `entryDatabase.ts:326,394,529-533,604-608` | Critical | Inert | ❌ |
| **B7** | `NewCustomerScreen` writes a different Len-Den shape than `AddTransactionScreen` | `NewCustomerScreen.tsx:248-256` | Critical | Repairs | ❌ |
| **B8** | Money inputs accept negative / NaN / pasted commas | `NewCustomerScreen.tsx:445,464,476` | Critical | Inert | ❌ |
| **B9** | Bill preview unclamped, save path clamps → customer credit destroyed | `AddTransactionScreen.tsx:169` vs `BillTable.tsx:30` | Critical | Inert | ❌ |
| **B10** | Saving an edit never updates `status` → CLOSED entries with a live balance | `TransactionDetailScreen.tsx:342`; `entryDatabase.ts:589` | Critical | Repairs | ❌ |
| **B11** | `PRAGMA foreign_keys` never set → every `ON DELETE CASCADE` is inert | `entryDatabase.ts:277`, FKs at `:50,65,76,87` | Critical | DANGEROUS | ⚠️ inherits |
| **B12** | Admin API key hardcoded, in git history and shipped binary | `ProductService.ts:4`, `BhavService.ts:4` | Critical | Inert | ❌ |
| **B13** | "Delete all images on a variant" cannot be expressed | `AddEditProductScreen.tsx:344` | Critical | Inert | ❌ |
| **B14** | Product save does unrolled-back sequential writes; retry duplicates variants | `AddEditProductScreen.tsx:264-368` | Critical | Inert | ❌ |
| **B15** | Variant `weight` required by API, unvalidated in UI | `AddEditProductScreen.tsx:209-232` | Critical | Inert | ❌ |
| **I1** | No transactions anywhere; multi-statement writes half-commit | `entryDatabase.ts:441,490,617,419` | Important | Inert | ❌ |
| **I2** | Swallowed errors return defaults the next write persists as fact | `entryDatabase.ts:1177` + 13 sites | Important | Inert | ❌ |
| **I3** | `deleteImage`/`deleteImages` are dead code — no image is ever deleted | `fileStorage.ts:48-63` | Important | DANGEROUS | ❌ |
| **I4** | Export omits `jama_entries` and `rehan_transactions` | `ExportService.ts:30-49` | Important | Inert | ❌ |
| **I5** | Failed export produces an empty zip and reports success | `ExportService.ts:30-32` | Important | Inert | ❌ |
| **I6** | Empty Len-Den can be saved with no amount | `NewCustomerScreen.tsx:193-206` | Important | Inert | ❌ |
| **I7** | Unsaved edits silently discarded on back-navigation | `TransactionDetailScreen.tsx:419` | Important | Inert | ❌ |
| **I8** | Fully-repaid Rehan renders a stray `0` / may crash the list | `UserTransactionsScreen.tsx:236` | Important | Inert | ❌ |
| **I9** | Customer search re-queries per keystroke, no ordering guard | `ExistingCustomersScreen.tsx:81-123` | Important | Inert | ❌ |
| **I10** | Filtered results capped at 20 with no way to see the rest | `ExistingCustomersScreen.tsx:225,607` | Important | Inert | ❌ |
| **I11** | Date-range filter shifted one day earlier in IST | `ExistingCustomersScreen.tsx:90-95` | Important | Inert | ❌ |
| **I12** | "Add" enabled for amount `0`, then silently does nothing | `AddJamaModal.tsx:65,146` | Important | Inert | ❌ |
| **I13** | Date picker always opens on the current month | `CustomDatePicker.tsx:29-31` | Important | Inert | ❌ |
| **I14** | Partial jama write → duplicate Len-Den on retry | `AddTransactionScreen.tsx:176-206` | Important | Inert | ❌ |
| **I15** | Edit pencil on add-screen bill preview wired to an empty function | `AddTransactionScreen.tsx:381-389` | Important | Inert | ❌ |
| **I16** | Five endpoints send JSON where spec mandates multipart | `ProductService.ts:201,240,407,473,514` | Important | Inert | ❌ |
| **I17** | `existingImages` has two different wire encodings | `ProductService.ts:514-530` | Important | Inert | ❌ |
| **I18** | Upload filenames always `image.jpg` (`fileName` vs `name`) | `ProductService.ts:122,134` | Important | Inert | ❌ |
| **I19** | Documented 10-image cap unenforced client-side | `AddEditProductScreen.tsx:150` | Important | Inert | ❌ |
| **I20** | Server error messages discarded (`.error` vs `.message`) | `ProductService.ts` ×14 | Important | Inert | ❌ |
| **I21** | No timeout or cancellation on any request | all `fetch` in both services | Important | Inert | ❌ |
| **I22** | Fetch failure indistinguishable from an empty catalogue | `ProductListScreen.tsx:53-68` | Important | Inert | ❌ |
| **I23** | Clearing a description or size never reaches the server | `AddEditProductScreen.tsx:288,291` | Important | Inert | ❌ |
| **I24** | `BASE_URL` hardcoded to production — dev writes to live data | `ProductService.ts:3`, `BhavService.ts:3` | Important | Inert | ❌ |

**Minor (17), one line each:**
`entryDatabase.ts` — migration `catch` continues into queries that will fail (`:151`); `lenden` DDL omits `status`, relying on the ALTER (`:54`); overpayment clamped to zero and lost (`:1191`). `ExportService.ts` — zips accumulate forever (`:53`); unguarded `JSON.parse` (`:80`, *suspected unreachable*). `TransactionDetailScreen.tsx` — `x ? x.toString() : ""` turns stored `0` into `""` (6 sites); no unmount cancellation; duplicate image URIs collapse; `loadData` missing from its own deps. `BillTable.tsx` — index keys on deletable rows. `AddTransactionScreen.tsx` — `"0"` passes validation. `App.tsx` — `reloadAsync()` rejection unhandled; update indicator unmounted mid-download. `AddEditProductScreen.tsx` — deprecated `MediaTypeOptions`; delete confirms close over stale `variants`. Config — `.gitignore` misses a bare `.env`; `RECORD_AUDIO` declared but unused; iOS half-configured.

---

## 3. Critical findings in detail

### B1 — Duplicate `address` column kills every fresh install
**`entryDatabase.ts:33`** · *Confirmed empirically by two independent auditors*

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  address TEXT,        -- line 33, duplicate. Introduced in commit 0984546.
  ...
```

SQLite's `IF NOT EXISTS` short-circuits *before* the column list is validated, so an existing table never triggers the check. A fresh database throws. Since this is the first `execAsync` in `initDatabase`, `rehan`, `lenden` and `jama_entries` are never created either.

**Fix:** delete line 33.
**Effect on existing data: Inert.** Existing installs never parsed the bad column list and already have exactly one `address`. This is the rare zero-risk fix — ship it alone, first.

### B2 — The unawaited `initDatabase()` is what makes B1 silent
**`App.tsx:74`**

```js
useEffect(() => {
  initDatabase();      // not awaited, no .catch
  checkForUpdates();
  const timer = setTimeout(() => { ...setIsLoading(false); }, 1000);
```

The splash dismisses on a fixed timer with no dependency on the database being ready. A one-line typo became a total silent failure purely because of this. It also causes a subtler bug on upgrades: if the column migrations take longer than 1 second, `HomeScreen` mounts and queries `l.status` before the ALTER completes, gets `no such column: status`, and shows **an empty ledger on the first launch after an update** — which reads to you as "the update deleted all my data."

**Fix:** `await initDatabase()` behind a state flag, render a real error screen on rejection, and gate `setIsLoading(false)` on completion rather than a timer. Also memoise the *promise* in `openDatabase()` — the current `if (db) return db` check happens before the first `await`, so two concurrent first-callers open two connections.
**Effect on existing data: Inert.** But **fix B1 first** — otherwise new installs hang at the splash instead of failing silently, which is more visible but still broken.

### B3 — Editing a Len-Den erases every payment
**`TransactionDetailScreen.tsx:123-130`, `:216`, `:342-350`** · *Found independently by two auditors*

`lenden.jama` is written in exactly two places (`createLenden`, `updateLendenDetails`). Recording a payment goes through `createJamaEntry` + `updateLendenBaki`, and `updateLendenBaki` writes only `baki` and `status` — **never `jama`**. So `lenden.jama` is stale from the moment the first payment lands, normally `NULL`.

The edit-mode effect then computes `baki = remaining - 0`:

```ts
const jam = parseInt(editJama, 10) || 0;   // editJama seeded from lenden.jama — always stale
setEditBaki(calc >= 0 ? calc.toString() : "0");
```

This fires on `isEditMode` flipping false→true, with **no user input**. `hasChanges` becomes true, the Save button appears, and the read-only Baki field already displays the wrong number.

**Concrete sequence:** ₹1000 entry → Ramesh pays ₹400 → `baki=600`, correct. Later you open it to attach a photo, tap Edit, tap Save. Now `baki=1000`. The ₹400 receipt still shows in the list above a balance of ₹1000. You bill him ₹400 twice.

**Fix:** delete `editJama`/`editBaki` as editable state; derive both from `jamaEntries` at render time; call `updateLendenBaki(id)` after saving amount/discount/remaining. Long term, drop the `lenden.jama` column entirely.
**Effect on existing data: Repairs.** Corrupted rows are recoverable — `jama_entries` was never touched, so `baki = remaining − SUM(jama_entries.amount)` reconstructs the truth. Run that recompute as a one-time guarded migration **after** the code fix, or the next edit re-corrupts it. Rows whose `remaining` was *also* clobbered cannot be fully recovered; surface those rather than silently rewriting them.

### B4 — Editing a Rehan wipes its balance, unrecoverably
**`TransactionDetailScreen.tsx:175-188`, `:334-340`**

The rehan branch of `loadData` never seeds `editProductName` or `editAmount` — but the save path sends them regardless:

```ts
await updateRehanDetails(transactionId, finalPaths,
  editProductName.trim() || undefined,          // always "" → undefined
  editAmount ? parseInt(editAmount, 10) : undefined);   // always "" → undefined
```

`updateRehanDetails` is unconditional: `UPDATE rehan SET media=?, productName=?, amount=?`.

Open a pawn entry with an ₹18,000 running balance, tap Edit, add a photo, Save → `productName=NULL, amount=NULL`. **And it can never be repaired through the app**, because the balance is maintained by `amount = amount ± ?`, and in SQLite `NULL ± n = NULL` (see B5). Every subsequent transaction leaves it NULL.

**Fix:** seed all four states in the rehan branch, and make `updateRehanDetails` patch only the fields it is given.
**Effect on existing data: DANGEROUS.** Balances already NULLed cannot be recovered from the database — the opening principal was never recorded as a transaction. **Do not backfill `amount = 0`**: that makes "unknown balance" indistinguishable from "settled, owes nothing", and the next payment drives it negative unnoticed. Leave NULLs as NULL, fix the write path, and display NULL as "balance not recorded" so you can re-enter it deliberately from your paper records.

### B5 — `NULL ± n = NULL` poisons pawn balances permanently
**`entryDatabase.ts:457`, `:505`**

```js
`UPDATE rehan SET amount = amount ${operator} ? WHERE id = ?`
```

Two ways `rehan.amount` is already NULL on your device: every rehan row created **before** the `amount` column existed (`ALTER TABLE rehan ADD COLUMN amount INTEGER` at `:109` has **no DEFAULT**, so SQLite backfilled NULL), and B6's `|| null` coercion.

**Fix:** `UPDATE rehan SET amount = COALESCE(amount, 0) ${operator} ?`.
**Effect on existing data: Inert** (arithmetic only). Same warning as B4 — do not backfill existing NULLs.

### B6 — `||` instead of `??` at 12 write sites
**`entryDatabase.ts:326, 394, 529-533, 604-608`**

```js
lenden.amount || null,      // 0 || null === null
lenden.discount || null,
lenden.baki || null,
```

Line 534 gets it right (`lenden.status ?? 0`), which shows the distinction was understood — these twelve were simply missed. The most common transaction in a jewellery shop, a cash sale paid in full, produces `discount = 0` and `baki = 0`, both stored as **NULL**.

Cascading consequences, all verified: the Baki row is not rendered at all (`:688`), so "paid in full" and "never recorded" look identical; a stored `0` round-trips back to NULL on the next save; and `updateLendenBaki:1189` reads `lenden.remaining || 0`, so a NULL remaining makes `baki = 0 − totalJama` → clamped to 0 → **`status` auto-flips to closed**. An open entry silently marks itself settled the moment a payment is recorded.

**Fix:** `??` at all twelve sites, plus `?? 0` at `:1189`, plus `!= null` checks in `TransactionDetailScreen.tsx:210-219`.
**Effect on existing data: Inert — and the backfill is a trap.** `UPDATE lenden SET baki = 0 WHERE baki IS NULL` is **wrong**: it cannot distinguish "was 0, got coerced" from "genuinely never filled in" (rows predating the column migration, which also has no DEFAULT). Both are NULL today and they are not the same thing. Fix the writes, leave historical NULLs alone, read them as "not recorded".

### B7 — Two screens write different Len-Den records for identical input
**`NewCustomerScreen.tsx:248-256`** vs **`AddTransactionScreen.tsx:167-195`**

The new-customer path omits `jama` and `status` entirely and uses `remaining || undefined`. An entry created there is born already suffering B3, is left **open** even when paid in full at creation, and stores `baki = NULL` rather than `0`.

**Concrete:** New Customer → "Meena" → Len-Den ₹5000 → add a ₹5000 jama (paid on the spot) → Save. Her card shows a ₹5000 remaining chip, **no CLOSED badge**, and no jama chip. The ₹5000 she paid is invisible on every summary view.

**Fix:** extract one `buildLendenPayload(amount, discount, jamaEntries)` used by both screens, always setting `jama`, `baki`, `status`, passing `0` through with `??`.
**Effect on existing data: Repairs** — same recompute as B3.

### B8 — Money inputs accept negative and NaN values
**`NewCustomerScreen.tsx:445, 464, 476`**

These three inputs are the **only** money inputs in the app without a digit filter; every other one uses `text.replace(/[^0-9]/g, "")`. RN's `keyboardType="numeric"` maps to `TYPE_CLASS_NUMBER | FLAG_DECIMAL | FLAG_SIGNED`, so `-` and `.` are typeable, and paste bypasses the keyboard entirely. Typing `-500` stores a negative amount; pasting `1,200` stores **₹1**; typing `.5` yields `NaN`, which is falsy, so `|| null` stores **NULL** and the entry saves "successfully" with no amount and no error.

**Fix:** same digit filter as everywhere else, plus a `Number.isNaN` rejection in `handleSave`.
**Effect on existing data: Inert.**

### B9 — The bill preview promises a number the save will not keep
**`AddTransactionScreen.tsx:169-185`** vs **`BillTable.tsx:30-43`**

The preview computes true signed arithmetic; the save path clamps with `Math.max(0, …)` and auto-closes on a clamped zero. Enter ₹1000 and a ₹1200 payment (customer is ₹200 in credit): the preview correctly shows **FINAL BAKI ₹-200**, then Save stores `baki = 0, status = 1`. The ₹200 you owe back has no record anywhere.

**Fix:** store the signed value and render a negative baki as "Advance ₹200". If a clamp is genuinely wanted, apply it in `BillTable` too so the preview cannot promise what the save discards — and never auto-close on a clamped zero.
**Effect on existing data: Inert** going forward; past credits are already lost and are not reconstructable.

### B10 — Saving an edit leaves CLOSED entries with a live balance
**`TransactionDetailScreen.tsx:342-350`; `entryDatabase.ts:589-604`**

`updateLendenDetails`'s SET list omits `status`, and the screen never calls `updateLendenBaki` after an edit. A closed ₹1000 entry corrected to ₹1500 gets `baki=1500` but keeps `status=1` — it still shows **CLOSED**, is excluded from the "Open" filter, and carries an invisible ₹1500 debt.

**Fix:** call `updateLendenBaki(transactionId)` at the end of `handleSaveChanges`.
**Effect on existing data: Repairs** — same recompute as B3.

### B11 — Every `ON DELETE CASCADE` in the schema is decorative
**`entryDatabase.ts:277-283`; FK declarations at `:50, 65, 76, 87`**

`PRAGMA foreign_keys` appears nowhere in the codebase, and expo-sqlite sets none. SQLite defaults it **off per connection**. The comment above `deleteUser` says "cascades to rehan and lenden"; it does not. Corroborating evidence from your own code: `deleteRehan` and `deleteLenden` both delete their children *manually*, which would be redundant if cascades worked — the author hit this and patched around it in two of three places.

The confirm dialog promises "This will also delete all N associated transactions", then reports "Customer and all transactions deleted." In fact those rows survive with a dangling `userId`. They vanish from every screen (all read paths `JOIN users`) — but **`ExportService` does not join `users`**, so a deleted customer's entries reappear in every subsequent export.

**Fix:** add explicit child deletes to `deleteUser`, and add `PRAGMA foreign_keys = ON` in `openDatabase()`.
**Effect on existing data: DANGEROUS — do not enable the pragma naively.** Your database already contains orphan rows from past deletions. Turning FKs on does not retroactively delete them (checks run on write), but any subsequent write touching an orphan will start throwing `FOREIGN KEY constraint failed` where it previously succeeded, and a future table rebuild will drop rows. **Correct order:** (1) ship a one-time orphan sweep guarded by a version marker, collecting `media` paths for file cleanup first; (2) *then* enable the pragma. Reversed, the app starts throwing on legitimate edits.

### B12 — Admin API key in git history and in the shipped binary
**`ProductService.ts:4`, `BhavService.ts:4`** · *Security*

A single static `x-admin-key` string literal is the entire authorisation model for all writes. It grants: create/update/**delete** any product, category or variant (no undo offered anywhere); read and **overwrite** `silver_bhav`, `gold_995_bhav`, `gold_999_bhav`, `rtgs_bhav` — the metal rates your billing is priced from; and reach into your paid Cloudinary storage.

It is in **three commits already pushed to `origin/main`** (`d8a92bd`, `0984546`, `8c0cbf5`), and compiled into `dist/`'s Hermes bundles **and their sourcemaps**. `dist/` is correctly gitignored, but it is the artifact published for OTA updates — so the key ships to every installed device regardless. This is structural: any string literal in a mobile client is extractable from the APK.

**Two things to check yourself, today:** whether `github.com/aryanseth9795/asha_jwellers_admin` is public (the audit deliberately made no network request), and whether the rates currently on the server are the ones you set.

**Remediation, in order:**
1. Set a new key in the server environment and invalidate the old one.
2. Add a bare `.env` line to `.gitignore` **first** — it currently only covers `.env*.local`, so the obvious fix would commit the new key on the next `git add .`.
3. Remove both literals; source from `app.config.ts` reading `process.env`, or EAS build secrets.
4. Rebuild and publish an OTA update. Server-side rotation alone bricks every installed copy until clients receive the new key — sequence the switch and the push, or accept a write outage.
5. `git filter-repo` + force-push removes it from this repo but not from clones, forks or CI caches. **Treat the current key as burned regardless.**

**The durable fix** beyond rotation: move admin writes behind per-user auth issuing short-lived tokens, so one compromised device does not hand over permanent destructive access to your catalogue and pricing.
**Effect on existing data: Inert** in this repo; the server-side consequences are the real exposure.

### B13 — "Delete all images on a variant" is impossible
**`AddEditProductScreen.tsx:344-347`**

`existingImages` means "URLs **to keep**", so `[]` is meaningful — it means keep none. The screen converts `[]` to `undefined`, which both encoders drop. The field is omitted at exactly the moment the user's intent is "remove all of them". Remove all three images from a variant, save, reopen — all three are back.

**Fix:** `existingImages: existingImageUrls ?? []`, and make `createFormData` stringify an empty array rather than skipping it.
**Effect on existing data: Inert.**

### B14 — Product save half-commits and duplicates variants on retry
**`AddEditProductScreen.tsx:264-368`**

One tap issues `updateProduct` → N × `addVariant` → M × `updateVariant`, with no transaction, no rollback, and — critically — **the returned `_id`s are never written back to state**. If the third `addVariant` fails, the product and two variants are already committed but the alert says "Failed to save product". Tapping Update again re-filters on `v.isNew`, still `true` for all three, and **creates variants 1 and 2 a second time**.

Reachable without any error too: `isLoading` clears in the `finally` *before* the success alert is dismissed, and on Android that alert can be dismissed with the back button without firing `onPress`.

**Fix:** write returned `_id`s back and clear `isNew`; keep the button disabled until navigation occurs; report precisely what succeeded on partial failure.
**Effect on existing data: Inert** locally — but duplicates already created on the server need manual cleanup, and the API cannot delete the last variant.

### B15 — Variant weight is required by the API but unvalidated in the UI
**`AddEditProductScreen.tsx:209-232`, `:159-191`, `:662-671`**

`handleSaveVariant` performs no validation at all. The Weight field lacks the required-asterisk that Name and Category carry, so the UI signals it is optional. `validateForm` checks weight only for `variants[0]`, and only when `!isEditMode` — so every variant after the first is unchecked in create mode, and **no variant at all is checked in edit mode**. The submit path sends `weight: variant.weight || ""`, defeating the non-optional type.

**Fix:** require non-empty weight before the modal closes, mark the field required, validate all variants in both modes.
**Effect on existing data: Inert.**

---

## 4. Two defects in the in-flight plan

The data-layer audit reviewed §4 of the bill-printing design and found two real problems with work that has **not yet landed**. Both are now patched into `agent/2026-08-31-lenden-bill-plan.md`.

**P1 — The `amountOverridden` backfill is not atomic with its `ALTER`.**
The migration adds the column then runs `UPDATE lenden SET amountOverridden = 1` to protect every historical row. If the pair half-completes, the surrounding migration block's `catch` swallows it (it logs "Continue anyway as tables might be fresh") and, because the column now exists, **the backfill never runs again**. Every historical entry would sit at `amountOverridden = 0`, protected only by the `items.length === 0` fallback — which stops protecting them the instant anyone adds a line item to an old entry, silently recomputing that entry's amount from the new items. **Fix: wrap the ALTER+UPDATE pair in `withTransactionAsync`.**

**P2 — `lenden_items`' `ON DELETE CASCADE` will not fire** (it inherits B11). `deleteLenden` needs an explicit `DELETE FROM lenden_items WHERE lendenId = ?`, inside the same transaction as the parent delete.

---

## 5. Remediation plan — sequenced by data risk, not severity

The ordering principle: **a Critical bug whose fix is risky lands after an Important bug whose fix is inert.** Two places below deliberately invert severity order, and both are called out.

### Phase 0 — Get a backup you can actually trust (do this before anything else)

**Your in-app export is not a backup.** It omits `jama_entries` and `rehan_transactions` — every payment you have ever recorded — and if the read fails it hands you an empty zip that reports success.

1. **Copy the raw database file off the device first.** It lives at `<app documentDirectory>/SQLite/aj_database.db`. This is the only artifact that currently contains everything. Do this before any code change lands.
2. **Then fix the export** (I4 + I5): add both missing tables, add a `schemaVersion` field, and make it refuse to produce a zip with zero records when the database reports rows. This is JS-only, so it ships as an OTA update with no rebuild.
3. Take a second backup with the fixed export and confirm the payment tables are populated.
4. **Write an import path.** There is none anywhere in the codebase, so no export has ever been round-tripped. A backup you cannot restore is not a backup.

*Why first:* every later phase touches data. Verify recovery before you need it.

### Phase 1 — Inert fixes (no stored row changes, safe in any order)

**1a. B1 alone, shipped by itself.** Delete `entryDatabase.ts:33`. Zero migration cost, and it un-bricks every future install. Do not bundle it with anything.

**1b. B2** — await `initDatabase()`, add an error screen, memoise the connection promise. **Must follow 1a**, or fresh installs hang at the splash instead of failing silently.

**1c. The write-path corrections:** B5 (`COALESCE`), B6 (`??` at 12 sites), B8 (digit filters), B15, B13, I16–I20, I23.

**1d. The read/UX corrections:** B9, I6–I13, I15, I21, I22, I24, and the Minor list.

**1e. B12 — key rotation.** Independent of the database entirely; run it in parallel with this phase. Order matters within it: `.gitignore` line → server key → client change → OTA push.

*Verify before proceeding:* install fresh on a spare device and confirm the app creates its tables and accepts a customer.

### Phase 2 — Repairs (fix the code, then correct the rows it corrupted)

**2a. Fix the code first:** B3, B7, B10 — make `jama_entries` the single source of truth, unify the two Len-Den write paths, call `updateLendenBaki` after every edit.

**2b. Only then, the one-time recompute**, guarded by a version marker so it runs exactly once:
`baki = remaining − SUM(jama_entries.amount)` for every Len-Den, with `status` re-derived.

Running 2b before 2a is pointless — the next edit re-corrupts it. Rows whose `remaining` was also clobbered cannot be fully recovered; **surface those in a list rather than silently rewriting them**, and reconcile against your paper records.

**2c. B4** — seed the rehan edit states and make `updateRehanDetails` patch only what it is given. Code fix only. **Do not backfill NULL balances**; display them as "not recorded" so you can re-enter them deliberately.

*Verify before proceeding:* pick three customers with known payment histories and confirm their balances match your paper records.

### Phase 3 — Migrations (schema and backfill)

**3a. The in-flight feature branch's Task 5** — `lenden_items`, `billNo`, `amountOverridden` — with the P1 transaction fix applied.

**3b. Export schema versioning** if not already done in Phase 0.

*Verify:* every historical amount unchanged. This is the checkpoint the plan already builds in.

### Phase 4 — Dangerous (isolated, backup taken immediately before)

**4a. B11 — foreign keys.** Strictly in this order:
1. Take a fresh backup.
2. Run a one-time orphan sweep, guarded by a version marker, **collecting `media` paths before deleting rows**.
3. Add explicit child deletes to `deleteUser` and `deleteLenden` (including `lenden_items`, per P2).
4. *Only then* enable `PRAGMA foreign_keys = ON`.

**4b. I3 — orphaned image cleanup.** The sweep must enumerate `media` from every table before deleting anything, and must run only at cold start before any screen mounts — a file saved but not yet written to a row would otherwise be deleted mid-flow.

**4c. I1 — transactions.** Wrapping writes in `withTransactionAsync` will surface errors that are currently swallowed by partial success. Expect flows that appeared to work to start reporting failures honestly. That is the point, but land it when you can watch it.

> **Note on the ordering inversion:** B11 and B4 are both Critical, yet they land in Phase 4 and Phase 2c while several Important findings land in Phase 1. That is deliberate. B11's fix can start throwing errors on legitimate edits if the orphan sweep is skipped, and B4's data is already unrecoverable so haste buys nothing. The Phase 1 items cannot damage a single stored row.

---

## 6. Verification checklist (on a device holding real data)

1. Raw `aj_database.db` copied off the device and its size sanity-checked. *(Phase 0)*
2. Fixed export produces a zip containing non-empty `jama_entries` and `rehan_transactions`. *(Phase 0)*
3. Fresh install on a spare device creates all tables and accepts a customer. *(B1, B2)*
4. Three known customers' balances match paper records **before** any change — record them now as your baseline.
5. Open a Len-Den with payments, tap Edit, tap Cancel. The Save button must **not** appear on its own. *(B3)*
6. Open the same entry, tap Edit, add a photo, Save. Balance unchanged. *(B3)*
7. Open a Rehan with a balance, tap Edit, add a photo, Save. Product name and amount intact. *(B4)*
8. New Customer → Len-Den paid in full at creation → shows CLOSED with ₹0, not open with a stale chip. *(B7)*
9. Cash sale paid in full → reopen → Baki row shows **₹0**, not blank. *(B6)*
10. Post-recompute, re-check the three baselines from step 4. *(Phase 2b)*
11. Delete a test customer → export → confirm their rows do **not** reappear. *(B11)*
12. Every historical amount unchanged after the Task 5 migration. *(Phase 3)*

---

## 7. What I would not bother fixing

- **`getProductsByCategory` dead code** — delete it or leave it; it costs nothing either way.
- **`eas.json` production APK vs AAB** — correct as-is if you sideload onto shop devices, which the setup implies.
- **`MediaTypeOptions` deprecation** — still works in the installed version; change it at the next major upgrade, not now.
- **Minor `JSON.parse` hardening in the export** — the auditor labelled it *suspected unreachable* and could find no write path producing non-JSON. Cheap to harden, but not worth its own release.

---

## 8. Confidence

**Verified by executing code:** B1 (reproduced against real SQLite by two independent auditors), B12's git history and bundle presence, the absence of any `AbortController` or timeout, `tsc --noEmit` passing.

**Verified by reading code:** everything else in Critical and Important, each with a traced failure path.

**Suspected, not confirmed** — carried forward honestly rather than laundered into fact:
- Whether I16's JSON fallbacks currently fail depends on whether `express.json()` is mounted ahead of the admin routes on the server — not determinable from this repo.
- How the server treats an *absent* `existingImages` (keep-all or delete-all) — B13 is a client-side defect either way, but the visible symptom depends on the server.
- Whether the error envelope uses `message` (I20) — inferred by analogy with the documented success shape.
- I8's exact failure mode — that `{0 && <View/>}` puts a bare `0` in the tree is certain; whether RN 0.81 renders stray text or throws was not verified on-device. The one-character fix is the same either way.
- Whether the GitHub repo is public — **check this yourself**; it decides how urgent B12's rotation is.

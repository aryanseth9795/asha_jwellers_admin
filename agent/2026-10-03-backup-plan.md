# Backup Export / Import Implementation Plan

> Executed with parallel subagents (owner's request). Wave 1 units touch disjoint files and run at the same time.
> Wave 2 integrates. Each unit is reviewed, then the whole branch is reviewed.

**Goal:** Build backup v2: export of all 7 ledger tables plus photos, and a validated, all-or-nothing import with Safe
merge or Replace & restore. Every record carries a permanent UUID.

**Spec:** `agent/2026-10-03-backup-design.md`
**Contract (already committed):** `src/backup/format.ts`. It holds the types, the constants and `BackupError`. Do not
change it. Report it if it is missing something.

## Global Constraints

- Branch `feat/import-export-module`, working in place at `D:\Desktop\asha`.
- **Parallel safety:**
  - Do NOT run any git command that writes: no add, commit, checkout or stash. The controller commits each unit.
  - Edit only the files listed for your unit.
  - Other agents are editing other files at the same time. If `npx tsc --noEmit` reports errors only in files outside
    your list, ignore them, and say so in your report.
- No new dependencies.
- Pure modules (`src/backup/*`) must not import react-native or expo, so Jest (node env, `src/**/*.test.ts`) can load
  them.
- UI text comes from `src/ui`. Messages go through `notify` / `confirm` from `src/ui`. Pop-ups use `BottomSheet`.
- Keep each file's line endings: `src/database/*.ts` and `src/types/entry.ts` are CRLF. New files use LF.
- Dates are ISO strings. Money values are integers, stored as they are.

---

## Wave 1 (parallel)

### Unit A — checksum and serializer

**Files:** create `src/backup/checksum.ts`, `src/backup/checksum.test.ts`, `src/backup/serialize.ts`,
`src/backup/serialize.test.ts`.

**`checksum.ts`:** `export const fnv1a = (text: string): string`. It computes FNV-1a 32-bit over the UTF-8 bytes
(`new TextEncoder().encode(text)`) and returns 8 lower-case hex digits, zero-padded. Test vectors:

| Input | Output |
|---|---|
| `""` | `"811c9dc5"` |
| `"a"` | `"e40c292c"` |
| `"foobar"` | `"bf9cf968"` |

Also test that a Hindi string gives a stable 8-hex result.

**`serialize.ts`:**

```ts
export interface SerializeResult {
  /** zip-relative path → exact JSON text written to the zip */
  files: Record<string, string>;
  manifest: Manifest;
  /** photos to copy into the staging folder: absolute phone path → zip-relative path */
  mediaCopies: { from: string; to: string }[];
}
export const serializeSnapshot = (
  snapshot: LocalSnapshot,
  options: { createdAt: string; mediaExists: (absolutePath: string) => boolean },
): SerializeResult;
```

Rules (spec §5):
- **Shapes:** rows convert to the `format.ts` row shapes, dropping numeric `id`s.
  - `userId` → `customerUuid`, or `null` when no customer has that id.
  - `rehanId` → `rehanUuid` and `lendenId` → `lendenUuid`. A child whose parent id is not in the snapshot is left out,
    and the export adds the warning `"N <table> rows had no parent record and were left out"`.
- **Media:** each record's `media` (absolute paths, in order) becomes `media/<recordUuid>/<n>-<basename>` with `n`
  starting at 1, one entry in `mediaCopies` per photo.
  - A path for which `mediaExists` returns false is dropped and counted in `manifest.media.missing`, with the warning
    `"N photos listed on records were not found on the phone and were left out"`.
- **Files:**
  - `files[DATA_FILES[k]] = JSON.stringify(rows, null, 2)` for every table, even when it is empty.
  - `manifest.files[path] = { count, checksum: fnv1a(text) }`.
  - `manifest` = `{ format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt, files, media: { count: mediaCopies.length, missing }, warnings }`.
- **Order:** rows stay in snapshot order.

**Tests (Jest):**
- a snapshot with 2 customers, 1 rehan with 2 photos (one missing), 1 transaction, 1 len-den with 1 item, 1 old item
  and 1 jama, plus an orphan rehan (`userId` 999) and an orphan jama (`lendenId` 999)
- assert exact rows, `customerUuid` null for the orphan rehan, the orphan jama left out with its warning, media paths
  and copies, the missing count, counts, and that each checksum equals `fnv1a` of each file text

### Unit B — validator and legacy converter

**Files:** create `src/backup/validate.ts`, `src/backup/validate.test.ts`, `src/backup/legacy.ts`,
`src/backup/legacy.test.ts`.

**`validate.ts`:**

```ts
/** Structural + referential checks on parsed rows. Returns readable problems (empty = valid). */
export const validateData = (data: BackupData, mediaPaths: Set<string>): string[];
export const validateBackup = (input: {
  manifestText: string | null;
  files: Record<string, string | undefined>; // zip-relative path → text (undefined = missing)
  mediaPaths: Set<string>; // every file path present under media/ in the zip
}): { ok: true; manifest: Manifest; data: BackupData } | { ok: false; errors: string[] };
```

**`validateBackup` checks, in order.** It stops at the first category that fails and returns at most 5 messages:
1. **Manifest:** present and parseable. `format === BACKUP_FORMAT`, otherwise "Not an AJ backup". `version ===
   BACKUP_VERSION`, otherwise "Unsupported backup version N".
2. **Files:** every `DATA_FILES` path exists ("Backup is incomplete: <path> is missing").
3. **Checksums:** `fnv1a(text) === manifest.files[path].checksum`, otherwise "Backup is damaged: <path> failed its
   check".
4. **JSON:** each file parses as an array, and its length equals `manifest.files[path].count`.
5. **`validateData`:**
   - required fields and types for each row shape: strings non-empty where required, numbers finite, `null` allowed
     only where the type allows it
   - `uuid` matches `UUID_RE` and is unique within its table
   - `type` is "diya" or "jama"
   - every `rehanUuid` / `lendenUuid` resolves within the backup, and every non-null `customerUuid` resolves
   - every media path is in `mediaPaths`

Messages name the table and row number, e.g. `"rehan row 12: customerUuid does not match any customer"`.

**`legacy.ts`:**

```ts
export const convertLegacy = (
  input: { users: unknown; rehan: unknown; lenden: unknown },
  newUuid: () => string,
): { data: BackupData; warnings: string[] };
```

- **Input:** v1 rows as exported by the old app. Users have `id, name, address, mobileNumber, nickname, createdAt`.
  Rehan rows have `id, userId, media (JSON string), status, openDate, closedDate, productName, amount, originalMedia`.
  Len-den rows have `id, userId, date, media, amount, discount, remaining, jama, baki, status, billNo, amountOverridden,
  originalMedia`.
- **UUIDs:** if a row already has a valid `uuid` (a refined backup), keep it. Otherwise use `newUuid()`.
- **Customer links:**
  - If a rehan or len-den row has a valid `userUuid`, use it as the `customerUuid`.
  - Otherwise map its numeric `userId` through the users' ids.
  - An unknown user gives `null`.
- **Media:** the media JSON string is parsed to an array of the strings already in it (e.g. `"images/x.jpg"`, relative
  to the old zip). Bad JSON gives `[]` plus a warning.
- **`updatedAt`:** `createdAt`, `openDate` or `date` respectively.
- **Status:** a missing `status` gives 0 for rehan and `null` for len-den. A missing `amountOverridden` gives `1`.
  Old rows predate line items, so their stored amount is authoritative (same rule as the database migration).
- **Child tables:** `rehanTransactions`, `lendenItems`, `oldJewellery` and `jamaEntries` are empty.
- **Warning:** always add `"This is an old backup: jama payments, rehan diya/jama, bill items and old jewellery are not
  in it and cannot be restored."`
- **Bad input:** if `users`, `rehan` or `lenden` is not an array, throw a `BackupError("Not an AJ backup")`.

**Tests:** every rejection path of `validateBackup` (one test each), a valid round of `validateData`, and legacy
conversion covering kept uuids, `userUuid` links, orphans, media parsing, bad media JSON, and defaults.

### Unit C — merge planner

**Files:** create `src/backup/plan.ts` and `src/backup/plan.test.ts`.

```ts
export const countRows = (data: BackupData): Record<TableKey, number>;
export const planMerge = (backup: BackupData, local: LocalSnapshot): MergePlan;
```

Rules (spec §6.1):
- **Local UUIDs:** convert the local snapshot to UUID form using its numeric ids. A local rehan or len-den whose
  `userId` matches no customer has `customerUuid` null.
- **Customer:**
  - Absent locally: insert.
  - Same name, address, mobileNumber, nickname and createdAt: same.
  - Otherwise: conflict.
- **Rehan:**
  - Absent: insert it with all its backup transactions. Those transactions are NOT in `applyToBalance`.
  - Present: compare customerUuid, productName, status, openDate and closedDate, but not `amount` or media. A mismatch
    is a conflict; otherwise same.
  - For a present rehan, each backup transaction is handled on its own:
    - Absent locally: insert, and add its uuid to `applyToBalance`.
    - Present and identical (type, amount, date): same.
    - Otherwise: conflict.
- **Len-den:**
  - Absent: insert it, and insert all its items, old jewellery and jama entries.
  - Present: compare customerUuid, date, amount, discount, remaining, status, billNo and amountOverridden, but not jama,
    baki or media. A mismatch is a conflict; otherwise same.
  - The items and old jewellery of a present len-den are never inserted. Count them as same when an item with the
    same uuid exists locally; otherwise count them as conflict.
  - Jama entries of a present len-den:
    - Absent: insert, and add the len-den uuid (deduplicated) to `recomputeLenden`.
    - Present and identical (amount, date): same.
    - Otherwise: conflict.
- **Children of a conflicting parent:** follow the same per-child rules as for a present parent. The parent itself
  stays local.
- **`summary`:** total = backup rows per table. insert + same + conflict = total.
- **`billNoClashes`:** the sorted distinct billNo values of inserted len-den that equal the billNo of a different
  local len-den.
- **Re-import:** planning the same data a second time against a local snapshot that already contains it gives 0
  inserts.

**Tests:** each table's insert / same / conflict; children inserted into an existing rehan (with `applyToBalance`) and
an existing len-den (with `recomputeLenden`); conflict parents; the orphan `customerUuid` null; bill-number clashes;
and an idempotent re-plan. Build the local snapshot from the backup with numeric ids to show the re-plan is a no-op.

### Unit D — database identity migration

**Files:** create `src/database/uuidSql.ts`. Modify `src/database/entryDatabase.ts`, `src/database/lendenItems.ts`,
`src/database/lendenOldJewelleryItems.ts` and `src/types/entry.ts`.

- **`uuidSql.ts`:**
  `export const UUID_SQL = "lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))";`.
  Add a comment that it yields a lower-case UUID v4 per evaluated row.
- **Migration in `initDatabase`:** after the existing migrations, add `ensureIdentityColumns(database)`. For each of
  the 7 tables, check `PRAGMA table_info`. If `uuid` is missing, then inside `database.withTransactionAsync`:
  - `ALTER TABLE <t> ADD COLUMN uuid TEXT`
  - `ALTER TABLE <t> ADD COLUMN updatedAt TEXT`
  - `UPDATE <t> SET uuid = ${UUID_SQL} WHERE uuid IS NULL`
  - `UPDATE <t> SET updatedAt = COALESCE(<dateColumn>, '<now ISO>') WHERE updatedAt IS NULL`, where `<dateColumn>`
    is:

| Table | Date column |
|---|---|
| users | createdAt |
| rehan | openDate |
| rehan_transactions, lenden, jama_entries | date |
| lenden_items, lenden_old_jewellery_items | none (use now) |

  Then, outside the guard so it always runs, `CREATE UNIQUE INDEX IF NOT EXISTS idx_<t>_uuid ON <t>(uuid)`. Also add
  `uuid TEXT` and `updatedAt TEXT` to each `CREATE TABLE IF NOT EXISTS` for fresh installs.
- **Inserts:** every INSERT in the three database files adds `uuid, updatedAt` with values `${UUID_SQL}, ?` (now ISO).
- **Updates:** every UPDATE statement sets `updatedAt = ?` (now ISO), including the balance updates in
  `createRehanTransaction`, `deleteRehanTransaction`, `updateLendenBaki` and `editJamaEntry`.
- **`deleteUser`:** in one `withTransactionAsync`, delete:
  - the user's `rehan_transactions` (`WHERE rehanId IN (SELECT id FROM rehan WHERE userId = ?)`), then their `rehan`
  - the user's `jama_entries`, `lenden_items` and `lenden_old_jewellery_items` for their len-den, then their `lenden`
  - the user
- **`src/types/entry.ts`:** add optional `uuid?: string; updatedAt?: string;` to `User`, `Rehan`, `Lenden`,
  `JamaEntry` and `RehanTransaction` (and to the item types if they are declared there).
- No behaviour change beyond these. Verify with `npx tsc --noEmit` (own files) and a careful read: there is no SQLite
  in Jest.

### Unit E — import preview sheet

**Files:** create `src/components/ImportBackupSheet.tsx`.

```tsx
const ImportBackupSheet: React.FC<{
  visible: boolean;
  preview: ImportPreview | null;
  busy: boolean;
  onMerge: () => void;
  onReplace: () => void;
  onClose: () => void;
}>;
```

- **Frame:** a `BottomSheet`, title "Import backup". The subtitle is the backup date (`createdAt` formatted `en-IN`
  day, month, year and time) or "Date unknown", plus " · Old backup" for legacy.
- **Counts table.** Rows, in this order: Customers, Rehan, Rehan diya/jama, Len-den, Bill items, Old jewellery, Jama
  payments.
  - Columns: In backup, then (only when `preview.merge` is non-null) New, Already here, Different.
  - Numbers are right-aligned and stay on one line. Labels follow rule 4: `flexShrink: 1`, `numberOfLines={1}`.
  - Use plain `View` rows; the sheet body scrolls.
- **Warnings:** each warning is an amber row with an `alert-circle-outline` icon. Bill-number clashes show as "Bill
  numbers already used on this phone: 3, 7". Missing media shows as "N photos are missing from the backup".
- **Footer, stacked full-width, 48 dp tall:**
  - "Safe merge" (primary blue): shown only when `merge` is non-null.
  - "Replace & restore" (red `colors.danger` outline).
  - Both are disabled, with an `ActivityIndicator` replacing the labels, while `busy`.
- Tokens come from `src/ui/theme.ts`. Imports: `Text`, `BottomSheet` and `colors` from `"../ui"`; `ImportPreview`
  from `"../backup/format"`.

---

## Wave 2 (one agent, after Wave 1 is committed)

### Unit F — database apply, services, Home wiring, round-trip test

**Files:**
- Create `src/database/backupQueries.ts`, `src/services/BackupExportService.ts`,
  `src/services/BackupImportService.ts` and `src/backup/roundtrip.test.ts`.
- Modify `src/screen/homeScreen.tsx` and `src/ui/sourceAudit.test.ts`.
- Delete `src/services/ExportService.ts`.

- **`backupQueries.ts`:**
  - `readSnapshot(): Promise<LocalSnapshot>`: all 7 tables, inside `withExclusiveTransactionAsync` for a consistent
    read. `media` is parsed from its JSON string.
  - `applyReplace(data: BackupData, mediaMap: Map<string, string>)`: delete the 7 tables' rows, then insert all rows
    with their uuid and updatedAt as they are. Parent uuids map to new local ids; `customerUuid` null gives `userId`
    0. Media relative paths map to absolute paths through `mediaMap`.
  - `applyMerge(plan: MergePlan, mediaMap)`:
    - Insert `plan.insert`. Resolve parents through local `uuid` lookups and the uuids inserted in this run.
    - For each `applyToBalance` transaction, update the rehan balance (diya +, jama −).
    - For each `recomputeLenden`, recompute `jama` = Σ entries and `baki` = `remaining − jama` (bounded as
      `updateLendenBaki` does; reuse that function's SQL).
    - Run everything in one `withExclusiveTransactionAsync`. Return the inserted counts.
- **`BackupExportService.ts`:**
  - `exportBackup(): Promise<void>`: snapshot → `serializeSnapshot` (with `mediaExists` via
    `FileSystem.getInfoAsync`) → stage files and copy photos → zip → share.
  - `writeEmergencyBackup(): Promise<string>`: the same into `backups/before-restore-<ts>.zip`, keeping the newest 3.
- **`BackupImportService.ts`:**
  - `pickAndStageBackup(): Promise<StagedImport | null>`:
    - Pick with `File.pickFileAsync(undefined, "application/zip")`, imported from `"expo-file-system"`.
    - Copy into the cache, unzip, and detect v2 or legacy.
    - Read the texts, list `media/**`, then validate, or convert legacy and run `validateData`.
    - Read the local snapshot and plan, then build an `ImportPreview`.
    - Throw `BackupError` with a spec §7 message on failure.
    - `StagedImport = { preview: ImportPreview; data: BackupData; plan: MergePlan | null; dir: string }`.
  - `applyImport(staged, mode): Promise<ImportResult>`:
    - Copy photos to `<images dir>/<recordUuid>-<n>-<name>`, reusing existing files and tracking new ones.
    - Replace runs `writeEmergencyBackup` first.
    - Apply, and on error delete the newly copied photos and rethrow.
    - Finally delete the staging folder.
  - `discardStagedImport(staged)`.
- **Home:** add an "Import" button next to "Export", in the same style, with the `cloud-download-outline` icon.
  - Flow: pick → stage → open `ImportBackupSheet` → Safe merge or Replace (after
    `confirm({ tone: "danger", title: "Replace all data?", message: "Everything on this phone is replaced by the backup. An automatic backup of the current data is saved first.", confirmLabel: "Replace" })`) → apply → `notify.success("Backup imported", "<inserted> added · <skipped> already here · <conflicts> kept as on this phone")`.
  - Errors use `notify.error("Import failed", error.message)`.
  - Export now calls `exportBackup`.
- **`roundtrip.test.ts` (pure):**
  - Build a `LocalSnapshot` covering every table and field (including null-able fields, an orphan len-den and
    photos).
  - `serializeSnapshot` (all media exist) → `validateBackup` with the file texts and media paths → `ok`.
  - Then `planMerge(data, emptySnapshot)`: everything is insert.
  - Then `planMerge(data, snapshotItself)`: everything is same.
  - Then assert that `data`, mapped back by uuid, equals the snapshot field for field (exact restore), with media
    compared by count and order.
- **Audit:** add a rule that no file imports `services/ExportService`.

### Unit G — village picker (owner request, 2026-10-03)

**Files:**
- Create `src/utils/villageNames.ts`, `src/utils/villageNames.test.ts`, `src/database/villages.ts` and
  `src/components/VillagePicker.tsx`.
- Modify `src/screen/NewCustomerScreen.tsx` (address input) and `src/screen/ExistingCustomersScreen.tsx` (edit-sheet
  address input).

The customer's `address` field holds the village name. No schema change is needed.

- **`villageNames.ts` (pure):**
  - `villageKey(s)`: lower-case, punctuation removed, spaces collapsed, trimmed. `"Manwal ."` gives `"manwal"`.
  - `canonicalVillages(addresses: (string | null)[]): { name: string; count: number }[]`:
    - Group by key, ignoring empty keys.
    - The display name is the most common raw spelling, trimmed and with spaces collapsed. A tie goes to the earliest
      seen.
    - Sorted by count desc, then name.
  - `resolveVillage(input: string, villages: { name: string }[]): string`: returns the canonical name when the key
    matches an existing village. Otherwise it returns the input trimmed, with spaces collapsed and the first letter
    capitalised. This is how a new village is stored.
  - Tests:
    - Manwal ×72 and "Manwal ." ×2 give "Manwal".
    - Chhoonchhe ×2 and Chhonchhe ×1 are different keys, so they stay separate. Spelling merges are only for
      punctuation, case and space variants.
    - Tie-break, the empty and null case, `resolveVillage` for an existing village, and a new village.
- **`villages.ts` (device):** `getVillages(): Promise<{ name: string; count: number }[]>` reads `SELECT address FROM
  users` with its own `openDatabaseAsync("aj_database.db")` connection, as `lendenItems.ts` does, and returns
  `canonicalVillages(...)`.
- **`VillagePicker.tsx`:**
  - Props: `value: string`, `onChange(v: string)`, `placeholder?`.
  - It is a `TextInput` from `src/ui`. Focusing or typing shows a suggestion list under it of up to 8 villages whose
    name contains the typed text, case-insensitive, with the most used first and the count shown dim on the right.
  - When the typed text matches no village key, the last row is "+ Add "<typed>" as a new village" (it just keeps the
    text).
  - Tapping a suggestion sets the canonical name and closes the list.
  - On blur, the value is passed through `resolveVillage`.
  - The list is a plain `View` of rows, not a nested scroll view. Rows are at least 44 dp tall.
  - The village list loads once on mount via `getVillages`.
- **Screens:** replace the address `TextInput` in NewCustomer and in the Edit Customer sheet with `<VillagePicker>`.
  The label becomes "Village" and the placeholder "Choose or type a village". Keep the state variables and the
  duplicate check (NewCustomer resets `hasDuplicateCheckRun` on change, as today).

## Wave 2

### Unit H1 — item category in the data layer (runs first; Unit F and Unit H2 depend on it)

**Files:**
- `src/backup/format.ts`: add `category: string | null` to `RehanRow` and `LendenItemRow`. The Local types follow
  automatically.
- `src/backup/serialize.ts`, `src/backup/validate.ts`, `src/backup/legacy.ts` and `src/backup/plan.ts`: carry,
  validate (string or null) and compare `category`. In legacy, read an optional `category` string from v1 rehan rows,
  defaulting to null.
- The matching tests: update the fixtures and add one test per module for `category`.
- `src/database/entryDatabase.ts`: in the migration, add `category TEXT` to `rehan` when it is missing. Also add it in
  `CREATE TABLE`. `createRehan` and `updateRehanDetails` accept and store `category`.
- `src/database/lendenItems.ts`: add `category TEXT` to `lenden_items` (the migration lives in `initDatabase`).
  `replaceLendenItems` stores it, and `toLendenItem` returns it. Also make `toLendenItem` and `toOldJewelleryItem`
  return `uuid` and `updatedAt`, a Unit D follow-up.
- `src/types/entry.ts`: add `category?: string | null` to Rehan, NewRehan, LendenItem and NewLendenItem.
- `App.tsx`: await `initDatabase()` before leaving the splash. `isLoading` becomes false only after both the timer and
  the init have finished. If init throws, show the existing splash with "Could not open data. Restart the app." and
  stay there.

### Unit F — see "Wave 2 (one agent, after Wave 1 is committed)" above. It runs after H1, in parallel with H2.

### Unit H2 — category picker and analytics (in parallel with F)

**Files:**
- Create `src/utils/itemCategories.ts` and its `.test.ts`, `src/database/itemCategories.ts`, and
  `src/components/CategoryPicker.tsx`.
- Modify `src/screen/AddTransactionScreen.tsx` (rehan), `src/components/AddLendenItemModal.tsx` (bill item),
  `src/screen/TransactionDetailScreen.tsx` (rehan edit), and `src/utils/analytics/report/pledges.ts` and its test.

- **`itemCategories.ts` (pure):**
  - `BASE_CATEGORIES`: the item-rule labels in rule order, then "Other". Import the labels from `items.ts`; do not
    copy them.
  - `categoryOptions(stored: (string | null)[])`: the base list, followed by custom stored categories ordered by count.
  - `resolveCategory(input)`: empty gives "Other". A match on the case-insensitive key gives the canonical name.
    Otherwise trim it and capitalise the first letter.
  - Tests.
- **`src/database/itemCategories.ts`:** `getStoredCategories()` returns `SELECT category FROM rehan UNION ALL SELECT
  category FROM lenden_items`, using its own connection.
- **`CategoryPicker`:** works like `VillagePicker`. Label "Category (optional)", placeholder "Choose a category —
  Other if left empty". When the field is focused and empty it shows the whole list, not only matches. Saving passes
  the value through `resolveCategory`.
- **Screens:** rehan add and edit, and the bill item modal, pass `category` into the database calls. The existing
  description field stays.
- **Analytics:** `buildPledgeRows` uses `rehan.category ?? itemTypeOf(productName)` for the item type. Add a test that
  a stored category wins over the description keyword.

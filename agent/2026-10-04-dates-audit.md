# Calendar-date audit (hardening Task 3, item 8)

Scope: every place in `src/` that reads or writes the five calendar fields

- `rehan.openDate`, `rehan.closedDate`
- `lenden.date`
- `jama_entries.date`
- `rehan_transactions.date`

Snapshot: HEAD `f2afde6` plus the uncommitted edits other agents had in the tree when this was written. `entryDatabase.ts` and the screens were still moving (line numbers drifted by 3 to 35 between my own greps), so every row also names the function or symbol. Re-grep before editing. Tags used below:

| Tag | Meaning |
|---|---|
| **W** | writes the value |
| **P** | parses it with `new Date(...)` |
| **CMP** | compares it as a string or as `toISOString()` text |
| **PICK** | feeds a date picker |
| **SORT** | sorts by it |
| **SQL** | SQLite date function or comparison |
| **FMT** | formats it for display only |

Helpers referred to: `toDay`, `normalizeDay`, `parseDay`, `todayDay`, `isDay` from `src/utils/dates.ts` (done). One more is proposed, see finding 3: `toLocalDate(value)`.

## Findings that change the plan

1. **Eleven writes, one source of the bug.** Every screen write is `<Date>.toISOString()`; two database defaults are `new Date().toISOString()`. All become `toDay(...)` / `todayDay()`. Table A.
2. **`closeRehan` writes the same string to `closedDate` and `updatedAt`** (`entryDatabase.ts:660-664`, `closedDate, closedDate`). After the change `closedDate` is a day but `updatedAt` must stay a full timestamp (the merge logic and "last write wins" read it). Use two variables.
3. **`new Date("YYYY-MM-DD")` is UTC midnight, not local midnight.** In IST (UTC+5:30) that is 05:30 on the same day, so every `new Date(plainDay)` read below is accidentally correct on this phone and in this test machine. West of UTC (any Americas timezone) it is the previous evening and the day shifts. The plan allows `new Date(...)` "where a UTC-midnight instant is harmless"; for the calendar-field/period maths below it is not harmless in principle. Recommendation: add one tolerant helper to `dates.ts`:
   `toLocalDate(value: string): Date` = `parseDay(value)` when `DAY_RE` matches, otherwise `new Date(value)` (so un-migrated or garbage values behave exactly as today, with no throw in a render path). Then replace each raw parse below with it. I did not add it, because the dispatch fixed the export list; say the word and I will add it with tests.
4. **Analytics has no string-vs-`toISOString()` comparison.** Every analytics date goes through `new Date(x).getTime()`, `toTime`, `dayNumber` or `daysBetween`. The `now.toISOString()` strings (`nowIso`) are fed to `daysBetween`, so they are parsed, not compared. They still should become `toDay(now)` so both sides of `daysBetween` are days (Table E). The one true string-vs-UTC-day bug is `ExistingCustomersScreen` (`toISOString().split("T")[0]`) plus the SQL `date(...)` filter that consumes it (Table A, Table C).
5. **Central analytics fix point is `periods.ts` `toTime`.** `inPeriod`, `bucketKey`, `dayNumber`, `daysBetween`, `allPeriod` all call it. Making `toTime` return `parseDay(v).getTime()` for plain days (cache already exists) fixes every period/bucket/age calculation in one place. The remaining raw `new Date(x)` calls in analytics (Table E) must be switched separately.
6. **Backup normalisation must happen before `planMerge`, not only at insert.** `plan.ts` decides `same` vs `conflict` by `eq(local.openDate, backup.openDate)` etc. After migration the phone holds plain days; an older v2 backup holds ISO text; unless the backup is normalised first, every date-carrying row on a re-import of the same data shows as a conflict. Put the normalisation in `validateBackup` (after `validateData` passes, before returning `data`) and in `convertLegacy` (v1 path never goes through `validateBackup`). Table D.
7. **`legacy.ts` reuses the date as `updatedAt`** (`updatedAt: openDate`, `updatedAt: date`, `legacy.ts:104,126`). When `openDate`/`date` are normalised, keep `updatedAt` as the original raw string (a timestamp), or the v1 import would write a bare day into `updatedAt`. Likewise the `EPOCH` fallback is a timestamp; the date fields need a plain `"1970-01-01"` fallback (`normalizeDay(EPOCH)` is `1969-12-31` west of UTC).
8. **SQL `date(openDate) >= date(?)` has two problems:** it returns the UTC day of a stored ISO instant (the second half of the Existing Customers off-by-one), and wrapping the column in `date()` stops SQLite using `idx_rehan_openDate` / `idx_lenden_date` / the `(userId, date)` indexes. After migration compare the column directly: `openDate >= ?` with a `toDay` parameter.
9. **Order of migrations.** `ensureIdentityColumns` (`entryDatabase.ts:375`) seeds `updatedAt` from `COALESCE(<dateColumn>, now)` (`:62`) for old rows. The dates migration must run after it (and after `ensureIndexes`), otherwise `updatedAt` would be seeded with a bare day. `PRAGMA user_version` is unused anywhere in `src/` (grep), so it is free to use for the "done" marker.
10. **No other readers.** `users.createdAt`, every `updatedAt`, `UserRow.createdAt` (`customersAdded`, `pledgeCustomers.ts:182`), bhav `updated_at`, manifest `createdAt` and the automatic-backup file names are timestamps and stay as they are.

---

## A. Database: `src/database/entryDatabase.ts`

| Line | Symbol | Tag | What it does | Recommended change |
|---|---|---|---|---|
| 121-122 | `initDatabase` rehan DDL | schema | `openDate TEXT NOT NULL`, `closedDate TEXT` | None (still TEXT). Add a one-line comment: plain `YYYY-MM-DD`. |
| 137, 156, 207 | `initDatabase` lenden / jama_entries / rehan_transactions DDL | schema | `date TEXT NOT NULL` | None. Comment as above. |
| 27-29, 32, 62 | `IDENTITY_TABLES`, `ensureIdentityColumns` | read (seed) | Seeds `updatedAt` from the date column for old rows | Keep. Dates migration must run after this (finding 9). |
| 551 | `createRehan` | W | `const openDate = rehan.openDate \|\| new Date().toISOString()` then INSERT (`:555-558`) | `rehan.openDate ? normalizeDay(rehan.openDate) : todayDay()`. Normalising here makes a stray ISO from any caller land as a day. `updatedAt` (`:562`) stays `toISOString()`. |
| 592, 607 | `getRehanByUserId`, `getAllRehan` | SORT | `ORDER BY openDate DESC` | `ORDER BY openDate DESC, id DESC`. |
| 660-664 | `closeRehan` | W | `closedDate = new Date().toISOString()` used for both `closedDate` and `updatedAt` | `closedDate = todayDay()`; `updatedAt = new Date().toISOString()`; two separate bound params. |
| 700-704 | `createRehanTransaction` | W | INSERT `transaction.date` as given | `normalizeDay(transaction.date)` (or `transaction.date ?? todayDay()` if the type allows). `updatedAt` stays a timestamp (`:705`, `:715`). |
| 732 | `getRehanTransactionsByRehanId` | SORT | `ORDER BY date DESC` | `ORDER BY date DESC, id DESC`. |
| 784 | `createLenden` | W | INSERT `lenden.date` as given | `normalizeDay(lenden.date)`. |
| 823, 838 | `getLendenByUserId`, `getAllLenden` | SORT | `ORDER BY date DESC` | `ORDER BY date DESC, id DESC`. |
| 941, 965 | `getAllTransactions` SQL | SORT | `ORDER BY r.openDate DESC`, `l.date DESC` | Add `, r.id DESC` / `, l.id DESC`. |
| 978, 992 | `getAllTransactions` map | read | `date: r.openDate`, `date: l.date` into `Transaction.date` | None (already strings). |
| 1005 | `getAllTransactions` merged sort | P + SORT | `new Date(b.date).getTime() - new Date(a.date).getTime()` | Compare the strings: `b.date.localeCompare(a.date) \|\| (a.type === b.type ? b.id - a.id : a.type < b.type ? -1 : 1)`. Plain days sort correctly as text, no timezone, with a stable tie-break. |
| 1042, 1071 | `searchTransactions` SQL | SORT | as 941/965 | Same `, id DESC`. |
| 1088, 1102 | `searchTransactions` map | read | as 978/992 | None. |
| 1115 | `searchTransactions` merged sort | P + SORT | as 1005 | Same replacement as 1005. Share one `byDateDesc` comparator for the three merged sorts. |
| 1227, 1231 | `filterUsersWithCounts` (rehan only) | SQL | `date(openDate) >= date(?)`, `<= date(?)` | `openDate >= ?` / `openDate <= ?`. Normalise the incoming `filters.dateFrom/dateTo` with `normalizeDay` at the top of the function so a bad value fails loudly instead of matching nothing. |
| 1247, 1251 | `filterUsersWithCounts` (lenden only) | SQL | `date(date) >= date(?)`, `<= date(?)` | `date >= ?` / `date <= ?`. |
| 1268-1273 | `filterUsersWithCounts` (both) | SQL | rehan: `date(openDate)`; lenden: `date(date)`; params pushed at `:1280-1287` | Same direct comparison for both conditions. |
| 1325, 1331 | `getTransactionsByUserId` SQL | SORT | `ORDER BY openDate DESC`, `ORDER BY date DESC` | Add `, id DESC`. |
| 1345, 1359 | `getTransactionsByUserId` map | read | `date: r.openDate`, `date: l.date` | None. |
| 1372 | `getTransactionsByUserId` merged sort | P + SORT | as 1005 | Same shared comparator. |
| 1389-1392 | `createJamaEntry` | W | INSERT `entry.date` as given | `normalizeDay(entry.date)`. |
| 1409 | `getJamaEntriesByLendenId` | SORT | `ORDER BY date ASC` | `ORDER BY date ASC, id ASC` (matches the direction; it drives the running baki in `BillTable`). |
| 1485-1487 | `editJamaEntry` | W | `UPDATE jama_entries SET ... date = ?` with the `date` param | `normalizeDay(date)`. |
| (new, in `initDatabase` after `ensureIndexes`) | dates migration | W | does not exist yet | One `withTransactionAsync`: for each of the five columns `SELECT id, <col>`, skip values where `DAY_RE.test`, `normalizeDay` the rest, `UPDATE ... SET <col> = ? WHERE id = ?` (leave `updatedAt` untouched). If a value cannot be normalised, throw so the whole transaction rolls back and the next start retries; do not guess. NULL `closedDate` stays NULL. Mark done with `PRAGMA user_version = 1` (only after the transaction commits). |

Other functions that touch the fields only as pass-through and need no change: `updateRehanDetails` (`:629`, updatedAt only), `deleteRehanTransaction` (`:764`, updatedAt only), `updateLendenDetails` (`:868`, updatedAt only), `updateLendenBaki`.

## B. Database: other modules

| File:line | Symbol | Tag | What it does | Recommended change |
|---|---|---|---|---|
| `src/database/backupQueries.ts:60, 63, 66, 75` | `readSnapshot` | read | SELECTs `openDate, closedDate`, `date` verbatim for export | None. Export writes whatever is stored, which is plain days after migration. |
| `src/database/backupQueries.ts:157-165` | `insertRows` rehan | W | INSERT `x.openDate`, `x.closedDate` as given | None if the data is normalised upstream (finding 6). Cheap defence: `normalizeDay(x.openDate)`, `x.closedDate === null ? null : normalizeDay(x.closedDate)` here too, so no path can write a timestamp. |
| `src/database/backupQueries.ts:175-180` | `insertRows` rehan_transactions | W | INSERT `t.date` | Same. |
| `src/database/backupQueries.ts:188-191` | `insertRows` lenden | W | INSERT `l.date` | Same. |
| `src/database/backupQueries.ts:244-248` | `insertRows` jama_entries | W | INSERT `j.date` | Same. |
| `src/database/backupQueries.ts:308, 334` | `applyMerge` | updatedAt | `new Date().toISOString()` for `updatedAt` only | None. |
| `src/database/analyticsQueries.ts:30, 32, 34, 37` | `getAnalyticsData` | read | SELECTs `lenden.date`, `jama_entries.date`, `rehan.openDate/closedDate`, `rehan_transactions.date` into `AnalyticsData` | None. The analytics layer must accept plain days (Table E). |
| `src/database/lendenItems.ts:78, 136, 158`; `lendenOldJewelleryItems.ts:72` | various | updatedAt | `new Date().toISOString()` for `updatedAt` only | None. |
| `src/database/indexes.ts:17-25` | `INDEX_STATEMENTS` | schema | `(userId, openDate)`, `(userId, date)`, `(lendenId, date)`, `(rehanId, date)`, single-column `openDate` / `date` | None. These already cover the `, id DESC` tie-break (rowid is the last key of every index entry). |

## C. Screens

| File:line | Symbol | Tag | What it does | Recommended change |
|---|---|---|---|---|
| `src/screen/AddTransactionScreen.tsx:66` | `selectedDate` state | PICK | `useState(new Date())`, feeds `CustomDatePicker` (`:657`) | None. Picker state stays a `Date`. |
| `src/screen/AddTransactionScreen.tsx:224` | `handleSave` rehan | W | `openDate: selectedDate.toISOString()` | `toDay(selectedDate)`. |
| `src/screen/AddTransactionScreen.tsx:239` | `handleSave` lenden | W | `date: selectedDate.toISOString()` | `toDay(selectedDate)`. |
| `src/screen/AddTransactionScreen.tsx:255` | jama loop | W | `date: entry.date` (already a string from the modal callback) | None once :607 is fixed. |
| `src/screen/AddTransactionScreen.tsx:607` | `AddJamaModal` `onAdd` | W | `{ amount, date: date.toISOString() }` into local `jamaEntries` | `toDay(date)`. |
| `src/screen/NewCustomerScreen.tsx:62` | `selectedDate` state | PICK | as above, `CustomDatePicker` `:599-601` | None. |
| `src/screen/NewCustomerScreen.tsx:268` | save rehan | W | `openDate: selectedDate.toISOString()` | `toDay(selectedDate)`. |
| `src/screen/NewCustomerScreen.tsx:276` | save lenden | W | `date: selectedDate.toISOString()` | `toDay(selectedDate)`. |
| `src/screen/NewCustomerScreen.tsx:289` | jama loop | W | `date: entry.date` | None once :536 is fixed. |
| `src/screen/NewCustomerScreen.tsx:536` | `AddJamaModal` `onAdd` | W | `date.toISOString()` | `toDay(date)`. |
| `src/screen/TransactionDetailScreen.tsx:1128` | `AddRehanTransactionModal` `onAdd` | W | `createRehanTransaction({ date: date.toISOString() })` | `toDay(date)`. |
| `src/screen/TransactionDetailScreen.tsx:1168` | `AddJamaModal` `onAdd` edit | W | `editJamaEntry(entry.id, amount, date.toISOString())` | `toDay(date)`. |
| `src/screen/TransactionDetailScreen.tsx:1175` | `AddJamaModal` `onAdd` add | W | `createJamaEntry({ ..., date: date.toISOString() })` | `toDay(date)`. |
| `src/screen/TransactionDetailScreen.tsx:1159` | `AddJamaModal` `initialDate` | PICK | passes the stored `jamaEntries[i].date` string to the modal | None here; the modal parses it (Table F, `AddJamaModal.tsx:37`). |
| `src/screen/TransactionDetailScreen.tsx:389` | `formatDate` | P + FMT | `new Date(dateString).toLocaleDateString(...)`, used at `:1305` (open/entry date) and `:1322` (closed date) | `toLocalDate(dateString)`. |
| `src/screen/TransactionDetailScreen.tsx:812-820` | date badge | P + FMT | `new Date(rehan?.openDate \|\| lenden?.date \|\| "").toLocaleDateString(...)` | `toLocalDate(...)` (or reuse `formatDate`). |
| `src/screen/TransactionDetailScreen.tsx:1314` | closed-date row | read | truthiness test on `rehan.closedDate` | None. |
| `src/screen/UserTransactionsScreen.tsx:94` | `formatDate` | P + FMT | `new Date(dateString).toLocaleDateString(...)`, used at `:228`, `:255`, `:325` | `toLocalDate(dateString)`. |
| `src/screen/BillPreviewScreen.tsx:85, 95` | bill data | read | passes `lenden.date` and `jama[].date` strings into `BillData` | None; the formatting is in `formatBillDate` (Table G). |
| `src/screen/ExistingCustomersScreen.tsx:51-52` | filter state | PICK | `filterDateFrom/To: Date \| null` | None. State stays `Date`. |
| `src/screen/ExistingCustomersScreen.tsx:93, 96` | `loadUsers` | CMP (bug) | `filterDateFrom.toISOString().split("T")[0]` = the UTC day, one day early in IST | `toDay(filterDateFrom)`, `toDay(filterDateTo)`. This is the known off-by-one. |
| `src/screen/ExistingCustomersScreen.tsx:588, 601` | pickers | PICK | `value={filterDateFrom \|\| new Date()}` | None. |
| `src/screen/ExistingCustomersScreen.tsx:479, 506` | chip text | FMT | `formatDate(Date)` of the picked `Date` | None (not a stored value). |
| `src/screen/AnalyticsScreen.tsx:113-119` | `period` memo, `grain === "all"` | P | passes every `lenden.date`, `jama.date`, `rehan.openDate`, `rehan.closedDate`, `rehanTx.date` to `allPeriod(isos)` which parses with `toTime` | None here; fixed by the `toTime` change (Table E, `periods.ts:32`). |
| `src/screen/AnalyticsScreen.tsx:218` | billing tab filter | CMP | `inPeriod(b.date, period)` | None; `inPeriod` fixed centrally. |
| `src/screen/AnalyticsScreen.tsx:131, 139` | `canGoForward`, custom step | P | `Date.now()` vs `period.end`; builds `Date`s from fields | None (not stored values). |

## D. Backup

| File:line | Symbol | Tag | What it does | Recommended change |
|---|---|---|---|---|
| `src/backup/format.ts:60-61, 72, 79, 124` | row types | type | `openDate: string; closedDate: string \| null`; `date: string` | Comment only: plain `YYYY-MM-DD` after import. |
| `src/backup/validate.ts:39-40, 42, 52, 80` | `SPECS` | validate | `openDate: "str"`, `closedDate: "strN"`, `date: "str"` | Add kinds `day` and `dayN` to `Kind` / `checkKind`: accept a string where `isDay(v)` or `normalizeDay(v)` does not throw (both forms). Use them for the five fields. Message e.g. `date is not a valid date`. |
| `src/backup/validate.ts:175-244` | `validateBackup` | validate | parses, checksums, then `validateData`, returns `data` | After `validateData` passes, return `data` with the five fields run through `normalizeDay` (a pure `normalizeBackupDays(data)` next to `validateData`, so it is unit-testable). This must precede `planMerge` (finding 6). Checksums are verified on the raw text first, so they are unaffected. |
| `src/backup/legacy.ts:10` | `EPOCH` | W | `"1970-01-01T00:00:00.000Z"` fallback for missing dates | Keep for `createdAt`/`updatedAt`. Add `EPOCH_DAY = "1970-01-01"` for the five date fields. |
| `src/backup/legacy.ts:93-104` | `convertLegacy` rehan | W | `openDate = str(r.openDate) ?? EPOCH`; `closedDate: str(r.closedDate)`; `updatedAt: openDate` | `openDate: normalizeDay(raw)`, `closedDate: normalizeDay(raw)` when present; `updatedAt` keeps the raw string (finding 7). An un-normalisable value throws `BackupError("... date")` so the import is rejected, not silently dated 1970. |
| `src/backup/legacy.ts:111-126` | `convertLegacy` lenden | W | `date = str(l.date) ?? EPOCH`; `updatedAt: date` | Same. |
| `src/backup/plan.ts:93-94, 112, 127, 170` | `planMerge` | CMP | `eq(l.openDate, r.openDate)`, `eq(l.closedDate, r.closedDate)`, `eq(l.date, t.date)`, `eq(l.date, d.date)`, `eq(l.date, j.date)` decide same vs conflict | No code change, provided the backup side is normalised first (finding 6). Local side is plain days after migration. Add a plan test: a backup with ISO dates normalised vs a local row with the plain day is `same`. |
| `src/backup/serialize.ts:93-94, 111, 119, 182` | `buildBackup` | read | copies `openDate`, `closedDate`, `date` verbatim | None. |
| `src/services/BackupImportService.ts:173` | `stageV2` | flow | `validateBackup` then `planMerge(data, await readSnapshot())` | None, if `validateBackup` normalises (finding 6). |
| `src/services/BackupImportService.ts:210-227` | `stageLegacy` | flow | `convertLegacy` then `validateData` (not `validateBackup`) | None, if `convertLegacy` normalises; `validateData` then sees plain days. |
| `src/services/BackupImportService.ts:157` | `legacyDate` | timestamp | `new Date(ms).toISOString()` for the preview `createdAt` | None (a timestamp, not one of the five fields). |
| `src/services/BackupExportService.ts:48` | export manifest | timestamp | `createdAt: new Date().toISOString()` | None. |

## E. Analytics (`src/utils/analytics`)

| File:line | Symbol | Tag | What it does | Recommended change |
|---|---|---|---|---|
| `periods.ts:32-39` | `toTime` | P | `new Date(iso).getTime()`, cached. Feeds `allPeriod`, `inPeriod`, `bucketKey`, `dayNumber`, `daysBetween` | `DAY_RE.test(v) ? parseDay(v).getTime() : new Date(v).getTime()` (non-throwing for odd values; or `toLocalDate(v).getTime()`). One change fixes every period, bucket and age calculation. Export it so the files below can reuse it. |
| `periods.ts:134` | `allPeriod` | P | `isos.map(toTime)` | None (via `toTime`). Parameter name `isos` is now "days or ISO"; rename optional. |
| `periods.ts:217` | `inPeriod` | CMP | `toTime(iso)` against `period.start/end` | None (via `toTime`). Plan item "analytics test that a plain-date row lands in the right period" goes here. |
| `periods.ts:235` | `bucketKey` | P | `keyOf(new Date(toTime(iso)), unit)` | None (via `toTime`). |
| `periods.ts:286-289` | `dayNumber`, `daysBetween` | P | day index from the local fields of `new Date(toTime(iso))` | None (via `toTime`). |
| `baki.ts:18` | `baakiAt` `before` | P + CMP | `new Date(iso).getTime() < t` for `bill.date` (`:27`) and `j.date` (`:23`) | Use the exported `toTime`. Plain day = local midnight; `< t` then means "started before this instant", same as today for local-midnight data. |
| `baki.ts:46, 50` | `baakiAging` | CMP | `nowIso = now.toISOString()`; `daysBetween(bill.date, nowIso)` | `const today = toDay(now)`; `daysBetween(bill.date, today)`. |
| `customers.ts:56, 58` | `latest`, `earliest` | P + CMP | `new Date(a).getTime() >= new Date(b).getTime()` over activity dates | Use `toTime`. |
| `customers.ts:64` | `countNewCustomers` `note` | P | `new Date(iso).getTime()` for `lenden.date` (`:68`) and `rehan.openDate` (`:69`) | Use `toTime`. |
| `customers.ts:88-89, 101, 103` | `buildCustomersView` | read | records `lenden.date`, `rehan.openDate`; `inPeriod(entry.date)`; `dayNumber(entry.date)` | None (via `toTime`). |
| `customers.ts:131, 135` | `buildCustomersView` recency | CMP | `nowIso = now.toISOString()`; `daysBetween(latest(...), nowIso)` | `toDay(now)`. |
| `importance.ts:37, 40` | `buildImportanceView` | read | `inPeriod(bill.date)`, `dayNumber(bill.date)` | None (via `toTime`). |
| `sales.ts:40, 44, 51, 56, 85` | `payments`, `buildSalesView` | read | `jama.date`, `lenden.date` into `Point.date`, `inPeriod` | None (via `toTime`). |
| `categories.ts:41` | `totalsIn` | read | `dateOf` map of `bill.date`, `inPeriod` | None. |
| `metal.ts:52, 66` | `buildMetalView` | read | `dateOf` map of `entry.date`, `series` | None. |
| `villages.ts:57, 61` | `villageStats` | read | `inPeriod(bill.date, ...)` | None. |
| `rehan.ts:44-59` | `buildRehanView` | read | `Point.date` from `openDate`, `rehanTx.date`; `inPeriod(r.closedDate)`; `daysBetween(r.openDate, r.closedDate)` | None (via `toTime`). |
| `overview.ts:85`, `trends.ts:53` | `at = new Date(Math.min(period.end, now))` | CMP | instant passed to `baakiAt` | None. `now` is an instant, compared with local-midnight `toTime` values. |
| `report/billing.ts:63, 96` | `buildBillRows` | CMP | `nowIso = now.toISOString()`; `daysBetween(b.date, nowIso)` | `toDay(now)`. |
| `report/billing.ts:102` | `buildBillRows` sort | P + SORT | `new Date(b.date).getTime() - new Date(a.date).getTime() \|\| b.id - a.id` | Use `toTime` (tie-break by id already there). |
| `report/billing.ts:137` | `oldestFirst` | P + SORT | same pattern ascending | Use `toTime`. |
| `report/billing.ts:157-158` | `groupOf` | read | `from`/`to` = first/last `date` | None. |
| `report/pledges.ts:63, 81` | `buildPledgeRows` | CMP | `nowIso`; `daysBetween(r.openDate, nowIso)` | `toDay(now)`. |
| `report/pledges.ts:65-69, 83-85` | `buildPledgeRows` | P | `opened = new Date(r.openDate)`; `getFullYear()`, `getMonth()`, `getDay()` | `toLocalDate(r.openDate)`; this is the place a UTC-midnight parse changes a weekday/month west of UTC. |
| `report/pledges.ts:82` | `daysToRedeem` | P | `daysBetween(r.openDate, r.closedDate)` | None (via `toTime`). |
| `report/pledgeBook.ts:87, 127, 130` | `time`, `monthlyBook` | P + CMP | `new Date(iso).getTime()` against local month starts for `openDate` and `closedDate` | `time = toTime`. |
| `report/itemsView.ts:73, 79, 90` | `quarterOf`, `itemMixByQuarter` | P | `new Date(iso)`; `getFullYear()/getMonth()` for `r.openDate` (`:90`) and `now.toISOString()` (`:79`) | `toLocalDate(iso)`; pass `now` directly instead of `now.toISOString()`. |
| `report/quality.ts:208-212` | `dataQuality` | P + CMP | `new Date(r.closedDate).getTime() < new Date(r.openDate).getTime()` | Use `toTime`. Truthiness checks on `closedDate` unchanged. |
| `report/fixture.ts:6` | `iso()` | test data | `new Date(y, m-1, d, 12).toISOString()` noon timestamp for all fixtures | Test fixtures only. Keep as is to cover un-migrated values, and add a plain-day fixture variant for the plan's "plain-date row lands in the right period" test. |
| `types.ts:36-37, 17, 28, 45` | row types | type | `string` | Comment only. |

## F. Components

| File:line | Symbol | Tag | What it does | Recommended change |
|---|---|---|---|---|
| `src/components/AddJamaModal.tsx:25, 36-37` | `AddJamaModal` | PICK + P | edit mode: `setSelectedDate(new Date(initialDate))` with the stored `jama_entries.date`, feeds `CustomDatePicker` (`:129`) | `toLocalDate(initialDate)`. This is the one place a stored day becomes a picker value; UTC-midnight would preselect the wrong day west of UTC. |
| `src/components/AddJamaModal.tsx:58` | `handleAdd` | W (source) | `onAdd(amountNum, selectedDate)` hands a `Date` to the screen | None; screens convert with `toDay`. |
| `src/components/AddRehanTransactionModal.tsx:20, 46` | `AddRehanTransactionModal` | PICK + W (source) | `selectedDate` state; `onAdd(amount, type, selectedDate)` | None; screens convert with `toDay`. |
| `src/components/CustomDatePicker.tsx:53, 78, 179, 186` | `CustomDatePicker` | PICK | builds local-midnight `Date`s from year/month/day; "Today" gives `new Date()` (with a time) | None. `toDay` drops the time. |
| `src/components/BillTable.tsx:37-45, 99` | `formatDate` | P + FMT | `new Date(dateString).toLocaleDateString(...)` for each jama entry date | `toLocalDate(dateString)`. |
| `src/components/RehanTransactionTable.tsx:19-24, 46` | `formatDate` | P + FMT | `new Date(dateString).toLocaleDateString(...)` for each rehan transaction date | `toLocalDate(dateString)`. |
| `src/components/analytics/report/BillingSummaryTab.tsx:16-17, 79, 121` | `shortDate`, table | P + FMT + SORT | `new Date(iso)` for display; `sortValue: new Date(b.date).getTime()` | `toLocalDate(iso)` and `toTime` (or `toLocalDate(b.date).getTime()`). |
| `src/components/analytics/PeriodPicker.tsx:84-89` | custom range | PICK | `Date`s from the picker, not stored | None. |

## G. Utils and services that format a stored day

| File:line | Symbol | Tag | What it does | Recommended change |
|---|---|---|---|---|
| `src/utils/billFormat.ts:36-42` | `formatBillDate` | P + FMT | `new Date(iso)` then local `dd/mm/yyyy`; printed on the bill for `lenden.date` and each `jama.date` (`BillHtmlService.ts:172, 387`) | `toLocalDate(iso)`; keep returning `""` for an invalid date (existing test `billFormat.test.ts:54-55`). |
| `src/services/BillHtmlService.ts:63` | `BillData.date` comment | doc | `// ISO; the entry's own date, not today` | Update comment: plain day. |
| `src/types/entry.ts:26-27, 38, 49, 58, 64, 80, 165, 173` | entry types | type | `openDate`, `closedDate`, `date` as `string` | Update comments only (line 38 says "defaults to current date"; now "defaults to today as YYYY-MM-DD"). |

## H. Existing tests that will need new expectations

The change makes some tests' timestamp fixtures stop round-tripping as-is, because a stored or imported timestamp becomes a day. Build expected values with `toDay(new Date(...))` / local constructors so the tests stay correct in any timezone.

| File | Why |
|---|---|
| `src/backup/roundtrip.test.ts` (`T1`, `T2` at `:46-47`, used as `openDate`, `closedDate`, `date` in fixtures and in `createRehan({ openDate: T1 })`, `:445` raw `UPDATE ... closedDate`) | Exact-restore assertions compare stored values with the fixtures; use plain-day fixtures for the five fields. |
| `src/backup/legacy.test.ts:32-33, 88-89, 118-121, ...` | Expected `openDate: "2024-03-01T00:00:00.000Z"` becomes a day (`toDay(new Date("2024-03-01T00:00:00.000Z"))`); `updatedAt` stays the raw timestamp (finding 7). |
| `src/backup/plan.test.ts:36-37, 294-295`, `serialize.test.ts`, `validate.test.ts:37-38` | Fixtures with ISO dates; add cases for plain days and for both forms accepted. |
| `src/services/BillHtmlService.test.ts:20, 140, 158, 263`; `src/utils/billFormat.test.ts:49-55` | Still pass (timestamps are handled by the fallback); add a plain-day case. |
| `src/utils/analytics/*.test.ts` (`iso()` noon helpers) | Still pass unchanged (noon timestamps go through `new Date`). Add the plan's plain-day-in-the-right-period test. |

# Old Jewellery Adjustments — Change Report

**Date:** 2026-10-02
**Branch:** `feat/old-jewellery-adjustments`
**Status:** Implemented. Typecheck clean, 115/115 Jest tests pass. Not yet verified on a device.

| Commit | Summary |
|---|---|
| `e096374` | Baseline: old jewellery credit on Len-Den entries and bills (pre-existing work, committed as-is) |
| `4252292` | Metal and purity per old item, bill Metal/Purity column, register query and totals logic |
| `7ea4d21` | Metal picker in the form, metal badges in records, Old Jewellery register screen |

---

## 1. Goal

Old jewellery taken from a customer in exchange is credited against a Len-Den sale. Before this
branch it was stored as `description / weight / value` only. Analytics needs to answer
"how much old gold vs old silver did we receive", so each item now records its **metal**, and
there is one place to see every old item received across all bills.

## 2. Settlement formula (baseline, `e096374`)

`src/utils/lendenSettlement.ts` is the single formula every screen and the bill use:

```
netPayable = grossTotal − oldJewelleryCredit − discount
baki       = netPayable − jamaTotal
oldJewelleryCredit = Σ item.value      (sumOldJewelleryValues)
```

- `grossTotal` is the new-jewellery total (the entry's effective `amount`).
- The stored `lenden.remaining` column holds `netPayable`; `lenden.baki` holds `baki`.
- Validation is deliberately separate: callers reject `netPayable < 0` ("credit and discount
  cannot exceed the new jewellery total") and `baki < 0` ("jama cannot exceed net payable")
  with a message, instead of the formula silently clamping a customer's credit.

Items live in `lenden_old_jewellery_items` (`lendenId`, contiguous 1-based `position`).
`replaceLendenOldJewelleryItems` deletes and re-inserts an entry's items inside one
transaction, so positions never have gaps and a failed save leaves the old list intact.
`deleteLenden` removes them alongside jama entries and line items.

## 3. Metal and purity on old items (`4252292`)

### 3.1 Schema and migration — `src/database/entryDatabase.ts`

- `CREATE TABLE lenden_old_jewellery_items` now includes `metal TEXT` and `purity TEXT`
  for fresh installs.
- Existing installs: the migration block reads `PRAGMA table_info(lenden_old_jewellery_items)`
  and `ALTER TABLE … ADD COLUMN` for each missing column. Same pattern as the other
  migrations in the file. Each `ADD COLUMN` is a single statement, so no transaction is needed
  (unlike `amountOverridden`, whose ALTER and backfill must be atomic).

**Core decision — no backfill.** Existing rows keep `metal = NULL`. Unlike `lenden_items`
(where historical purity values reliably implied the metal), an old-jewellery description is
free text. Guessing "chain → gold" would put any silver item into gold totals with no way to
tell later. `NULL` stays visible as "Metal not set" and lands in a separate `unknown` bucket,
so it can never inflate gold or silver figures. Editing the entry and picking a metal fixes it.

### 3.2 Types — `src/types/entry.ts`

- `OldJewelleryItem.metal: JewelleryMetal | null`, `purity: Purity | null` (always present on
  stored rows, possibly null).
- `NewOldJewelleryItem.metal?` / `purity?` (optional so in-progress form state type-checks).
- Purity reuses the existing `Purity` union and `PURITY_OPTIONS_BY_METAL`
  (gold: 24KT/22KT/18KT, silver: Desi/Fancy), so new and old items share one vocabulary.

### 3.3 Data access — `src/database/lendenOldJewelleryItems.ts`

- `toMetal()` maps the raw column to `"gold" | "silver" | null`. Any other string is treated as
  untracked rather than trusted, so a bad value can't reach the totals.
- `replaceLendenOldJewelleryItems` writes `metal` and `purity` (`?? null`).
- **New `getOldJewelleryRegister()`** — one query:
  ```sql
  SELECT o.*, l.date, l.billNo, l.userId, u.name AS userName
  FROM lenden_old_jewellery_items o
  JOIN lenden l ON o.lendenId = l.id
  JOIN users  u ON l.userId  = u.id
  ORDER BY l.date DESC, o.lendenId DESC, o.position ASC
  ```
  The date is the **Len-Den entry's date** (when the exchange happened); old items have no
  date of their own. Inner joins drop orphaned items whose entry or customer was deleted.

### 3.4 Shared label — `src/utils/billFormat.ts`

`formatMetalPurity(metal, purity)` → `"Gold / 22KT"`, `"Silver"`, `"22KT"` or `""`. Missing parts
are omitted, never printed as `null`/`undefined`. The new-item bill table previously built this
string inline; both bill tables, the records table and the register now share it.

### 3.5 Register logic — `src/utils/oldJewelleryRegister.ts` (pure, unit-tested)

- `summarizeRegister(rows)` → `{ gold, silver, unknown, total }`, each `{ count, weight, value }`.
  - Bucket is `item.metal ?? "unknown"`.
  - Items without a weight are **counted** and their **value** included, but add 0 g.
  - Weights are rounded to 3 decimals (milligram) after every addition, so `0.1 + 0.2` reads
    `0.3 g`, not `0.30000000000000004 g`.
- `filterRegister(rows, { metal, period }, now)`:
  - `metal: "all" | "gold" | "silver"`. Gold/silver filters **exclude** unknown items.
  - `period: "month" | "year" | "all"` — month = calendar month; year = Indian financial year (Apr–Mar), matching Analytics.
  - `now` is injectable so tests are deterministic.

### 3.6 Bill — `src/services/BillHtmlService.ts`

- The "Old Jewellery Exchange" table gains a **Metal/Purity** column (5 columns; title `colspan`
  and the credit footer `colspan` were updated to match). Untracked items print a blank cell.
- **Restored "Rupees in words :"** — it had fallen out of the markup during the last layout
  pass, while its CSS (`.words-line`), the computed `payable`, the `toHindiRupeesWords` import and
  two tests remained. The final template artwork (`Final_templat.jpeg`) has this line directly
  above the footer crop, so its absence was a regression. It prints `payable` in Hindi words:
  - payment details **on** → the entry's `baki`
  - payment details **off** → `netPayable` (gross − old credit − discount)

## 4. Entry form and records (`7ea4d21`)

### 4.1 `AddOldJewelleryItemModal`

- Metal chips (Gold / Silver), **required**, with **no default selected**. A preselected
  "Gold" would let a hurried user save silver as gold, silently corrupting the metal totals.
  The Save button stays disabled until a metal is picked.
- Purity chips appear after a metal is chosen. Optional; tapping the selected chip clears it.
  Switching metal clears purity (purities are metal-specific).
- Editing a legacy item opens with no metal selected, so saving it forces the metal to be set.
- If a stored purity isn't valid for the stored metal, it's dropped rather than shown wrong.

### 4.2 `OldJewelleryItemsTable`

Each row shows a metal/purity badge (gold-tinted / silver-tinted) or a red-outlined
"Metal not set" badge for legacy items.

### 4.3 `TransactionDetailScreen` — data-loss fix

Loading an entry rebuilt the items as `{ description, weight, value }`, dropping metal and
purity. Every save then re-wrote the items through `replaceLendenOldJewelleryItems`, which
would have **erased the metal on every edit** of any field on the entry. The mapping now
carries `metal` and `purity`. (`AddTransactionScreen` passes the modal's objects straight through,
so it needed no change.)

### 4.4 Old Jewellery register — `src/screen/OldJewelleryRegisterScreen.tsx`

- Reached from a new **Old Jewellery** card on Home (`navigation.navigate("OldJewelleryRegister")`,
  registered in `App.tsx`, typed in `RootStackParamList`).
- Data loads in `useFocusEffect`, so returning from an edited entry shows fresh data. An `active`
  flag drops a result that arrives after the screen has lost focus.
- **Filter semantics:**
  - Period chips (This Month / This Year / All Time, default This Year) filter **both** the
    totals and the list.
  - Metal chips (All / Gold / Silver) filter **only the list**. The Gold and Silver totals cards
    stay side by side for comparison while the list narrows.
- If any untracked items fall in the period, a note shows their count and value and says to edit
  the entry. They are never folded into either metal's card.
- Each row: description, customer · bill no., metal badge, weight, value, date. Tapping opens the
  entry's detail screen.

## 5. Tests

| File | Covers |
|---|---|
| `src/utils/oldJewelleryRegister.test.ts` (new, 8) | per-metal buckets, unknown bucket, null weight, float rounding, empty input, metal and period filters |
| `src/utils/billFormat.test.ts` (+3) | `formatMetalPurity` all combinations |
| `src/services/BillHtmlService.test.ts` (+1, 2 fixed) | old-jewellery Metal/Purity column with legacy item (no `null`/`undefined` leaks); words line now present |

Screens aren't unit-tested. Jest only runs `src/**/*.test.ts` in a node environment, so all
logic that matters was kept in pure `.ts` modules.

## 6. Manual verification still needed (device)

1. Launch on an install with existing data → the migration adds the columns; old items show
   "Metal not set".
2. Add an old item: Save is disabled until a metal is chosen; purity chips follow the metal.
3. Edit an existing entry, change only the discount, save, reopen → metal is still there (§4.3).
4. Generate a bill with old jewellery → Metal/Purity column and "Rupees in words" line render
   without pushing the footer onto a second page.
5. Home → Old Jewellery → totals match the items; period and metal chips behave as in §4.4.

## 7. Known limitations

- Register "This Year" now uses the Indian financial year (Apr–Mar), matching Analytics (done).
- Legacy items stay "unknown" until edited one by one; there's no bulk "set metal" action.

## 8. Follow-up — old jewellery lives only inside Len-Den

At the owner's request, old jewellery is no longer a separate place in the app; it is part of a single Len-Den bill
(new jewellery − old jewellery value − discount = net payable, then jama and baki).

- **Removed:** the Old Jewellery register (Home card, `OldJewelleryRegisterScreen`, `getOldJewelleryRegister`,
  `src/utils/oldJewelleryRegister.ts` and its tests, the `OldJewelleryRegister` route). §3.3's register query,
  §3.5 and §4.4 above describe that removed code. Old gold/silver received is still reported in Analytics → Metal.
- **Add entry (`AddTransactionScreen`):** the on/off switch is gone. An "Old Jewellery Returned" section is always
  shown under Jewellery Items; with no items it costs nothing. The "turn on but add nothing" validation went with it.
- **Entry detail (`TransactionDetailScreen`):** the same section shows on every Len-Den entry, not only in edit mode
  or when items exist.
- **`OldJewelleryItemsTable`:** new optional `newJewelleryTotal` prop renders a live
  `New ₹X − Old ₹Y = ₹Z` line, so the exchange adjustment is visible before the discount/jama summary.
- **Printed bill (owner change 77b0ea8):** the itemised Old Jewellery Exchange table is no longer printed; §3.6's table description is historical. The credit appears in the Hindi payment summary.

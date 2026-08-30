# Len-Den Itemised Billing — Design Spec

**Date:** 2026-08-31
**Status:** Approved for planning
**Scope:** Add jewellery line items to Len-Den entries, and generate a printable A5 bill on the Asha Jewellers template.

---

## 1. Problem

A Len-Den entry today holds a single manual `amount`, then `discount → remaining → jama → baki`, plus photos of a paper bill in `media`. There is no record of *what was sold* — no item name, purity, weight or rate — and no way to produce a bill from the app. Bills are written by hand on pre-printed Asha Jewellers stationery and photographed.

This spec covers storing the line items and generating the bill.

## 2. Source material

Two reference images drove the design:

| File | Role |
|---|---|
| `img/2026-08-31/1788119935472-IMG-20260829-WA0012.jpg` | The blank **Asha Jewellers** stationery — gold swoosh border, AJ logo, model photo, address strip, empty invoice box, printed table, "Rupees in words", signature line. **1024 × 1536 px, ratio 1:1.500.** |
| Sample bill (Raja Soni Jewellers, supplied in chat) | The **data layout** wanted: बिल नं., नाम / पता / दिनांक, a 6-column item table, a totals box, and amount-in-words. |

The two conflict in one place: the Asha template's *printed* table is `Sl.No | Description | Qty. | Amount` (4 columns), but the required table is `क्रं. | विवरण | शुद्धता | वजन | दर प्रति ग्राम | कुल राशि` (6 columns). Section 5 resolves this.

## 3. Decisions

Settled during brainstorming; these are fixed inputs to the plan, not open questions.

| # | Decision | Choice |
|---|---|---|
| D1 | Relationship between items and `amount` | **Auto, but overridable.** `amount` auto-fills from the item sum; user can override per entry, marked with `*`. |
| D2 | Bill language | **Hindi labels**, matching the sample. Item names print as typed. |
| D3 | Output channels | **In-app preview**, then **Share as PDF** and **Direct print dialog**. No JPG export. |
| D4 | Item entry | **Purity dropdown** (24KT / 22KT / 18KT / Silver); **rate always manual** — no bhav API call at billing time. |
| D5 | Template handling | **Clip header + footer bands from the template JPG, rebuild the middle in HTML.** |
| D6 | Payment details on bill | **Per-bill toggle** on the preview screen — plain sale copy, or full ledger with छूट / जमा / बाकी. |

## 4. Data model

### 4.1 New table

Mirrors the existing `jama_entries` child-table pattern.

```sql
CREATE TABLE IF NOT EXISTS lenden_items (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  lendenId INTEGER NOT NULL,
  position INTEGER NOT NULL,   -- क्रं. display order, 1-based
  name     TEXT    NOT NULL,   -- विवरण, as typed (Hindi or Latin)
  purity   TEXT,               -- शुद्धता: '24KT' | '22KT' | '18KT' | 'Silver'
  weight   REAL,               -- वजन, grams, 3 decimal places (3.500)
  rate     INTEGER,            -- दर प्रति ग्राम, whole rupees
  total    INTEGER NOT NULL,   -- कुल राशि, whole rupees
  FOREIGN KEY (lendenId) REFERENCES lenden(id) ON DELETE CASCADE
);
```

`weight` is `REAL` because grams carry three decimals. Everything monetary stays `INTEGER` whole rupees, consistent with the existing `amount` / `discount` / `remaining` / `jama` / `baki` columns.

`total` defaults to `Math.round(weight × rate)` but is stored, not derived, so the user can round a line off (e.g. 50,750 → 50,700) and have it persist. `AddLendenItemModal` therefore exposes `total` as an editable field pre-filled from `weight × rate`, recomputed whenever weight or rate changes until the user edits it directly.

`position` is 1-based and **renumbered to stay contiguous** whenever an item is deleted or reordered, so the printed क्रं. column never shows a gap.

### 4.2 New columns on `lenden`

Added through the existing `PRAGMA table_info` migration block in `initDatabase`.

| Column | Type | Meaning |
|---|---|---|
| `billNo` | `INTEGER` | Bill number. `NULL` until a bill is first generated. |
| `amountOverridden` | `INTEGER DEFAULT 0` | `1` when the user has typed an amount that differs from the item sum. |

### 4.3 Amount resolution rule

```
effectiveAmount(lenden, items) =
  items.length === 0            -> lenden.amount        (legacy / no items yet)
  lenden.amountOverridden === 1 -> lenden.amount        (user typed it)
  otherwise                     -> sum(items[].total)   (auto)
```

**Migration safety — this is the one that can destroy data.** Every Len-Den row that exists today has zero items. A naive "amount = sum of items" would rewrite every historical amount to `0`. The migration therefore sets `amountOverridden = 1` on all pre-existing rows:

```sql
UPDATE lenden SET amountOverridden = 1 WHERE amountOverridden IS NULL OR amountOverridden = 0;
```

run **once, immediately after the column is added** and never again. The `items.length === 0` guard in the resolution rule is a second, independent layer of protection.

### 4.4 Bill number assignment

Assigned lazily, when `BillPreviewScreen` first opens for an entry whose `billNo` is `NULL`:

```
nextBillNo = (SELECT IFNULL(MAX(billNo), 0) FROM lenden) + 1
```

Persisted immediately, so reprinting an entry always shows the same number. Editable from the preview screen — typing `9268` once makes the series continue from there. No separate settings table.

### 4.5 Types

Added to `src/types/entry.ts`:

```ts
export type Purity = "24KT" | "22KT" | "18KT" | "Silver";

export interface LendenItem {
  id: number;
  lendenId: number;
  position: number;
  name: string;
  purity: Purity | null;
  weight: number | null;
  rate: number | null;
  total: number;
}

export interface NewLendenItem {
  lendenId: number;
  position: number;
  name: string;
  purity?: Purity;
  weight?: number;
  rate?: number;
  total: number;
}
```

`Lenden` and `NewLenden` gain optional `billNo` and `amountOverridden`. `RootStackParamList` gains `BillPreview: { lendenId: number }`.

## 5. Bill rendering

### 5.1 One HTML string, three consumers

`BillHtmlService.buildBillHtml(data: BillData): string` is a **pure function** — no I/O, no React, no native calls. The preview WebView, the shared PDF and the print dialog all render that identical string. The preview therefore cannot drift from what prints, and the function is unit-testable without a device.

```ts
export interface BillData {
  billNo: number;
  date: string;                    // ISO
  customer: { name: string; address: string | null; mobile: string | null };
  items: LendenItem[];
  amount: number;                  // effective amount, per §4.3
  discount: number;
  jamaEntries: { amount: number; date: string }[];
  baki: number;
  showPaymentDetails: boolean;     // D6 toggle
  templateDataUri: string;         // "data:image/jpeg;base64,..."
}
```

### 5.2 Template banding

The template is **taller** than A5 (1:1.500 vs 1:1.419), which is what makes clipping work — the two bands render at their natural aspect ratio across the full page width, and the rebuilt middle absorbs the difference.

```
page 148mm wide  →  template renders 222mm tall at full width
┌─────────────────────────────┐  ─┐
│ header band     0 → 78.8mm  │   │  background-position: 0 0
│ swoosh, AJ logo, model      │   │
│ photo, address strip        │   │
├─────────────────────────────┤   │
│                             │   │
│ middle  ~108.7mm            │   │  rebuilt in HTML
│ customer box                │   │  cream #FDFBF7 background
│ 6-column item table         │   │  + gold side rules to continue
│ totals box                  │   │    the template's frame
│ राशि शब्दों में                  │   │
│                             │   │
├─────────────────────────────┤   │
│ footer band       22.5mm    │   │  background-position: 0 -199.5mm
│ ornament, T&C, Signature    │   │
└─────────────────────────────┘  ─┘
                                    total 210mm = A5
```

No image editing is required. The JPG is embedded **once** as a base64 data URI in a `:root` custom property, and both bands reference it with different `background-position`:

```css
:root { --tpl: url("data:image/jpeg;base64,..."); }
@page { size: A5; margin: 0; }

.band {
  width: 100%;
  background-image: var(--tpl);
  background-size: 148mm 222mm;
  background-repeat: no-repeat;
}
.band-header { height: 78.8mm;  background-position: 0 0; }
.band-footer { height: 22.5mm;  background-position: 0 -199.5mm; }
```

The literal `mm` values above are shown for readability only. In the implementation they are **computed** from the two constants in §5.3 and interpolated into the HTML — nothing is hard-coded.

### 5.3 Calibration constants

The band heights above are **derived, not hard-coded**. Only two fractions are tunable:

```ts
const TEMPLATE_W = 1024;
const TEMPLATE_H = 1536;
const HEADER_CROP_PCT = 0.3548;  // fraction of template height used as header
const FOOTER_CROP_PCT = 0.1016;  // fraction used as footer

const PAGE_W_MM = 148, PAGE_H_MM = 210;
const tplH   = PAGE_W_MM * (TEMPLATE_H / TEMPLATE_W);   // 222mm
const headerH = tplH * HEADER_CROP_PCT;                  // 78.77mm
const footerH = tplH * FOOTER_CROP_PCT;                  // 22.55mm
const footerOffset = -(tplH - footerH);                  // -199.45mm
const middleH = PAGE_H_MM - headerH - footerH;           // 108.68mm
```

**The two percentages are eyeballed from the reference image and WILL need adjusting on the first real render.** Calibration is an explicit, named step in the implementation plan: render once, inspect the seams, adjust two numbers. Everything else follows.

### 5.4 Middle section layout

```
┌──────────────────────────────────────────────────────┐
│ नाम    : सरिता शर्मा           बिल नं.  : 9267          │
│ पता    : रामदशपुर, जौनपुर       दिनांक  : 27/08/2026     │
│ मोबाइल : 9415501122                                   │
├────┬─────────────┬────────┬────────┬────────┬────────┤
│क्रं. │ विवरण        │ शुद्धता  │  वजन   │   दर   │कुल राशि │
├────┼─────────────┼────────┼────────┼────────┼────────┤
│ 1  │ मांगटीका      │  22KT  │3.500 ग्राम│ 14,500 │ 50,750 │
│    │             │        │(3 ग्राम   │        │        │
│    │             │        │ 500 मिली) │        │        │
├────┴─────────────┴────────┴────────┴────────┴────────┤
│                      ┌────────────────┬─────────────┐│
│                      │ कुल वजन          │ 3.500 ग्राम  ││
│                      │ दर प्रति ग्राम     │  14,500/-   ││
│                      │ कुल राशि          │  50,750/-   ││
│                      ├────────────────┼─────────────┤│
│                      │ कुल देय राशि      │  50,750/-   ││
│                      └────────────────┴─────────────┘│
│ राशि शब्दों में : पचास हजार सात सौ पचास रुपये मात्र ।         │
└──────────────────────────────────────────────────────┘
```

The मोबाइल row renders only when the customer has a mobile number; `पता` likewise. `दिनांक` is `lenden.date`, not today's date, so a back-dated entry prints its own date.

**Totals box, `showPaymentDetails = false`** (plain sale copy): कुल वजन, दर प्रति ग्राम, कुल राशि, कुल देय राशि. **This is the default** — the toggle starts off on every bill, regardless of whether baki is outstanding.

**Totals box, `showPaymentDetails = true`** (ledger copy): कुल वजन, कुल राशि, छूट, one जमा row per payment with its date, बाकी as the emphasised final row.

`दर प्रति ग्राम` appears in the summary **only when every item shares the same rate**. With mixed rates the row is omitted — a single summary rate would be misleading.

**Vertical budget.** The middle band is ~108.7mm, spent roughly as:

| Element | Height |
|---|---|
| Customer box (3 rows) | ~18mm |
| Table header row | ~7mm |
| Totals box | ~30mm |
| राशि शब्दों में line | ~7mm |
| Padding and gaps | ~6mm |
| **Left for item rows** | **~41mm** |

At ~8mm per row (two-line weight cell), that is **5 items**. Five is therefore the design target; the UI warns above five, and the HTML degrades by dropping the `(3 ग्राम 500 मिली)` sub-line to fit ~7. Beyond that the bill overflows and the user must split it.

The faint necklace watermark in the template sits *inside* the printed table area and cannot be clipped out without dragging printed table borders along with it. It is **omitted**. If wanted later, it must be supplied as a separately cropped transparent asset.

### 5.5 Hindi text

Fixed labels are hard-coded Hindi strings. Amount-in-words needs a real converter.

`src/utils/hindiNumberWords.ts` — pure, no dependencies:

```ts
export function toHindiWords(n: number): string;        // 50750 → "पचास हजार सात सौ पचास"
export function toHindiRupeesWords(n: number): string;  // 50750 → "पचास हजार सात सौ पचास रुपये मात्र"
```

Implementation is an **exhaustive 0–99 lookup table** — Hindi 1–99 are all irregular (इक्यावन, बावन, तिरपन, उनहत्तर…), so they cannot be composed from tens and units — combined with Indian grouping: करोड़ (10⁷) → लाख (10⁵) → हजार (10³) → सौ (10²) → 0–99 remainder.

Required test vectors:

| Input | Expected |
|---|---|
| 0 | शून्य |
| 11 | ग्यारह |
| 19 | उन्नीस |
| 21 | इक्कीस |
| 45 | पैंतालीस |
| 51 | इक्यावन |
| 69 | उनहत्तर |
| 99 | निन्यानवे |
| 100 | एक सौ |
| 750 | सात सौ पचास |
| 1000 | एक हजार |
| **50750** | **पचास हजार सात सौ पचास** ← matches the supplied sample bill |
| 100000 | एक लाख |
| 169650 | एक लाख उनहत्तर हजार छह सौ पचास |
| 10000000 | एक करोड़ |

`src/utils/billFormat.ts` — also pure:

- `formatWeight(3.5)` → `"3.500 ग्राम"` plus sub-line `"(3 ग्राम 500 मिली)"`, matching the sample
- `formatRupees(50750)` → `"50,750/-"` (Indian digit grouping)
- `formatBillDate(iso)` → `"27/08/2026"`

### 5.6 Fonts

**No Devanagari webfont is bundled initially.** Android and iOS both ship a Devanagari face, and the print pipeline embeds a subset into the generated PDF.

This is a deliberate bet, not an assumption to leave untested. The plan carries an explicit verification step: **generate a PDF, transfer it to a desktop, and confirm Devanagari renders as text rather than boxes.** If it fails, the fallback is a base64 `woff2` subset of Noto Sans Devanagari inlined into the HTML (roughly +80 KB), which is a self-contained change to `BillHtmlService`.

## 6. Files

```
NEW  src/database/lendenItems.ts          item CRUD
NEW  src/utils/hindiNumberWords.ts        pure, tested
NEW  src/utils/billFormat.ts              pure, tested
NEW  src/services/BillHtmlService.ts      pure HTML builder, tested
NEW  src/services/BillService.ts          expo-print wrappers: sharePdf() / print()
NEW  src/components/AddLendenItemModal.tsx    mirrors AddJamaModal
NEW  src/components/LendenItemsTable.tsx      editable item list
NEW  src/screen/BillPreviewScreen.tsx         WebView + toggle + share/print
NEW  assets/bill-template.jpg             moved from img/2026-08-31/

EDIT src/types/entry.ts                   LendenItem, NewLendenItem, Purity,
                                          Lenden.billNo/amountOverridden, BillPreview route
EDIT src/database/entryDatabase.ts        lenden_items DDL + column migration
EDIT src/screen/AddTransactionScreen.tsx  items section, amount auto/override
EDIT src/screen/TransactionDetailScreen.tsx  items section, "बिल बनाएं" button
EDIT App.tsx                              BillPreview route
```

Item CRUD goes in its own module rather than into `entryDatabase.ts`, which is already 1226 lines. Only the DDL and the column migration are added there, since `initDatabase` owns schema setup.

### 6.1 Screen behaviour

**`AddTransactionScreen`** — items are held in local React state before the `lenden` row exists, then written after `createLenden` returns an id. This mirrors exactly how `jamaEntries` is already handled in the same screen. The items section renders only when `entryType === "lenden"`.

**Amount field** — shows the item sum as a read-only line, with the editable Amount beneath it. Typing a value that differs from the sum sets `amountOverridden = 1` and shows a `*` marker; clearing the field reverts to auto.

**`TransactionDetailScreen`** — items section in both view and edit mode, plus a **बिल बनाएं** button that navigates to `BillPreview`. The button is disabled when the entry has no items.

**`BillPreviewScreen`** — loads the entry, its items, its jama entries and the customer; assigns `billNo` if `NULL`; reads the template asset to base64; builds the HTML; renders it in a `WebView`. Carries the `showPaymentDetails` toggle, an editable bill-number control, and **शेयर करें** / **प्रिंट करें** actions.

### 6.2 Bill generation service

```ts
// src/services/BillService.ts
export async function sharePdf(html: string, billNo: number): Promise<void>;
export async function printBill(html: string): Promise<void>;
export async function loadTemplateDataUri(): Promise<string>;
```

`sharePdf` calls `Print.printToFileAsync({ html, width: 420, height: 595 })` (A5 in PostScript points), renames the output to `bill_<billNo>.pdf`, and hands it to `Sharing.shareAsync` — `expo-sharing` is already a dependency. `printBill` calls `Print.printAsync({ html })`.

`loadTemplateDataUri` resolves the bundled asset via `expo-asset` and reads it with `readAsStringAsync(..., { encoding: 'base64' })`. The result is cached in a module-level variable — it is a ~151 KB string and does not change.

## 7. Dependencies

| Package | Purpose |
|---|---|
| `expo-print` | HTML → A5 PDF, and the native print dialog |
| `react-native-webview` | In-app bill preview |

Both are Expo-supported. `expo-sharing`, `expo-file-system` and `expo-asset` are already present.

> **This feature cannot ship as an OTA update.** `App.tsx` uses `expo-updates` to push JS-only updates, but native modules require a **new EAS build installed on the device**. Plan the rollout accordingly.

## 8. Testing

The project has no test runner. `jest` + `ts-jest` are added, scoped to the pure modules only:

- `src/utils/hindiNumberWords.test.ts` — the table in §5.5, exhaustively
- `src/utils/billFormat.test.ts` — weight, currency grouping, date
- `src/services/BillHtmlService.test.ts` — given a `BillData`, assert the HTML contains the expected values; assert the payment rows appear only when `showPaymentDetails` is true; assert `दर प्रति ग्राम` is omitted for mixed-rate bills

Existing code is **not** retrofitted with tests. Screens, PDF generation and printing are verified manually on device.

### 8.1 Manual verification checklist

1. Fresh install — database initialises without error (see §9).
2. Upgrade over an existing install — **historical Len-Den amounts are unchanged** (§4.3).
3. Add a Len-Den entry with 1 item; amount auto-fills.
4. Add a second item at a different rate; amount updates; summary omits `दर प्रति ग्राम`.
5. Override the amount; `*` appears; reopen the entry and confirm it persisted.
6. Generate a bill; check the header and footer seams against the template (§5.3 calibration).
7. Toggle payment details; confirm छूट / जमा / बाकी appear and disappear.
8. Share the PDF to WhatsApp; **open it on a desktop and confirm Devanagari renders** (§5.6).
9. Print; confirm A5 paper size and that nothing is clipped at the margins.
10. Reprint the same entry; confirm the bill number is unchanged.

## 9. Adjacent defect

`src/database/entryDatabase.ts`, the `users` `CREATE TABLE` lists `address TEXT` twice:

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  address TEXT,        -- duplicate
  mobileNumber TEXT,
  ...
);
```

Existing installs are unaffected — `IF NOT EXISTS` short-circuits. A **fresh install may throw**, since SQLite rejects duplicate column names when it parses the statement. This was not reproducible in the dev environment (no `sqlite3` CLI available), so it is flagged rather than asserted, and manual check #1 above exercises it.

The stray line is removed as part of this work, since §4.2 modifies the same function. Approved as in scope.

## 10. Out of scope

- Rehan entries — unchanged.
- The bhav API — not called during billing (D4).
- GST, HSN codes, making charges, wastage percentages.
- Multi-page bills. One A5 page, designed for 5 items and degrading to ~7 (§5.4).
- Editing the template artwork, or making shop details configurable — they are baked into the template image.
- JPG/image export (D3).
- Retrofitting tests onto existing screens or database code.

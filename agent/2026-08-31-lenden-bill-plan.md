# Len-Den Itemised Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user attach jewellery line items (name, purity, weight, rate, total) to a Len-Den entry and generate a printable A5 bill on the Asha Jewellers template.

**Architecture:** Three pure, unit-tested utility modules (Hindi number words, formatting, amount resolution) feed a pure `buildBillHtml()` function that produces one A5 HTML string. That single string is rendered by the preview WebView, the shared PDF and the print dialog, so the preview cannot drift from what prints. Line items live in a `lenden_items` child table mirroring the existing `jama_entries` pattern. The Asha template JPG is embedded once as a base64 data URI and clipped into a header band and a footer band with `background-position`; the middle is rebuilt in HTML to hold the six Hindi columns the printed 4-column table cannot.

**Tech Stack:** React Native 0.81 / Expo SDK 54, TypeScript (strict), expo-sqlite, expo-print, react-native-webview, expo-asset, expo-sharing, jest + ts-jest.

**Spec:** `agent/2026-08-31-lenden-bill-design.md`

## Global Constraints

- **Monetary values are `INTEGER` whole rupees** everywhere, matching the existing `amount` / `discount` / `remaining` / `jama` / `baki` columns. Only `weight` is `REAL`.
- **Bill labels are Hindi**; item names print exactly as the user typed them.
- **Rate is always entered manually.** Do not call `BhavService` from any billing code path.
- **Purity is one of exactly** `"24KT" | "22KT" | "18KT" | "Silver"`.
- **A5 page = 148mm × 210mm = 420pt × 595pt.** Template JPG is 1024 × 1536 px.
- **`buildBillHtml` must stay pure** — no React, no native module imports, no I/O. It is unit-tested in a node environment.
- **Tests cover pure modules only** (`src/**/*.test.ts`). Screens, PDF generation and printing are verified manually on device. Do not retrofit tests onto existing screens or database code.
- **This feature cannot ship over-the-air.** `expo-print`, `react-native-webview` and `expo-asset` are native modules and need a new EAS build installed on the device.
- TypeScript is `strict: true`. Follow the existing code style: `React.FC<Props>`, `StyleSheet.create` at the bottom of the file, `Ionicons` for icons, `#007AFF` as the primary accent.
- Branch is `feat/lenden-itemised-billing`. Commit after every task.

---

### Task 1: Hindi number-to-words utility

Sets up the test runner (no other task needs it first) and builds the converter that produces the `राशि शब्दों में` line.

**Files:**
- Create: `src/utils/hindiNumberWords.ts`
- Create: `src/utils/hindiNumberWords.test.ts`
- Create: `jest.config.js`
- Modify: `package.json` (devDependencies + `test` script)

**Interfaces:**
- Consumes: nothing.
- Produces: `toHindiWords(n: number): string`, `toHindiRupeesWords(n: number): string`

- [ ] **Step 1: Install the test runner**

```bash
npm install --save-dev jest@^29.7.0 ts-jest@^29.2.5 @types/jest@^29.5.14
```

- [ ] **Step 2: Create `jest.config.js`**

Do **not** use the `ts-jest` preset — it would inherit `expo/tsconfig.base`, whose `module: "esnext"` breaks ts-jest. Give ts-jest an explicit inline tsconfig instead.

```js
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          target: "es2020",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
      },
    ],
  },
};
```

- [ ] **Step 3: Add the test script to `package.json`**

In the `"scripts"` block, add:

```json
    "test": "jest"
```

- [ ] **Step 4: Write the failing test**

Create `src/utils/hindiNumberWords.test.ts`:

```ts
import { toHindiWords, toHindiRupeesWords } from "./hindiNumberWords";

describe("toHindiWords", () => {
  it.each([
    [0, "शून्य"],
    [1, "एक"],
    [11, "ग्यारह"],
    [19, "उन्नीस"],
    [21, "इक्कीस"],
    [45, "पैंतालीस"],
    [50, "पचास"],
    [51, "इक्यावन"],
    [69, "उनहत्तर"],
    [99, "निन्यानवे"],
    [100, "एक सौ"],
    [750, "सात सौ पचास"],
    [1000, "एक हजार"],
    [50750, "पचास हजार सात सौ पचास"],
    [100000, "एक लाख"],
    [169650, "एक लाख उनहत्तर हजार छह सौ पचास"],
    [10000000, "एक करोड़"],
  ])("converts %i", (input, expected) => {
    expect(toHindiWords(input)).toBe(expected);
  });

  it("has an entry for every value 0-99", () => {
    for (let i = 0; i <= 99; i++) {
      expect(toHindiWords(i)).not.toBe("");
    }
  });

  it("rounds and takes the absolute value of odd inputs", () => {
    expect(toHindiWords(50750.4)).toBe("पचास हजार सात सौ पचास");
    expect(toHindiWords(-50)).toBe("पचास");
  });
});

describe("toHindiRupeesWords", () => {
  it("matches the wording on the reference bill", () => {
    expect(toHindiRupeesWords(50750)).toBe(
      "पचास हजार सात सौ पचास रुपये मात्र",
    );
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx jest src/utils/hindiNumberWords.test.ts`
Expected: FAIL — `Cannot find module './hindiNumberWords'`

- [ ] **Step 6: Write the implementation**

Create `src/utils/hindiNumberWords.ts`. Hindi 1–99 are all irregular and cannot be composed from tens and units, so the table must be exhaustive.

```ts
// Number -> Hindi words, for the "राशि शब्दों में" line on the bill.
// Hindi 1-99 are irregular, so the table below is exhaustive by design.

const ONES_TO_99 = [
  "शून्य", "एक", "दो", "तीन", "चार", "पांच", "छह", "सात", "आठ", "नौ",
  "दस", "ग्यारह", "बारह", "तेरह", "चौदह", "पंद्रह", "सोलह", "सत्रह", "अठारह", "उन्नीस",
  "बीस", "इक्कीस", "बाईस", "तेईस", "चौबीस", "पच्चीस", "छब्बीस", "सत्ताईस", "अट्ठाईस", "उनतीस",
  "तीस", "इकतीस", "बत्तीस", "तैंतीस", "चौंतीस", "पैंतीस", "छत्तीस", "सैंतीस", "अड़तीस", "उनतालीस",
  "चालीस", "इकतालीस", "बयालीस", "तैंतालीस", "चवालीस", "पैंतालीस", "छियालीस", "सैंतालीस", "अड़तालीस", "उनचास",
  "पचास", "इक्यावन", "बावन", "तिरपन", "चौवन", "पचपन", "छप्पन", "सत्तावन", "अट्ठावन", "उनसठ",
  "साठ", "इकसठ", "बासठ", "तिरसठ", "चौंसठ", "पैंसठ", "छियासठ", "सड़सठ", "अड़सठ", "उनहत्तर",
  "सत्तर", "इकहत्तर", "बहत्तर", "तिहत्तर", "चौहत्तर", "पचहत्तर", "छिहत्तर", "सतहत्तर", "अठहत्तर", "उन्यासी",
  "अस्सी", "इक्यासी", "बयासी", "तिरासी", "चौरासी", "पचासी", "छियासी", "सत्तासी", "अट्ठासी", "नवासी",
  "नब्बे", "इक्यानवे", "बानवे", "तिरानवे", "चौरानवे", "पचानवे", "छियानवे", "सत्तानवे", "अट्ठानवे", "निन्यानवे",
];

const CRORE = 10000000;
const LAKH = 100000;
const THOUSAND = 1000;
const HUNDRED = 100;

/** 50750 -> "पचास हजार सात सौ पचास" */
export function toHindiWords(value: number): string {
  let n = Math.abs(Math.round(value));
  if (n === 0) return ONES_TO_99[0];

  const parts: string[] = [];

  const crore = Math.floor(n / CRORE);
  n %= CRORE;
  const lakh = Math.floor(n / LAKH);
  n %= LAKH;
  const thousand = Math.floor(n / THOUSAND);
  n %= THOUSAND;
  const hundred = Math.floor(n / HUNDRED);
  n %= HUNDRED;

  // Recurse for crore so values above 99 crore still read correctly.
  if (crore > 0) parts.push(`${toHindiWords(crore)} करोड़`);
  if (lakh > 0) parts.push(`${ONES_TO_99[lakh]} लाख`);
  if (thousand > 0) parts.push(`${ONES_TO_99[thousand]} हजार`);
  if (hundred > 0) parts.push(`${ONES_TO_99[hundred]} सौ`);
  if (n > 0) parts.push(ONES_TO_99[n]);

  return parts.join(" ");
}

/** 50750 -> "पचास हजार सात सौ पचास रुपये मात्र" */
export function toHindiRupeesWords(value: number): string {
  return `${toHindiWords(value)} रुपये मात्र`;
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx jest src/utils/hindiNumberWords.test.ts`
Expected: PASS, all cases green.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json jest.config.js src/utils/hindiNumberWords.ts src/utils/hindiNumberWords.test.ts
git commit -m "feat: Hindi number-to-words converter for bill amount in words"
```

---

### Task 2: Bill formatting helpers

Weight, Indian-grouped currency, and bill date. `toLocaleString("en-IN")` is not reliable across Hermes builds, so grouping is implemented by hand.

**Files:**
- Create: `src/utils/billFormat.ts`
- Create: `src/utils/billFormat.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `formatWeight(grams: number): { main: string; sub: string }`, `formatRupees(n: number): string`, `formatBillDate(iso: string): string`

- [ ] **Step 1: Write the failing test**

Create `src/utils/billFormat.test.ts`:

```ts
import { formatWeight, formatRupees, formatBillDate } from "./billFormat";

describe("formatWeight", () => {
  it("formats grams with three decimals and a milligram sub-line", () => {
    expect(formatWeight(3.5)).toEqual({
      main: "3.500 ग्राम",
      sub: "(3 ग्राम 500 मिली)",
    });
  });

  it("omits the sub-line for whole grams", () => {
    expect(formatWeight(3)).toEqual({ main: "3.000 ग्राम", sub: "" });
  });

  it("handles zero", () => {
    expect(formatWeight(0)).toEqual({ main: "0.000 ग्राम", sub: "" });
  });

  it("sums to three decimals without float drift", () => {
    expect(formatWeight(0.1 + 0.2).main).toBe("0.300 ग्राम");
  });
});

describe("formatRupees", () => {
  it.each([
    [0, "0/-"],
    [750, "750/-"],
    [50750, "50,750/-"],
    [169650, "1,69,650/-"],
    [10000000, "1,00,00,000/-"],
  ])("groups %i in the Indian style", (input, expected) => {
    expect(formatRupees(input)).toBe(expected);
  });
});

describe("formatBillDate", () => {
  it("renders dd/mm/yyyy", () => {
    expect(formatBillDate("2026-08-27T10:30:00.000Z")).toBe("27/08/2026");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/utils/billFormat.test.ts`
Expected: FAIL — `Cannot find module './billFormat'`

- [ ] **Step 3: Write the implementation**

Create `src/utils/billFormat.ts`:

```ts
// Formatting helpers for the printed bill. Pure — safe to unit test.

/**
 * 3.5 -> { main: "3.500 ग्राम", sub: "(3 ग्राम 500 मिली)" }
 * Whole gram values get an empty sub-line.
 */
export function formatWeight(grams: number): { main: string; sub: string } {
  const safe = Number.isFinite(grams) ? Math.abs(grams) : 0;
  // Round to milligrams first so 0.1 + 0.2 does not leak float drift.
  const totalMilli = Math.round(safe * 1000);
  const whole = Math.floor(totalMilli / 1000);
  const milli = totalMilli % 1000;

  const main = `${(totalMilli / 1000).toFixed(3)} ग्राम`;
  const sub = milli === 0 ? "" : `(${whole} ग्राम ${milli} मिली)`;

  return { main, sub };
}

/** Indian digit grouping: 169650 -> "1,69,650/-" */
export function formatRupees(value: number): string {
  const digits = Math.abs(Math.round(value)).toString();
  if (digits.length <= 3) return `${digits}/-`;

  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");

  return `${grouped},${last3}/-`;
}

/** ISO date string -> "27/08/2026" */
export function formatBillDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/utils/billFormat.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/billFormat.ts src/utils/billFormat.test.ts
git commit -m "feat: bill formatting helpers for weight, rupees and date"
```

---

### Task 3: Amount resolution rule

The data-safety-critical rule from spec §4.3, extracted as a pure function so it can be tested without a device. Every historical Len-Den entry depends on this being right.

**Files:**
- Create: `src/utils/lendenAmount.ts`
- Create: `src/utils/lendenAmount.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `resolveEffectiveAmount(lenden: AmountSource, items: HasTotal[]): number`
  - `sumItemTotals(items: HasTotal[]): number`
  - `isAmountOverridden(lenden: AmountSource, items: HasTotal[]): boolean`
  - types `AmountSource = { amount?: number | null; amountOverridden?: number | null }` and `HasTotal = { total: number }`

- [ ] **Step 1: Write the failing test**

Create `src/utils/lendenAmount.test.ts`:

```ts
import {
  resolveEffectiveAmount,
  sumItemTotals,
  isAmountOverridden,
} from "./lendenAmount";

describe("sumItemTotals", () => {
  it("sums totals", () => {
    expect(sumItemTotals([{ total: 50750 }, { total: 118900 }])).toBe(169650);
  });

  it("returns 0 for an empty list", () => {
    expect(sumItemTotals([])).toBe(0);
  });
});

describe("resolveEffectiveAmount", () => {
  it("sums the items when there are items and no override", () => {
    const lenden = { amount: 999, amountOverridden: 0 };
    const items = [{ total: 50750 }, { total: 118900 }];
    expect(resolveEffectiveAmount(lenden, items)).toBe(169650);
  });

  it("uses the stored amount when overridden", () => {
    const lenden = { amount: 169000, amountOverridden: 1 };
    const items = [{ total: 50750 }, { total: 118900 }];
    expect(resolveEffectiveAmount(lenden, items)).toBe(169000);
  });

  // The regression that would destroy every historical entry.
  it("NEVER zeroes a legacy entry that has no items", () => {
    const legacy = { amount: 45000, amountOverridden: 0 };
    expect(resolveEffectiveAmount(legacy, [])).toBe(45000);
  });

  it("survives a null amount", () => {
    expect(resolveEffectiveAmount({ amount: null }, [])).toBe(0);
    expect(resolveEffectiveAmount({}, [])).toBe(0);
  });
});

describe("isAmountOverridden", () => {
  it("is true when the typed amount differs from the item sum", () => {
    expect(isAmountOverridden({ amount: 50000 }, [{ total: 50750 }])).toBe(true);
  });

  it("is false when the typed amount equals the item sum", () => {
    expect(isAmountOverridden({ amount: 50750 }, [{ total: 50750 }])).toBe(
      false,
    );
  });

  it("is false when there are no items to compare against", () => {
    expect(isAmountOverridden({ amount: 50000 }, [])).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/utils/lendenAmount.test.ts`
Expected: FAIL — `Cannot find module './lendenAmount'`

- [ ] **Step 3: Write the implementation**

Create `src/utils/lendenAmount.ts`:

```ts
// Resolves the effective amount of a Len-Den entry from its line items.
// See agent/2026-08-31-lenden-bill-design.md §4.3.

export interface AmountSource {
  amount?: number | null;
  amountOverridden?: number | null;
}

export interface HasTotal {
  total: number;
}

export function sumItemTotals(items: HasTotal[]): number {
  return items.reduce((sum, item) => sum + item.total, 0);
}

/**
 * Two independent guards protect historical data:
 *   1. no items  -> the stored amount is authoritative
 *   2. overridden -> the user typed it, so it wins
 * Only when neither applies is the amount recomputed from items.
 */
export function resolveEffectiveAmount(
  lenden: AmountSource,
  items: HasTotal[],
): number {
  if (items.length === 0) return lenden.amount ?? 0;
  if (lenden.amountOverridden === 1) return lenden.amount ?? 0;
  return sumItemTotals(items);
}

/** Whether a typed amount diverges from the item sum, for the `*` marker. */
export function isAmountOverridden(
  lenden: AmountSource,
  items: HasTotal[],
): boolean {
  if (items.length === 0) return false;
  return (lenden.amount ?? 0) !== sumItemTotals(items);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/utils/lendenAmount.test.ts`
Expected: PASS

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: 3 suites pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/lendenAmount.ts src/utils/lendenAmount.test.ts
git commit -m "feat: Len-Den amount resolution rule with legacy-entry guards"
```

---

### Task 4: Native dependencies and template asset

Installs everything native in one go so there is a single dev-client rebuild, and moves the template JPG where the app can bundle it.

**Files:**
- Modify: `package.json`
- Modify: `src/declarations.d.ts`
- Move: `img/2026-08-31/1788119935472-IMG-20260829-WA0012.jpg` → `assets/bill-template.jpg`

**Interfaces:**
- Consumes: nothing.
- Produces: `assets/bill-template.jpg` bundled and requireable; `expo-print`, `react-native-webview`, `expo-asset` available.

- [ ] **Step 1: Install the native dependencies**

Use `npx expo install`, not `npm install` — it pins versions compatible with SDK 54.

```bash
npx expo install expo-print react-native-webview expo-asset
```

- [ ] **Step 2: Move the template into `assets/`**

```bash
git mv "img/2026-08-31/1788119935472-IMG-20260829-WA0012.jpg" assets/bill-template.jpg
```

- [ ] **Step 3: Declare the JPG module type**

Append to `src/declarations.d.ts` so `require("../../assets/bill-template.jpg")` type-checks under `strict: true` regardless of whether `expo-env.d.ts` has been generated:

```ts
declare module "*.jpg" {
  const content: number;
  export default content;
}
```

- [ ] **Step 4: Verify TypeScript still compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Rebuild the dev client and install it on the device**

```bash
npx eas build --profile development --platform android
```

This is required — the three packages above are native modules. The previous dev client will no longer run this JS bundle. Install the resulting APK on the device before continuing.

- [ ] **Step 6: Smoke-test the app on the new build**

Run: `npx expo start --dev-client`
Expected: the app launches to the Home screen and the existing customer/transaction flows still work. Nothing new is visible yet — this step only confirms the rebuild is healthy.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/declarations.d.ts assets/bill-template.jpg
git commit -m "chore: add expo-print, react-native-webview, expo-asset; bundle bill template"
```

---

### Task 5: Types, schema and migration

Adds the item types, the `lenden_items` table, the two new `lenden` columns with the data-safety backfill, and removes the duplicate `address` column from the `users` DDL.

**Files:**
- Modify: `src/types/entry.ts`
- Modify: `src/database/entryDatabase.ts` (users DDL ~line 29-32; new table after the `jama_entries` block ~line 78; lenden column migration block ~line 145)

**Interfaces:**
- Consumes: nothing.
- Produces: types `Purity`, `LendenItem`, `NewLendenItem`; `Lenden.billNo`, `Lenden.amountOverridden`; route `BillPreview: { lendenId: number }`; tables `lenden_items`, columns `lenden.billNo`, `lenden.amountOverridden`; `createLenden` now writes `amountOverridden`.

- [ ] **Step 1: Add the types**

In `src/types/entry.ts`, add after the `NewLenden` interface:

```ts
export type Purity = "24KT" | "22KT" | "18KT" | "Silver";

export const PURITY_OPTIONS: Purity[] = ["24KT", "22KT", "18KT", "Silver"];

// Jewellery line item on a Len-Den entry
export interface LendenItem {
  id: number;
  lendenId: number;
  position: number; // 1-based, kept contiguous
  name: string;
  purity: Purity | null;
  weight: number | null; // grams
  rate: number | null; // rupees per gram
  total: number; // rupees
}

export interface NewLendenItem {
  name: string;
  purity?: Purity | null;
  weight?: number | null;
  rate?: number | null;
  total: number;
}
```

- [ ] **Step 2: Extend `Lenden` and `NewLenden`**

In the existing `Lenden` interface add:

```ts
  billNo?: number | null;
  amountOverridden?: number | null;
```

and in `NewLenden` add:

```ts
  billNo?: number;
  amountOverridden?: number;
```

- [ ] **Step 3: Add the navigation route**

In `RootStackParamList`, after the `TransactionDetail` entry:

```ts
  BillPreview: {
    lendenId: number;
  };
```

- [ ] **Step 4: Fix the duplicate column in the users DDL**

In `src/database/entryDatabase.ts`, the `users` `CREATE TABLE` currently lists `address TEXT` twice. Delete the second occurrence so the block reads:

```sql
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        mobileNumber TEXT,
        nickname TEXT,
        createdAt TEXT NOT NULL
      );
```

- [ ] **Step 5: Create the `lenden_items` table**

Immediately after the `jama_entries` `execAsync` block, add:

```ts
    // Create Lenden Items table (jewellery line items per lenden)
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS lenden_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lendenId INTEGER NOT NULL,
        position INTEGER NOT NULL,
        name TEXT NOT NULL,
        purity TEXT,
        weight REAL,
        rate INTEGER,
        total INTEGER NOT NULL,
        FOREIGN KEY (lendenId) REFERENCES lenden(id) ON DELETE CASCADE
      );
    `);
```

- [ ] **Step 6: Add the lenden column migration with the backfill**

Inside the existing `try` block that checks `lendenColumns`, after the `status` check, add:

```ts
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
```

- [ ] **Step 7: Persist `amountOverridden` in `createLenden`**

`createLenden`'s INSERT lists a fixed column set. Adding the field to
`NewLenden` alone is not enough — TypeScript accepts the extra property and
the value is silently dropped, so a user's typed override would be lost the
moment the entry is reloaded. Add the column to the statement, mirroring how
`status` is handled on the line below it.

Change the INSERT from:

```ts
      "INSERT INTO lenden (userId, date, media, amount, discount, remaining, jama, baki, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
```

to:

```ts
      "INSERT INTO lenden (userId, date, media, amount, discount, remaining, jama, baki, status, amountOverridden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
```

and add one argument after `lenden.status ?? 0,`:

```ts
      lenden.amountOverridden ?? 0,
```

- [ ] **Step 8: Delete `lenden_items` explicitly in `deleteLenden`**

The `FOREIGN KEY ... ON DELETE CASCADE` clause in the new table **will not fire**. `PRAGMA foreign_keys` is never set anywhere in this codebase and SQLite defaults it off per connection, so every cascade in this schema is decorative. `deleteLenden` already deletes `jama_entries` manually for exactly this reason — follow that existing pattern.

In `deleteLenden`, alongside the existing `jama_entries` delete:

```ts
    await database.runAsync("DELETE FROM lenden_items WHERE lendenId = ?", id);
```

Do **not** add `PRAGMA foreign_keys = ON` as part of this task. Enabling it on a database that already contains orphan rows makes later writes throw `FOREIGN KEY constraint failed` where they previously succeeded; that change needs a guarded orphan sweep first and is tracked separately in `agent/2026-08-31-bug-audit-and-fix-plan.md` (finding B11, Phase 4).

- [ ] **Step 9: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 10: Verify the migration on device**

Run the app on the device that already holds real data (`npx expo start --dev-client`). Watch the Metro console for `Added amountOverridden to lenden table and backfilled existing rows`, then open an existing customer with Len-Den entries.

Expected: **every historical amount is unchanged.** If any entry shows ₹0, stop and fix before continuing — this is the failure mode Task 3 guards against.

- [ ] **Step 11: Commit**

```bash
git add src/types/entry.ts src/database/entryDatabase.ts
git commit -m "feat: lenden_items schema, billNo/amountOverridden columns, users DDL fix"
```

---

### Task 6: Line item CRUD

`entryDatabase.ts` is already 1226 lines, so item persistence gets its own module. `replaceLendenItems` deletes and reinserts, which keeps `position` contiguous for free — correct and simple at the 5-7 item scale this bill supports.

**Files:**
- Create: `src/database/lendenItems.ts`

**Interfaces:**
- Consumes: `LendenItem`, `NewLendenItem`, `Purity` from Task 5.
- Produces:
  - `getLendenItems(lendenId: number): Promise<LendenItem[]>`
  - `replaceLendenItems(lendenId: number, items: NewLendenItem[]): Promise<void>`
  - `getNextBillNo(): Promise<number>`
  - `setLendenBillNo(lendenId: number, billNo: number): Promise<void>`
  - `setLendenAmountOverridden(lendenId: number, overridden: number): Promise<void>`

> **Deviation from spec §4.5, deliberate.** The spec's `NewLendenItem` carried `lendenId` and `position`. Here it carries neither — `replaceLendenItems` owns both, which is what keeps `position` contiguous automatically and lets the screens hold a plain list of items with no bookkeeping. Every consumer uses the position-less shape.

- [ ] **Step 1: Write the module**

Create `src/database/lendenItems.ts`:

```ts
import * as SQLite from "expo-sqlite";
import { LendenItem, NewLendenItem, Purity } from "../types/entry";

// entryDatabase.ts owns schema creation; this module only reads and writes rows.
let db: SQLite.SQLiteDatabase | null = null;

const openDatabase = async () => {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("aj_database.db");
  return db;
};

interface LendenItemRow {
  id: number;
  lendenId: number;
  position: number;
  name: string;
  purity: string | null;
  weight: number | null;
  rate: number | null;
  total: number;
}

const toLendenItem = (row: LendenItemRow): LendenItem => ({
  id: row.id,
  lendenId: row.lendenId,
  position: row.position,
  name: row.name,
  purity: (row.purity as Purity | null) ?? null,
  weight: row.weight,
  rate: row.rate,
  total: row.total,
});

/** Items for one Len-Den entry, ordered by their printed क्रं. */
export const getLendenItems = async (
  lendenId: number,
): Promise<LendenItem[]> => {
  try {
    const database = await openDatabase();
    const rows = await database.getAllAsync<LendenItemRow>(
      "SELECT * FROM lenden_items WHERE lendenId = ? ORDER BY position ASC",
      lendenId,
    );
    return rows.map(toLendenItem);
  } catch (error) {
    console.error("Error getting Lenden items:", error);
    return [];
  }
};

/**
 * Replaces every item on an entry, renumbering position from 1.
 * Delete-then-insert keeps the क्रं. column contiguous with no gaps.
 */
export const replaceLendenItems = async (
  lendenId: number,
  items: NewLendenItem[],
): Promise<void> => {
  try {
    const database = await openDatabase();
    await database.withTransactionAsync(async () => {
      await database.runAsync(
        "DELETE FROM lenden_items WHERE lendenId = ?",
        lendenId,
      );
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await database.runAsync(
          "INSERT INTO lenden_items (lendenId, position, name, purity, weight, rate, total) VALUES (?, ?, ?, ?, ?, ?, ?)",
          lendenId,
          i + 1,
          item.name,
          item.purity ?? null,
          item.weight ?? null,
          item.rate ?? null,
          item.total,
        );
      }
    });
  } catch (error) {
    console.error("Error replacing Lenden items:", error);
    throw error;
  }
};

/** Next bill number in the shop's series. Typing one in makes the series continue from there. */
export const getNextBillNo = async (): Promise<number> => {
  try {
    const database = await openDatabase();
    const row = await database.getFirstAsync<{ maxBillNo: number | null }>(
      "SELECT MAX(billNo) as maxBillNo FROM lenden",
    );
    return (row?.maxBillNo ?? 0) + 1;
  } catch (error) {
    console.error("Error getting next bill number:", error);
    return 1;
  }
};

export const setLendenBillNo = async (
  lendenId: number,
  billNo: number,
): Promise<void> => {
  try {
    const database = await openDatabase();
    await database.runAsync(
      "UPDATE lenden SET billNo = ? WHERE id = ?",
      billNo,
      lendenId,
    );
  } catch (error) {
    console.error("Error setting bill number:", error);
    throw error;
  }
};

/**
 * Separate from updateLendenDetails so that function's signature — and its
 * existing callers — stay untouched.
 */
export const setLendenAmountOverridden = async (
  lendenId: number,
  overridden: number,
): Promise<void> => {
  try {
    const database = await openDatabase();
    await database.runAsync(
      "UPDATE lenden SET amountOverridden = ? WHERE id = ?",
      overridden,
      lendenId,
    );
  } catch (error) {
    console.error("Error setting amountOverridden:", error);
    throw error;
  }
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/database/lendenItems.ts
git commit -m "feat: Len-Den line item CRUD and bill number allocation"
```

---

### Task 7: Bill HTML builder

The heart of the feature and the largest pure module. One function, fully tested, feeding preview, PDF and print.

**Files:**
- Create: `src/services/BillHtmlService.ts`
- Create: `src/services/BillHtmlService.test.ts`

**Interfaces:**
- Consumes: `LendenItem` (Task 5), `toHindiRupeesWords` (Task 1), `formatWeight` / `formatRupees` / `formatBillDate` (Task 2).
- Produces: `buildBillHtml(data: BillData): string`, types `BillData` / `BillCustomer` / `BillJama`, constants `HEADER_CROP_PCT`, `FOOTER_CROP_PCT`, `COMPACT_ITEM_THRESHOLD`.

- [ ] **Step 1: Write the failing test**

Create `src/services/BillHtmlService.test.ts`:

```ts
import { buildBillHtml, BillData } from "./BillHtmlService";
import { LendenItem } from "../types/entry";

const item = (over: Partial<LendenItem> = {}): LendenItem => ({
  id: 1,
  lendenId: 1,
  position: 1,
  name: "मांगटीका",
  purity: "22KT",
  weight: 3.5,
  rate: 14500,
  total: 50750,
  ...over,
});

const data = (over: Partial<BillData> = {}): BillData => ({
  billNo: 9267,
  date: "2026-08-27T00:00:00.000Z",
  customer: { name: "सरिता शर्मा", address: "रामदशपुर, जौनपुर", mobile: "9415501122" },
  items: [item()],
  amount: 50750,
  discount: 0,
  jamaEntries: [],
  baki: 50750,
  showPaymentDetails: false,
  templateDataUri: "data:image/jpeg;base64,AAAA",
  ...over,
});

describe("buildBillHtml", () => {
  it("renders the customer, bill number and date", () => {
    const html = buildBillHtml(data());
    expect(html).toContain("सरिता शर्मा");
    expect(html).toContain("रामदशपुर, जौनपुर");
    expect(html).toContain("9415501122");
    expect(html).toContain("9267");
    expect(html).toContain("27/08/2026");
  });

  it("renders the item row with all six columns", () => {
    const html = buildBillHtml(data());
    expect(html).toContain("मांगटीका");
    expect(html).toContain("22KT");
    expect(html).toContain("3.500 ग्राम");
    expect(html).toContain("(3 ग्राम 500 मिली)");
    expect(html).toContain("14,500/-");
    expect(html).toContain("50,750/-");
  });

  it("embeds the template exactly once and bands it", () => {
    const html = buildBillHtml(data());
    expect(html.split("data:image/jpeg;base64,AAAA").length - 1).toBe(1);
    expect(html).toContain("band-header");
    expect(html).toContain("band-footer");
  });

  it("omits the address and mobile rows when absent", () => {
    const html = buildBillHtml(
      data({ customer: { name: "सरिता", address: null, mobile: null } }),
    );
    expect(html).not.toContain("मोबाइल");
    expect(html).not.toContain("पता");
  });

  describe("summary rate row", () => {
    it("shows दर प्रति ग्राम when every item shares one rate", () => {
      const html = buildBillHtml(
        data({ items: [item(), item({ id: 2, position: 2, rate: 14500 })] }),
      );
      expect(html).toContain("दर प्रति ग्राम");
    });

    it("omits दर प्रति ग्राम when rates differ", () => {
      const html = buildBillHtml(
        data({ items: [item(), item({ id: 2, position: 2, rate: 9000 })] }),
      );
      expect(html).not.toContain("दर प्रति ग्राम");
    });
  });

  describe("payment details toggle", () => {
    it("prints the plain sale copy when off", () => {
      const html = buildBillHtml(data({ showPaymentDetails: false }));
      expect(html).toContain("कुल देय राशि");
      expect(html).not.toContain("जमा");
      expect(html).not.toContain("बाकी");
    });

    it("prints छूट, जमा and बाकी when on", () => {
      const html = buildBillHtml(
        data({
          showPaymentDetails: true,
          discount: 650,
          jamaEntries: [{ amount: 50000, date: "2026-08-27T00:00:00.000Z" }],
          baki: 100,
        }),
      );
      expect(html).toContain("छूट");
      expect(html).toContain("जमा (27/08/2026)");
      expect(html).toContain("बाकी");
      expect(html).toContain("50,000/-");
    });
  });

  it("puts the payable amount into words", () => {
    const html = buildBillHtml(data());
    expect(html).toContain("पचास हजार सात सौ पचास रुपये मात्र");
  });

  it("words the baki, not the gross, when payment details are shown", () => {
    const html = buildBillHtml(
      data({ showPaymentDetails: true, baki: 100, discount: 650 }),
    );
    expect(html).toContain("एक सौ रुपये मात्र");
  });

  it("drops the milligram sub-line once the table gets crowded", () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      item({ id: i + 1, position: i + 1 }),
    );
    const html = buildBillHtml(data({ items: many }));
    expect(html).not.toContain("(3 ग्राम 500 मिली)");
    expect(html).toContain("3.500 ग्राम");
  });

  it("escapes HTML in user-typed names", () => {
    const html = buildBillHtml(
      data({ items: [item({ name: "<script>x</script>" })] }),
    );
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/services/BillHtmlService.test.ts`
Expected: FAIL — `Cannot find module './BillHtmlService'`

- [ ] **Step 3: Write the implementation**

Create `src/services/BillHtmlService.ts`:

```ts
import { LendenItem } from "../types/entry";
import { toHindiRupeesWords } from "../utils/hindiNumberWords";
import {
  formatBillDate,
  formatRupees,
  formatWeight,
} from "../utils/billFormat";

// ---------------------------------------------------------------------------
// Template banding. See agent/2026-08-31-lenden-bill-design.md §5.2 and §5.3.
//
// The template (1024x1536, ratio 1:1.500) is TALLER than A5 (1:1.419). Both
// bands render at natural aspect ratio across the full page width and the
// rebuilt middle absorbs the difference.
//
// CALIBRATION: these two fractions were read off the reference image by eye.
// They are the only numbers to touch when the seams do not line up.
// ---------------------------------------------------------------------------
const TEMPLATE_W = 1024;
const TEMPLATE_H = 1536;
export const HEADER_CROP_PCT = 0.3548;
export const FOOTER_CROP_PCT = 0.1016;

const PAGE_W_MM = 148;
const PAGE_H_MM = 210;

const TPL_H_MM = PAGE_W_MM * (TEMPLATE_H / TEMPLATE_W);
const HEADER_H_MM = TPL_H_MM * HEADER_CROP_PCT;
const FOOTER_H_MM = TPL_H_MM * FOOTER_CROP_PCT;
const FOOTER_OFFSET_MM = -(TPL_H_MM - FOOTER_H_MM);
const MIDDLE_H_MM = PAGE_H_MM - HEADER_H_MM - FOOTER_H_MM;

const GOLD = "#C08A2E";
const GOLD_SOFT = "#E3C489";
const CREAM = "#FDFBF7";
const HEAD_BG = "#FAF1E2";
const INK = "#1A1A1A";

/** Above this many items the milligram sub-line is dropped so the table still fits. */
export const COMPACT_ITEM_THRESHOLD = 5;

export interface BillCustomer {
  name: string;
  address: string | null;
  mobile: string | null;
}

export interface BillJama {
  amount: number;
  date: string;
}

export interface BillData {
  billNo: number;
  date: string; // ISO; the entry's own date, not today
  customer: BillCustomer;
  items: LendenItem[];
  amount: number; // effective amount, per resolveEffectiveAmount
  discount: number;
  jamaEntries: BillJama[];
  baki: number;
  showPaymentDetails: boolean;
  templateDataUri: string;
}

const esc = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const mm = (value: number): string => `${value.toFixed(2)}mm`;

const summaryRow = (label: string, value: string, cls = ""): string =>
  `<tr class="${cls}"><td class="sl">${esc(label)}</td><td class="sv">${esc(
    value,
  )}</td></tr>`;

export function buildBillHtml(data: BillData): string {
  const { items, customer } = data;
  const compact = items.length > COMPACT_ITEM_THRESHOLD;

  const totalWeight = items.reduce((sum, i) => sum + (i.weight ?? 0), 0);

  // A single summary rate is only meaningful when every line shares it.
  const rates = items.map((i) => i.rate);
  const uniformRate =
    rates.length > 0 && rates.every((r) => r !== null && r === rates[0])
      ? (rates[0] as number)
      : null;

  const itemRows = items
    .map((item) => {
      let weightCell = "";
      if (item.weight !== null) {
        const w = formatWeight(item.weight);
        weightCell =
          compact || !w.sub
            ? esc(w.main)
            : `${esc(w.main)}<div class="sub">${esc(w.sub)}</div>`;
      }
      return `<tr>
        <td class="c">${item.position}</td>
        <td class="desc">${esc(item.name)}</td>
        <td class="c">${esc(item.purity ?? "")}</td>
        <td class="c">${weightCell}</td>
        <td class="r">${item.rate !== null ? esc(formatRupees(item.rate)) : ""}</td>
        <td class="r">${esc(formatRupees(item.total))}</td>
      </tr>`;
    })
    .join("");

  const summary: string[] = [summaryRow("कुल वजन", formatWeight(totalWeight).main)];

  if (data.showPaymentDetails) {
    summary.push(summaryRow("कुल राशि", formatRupees(data.amount)));
    if (data.discount > 0) {
      summary.push(summaryRow("छूट", `-${formatRupees(data.discount)}`));
    }
    for (const jama of data.jamaEntries) {
      summary.push(
        summaryRow(
          `जमा (${formatBillDate(jama.date)})`,
          `-${formatRupees(jama.amount)}`,
        ),
      );
    }
  } else {
    if (uniformRate !== null) {
      summary.push(summaryRow("दर प्रति ग्राम", formatRupees(uniformRate)));
    }
    summary.push(summaryRow("कुल राशि", formatRupees(data.amount)));
  }

  const payable = data.showPaymentDetails ? data.baki : data.amount;
  const payableLabel = data.showPaymentDetails ? "बाकी" : "कुल देय राशि";
  summary.push(summaryRow(payableLabel, formatRupees(payable), "final"));

  const addressRow = customer.address
    ? `<tr><td class="k">पता</td><td class="v">${esc(customer.address)}</td>
       <td class="k2">दिनांक</td><td class="v2">${esc(formatBillDate(data.date))}</td></tr>`
    : `<tr><td class="k"></td><td class="v"></td>
       <td class="k2">दिनांक</td><td class="v2">${esc(formatBillDate(data.date))}</td></tr>`;

  const mobileRow = customer.mobile
    ? `<tr><td class="k">मोबाइल</td><td class="v" colspan="3">${esc(customer.mobile)}</td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="hi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { --tpl: url("${data.templateDataUri}"); }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A5; margin: 0; }
  html, body { width: ${mm(PAGE_W_MM)}; height: ${mm(PAGE_H_MM)}; }
  body {
    background: ${CREAM};
    color: ${INK};
    font-family: "Noto Sans Devanagari", "Nirmala UI", "Mangal", sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { width: ${mm(PAGE_W_MM)}; height: ${mm(PAGE_H_MM)}; display: flex; flex-direction: column; }

  .band {
    width: 100%;
    flex: none;
    background-image: var(--tpl);
    background-size: ${mm(PAGE_W_MM)} ${mm(TPL_H_MM)};
    background-repeat: no-repeat;
  }
  .band-header { height: ${mm(HEADER_H_MM)}; background-position: 0 0; }
  .band-footer { height: ${mm(FOOTER_H_MM)}; background-position: 0 ${mm(FOOTER_OFFSET_MM)}; }

  /* Continues the template's gold frame down the rebuilt middle. */
  .middle {
    height: ${mm(MIDDLE_H_MM)};
    border-left: 0.4mm solid ${GOLD};
    border-right: 0.4mm solid ${GOLD};
    background: ${CREAM};
    padding: 2mm 5mm 0;
    display: flex;
    flex-direction: column;
  }

  table { width: 100%; border-collapse: collapse; }

  .cust { font-size: 8.5pt; margin-bottom: 2mm; }
  .cust td { padding: 0.8mm 1mm; vertical-align: top; }
  .cust .k, .cust .k2 { width: 14mm; color: ${INK}; white-space: nowrap; }
  .cust .k::after, .cust .k2::after { content: " :"; }
  .cust .v, .cust .v2 { font-weight: 700; border-bottom: 0.2mm dotted ${GOLD_SOFT}; }
  .cust .k2 { width: 16mm; padding-left: 3mm; }
  .cust .v2 { width: 28mm; }

  .items { font-size: 8pt; border: 0.3mm solid ${GOLD}; }
  .items th, .items td { border: 0.2mm solid ${GOLD_SOFT}; padding: 1.2mm 1mm; }
  .items th { background: ${HEAD_BG}; font-size: 8pt; font-weight: 700; }
  .items .c { text-align: center; }
  .items .r { text-align: right; }
  .items .desc { font-weight: 700; }
  .items .sub { font-size: 6.5pt; font-weight: 400; opacity: 0.75; }

  .foot { margin-top: auto; padding-bottom: 2mm; }
  .summary-wrap { display: flex; justify-content: flex-end; }
  .summary { width: 62mm; font-size: 8.5pt; border: 0.3mm solid ${GOLD}; }
  .summary td { border: 0.2mm solid ${GOLD_SOFT}; padding: 1.1mm 2mm; }
  .summary .sl { color: ${INK}; }
  .summary .sv { text-align: right; font-weight: 700; white-space: nowrap; }
  .summary .final td { background: ${HEAD_BG}; font-weight: 800; font-size: 9.5pt; }

  .words { font-size: 8pt; margin-top: 1.5mm; }
  .words b { font-weight: 700; }
</style>
</head>
<body>
  <div class="page">
    <div class="band band-header"></div>

    <div class="middle">
      <table class="cust">
        <tr>
          <td class="k">नाम</td><td class="v">${esc(customer.name)}</td>
          <td class="k2">बिल नं.</td><td class="v2">${data.billNo}</td>
        </tr>
        ${addressRow}
        ${mobileRow}
      </table>

      <table class="items">
        <thead>
          <tr>
            <th style="width:8mm">क्रं.</th>
            <th>विवरण</th>
            <th style="width:15mm">शुद्धता</th>
            <th style="width:22mm">वजन</th>
            <th style="width:20mm">दर</th>
            <th style="width:24mm">कुल राशि</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div class="foot">
        <div class="summary-wrap">
          <table class="summary">${summary.join("")}</table>
        </div>
        <div class="words">
          <b>राशि शब्दों में :</b> ${esc(toHindiRupeesWords(payable))} ।
        </div>
      </div>
    </div>

    <div class="band band-footer"></div>
  </div>
</body>
</html>`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/services/BillHtmlService.test.ts`
Expected: PASS, all cases green.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: 4 suites pass.

- [ ] **Step 6: Commit**

```bash
git add src/services/BillHtmlService.ts src/services/BillHtmlService.test.ts
git commit -m "feat: pure A5 bill HTML builder with template banding"
```

---

### Task 8: PDF share and print service

Thin wrappers over `expo-print`. Kept separate from `BillHtmlService` so the HTML builder stays importable in a node test environment.

**Files:**
- Create: `src/services/BillService.ts`

**Interfaces:**
- Consumes: `assets/bill-template.jpg` (Task 4).
- Produces: `loadTemplateDataUri(): Promise<string>`, `sharePdf(html: string, billNo: number): Promise<void>`, `printBill(html: string): Promise<void>`

- [ ] **Step 1: Write the module**

Create `src/services/BillService.ts`:

```ts
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";

// A5 in PostScript points: 148mm x 210mm.
const A5_WIDTH_PT = 420;
const A5_HEIGHT_PT = 595;

// ~151 KB of base64 that never changes — read it once per app session.
let cachedTemplate: string | null = null;

export async function loadTemplateDataUri(): Promise<string> {
  if (cachedTemplate) return cachedTemplate;

  const asset = Asset.fromModule(require("../../assets/bill-template.jpg"));
  await asset.downloadAsync();

  const uri = asset.localUri ?? asset.uri;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: "base64",
  });

  cachedTemplate = `data:image/jpeg;base64,${base64}`;
  return cachedTemplate;
}

/** Renders the bill to an A5 PDF named bill_<billNo>.pdf and opens the share sheet. */
export async function sharePdf(html: string, billNo: number): Promise<void> {
  const { uri } = await Print.printToFileAsync({
    html,
    width: A5_WIDTH_PT,
    height: A5_HEIGHT_PT,
    base64: false,
  });

  // printToFileAsync emits a random filename; rename so the customer receives
  // a file called bill_9267.pdf rather than a UUID.
  const target = `${FileSystem.cacheDirectory}bill_${billNo}.pdf`;
  await FileSystem.deleteAsync(target, { idempotent: true });
  await FileSystem.moveAsync({ from: uri, to: target });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device");
  }

  await Sharing.shareAsync(target, {
    mimeType: "application/pdf",
    dialogTitle: `बिल नं. ${billNo}`,
    UTI: "com.adobe.pdf",
  });
}

/** Opens the native print dialog. */
export async function printBill(html: string): Promise<void> {
  await Print.printAsync({ html });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/BillService.ts
git commit -m "feat: A5 PDF share and native print service"
```

---

### Task 9: Add/edit line item modal

Mirrors `AddJamaModal` in structure, props and styling so the two feel identical in use.

**Files:**
- Create: `src/components/AddLendenItemModal.tsx`

**Interfaces:**
- Consumes: `Purity`, `PURITY_OPTIONS`, `NewLendenItem` (Task 5).
- Produces: default export `AddLendenItemModal` with props `{ visible, onClose, onSave, editMode?, initialItem? }`, where `onSave: (item: NewLendenItem) => void`.

- [ ] **Step 1: Write the component**

Create `src/components/AddLendenItemModal.tsx`:

```tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NewLendenItem, Purity, PURITY_OPTIONS } from "../types/entry";

interface AddLendenItemModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (item: NewLendenItem) => void;
  editMode?: boolean;
  initialItem?: NewLendenItem;
}

const AddLendenItemModal: React.FC<AddLendenItemModalProps> = ({
  visible,
  onClose,
  onSave,
  editMode = false,
  initialItem,
}) => {
  const [name, setName] = useState("");
  const [purity, setPurity] = useState<Purity>("22KT");
  const [weight, setWeight] = useState("");
  const [rate, setRate] = useState("");
  const [total, setTotal] = useState("");
  // Once the user edits the total by hand we stop recomputing it for them.
  const [totalTouched, setTotalTouched] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (editMode && initialItem) {
      setName(initialItem.name);
      setPurity((initialItem.purity as Purity) ?? "22KT");
      setWeight(initialItem.weight != null ? String(initialItem.weight) : "");
      setRate(initialItem.rate != null ? String(initialItem.rate) : "");
      setTotal(String(initialItem.total));
      setTotalTouched(true);
    } else {
      setName("");
      setPurity("22KT");
      setWeight("");
      setRate("");
      setTotal("");
      setTotalTouched(false);
    }
  }, [visible, editMode, initialItem]);

  // Auto-fill total = weight x rate until the user overrides it.
  useEffect(() => {
    if (totalTouched) return;
    const w = parseFloat(weight);
    const r = parseInt(rate, 10);
    if (w > 0 && r > 0) {
      setTotal(String(Math.round(w * r)));
    } else {
      setTotal("");
    }
  }, [weight, rate, totalTouched]);

  const totalNum = parseInt(total, 10) || 0;
  const canSave = name.trim().length > 0 && totalNum > 0;

  const handleSave = () => {
    if (!canSave) return;
    const w = parseFloat(weight);
    const r = parseInt(rate, 10);
    onSave({
      name: name.trim(),
      purity,
      weight: Number.isFinite(w) ? w : null,
      rate: Number.isFinite(r) ? r : null,
      total: totalNum,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {editMode ? "Edit Item" : "Add Item"}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                विवरण / Description <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. मांगटीका"
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>शुद्धता / Purity</Text>
              <View style={styles.purityRow}>
                {PURITY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.purityChip,
                      purity === option && styles.purityChipActive,
                    ]}
                    onPress={() => setPurity(option)}
                  >
                    <Text
                      style={[
                        styles.purityText,
                        purity === option && styles.purityTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={styles.label}>वजन / Weight (g)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="3.500"
                  placeholderTextColor="#999"
                  value={weight}
                  onChangeText={(t) => setWeight(t.replace(/[^0-9.]/g, ""))}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={styles.label}>दर / Rate (₹/g)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="14500"
                  placeholderTextColor="#999"
                  value={rate}
                  onChangeText={(t) => setRate(t.replace(/[^0-9]/g, ""))}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                कुल राशि / Total (₹) <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.totalInput]}
                placeholder="0"
                placeholderTextColor="#999"
                value={total}
                onChangeText={(t) => {
                  setTotalTouched(true);
                  setTotal(t.replace(/[^0-9]/g, ""));
                }}
                keyboardType="numeric"
              />
              {!totalTouched && (
                <Text style={styles.hint}>Auto-calculated from weight × rate</Text>
              )}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>
              {editMode ? "Update Item" : "Add Item"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  content: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 30,
    maxHeight: "88%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F5",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#1A1A1A" },
  body: { paddingHorizontal: 20, paddingTop: 16 },
  inputGroup: { marginBottom: 16 },
  row: { flexDirection: "row", gap: 12 },
  flex1: { flex: 1 },
  label: { fontSize: 14, fontWeight: "600", color: "#666", marginBottom: 8 },
  required: { color: "#FF3B30" },
  input: {
    backgroundColor: "#F0F7FF",
    borderWidth: 1,
    borderColor: "#D0E4FF",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#1A1A1A",
  },
  totalInput: { fontWeight: "700", fontSize: 18 },
  hint: { fontSize: 12, color: "#999", marginTop: 6 },
  purityRow: { flexDirection: "row", gap: 8 },
  purityChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#D0E4FF",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  purityChipActive: { backgroundColor: "#007AFF", borderColor: "#007AFF" },
  purityText: { fontSize: 13, fontWeight: "700", color: "#007AFF" },
  purityTextActive: { color: "#fff" },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#007AFF",
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  saveButtonDisabled: { backgroundColor: "#A0C4FF" },
  saveButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});

export default AddLendenItemModal;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/AddLendenItemModal.tsx
git commit -m "feat: add/edit jewellery line item modal"
```

---

### Task 10: Line items table component

The in-app list of items, styled to match `BillTable`. Used by both the add and detail screens.

**Files:**
- Create: `src/components/LendenItemsTable.tsx`

**Interfaces:**
- Consumes: `NewLendenItem` (Task 5), `sumItemTotals` (Task 3), `formatWeight` / `formatRupees` (Task 2), `COMPACT_ITEM_THRESHOLD` (Task 7).
- Produces: default export `LendenItemsTable` with props `{ items: NewLendenItem[]; editable?: boolean; onAdd?: () => void; onEdit?: (index: number) => void; onDelete?: (index: number) => void }`.

- [ ] **Step 1: Write the component**

Create `src/components/LendenItemsTable.tsx`:

```tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NewLendenItem } from "../types/entry";
import { sumItemTotals } from "../utils/lendenAmount";
import { formatRupees, formatWeight } from "../utils/billFormat";
import { COMPACT_ITEM_THRESHOLD } from "../services/BillHtmlService";

interface LendenItemsTableProps {
  items: NewLendenItem[];
  editable?: boolean;
  onAdd?: () => void;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
}

const LendenItemsTable: React.FC<LendenItemsTableProps> = ({
  items,
  editable = false,
  onAdd,
  onEdit,
  onDelete,
}) => {
  const total = sumItemTotals(items);
  const totalWeight = items.reduce((sum, i) => sum + (i.weight ?? 0), 0);
  const overflowing = items.length > COMPACT_ITEM_THRESHOLD;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="diamond-outline" size={18} color="#007AFF" />
        <Text style={styles.headerText}>Items ({items.length})</Text>
      </View>

      {items.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No items added yet</Text>
        </View>
      )}

      {items.map((item, index) => (
        <View key={index} style={styles.itemRow}>
          <View style={styles.serial}>
            <Text style={styles.serialText}>{index + 1}</Text>
          </View>

          <View style={styles.itemBody}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.itemMeta}>
              {[
                item.purity ?? null,
                item.weight != null ? formatWeight(item.weight).main : null,
                item.rate != null ? `@ ${formatRupees(item.rate)}` : null,
              ]
                .filter(Boolean)
                .join("  ·  ")}
            </Text>
          </View>

          <Text style={styles.itemTotal}>{formatRupees(item.total)}</Text>

          {editable && onEdit && (
            <TouchableOpacity style={styles.iconButton} onPress={() => onEdit(index)}>
              <Ionicons name="pencil" size={16} color="#007AFF" />
            </TouchableOpacity>
          )}
          {editable && onDelete && (
            <TouchableOpacity style={styles.iconButton} onPress={() => onDelete(index)}>
              <Ionicons name="close-circle" size={20} color="#FF3B30" />
            </TouchableOpacity>
          )}
        </View>
      ))}

      {items.length > 0 && (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            TOTAL {totalWeight > 0 ? `· ${formatWeight(totalWeight).main}` : ""}
          </Text>
          <Text style={styles.totalValue}>{formatRupees(total)}</Text>
        </View>
      )}

      {overflowing && (
        <View style={styles.warning}>
          <Ionicons name="warning-outline" size={16} color="#B26A00" />
          <Text style={styles.warningText}>
            More than {COMPACT_ITEM_THRESHOLD} items may not fit on one A5 page.
          </Text>
        </View>
      )}

      {editable && onAdd && (
        <TouchableOpacity style={styles.addButton} onPress={onAdd}>
          <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
          <Text style={styles.addText}>Add Item</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
    backgroundColor: "#F0F7FF",
    borderBottomWidth: 1,
    borderBottomColor: "#D0E4FF",
  },
  headerText: { fontSize: 16, fontWeight: "700", color: "#007AFF" },
  empty: { padding: 20, alignItems: "center" },
  emptyText: { fontSize: 14, color: "#999" },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F5",
  },
  serial: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F0F7FF",
    alignItems: "center",
    justifyContent: "center",
  },
  serialText: { fontSize: 12, fontWeight: "700", color: "#007AFF" },
  itemBody: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: "600", color: "#1A1A1A" },
  itemMeta: { fontSize: 12, color: "#666", marginTop: 2 },
  itemTotal: { fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  iconButton: { padding: 2 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F8F9FA",
  },
  totalLabel: { fontSize: 13, fontWeight: "700", color: "#1A1A1A" },
  totalValue: { fontSize: 17, fontWeight: "700", color: "#1976D2" },
  warning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFF8E1",
  },
  warningText: { flex: 1, fontSize: 12, color: "#B26A00" },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    backgroundColor: "#F0F7FF",
    borderTopWidth: 1,
    borderTopColor: "#D0E4FF",
  },
  addText: { fontSize: 15, fontWeight: "600", color: "#007AFF" },
});

export default LendenItemsTable;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/LendenItemsTable.tsx
git commit -m "feat: in-app Len-Den line items table"
```

---

### Task 11: Wire items into AddTransactionScreen

Items are held in local state before the `lenden` row exists, then written after `createLenden` returns an id — exactly how `jamaEntries` is already handled in this screen.

**Files:**
- Modify: `src/screen/AddTransactionScreen.tsx`

**Interfaces:**
- Consumes: `LendenItemsTable` (Task 10), `AddLendenItemModal` (Task 9), `replaceLendenItems` (Task 6), `sumItemTotals` / `isAmountOverridden` (Task 3), `NewLendenItem` (Task 5).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the imports**

After the existing `import AddJamaModal from "../components/AddJamaModal";` line:

```tsx
import LendenItemsTable from "../components/LendenItemsTable";
import AddLendenItemModal from "../components/AddLendenItemModal";
import { replaceLendenItems } from "../database/lendenItems";
import { sumItemTotals, isAmountOverridden } from "../utils/lendenAmount";
import { NewLendenItem } from "../types/entry";
```

- [ ] **Step 2: Add the item state**

After the `const [showAddJamaModal, setShowAddJamaModal] = useState(false);` line:

```tsx
  // Jewellery line items (Lenden only)
  const [lendenItems, setLendenItems] = useState<NewLendenItem[]>([]);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  // Set once the user types an amount that differs from the item sum.
  const [amountTouched, setAmountTouched] = useState(false);

  const itemsTotal = sumItemTotals(lendenItems);
```

- [ ] **Step 3: Auto-fill the amount from the items**

Add this effect next to the other hooks, before `requestPermissions`:

```tsx
  // Amount tracks the item sum until the user overrides it.
  React.useEffect(() => {
    if (entryType !== "lenden" || amountTouched) return;
    setAmount(lendenItems.length > 0 ? String(itemsTotal) : "");
  }, [itemsTotal, lendenItems.length, entryType, amountTouched]);
```

- [ ] **Step 4: Mark the amount input as user-edited**

Change the Amount `TextInput`'s `onChangeText` from:

```tsx
                onChangeText={(text) => setAmount(text.replace(/[^0-9]/g, ""))}
```

to:

```tsx
                onChangeText={(text) => {
                  setAmountTouched(true);
                  setAmount(text.replace(/[^0-9]/g, ""));
                }}
```

- [ ] **Step 5: Render the items section**

Inside the `{entryType === "lenden" && (<>...</>)}` fragment, immediately **before** the Discount `inputContainer`, insert:

```tsx
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.sectionTitle, { fontSize: 16, marginBottom: 12 }]}>
                  Jewellery Items
                </Text>
                <LendenItemsTable
                  items={lendenItems}
                  editable={true}
                  onAdd={() => {
                    setEditingItemIndex(null);
                    setShowItemModal(true);
                  }}
                  onEdit={(index) => {
                    setEditingItemIndex(index);
                    setShowItemModal(true);
                  }}
                  onDelete={(index) => {
                    setLendenItems((prev) => prev.filter((_, i) => i !== index));
                  }}
                />
              </View>
```

- [ ] **Step 6: Show the override marker under the amount**

Immediately after the Amount `amountInputWrapper` closing `</View>`, add:

```tsx
            {entryType === "lenden" && lendenItems.length > 0 && (
              <Text style={styles.amountHint}>
                {isAmountOverridden({ amount: parseInt(amount, 10) || 0 }, lendenItems)
                  ? `* Overridden — items total ₹${itemsTotal.toLocaleString()}`
                  : "Auto-calculated from items"}
              </Text>
            )}
```

- [ ] **Step 7: Add the hint style**

In `StyleSheet.create`, next to `label`:

```tsx
  amountHint: {
    fontSize: 12,
    color: "#999",
    marginTop: 6,
  },
```

- [ ] **Step 8: Persist the items on save**

In `handleSave`, inside the `else` (lenden) branch, replace the amount calculation line:

```tsx
        const lendenAmountVal = amount ? parseInt(amount, 10) : 0;
```

with:

```tsx
        const lendenAmountVal = amount ? parseInt(amount, 10) : 0;
        const overridden =
          lendenItems.length > 0 && lendenAmountVal !== itemsTotal ? 1 : 0;
```

then add `amountOverridden: overridden,` to the `createLenden({...})` object, and immediately after the `for (const entry of jamaEntries)` loop add:

```tsx
        if (lendenItems.length > 0) {
          await replaceLendenItems(lendenId, lendenItems);
        }
```

- [ ] **Step 9: Mount the item modal**

Next to the existing `<AddJamaModal ... />`:

```tsx
      <AddLendenItemModal
        visible={showItemModal}
        editMode={editingItemIndex !== null}
        initialItem={
          editingItemIndex !== null ? lendenItems[editingItemIndex] : undefined
        }
        onClose={() => {
          setShowItemModal(false);
          setEditingItemIndex(null);
        }}
        onSave={(item) => {
          setLendenItems((prev) => {
            if (editingItemIndex === null) return [...prev, item];
            return prev.map((existing, i) =>
              i === editingItemIndex ? item : existing,
            );
          });
        }}
      />
```

- [ ] **Step 10: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 11: Test on device**

Run the app, add a Len-Den entry, add two items at different rates.
Expected: Amount auto-fills to the item sum; typing a different amount shows the `*` overridden hint; saving and reopening the entry preserves both items.

- [ ] **Step 12: Commit**

```bash
git add src/screen/AddTransactionScreen.tsx
git commit -m "feat: jewellery items on the add transaction screen"
```

---

### Task 12: Wire items into TransactionDetailScreen

Adds the items section and the bill button to the existing detail screen.

**Files:**
- Modify: `src/screen/TransactionDetailScreen.tsx` (imports ~line 39; state ~line 100; `loadData` lenden branch ~line 190-225; `handleSaveChanges` ~line 310; render before the BillTable block ~line 722; actions ~line 1028)

**Interfaces:**
- Consumes: `LendenItemsTable` (Task 10), `AddLendenItemModal` (Task 9), `getLendenItems` / `replaceLendenItems` (Task 6), `NewLendenItem` (Task 5).
- Produces: navigation to `BillPreview` (Task 13).

- [ ] **Step 1: Add the imports**

After `import BillTable from "../components/BillTable";`:

```tsx
import LendenItemsTable from "../components/LendenItemsTable";
import AddLendenItemModal from "../components/AddLendenItemModal";
import {
  getLendenItems,
  replaceLendenItems,
  setLendenAmountOverridden,
} from "../database/lendenItems";
import { sumItemTotals } from "../utils/lendenAmount";
import { NewLendenItem } from "../types/entry";
```

- [ ] **Step 2: Add the item state**

Next to the `showAddJamaModal` state:

```tsx
  // Jewellery line items (Lenden only)
  const [lendenItems, setLendenItems] = useState<NewLendenItem[]>([]);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  // Mirrors amountOverridden: true once the stored amount diverges from the item sum.
  const [amountTouched, setAmountTouched] = useState(false);

  const itemsTotal = sumItemTotals(lendenItems);
```

- [ ] **Step 3: Load the items**

In `loadData`, inside the `lenden` branch right after `const entries = await getJamaEntriesByLendenId(transactionId);`:

```tsx
          const storedItems = await getLendenItems(transactionId);
          setLendenItems(
            storedItems.map((i) => ({
              name: i.name,
              purity: i.purity,
              weight: i.weight,
              rate: i.rate,
              total: i.total,
            })),
          );
          setAmountTouched(lendenData.amountOverridden === 1);
```

- [ ] **Step 4: Keep the amount in sync with the items**

Without this the amount never responds to items added in edit mode. Add the effect next to the existing Remaining and Baki effects — it must sit **before** them so the Remaining/Baki chain recalculates from the new amount:

```tsx
  // Amount tracks the item sum in edit mode until the user overrides it.
  useEffect(() => {
    if (transactionType !== "lenden" || !isEditMode) return;
    if (amountTouched) return;
    if (lendenItems.length === 0) return;
    setEditAmount(String(itemsTotal));
  }, [itemsTotal, lendenItems.length, transactionType, isEditMode, amountTouched]);
```

Then mark the Amount input as user-edited. Find the Amount `TextInput` in the `isEditMode && transactionType === "lenden"` branch and change its `onChangeText` to also call `setAmountTouched(true)` before `setEditAmount`.

- [ ] **Step 5: Persist the items and the override flag on save**

In `handleSaveChanges`, after the existing lenden update call, add:

```tsx
      if (transactionType === "lenden") {
        await replaceLendenItems(transactionId, lendenItems);
        const typedAmount = parseInt(editAmount, 10) || 0;
        await setLendenAmountOverridden(
          transactionId,
          lendenItems.length > 0 && typedAmount !== itemsTotal ? 1 : 0,
        );
      }
```

- [ ] **Step 6: Render the items section**

Immediately **before** the `{/* Jama Entries BillTable for Lenden */}` block:

```tsx
        {transactionType === "lenden" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Jewellery Items</Text>
            <LendenItemsTable
              items={lendenItems}
              editable={isEditMode}
              onAdd={() => {
                setEditingItemIndex(null);
                setShowItemModal(true);
              }}
              onEdit={(index) => {
                setEditingItemIndex(index);
                setShowItemModal(true);
              }}
              onDelete={(index) => {
                setLendenItems((prev) => prev.filter((_, i) => i !== index));
              }}
            />
          </View>
        )}
```

`styles.section` (line 1273) and `styles.sectionTitle` (line 1282) already exist in this file — reuse them, do not redefine.

- [ ] **Step 7: Add the bill button**

Next to the existing `{transactionType === "rehan" && rehan?.status === 0 && !isEditMode && (` action block:

```tsx
        {transactionType === "lenden" && !isEditMode && (
          <TouchableOpacity
            style={[
              styles.billButton,
              lendenItems.length === 0 && styles.billButtonDisabled,
            ]}
            onPress={() => navigation.navigate("BillPreview", { lendenId: transactionId })}
            disabled={lendenItems.length === 0}
          >
            <Ionicons name="receipt" size={20} color="#fff" />
            <Text style={styles.billButtonText}>बिल बनाएं / Generate Bill</Text>
          </TouchableOpacity>
        )}
```

- [ ] **Step 8: Add the button styles**

In `StyleSheet.create`:

```tsx
  billButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#B8860B",
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 14,
  },
  billButtonDisabled: { backgroundColor: "#D8C79A" },
  billButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
```

- [ ] **Step 9: Mount the item modal**

Next to the existing `<AddJamaModal ... />` in this screen:

```tsx
      <AddLendenItemModal
        visible={showItemModal}
        editMode={editingItemIndex !== null}
        initialItem={
          editingItemIndex !== null ? lendenItems[editingItemIndex] : undefined
        }
        onClose={() => {
          setShowItemModal(false);
          setEditingItemIndex(null);
        }}
        onSave={(item) => {
          setLendenItems((prev) => {
            if (editingItemIndex === null) return [...prev, item];
            return prev.map((existing, i) =>
              i === editingItemIndex ? item : existing,
            );
          });
        }}
      />
```

- [ ] **Step 10: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: one error — `BillPreview` route has no registered screen yet. That is expected and is fixed in Task 13. All other errors must be resolved now.

- [ ] **Step 11: Commit**

```bash
git add src/screen/TransactionDetailScreen.tsx
git commit -m "feat: jewellery items and bill button on the transaction detail screen"
```

---

### Task 13: Bill preview screen and navigation

Assembles everything: loads the entry, allocates the bill number, builds the HTML, previews it in a WebView, and shares or prints it.

**Files:**
- Create: `src/screen/BillPreviewScreen.tsx`
- Modify: `App.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1-8.
- Produces: the `BillPreview` screen registered on the navigator.

- [ ] **Step 1: Write the screen**

Create `src/screen/BillPreviewScreen.tsx`:

```tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  TextInput,
} from "react-native";
import { WebView } from "react-native-webview";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList, Lenden, User, JamaEntry } from "../types/entry";
import {
  getLendenById,
  getUserById,
  getJamaEntriesByLendenId,
} from "../database/entryDatabase";
import {
  getLendenItems,
  getNextBillNo,
  setLendenBillNo,
} from "../database/lendenItems";
import { buildBillHtml, BillData } from "../services/BillHtmlService";
import { loadTemplateDataUri, sharePdf, printBill } from "../services/BillService";
import { resolveEffectiveAmount } from "../utils/lendenAmount";

type Nav = NativeStackNavigationProp<RootStackParamList, "BillPreview">;
type Rt = RouteProp<RootStackParamList, "BillPreview">;

interface Props {
  navigation: Nav;
  route: Rt;
}

const BillPreviewScreen: React.FC<Props> = ({ route }) => {
  const { lendenId } = route.params;

  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [html, setHtml] = useState("");
  const [billNo, setBillNo] = useState(0);
  const [billNoText, setBillNoText] = useState("");
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [data, setData] = useState<BillData | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);

      const lenden: Lenden | null = await getLendenById(lendenId);
      if (!lenden) throw new Error("Entry not found");

      const user: User | null = await getUserById(lenden.userId);
      const items = await getLendenItems(lendenId);
      const jama: JamaEntry[] = await getJamaEntriesByLendenId(lendenId);

      // Allocate a bill number the first time this entry is billed, so a
      // reprint always shows the same number.
      let resolvedBillNo = lenden.billNo ?? null;
      if (!resolvedBillNo) {
        resolvedBillNo = await getNextBillNo();
        await setLendenBillNo(lendenId, resolvedBillNo);
      }

      const templateDataUri = await loadTemplateDataUri();
      const amount = resolveEffectiveAmount(lenden, items);

      const billData: BillData = {
        billNo: resolvedBillNo,
        date: lenden.date,
        customer: {
          name: user?.name ?? "",
          address: user?.address ?? null,
          mobile: user?.mobileNumber ?? null,
        },
        items,
        amount,
        discount: lenden.discount ?? 0,
        jamaEntries: jama.map((j) => ({ amount: j.amount, date: j.date })),
        baki: lenden.baki ?? 0,
        showPaymentDetails: false,
        templateDataUri,
      };

      setBillNo(resolvedBillNo);
      setBillNoText(String(resolvedBillNo));
      setData(billData);
    } catch (error) {
      console.error("Error loading bill:", error);
      Alert.alert("Error", "Could not load this bill.");
    } finally {
      setIsLoading(false);
    }
  }, [lendenId]);

  useEffect(() => {
    load();
  }, [load]);

  // Rebuild the HTML whenever the toggle or the bill number changes.
  useEffect(() => {
    if (!data) return;
    setHtml(buildBillHtml({ ...data, showPaymentDetails, billNo }));
  }, [data, showPaymentDetails, billNo]);

  const commitBillNo = async () => {
    const parsed = parseInt(billNoText, 10);
    if (!parsed || parsed === billNo) {
      setBillNoText(String(billNo));
      return;
    }
    await setLendenBillNo(lendenId, parsed);
    setBillNo(parsed);
  };

  const handleShare = async () => {
    try {
      setIsBusy(true);
      await sharePdf(html, billNo);
    } catch (error) {
      console.error("Share failed:", error);
      Alert.alert("Error", "Could not create the PDF.");
    } finally {
      setIsBusy(false);
    }
  };

  const handlePrint = async () => {
    try {
      setIsBusy(true);
      await printBill(html);
    } catch (error) {
      console.error("Print failed:", error);
      Alert.alert("Error", "Could not open the print dialog.");
    } finally {
      setIsBusy(false);
    }
  };

  if (isLoading || !html) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>बिल नं.</Text>
          <TextInput
            style={styles.billNoInput}
            value={billNoText}
            onChangeText={(t) => setBillNoText(t.replace(/[^0-9]/g, ""))}
            onBlur={commitBillNo}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>भुगतान विवरण</Text>
          <Switch value={showPaymentDetails} onValueChange={setShowPaymentDetails} />
        </View>
      </View>

      <WebView
        style={styles.webview}
        originWhitelist={["*"]}
        source={{ html }}
        scalesPageToFit={true}
      />

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.action, styles.shareAction, isBusy && styles.actionDisabled]}
          onPress={handleShare}
          disabled={isBusy}
        >
          <Ionicons name="share-social" size={20} color="#fff" />
          <Text style={styles.actionText}>शेयर करें</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.action, styles.printAction, isBusy && styles.actionDisabled]}
          onPress={handlePrint}
          disabled={isBusy}
        >
          <Ionicons name="print" size={20} color="#fff" />
          <Text style={styles.actionText}>प्रिंट करें</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  controlRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  controlLabel: { fontSize: 14, fontWeight: "600", color: "#666" },
  billNoInput: {
    minWidth: 70,
    backgroundColor: "#F0F7FF",
    borderWidth: 1,
    borderColor: "#D0E4FF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  webview: { flex: 1, backgroundColor: "#EDEDED" },
  actions: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  shareAction: { backgroundColor: "#25A244" },
  printAction: { backgroundColor: "#B8860B" },
  actionDisabled: { opacity: 0.5 },
  actionText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

export default BillPreviewScreen;
```

- [ ] **Step 2: Register the route in `App.tsx`**

Add the import next to the other screen imports:

```tsx
import BillPreviewScreen from "./src/screen/BillPreviewScreen";
```

and the screen after the `TransactionDetail` entry:

```tsx
          <Stack.Screen
            name="BillPreview"
            component={BillPreviewScreen}
            options={{ title: "बिल" }}
          />
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors, including the `BillPreview` error left over from Task 12.

- [ ] **Step 4: Run the whole test suite**

Run: `npm test`
Expected: 4 suites pass.

- [ ] **Step 5: Test on device**

Open a Len-Den entry with items, tap **बिल बनाएं**.
Expected: the bill renders in the WebView with the Asha header and footer visible, the item table populated, and the amount in Hindi words.

- [ ] **Step 6: Commit**

```bash
git add src/screen/BillPreviewScreen.tsx App.tsx
git commit -m "feat: A5 bill preview screen with share and print"
```

---

### Task 14: Calibration and end-to-end verification

The two crop fractions were read off the reference image by eye. This task corrects them against a real render and works the spec's verification checklist.

**Files:**
- Modify: `src/services/BillHtmlService.ts` (`HEADER_CROP_PCT`, `FOOTER_CROP_PCT` only)

**Interfaces:**
- Consumes: everything.
- Produces: a calibrated, verified bill.

- [ ] **Step 1: Render and inspect the seams**

Open a bill preview on the device and look at the two joins.

- If the header band **cuts into the invoice box** printed on the template, *decrease* `HEADER_CROP_PCT`.
- If a **strip of the printed invoice box** appears below the address strip, *increase* it.
- If the footer band **swallows the Signature line**, *decrease* `FOOTER_CROP_PCT`; if a slice of the printed table shows above the ornament, *increase* it.

Adjust in steps of 0.005 and reload. Every other dimension is derived, so these two numbers are the only ones to touch.

- [ ] **Step 2: Confirm the gold frame lines up**

The `.middle` left and right borders must meet the template's gold side rules with no visible jog. If they sit slightly inboard or outboard, adjust the `.middle` `border-left` / `border-right` width or the `padding` horizontal value in `BillHtmlService.ts`.

- [ ] **Step 3: Verify Devanagari survives the PDF**

Share a bill as PDF, transfer it to a desktop, and open it.

Expected: all Hindi text renders as text, not boxes.

If it fails, download a Noto Sans Devanagari `woff2` subset, base64 it, and inline it as an `@font-face` in the `<style>` block of `buildBillHtml`, then set `font-family` to that face. This is the documented fallback in spec §5.6.

- [ ] **Step 4: Work the verification checklist**

From spec §8.1 (see also Task 5 Step 10):

1. Fresh install (clear app data) — database initialises with no error.
2. Upgrade over existing data — **historical Len-Den amounts unchanged**.
3. One item — amount auto-fills.
4. Second item at a different rate — amount updates; the summary omits `दर प्रति ग्राम`.
5. Override the amount — `*` appears; reopen and confirm it persisted.
6. Header and footer seams correct (Steps 1-2).
7. Toggle payment details — छूट / जमा / बाकी appear and disappear.
8. Share to WhatsApp; open on desktop (Step 3).
9. Print — A5 paper, nothing clipped at the margins.
10. Reprint — the bill number is unchanged.

- [ ] **Step 5: Run the full suite one last time**

Run: `npm test && npx tsc --noEmit`
Expected: 4 suites pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/services/BillHtmlService.ts
git commit -m "fix: calibrate bill template crop fractions against real render"
```

---

## Verification

The feature is done when:

- `npm test` passes all 4 suites (`hindiNumberWords`, `billFormat`, `lendenAmount`, `BillHtmlService`).
- `npx tsc --noEmit` reports no errors.
- Every item in the Task 14 Step 4 checklist passes on a real device.
- A shared PDF opens on a desktop with Devanagari rendering correctly.

## Notes for the executor

- **Task 4 is a hard gate.** It requires an EAS build and a manual APK install. Nothing from Task 8 onwards can be tested on device until that build is running.
- **Task 5 Step 10 is the highest-risk moment in the plan.** If historical amounts show ₹0, stop. The backfill in Step 6 or the guards in Task 3 are wrong.
- Tasks 1, 2, 3 and 7 are pure and need no device at all — they can be completed and verified entirely from the terminal.

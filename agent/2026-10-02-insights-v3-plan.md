# Insights Report (Analytics v3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the owner's "Rehan & Lenden Insights" report inside the app's Analytics screen on live data: Overview (key findings), Rehan book, Items, Customers & Villages, Billing, Together and Data quality.

**Architecture:** One builder turns raw rows into enriched pledge rows (principal, item type, village, photo, ages) and another into bill rows (collected, pending, flags). Pure, Jest-tested modules under `src/utils/analytics/report/` compute every card from those rows; the screen applies the report's filters and renders the cards. The v2 dashboard (time frames, ▲▼ comparisons, metal, trends) moves inside the Billing tab unchanged.

**Tech Stack:** React Native 0.81 + Expo 54, expo-sqlite, TypeScript 5.9, Jest 29 + ts-jest (node env, `src/**/*.test.ts` only).

**Spec:** `agent/2026-10-02-analytics-design.md` §12 (and §4, §10 for the v2 pieces reused in Billing).

## Global Constraints

- No new dependencies; no native rebuild (OTA via expo-updates). Charts stay plain React Native views.
- All dates are handled in **device local time**; never slice UTC ISO strings.
- Principal = `principalOf` (amount lent); Open book = Σ principal of open pledges (status 0).
- Item type = first recognised keyword (spec §12.4 table); none → `Other`; blank or numbers only → `Unspecified`. Bundle = two or more different item types named.
- Village = text before the first comma, punctuation removed, spaces collapsed, case-insensitive; blank → `Unknown`; fewer than **5** customers → `Other villages`.
- Billing: Net = `remaining` (fallback gross − discount); **Collected = net − baki**; Pending = baki on open bills; Received = Σ jama_entries, else legacy `lenden.jama`.
- Bill flags (exact labels): `Customer not on file`, `Received field blank`, `Received field short` (red); `Amount overridden`, `No bill number` (grey).
- Finding tags: `Risk`, `Watch`, `Upside`, `Data`. Quality tags: `Fix`, `Check`, `Note`, `Good`.
- Data quality runs on the whole ledger, ignoring filters.
- Money is integer rupees; never show NaN — empty data gives zeros, "—" or an empty-state line.
- Commits: plain messages, **no Co-Authored-By or any attribution/trailer lines** (owner's instruction).

## Review Focus

1. A pledge whose customer was deleted (userId not in `users`) must still count, as village `Unknown` and `onFile: false`, never crash a lookup → fixture pledge 8 / bill 2 (Tasks 1, 4, 5).
2. A rehan balance that was topped up with diya must show its original principal, not the running balance → fixture pledge 4 (Task 1).
3. `media` that is empty, `"[]"` or not valid JSON must read as "no photo", never throw → `hasPhoto` test (Task 1).
4. A Hindi or otherwise non-Latin item name must fall to `Other`, not `Unspecified` → `itemTypeOf` test (Task 1).
5. Filters that select nothing (e.g. a village with no pledges) must render zeros and empty states, not NaN → empty-rows tests in Tasks 2–5.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/utils/analytics/types.ts` (modify) | optional fields: `UserRow.mobileNumber/createdAt`, `RehanRow.productName/media`, `LendenRow.billNo/amountOverridden/media/remaining` |
| `src/database/analyticsQueries.ts` (modify) | select those columns |
| `src/utils/analytics/villages.ts` (modify) | punctuation-stripping `villageName`, `groupVillages` |
| `src/utils/analytics/report/items.ts` | keyword rules: `itemTypeOf`, `itemTypesIn`, `isBundle` |
| `src/utils/analytics/report/pledges.ts` | `PledgeRow`, `buildPledgeRows`, `filterPledges`, `filterOptions`, `hasPhoto` |
| `src/utils/analytics/report/fixture.ts` | shared test ledger (not a test file) |
| `src/utils/analytics/report/pledgeBook.ts` | headline stats, monthly book, buckets, cohorts, weekdays, interest, logging gap |
| `src/utils/analytics/report/itemsView.ts` | item stats, ranking, quarter mix, bundles |
| `src/utils/analytics/report/pledgeCustomers.ts` | villages, concentration, exposures, repeat, customers added, segments |
| `src/utils/analytics/report/billing.ts` | `BillRow`, flags, summary, waterfall, discounts, numbered vs earlier |
| `src/utils/analytics/report/together.ts` | ledger scale, village shares |
| `src/utils/analytics/report/quality.ts` | data quality checks + field coverage |
| `src/utils/analytics/report/findings.ts` | key findings |
| `src/components/analytics/BarChart.tsx` (modify) | `labelEvery` prop |
| `src/components/analytics/report/*.tsx` | shared UI (card, bars, table, segmented, tag, filter bar) and one component per tab |
| `src/screen/AnalyticsScreen.tsx` (rewrite) | 7 tabs, filters, Billing sub-tabs reusing v2 sections |

---

### Task 1: Data plumbing — row types, items, villages, pledge rows

**Files:**
- Modify: `src/utils/analytics/types.ts`, `src/database/analyticsQueries.ts`, `src/utils/analytics/villages.ts`
- Create: `src/utils/analytics/report/items.ts`, `src/utils/analytics/report/pledges.ts`, `src/utils/analytics/report/fixture.ts`
- Test: `src/utils/analytics/report/items.test.ts`, `src/utils/analytics/report/pledges.test.ts`, `src/utils/analytics/villages.test.ts` (append)

**Interfaces:**
- Produces: `itemTypeOf(name)`, `itemTypesIn(name)`, `isBundle(name)`, `OTHER_ITEM`, `UNSPECIFIED_ITEM`; `groupVillages(users): VillageGroups {of: Map<number,string>; customers: Map<string,number>; order: string[]}`, `villageOfUser(groups, userId)`, `OTHER_VILLAGES`, `UNKNOWN_VILLAGE`, `MIN_VILLAGE_CUSTOMERS`; `PledgeRow`, `PledgeFilters`, `ALL_PLEDGES`, `buildPledgeRows(data, now?, groups?)`, `filterPledges(rows, filters, ignore?)`, `filterOptions(rows, groups)`, `hasPhoto(media)`; fixture `NOW`, `iso`, `fixtureData`.

- [ ] **Step 1: Types and query.** In `src/utils/analytics/types.ts` add optional fields (keep every existing field):

```ts
export interface UserRow {
  id: number;
  name: string;
  address?: string | null;
  mobileNumber?: string | null;
  createdAt?: string | null;
}
```
`RehanRow` gains `productName?: string | null;` and `media?: string | null; // JSON array of image paths`.
`LendenRow` gains `remaining?: number | null; // net payable`, `billNo?: number | null;`, `amountOverridden?: number | null;`, `media?: string | null;`.

In `src/database/analyticsQueries.ts` change three queries:
```ts
    users: await database.getAllAsync<UserRow>(
      "SELECT id, name, address, mobileNumber, createdAt FROM users",
    ),
    lenden: await database.getAllAsync<LendenRow>(
      "SELECT id, userId, date, amount, discount, remaining, jama, baki, status, billNo, amountOverridden, media FROM lenden",
    ),
    rehan: await database.getAllAsync<RehanRow>(
      "SELECT id, userId, openDate, closedDate, status, amount, productName, media FROM rehan",
    ),
```
(Keep the exact layout style of the file; only the SQL strings change.)

- [ ] **Step 2: Shared fixture** — create `src/utils/analytics/report/fixture.ts`:

```ts
// Shared test ledger for the report modules (spec §12). Not a test file.
// Dates are local noon so local-time bucketing is exercised in any time zone.
import { AnalyticsData, LendenRow, RehanRow, UserRow } from "../types";

export const iso = (y: number, m: number, d: number): string =>
  new Date(y, m - 1, d, 12).toISOString();

export const NOW = new Date(2026, 9, 2, 12); // 2 Oct 2026

const user = (
  id: number,
  name: string,
  address: string,
  createdAt: string,
  mobileNumber: string | null = null,
): UserRow => ({ id, name, address, mobileNumber, createdAt });

const pledge = (
  id: number,
  userId: number,
  openDate: string,
  amount: number,
  productName: string,
  o: Partial<RehanRow> = {},
): RehanRow => ({
  id, userId, openDate, closedDate: null, status: 0, amount, productName, media: "[]", ...o,
});

const bill = (id: number, userId: number, date: string, amount: number, o: Partial<LendenRow> = {}): LendenRow => ({
  id, userId, date, amount, discount: null, remaining: amount, jama: null, baki: 0, status: 1,
  billNo: null, amountOverridden: 0, media: "[]", ...o,
});

export const fixtureData: AnalyticsData = {
  users: [
    user(1, "Ram", "Manwal .", iso(2025, 12, 28)),
    user(2, "Shyam", "manwal", iso(2026, 1, 5), "9999999999"),
    user(3, "Gita", "Kanja, Jaunpur", iso(2026, 1, 5)),
    user(4, "Sita", "Kanja", iso(2026, 1, 5)),
    user(5, "Mohan", "Kanja", iso(2026, 1, 5)),
    user(6, "Sohan", "Kanja", iso(2026, 1, 5)),
    user(7, "Rita", "Kanja", iso(2026, 1, 5)),
    user(8, "Lata", "Manwal", iso(2026, 1, 5)),
    user(9, "Hari", "Manwal", iso(2026, 1, 5)),
    user(10, "Ravi", "Manwal", iso(2026, 1, 5)),
    user(11, "Ramu", "Bhatewra", iso(2026, 1, 5)),
    user(12, "Ram", "manwal", iso(2026, 2, 1)),
    user(13, "Kavi", "", iso(2026, 3, 1)),
  ],
  rehan: [
    pledge(1, 1, iso(2024, 9, 1), 10000, "Hk Payal", { media: '["a.jpg"]' }),
    pledge(2, 1, iso(2025, 6, 10), 5000, "Chain 7.900"),
    pledge(3, 2, iso(2025, 10, 2), 8000, "Locket payal", { status: 1, closedDate: iso(2026, 3, 31) }),
    pledge(4, 3, iso(2026, 1, 10), 25000, "Krdhn hath mehndi"), // 5000 diya on top of 20000 lent
    pledge(5, 4, iso(2026, 1, 10), 3000, "Tika", { status: 1, closedDate: iso(2026, 7, 10) }),
    pledge(6, 11, iso(2026, 8, 5), 50000, "Desi chain"),
    pledge(7, 13, iso(2026, 9, 20), 2000, "3.800"),
    pledge(8, 99, iso(2026, 9, 25), 1000, "Mina 6"), // customer 99 is not on file
    pledge(9, 1, iso(2026, 9, 28), 0, "Payal"),
  ],
  rehanTx: [{ rehanId: 4, type: "diya", amount: 5000, date: iso(2026, 2, 1) }],
  lenden: [
    bill(1, 3, iso(2026, 9, 8), 10000, { discount: 500, remaining: 9500, baki: 9500, status: 0, billNo: 1 }),
    bill(2, 99, iso(2026, 9, 8), 43500, { discount: 1000, remaining: 42500, baki: 42500, status: 0, billNo: 2 }),
    bill(3, 5, iso(2026, 9, 25), 44545, { baki: 2045, status: 0, billNo: 3 }),
    bill(4, 6, iso(2026, 9, 30), 8200, { jama: 8000, billNo: 6 }),
    bill(5, 7, iso(2026, 1, 7), 16000, {
      discount: 500, remaining: 15500, baki: 7000, status: 0, amountOverridden: 1, media: '["x.jpg"]',
    }),
    bill(6, 8, iso(2025, 12, 29), 20300, { discount: 800, remaining: 19500, jama: 10000, amountOverridden: 1 }),
  ],
  jama: [{ lendenId: 3, amount: 42500, date: iso(2026, 9, 25) }],
  soldItems: [],
  oldItems: [],
};
```

- [ ] **Step 3: Failing tests.** `src/utils/analytics/report/items.test.ts`:

```ts
import { isBundle, itemTypeOf, itemTypesIn } from "./items";

describe("itemTypeOf", () => {
  it("takes the first recognised item word", () => {
    expect(itemTypeOf("Hk Payal")).toBe("Payal");
    expect(itemTypeOf("Krdhn hath mehndi")).toBe("Kardhan");
    expect(itemTypeOf("Top locket")).toBe("Tops");
    expect(itemTypeOf("Nthiya sahara")).toBe("Nathiya / Nathuni");
    expect(itemTypeOf("B kada  dana")).toBe("Kada");
    expect(itemTypeOf("Chabhi mala")).toBe("Guchha");
    expect(itemTypeOf("Har")).toBe("Haar");
    expect(itemTypeOf("Baal choti")).toBe("Bal choti");
  });

  it("uses Other for unrecognised names and Unspecified for blank or numbers", () => {
    expect(itemTypeOf("1 lar")).toBe("Other");
    expect(itemTypeOf("मांगटीका")).toBe("Other");
    expect(itemTypeOf("3.800")).toBe("Unspecified");
    expect(itemTypeOf("")).toBe("Unspecified");
    expect(itemTypeOf(null)).toBe("Unspecified");
    expect(itemTypeOf(undefined)).toBe("Unspecified");
  });
});

describe("bundles", () => {
  it("lists each item type once, in order", () => {
    expect(itemTypesIn("Locket half kardhan")).toEqual(["Locket", "Kardhan"]);
    expect(itemTypesIn("Payal payal")).toEqual(["Payal"]);
  });

  it("is a bundle when two or more item types are named", () => {
    expect(isBundle("Locket payal")).toBe(true);
    expect(isBundle("Jhala payal")).toBe(true);
    expect(isBundle("Payal 48 gm")).toBe(false);
    expect(isBundle(null)).toBe(false);
  });
});
```

Append to `src/utils/analytics/villages.test.ts` (add `groupVillages, villageName` to its import from `./villages`, and import `fixtureData` from `./report/fixture`):

```ts
describe("village cleaning and grouping (spec §12.5)", () => {
  it("drops punctuation", () => {
    expect(villageName("Manwal .")).toBe("Manwal");
    expect(villageName("Manwal, Jaunpur")).toBe("Manwal");
    expect(villageName("Kanja-")).toBe("Kanja");
  });

  it("groups small villages and blank addresses", () => {
    const groups = groupVillages(fixtureData.users);
    expect(groups.of.get(1)).toBe("Manwal");
    expect(groups.of.get(12)).toBe("Manwal");
    expect(groups.of.get(3)).toBe("Kanja");
    expect(groups.of.get(11)).toBe("Other villages");
    expect(groups.of.get(13)).toBe("Unknown");
    expect(groups.customers.get("Manwal")).toBe(6);
    expect(groups.customers.get("Kanja")).toBe(5);
    expect(groups.order).toEqual(["Manwal", "Kanja", "Other villages", "Unknown"]);
  });
});
```

`src/utils/analytics/report/pledges.test.ts`:

```ts
import { ALL_PLEDGES, buildPledgeRows, filterOptions, filterPledges, hasPhoto } from "./pledges";
import { NOW, fixtureData } from "./fixture";
import { groupVillages } from "../villages";

const rows = buildPledgeRows(fixtureData, NOW);
const byId = (id: number) => rows.find((r) => r.id === id)!;
const ids = (list: { id: number }[]) => list.map((r) => r.id);

describe("hasPhoto", () => {
  it("reads only a non-empty JSON array as a photo", () => {
    expect(hasPhoto('["a.jpg"]')).toBe(true);
    expect(hasPhoto("[]")).toBe(false);
    expect(hasPhoto("")).toBe(false);
    expect(hasPhoto(null)).toBe(false);
    expect(hasPhoto("not json")).toBe(false);
  });
});

describe("buildPledgeRows", () => {
  it("enriches each pledge", () => {
    expect(byId(1)).toMatchObject({
      item: "Payal", photo: true, principal: 10000, balance: 10000, open: true,
      daysOpen: 761, daysToRedeem: null, village: "Manwal", onFile: true,
      year: "2024", month: "2024-09", weekday: 0,
    });
  });

  it("uses the amount lent, not the topped-up balance", () => {
    expect(byId(4)).toMatchObject({ principal: 20000, balance: 25000, item: "Kardhan", village: "Kanja", daysOpen: 265 });
  });

  it("measures redeemed pledges and spots bundles", () => {
    expect(byId(3)).toMatchObject({ open: false, daysOpen: null, daysToRedeem: 180, bundle: true, item: "Locket" });
  });

  it("keeps pledges whose customer is missing", () => {
    expect(byId(8)).toMatchObject({ onFile: false, village: "Unknown", item: "Other" });
    expect(byId(7)).toMatchObject({ item: "Unspecified", village: "Unknown" });
    expect(byId(6).village).toBe("Other villages");
  });
});

describe("filterPledges", () => {
  it("applies each filter", () => {
    expect(ids(filterPledges(rows, ALL_PLEDGES))).toHaveLength(9);
    expect(ids(filterPledges(rows, { ...ALL_PLEDGES, village: "Manwal" }))).toEqual([1, 2, 3, 9]);
    expect(ids(filterPledges(rows, { ...ALL_PLEDGES, item: "Chain" }))).toEqual([2, 6]);
    expect(ids(filterPledges(rows, { ...ALL_PLEDGES, year: "2025" }))).toEqual([2, 3]);
    expect(ids(filterPledges(rows, { ...ALL_PLEDGES, status: "redeemed" }))).toEqual([3, 5]);
    expect(ids(filterPledges(rows, { ...ALL_PLEDGES, status: "open" }))).toEqual([1, 2, 4, 6, 7, 8, 9]);
  });

  it("can ignore one dimension so a ranking compares against the rest", () => {
    const f = { ...ALL_PLEDGES, village: "Manwal", item: "Payal" };
    expect(ids(filterPledges(rows, f))).toEqual([1, 9]);
    expect(ids(filterPledges(rows, f, "village"))).toEqual([1, 9]);
    expect(ids(filterPledges(rows, f, "item"))).toEqual([1, 2, 3, 9]);
  });

  it("returns nothing, not an error, for an empty selection", () => {
    expect(filterPledges(rows, { ...ALL_PLEDGES, village: "Nowhere" })).toEqual([]);
  });
});

describe("filterOptions", () => {
  it("lists villages, items by principal and years", () => {
    expect(filterOptions(rows, groupVillages(fixtureData.users))).toEqual({
      villages: ["Manwal", "Kanja", "Other villages", "Unknown"],
      items: ["Chain", "Kardhan", "Payal", "Locket", "Tika", "Unspecified", "Other"],
      years: ["2024", "2025", "2026"],
    });
  });
});
```

- [ ] **Step 4: Run** `npx jest src/utils/analytics/report src/utils/analytics/villages` → FAIL (modules / exports missing).

- [ ] **Step 5: Implement** — `src/utils/analytics/report/items.ts`:

```ts
// Pledge item types by keyword (spec §12.4). Item names are typed freely, so the
// first recognised word decides the type; words that match nothing are skipped.

export const OTHER_ITEM = "Other";
export const UNSPECIFIED_ITEM = "Unspecified";

const KEYWORDS: Record<string, string[]> = {
  Payal: ["payal", "paayal"],
  Locket: ["locket", "loket"],
  Bunda: ["bunda"],
  Anguthi: ["anguthi", "angoothi", "angothi", "ring"],
  Chain: ["chain"],
  Kardhan: ["kardhan", "kardhani", "krdhn", "krdhan"],
  Chhagal: ["chhagal", "chagal"],
  Jhala: ["jhala"],
  Tika: ["tika", "tikka"],
  Kil: ["kil", "keel"],
  Jhumka: ["jhumka", "jhumki"],
  "Nathiya / Nathuni": ["nathiya", "nthiya", "nathuni", "nath"],
  Toda: ["toda"],
  Tops: ["tops", "top"],
  Bali: ["bali"],
  Mangalsutra: ["mangalsutra"],
  "Hath mehndi": ["hath", "mehndi"],
  Sikdi: ["sikdi"],
  Haar: ["haar", "har"],
  Kundal: ["kundal"],
  Kada: ["kada", "bracelet"],
  Guchha: ["guchha", "chabhi"],
  Jantar: ["jantar"],
  "Bal choti": ["bal", "baal", "choti"],
  Latkan: ["latkan"],
  Chudi: ["chudi", "choodi"],
  Peti: ["peti"],
  Hasuli: ["hasuli", "hansuli"],
};

const TYPE_OF_WORD = new Map<string, string>();
for (const [type, words] of Object.entries(KEYWORDS)) {
  for (const word of words) TYPE_OF_WORD.set(word, type);
}

// Digits, spaces and ASCII punctuation: a name made only of these names no item.
const NOT_A_NAME = /[0-9\s.,;:!?'"()[\]{}/\\|_*#@&+=~`^-]/g;

/** Distinct item types named, in the order they appear. */
export const itemTypesIn = (name: string | null | undefined): string[] => {
  const types: string[] = [];
  for (const word of (name ?? "").toLowerCase().split(/[^a-z]+/)) {
    const type = TYPE_OF_WORD.get(word);
    if (type && !types.includes(type)) types.push(type);
  }
  return types;
};

export const itemTypeOf = (name: string | null | undefined): string => {
  if ((name ?? "").replace(NOT_A_NAME, "") === "") return UNSPECIFIED_ITEM;
  return itemTypesIn(name)[0] ?? OTHER_ITEM;
};

export const isBundle = (name: string | null | undefined): boolean => itemTypesIn(name).length >= 2;
```

In `src/utils/analytics/villages.ts` replace `villageName` and add grouping (keep `villageKey`, `villageLabel`, `buildVillageView` as they are):

```ts
// ASCII punctuation and the Devanagari danda; "Manwal ." and "Manwal" are one village.
const PUNCTUATION = /[.,;:!?'"()[\]{}/\\|_*#@&+=~`^\-।]/g;

/** The text before the first comma, punctuation removed and spacing collapsed. */
export const villageName = (address: string | null | undefined): string =>
  (address ?? "").split(",")[0].replace(PUNCTUATION, " ").replace(/\s+/g, " ").trim();
```

and append:

```ts
export const OTHER_VILLAGES = "Other villages";
export const UNKNOWN_VILLAGE = "Unknown";
export const MIN_VILLAGE_CUSTOMERS = 5;

export interface VillageGroups {
  of: Map<number, string>; // userId → grouped village
  customers: Map<string, number>; // grouped village → customers on file
  order: string[]; // named villages by customers, then Other villages, then Unknown
}

const mostCommon = (counts: Map<string, number>): string => {
  let best = "";
  let bestCount = 0;
  for (const [spelling, count] of counts) {
    if (count > bestCount) {
      best = spelling;
      bestCount = count;
    }
  }
  return best;
};

/** Spec §12.5: villages with fewer than 5 customers become "Other villages"; blank is "Unknown". */
export const groupVillages = (users: UserRow[]): VillageGroups => {
  const byKey = new Map<string, { ids: number[]; spellings: Map<string, number> }>();
  for (const user of users) {
    const name = villageName(user.address);
    const key = name.toLowerCase();
    const group = byKey.get(key) ?? { ids: [], spellings: new Map<string, number>() };
    group.ids.push(user.id);
    group.spellings.set(name, (group.spellings.get(name) ?? 0) + 1);
    byKey.set(key, group);
  }

  const of = new Map<number, string>();
  const customers = new Map<string, number>();
  const named: { name: string; count: number }[] = [];
  for (const [key, group] of byKey) {
    let village: string;
    if (key === "") village = UNKNOWN_VILLAGE;
    else if (group.ids.length < MIN_VILLAGE_CUSTOMERS) village = OTHER_VILLAGES;
    else {
      village = mostCommon(group.spellings);
      named.push({ name: village, count: group.ids.length });
    }
    group.ids.forEach((id) => of.set(id, village));
    customers.set(village, (customers.get(village) ?? 0) + group.ids.length);
  }
  named.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const order = [
    ...named.map((n) => n.name),
    ...[OTHER_VILLAGES, UNKNOWN_VILLAGE].filter((v) => customers.has(v)),
  ];
  return { of, customers, order };
};

/** A customer's grouped village; Unknown when the customer is not on file. */
export const villageOfUser = (groups: VillageGroups, userId: number): string =>
  groups.of.get(userId) ?? UNKNOWN_VILLAGE;
```
(Import `UserRow` from `./types` at the top of `villages.ts`.)

`src/utils/analytics/report/pledges.ts`:

```ts
import { AnalyticsData, RehanTxRow } from "../types";
import { daysBetween } from "../periods";
import { principalOf } from "../rehan";
import { VillageGroups, UNKNOWN_VILLAGE, groupVillages, villageOfUser } from "../villages";
import { isBundle, itemTypeOf } from "./items";

/** One rehan entry, enriched for the report (spec §12.2). */
export interface PledgeRow {
  id: number;
  userId: number;
  openDate: string;
  closedDate: string | null;
  open: boolean;
  principal: number; // amount lent
  balance: number; // current running balance
  name: string; // product name as typed
  item: string; // item type
  bundle: boolean;
  village: string;
  onFile: boolean; // customer exists in users
  photo: boolean;
  daysOpen: number | null; // open pledges only
  daysToRedeem: number | null; // redeemed pledges only
  year: string; // year opened, e.g. "2026"
  month: string; // month opened, e.g. "2026-01"
  weekday: number; // day opened, 0 = Sunday
}

export interface PledgeFilters {
  village: string; // "all" or a grouped village
  item: string; // "all" or an item type
  year: string; // "all" or "2026"
  status: "all" | "open" | "redeemed";
}

export const ALL_PLEDGES: PledgeFilters = { village: "all", item: "all", year: "all", status: "all" };

/** A non-empty JSON array of image paths; anything else (empty, "[]", bad JSON) is no photo. */
export const hasPhoto = (media: string | null | undefined): boolean => {
  if (!media) return false;
  try {
    const value = JSON.parse(media);
    return Array.isArray(value) && value.length > 0;
  } catch {
    return false;
  }
};

const pad = (n: number) => String(n).padStart(2, "0");

export const buildPledgeRows = (
  data: AnalyticsData,
  now: Date = new Date(),
  groups: VillageGroups = groupVillages(data.users),
): PledgeRow[] => {
  const onFile = new Set(data.users.map((u) => u.id));
  const txByRehan = new Map<number, RehanTxRow[]>();
  for (const tx of data.rehanTx) {
    const list = txByRehan.get(tx.rehanId) ?? [];
    list.push(tx);
    txByRehan.set(tx.rehanId, list);
  }
  const nowIso = now.toISOString();
  return data.rehan.map((r) => {
    const opened = new Date(r.openDate);
    const open = (r.status ?? 0) === 0;
    return {
      id: r.id,
      userId: r.userId,
      openDate: r.openDate,
      closedDate: r.closedDate,
      open,
      principal: principalOf(r, txByRehan.get(r.id) ?? []),
      balance: r.amount ?? 0,
      name: r.productName ?? "",
      item: itemTypeOf(r.productName),
      bundle: isBundle(r.productName),
      village: onFile.has(r.userId) ? villageOfUser(groups, r.userId) : UNKNOWN_VILLAGE,
      onFile: onFile.has(r.userId),
      photo: hasPhoto(r.media),
      daysOpen: open ? Math.max(0, daysBetween(r.openDate, nowIso)) : null,
      daysToRedeem: !open && r.closedDate ? daysBetween(r.openDate, r.closedDate) : null,
      year: String(opened.getFullYear()),
      month: `${opened.getFullYear()}-${pad(opened.getMonth() + 1)}`,
      weekday: opened.getDay(),
    };
  });
};

/** Applies the report filters; `ignore` drops one dimension (for rankings). */
export const filterPledges = (
  rows: PledgeRow[],
  f: PledgeFilters,
  ignore?: "village" | "item",
): PledgeRow[] =>
  rows.filter(
    (r) =>
      (ignore === "village" || f.village === "all" || r.village === f.village) &&
      (ignore === "item" || f.item === "all" || r.item === f.item) &&
      (f.year === "all" || r.year === f.year) &&
      (f.status === "all" || (f.status === "open") === r.open),
  );

export const filterOptions = (rows: PledgeRow[], groups: VillageGroups) => {
  const principalByItem = new Map<string, number>();
  for (const r of rows) principalByItem.set(r.item, (principalByItem.get(r.item) ?? 0) + r.principal);
  const villages = [...groups.order];
  if (rows.some((r) => r.village === UNKNOWN_VILLAGE) && !villages.includes(UNKNOWN_VILLAGE)) {
    villages.push(UNKNOWN_VILLAGE);
  }
  return {
    villages,
    items: [...principalByItem]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([item]) => item),
    years: [...new Set(rows.map((r) => r.year))].sort(),
  };
};
```

- [ ] **Step 6: Run** `npx jest src/utils/analytics` → PASS (the existing v2 villages tests must still pass — punctuation stripping doesn't change their inputs). `npx tsc --noEmit` clean.

- [ ] **Step 7: Commit** — `git commit -m "Add pledge rows, item keyword rules and village grouping for the insights report"` (stage only this task's files).

---

### Task 2: Rehan book calculations

**Files:** Create `src/utils/analytics/report/pledgeBook.ts`, `src/utils/analytics/report/pledgeBook.test.ts`

**Interfaces:**
- Consumes: `PledgeRow` (Task 1); `median`, `sum`, `daysBetween` (periods).
- Produces: `pledgeStats(rows): PledgeStats`, `monthlyBook(rows, now): MonthPoint[]`, `ageBuckets(rows)`, `redeemBuckets(rows)`, `sizeBands(rows)`: `CountBucket[]`, `cohorts(rows): Cohort[]`, `weekdays(rows)`, `interestWhatIf(rows, ratePerMonth): InterestWhatIf`, `loggingGap(rows): LoggingGap | null`, `monthLabel(key)`, `AGE_LABELS`, `SIZE_LABELS`.

- [ ] **Step 1: Failing test** — `src/utils/analytics/report/pledgeBook.test.ts`:

```ts
import {
  ageBuckets, cohorts, interestWhatIf, loggingGap, monthlyBook, pledgeStats,
  redeemBuckets, sizeBands, weekdays,
} from "./pledgeBook";
import { buildPledgeRows } from "./pledges";
import { NOW, fixtureData } from "./fixture";

const rows = buildPledgeRows(fixtureData, NOW);

describe("pledgeStats", () => {
  it("sums the book", () => {
    const s = pledgeStats(rows);
    expect(s).toMatchObject({
      pledges: 9, open: 7, redeemed: 2, principal: 99000, openBook: 88000,
      redeemedPrincipal: 11000, customers: 7, avgPledge: 11000, medianPledge: 5000,
      medianDaysToRedeem: 180.5, meanDaysToRedeem: 180.5, openYearPlus: 15000, largestPledge: 50000,
    });
    expect(s.redeemedPct).toBeCloseTo(2 / 9);
    expect(s.openYearPlusShare).toBeCloseTo(15000 / 88000);
  });

  it("is all zeros with no pledges", () => {
    expect(pledgeStats([])).toMatchObject({
      pledges: 0, openBook: 0, avgPledge: 0, medianPledge: 0, redeemedPct: 0,
      medianDaysToRedeem: null, openYearPlusShare: 0, largestPledge: 0,
    });
  });
});

describe("monthlyBook", () => {
  const months = monthlyBook(rows, NOW);
  const at = (key: string) => months.find((m) => m.key === key)!;

  it("runs from the first month opened to this month", () => {
    expect(months).toHaveLength(26);
    expect(months[0]).toEqual({
      key: "2024-09", label: "Sep 24", opened: 10000, openedCount: 1, redeemed: 0, redeemedCount: 0, openAtEnd: 10000,
    });
    expect(months[25].key).toBe("2026-10");
  });

  it("tracks open principal at each month-end", () => {
    expect(at("2025-10").openAtEnd).toBe(23000);
    expect(at("2026-03")).toMatchObject({ redeemed: 8000, redeemedCount: 1, openAtEnd: 38000 });
    expect(at("2026-10").openAtEnd).toBe(88000);
  });

  it("is empty without pledges", () => {
    expect(monthlyBook([], NOW)).toEqual([]);
  });
});

describe("buckets", () => {
  it("groups open pledges by age", () => {
    expect(ageBuckets(rows)).toEqual([
      { label: "≤3 mo", count: 4, principal: 53000 },
      { label: "3–6 mo", count: 0, principal: 0 },
      { label: "6–12 mo", count: 1, principal: 20000 },
      { label: "1–2 yr", count: 1, principal: 5000 },
      { label: "2 yr +", count: 1, principal: 10000 },
    ]);
  });

  it("groups redeemed pledges by time taken", () => {
    expect(redeemBuckets(rows).map((b) => b.count)).toEqual([0, 2, 0, 0, 0]);
  });

  it("bands pledges by size", () => {
    expect(sizeBands(rows).map((b) => [b.label, b.count])).toEqual([
      ["<1K", 1], ["1–2.5K", 2], ["2.5–5K", 1], ["5–10K", 2], ["10–20K", 1], ["20–40K", 1], ["40K+", 1],
    ]);
  });
});

describe("cohorts", () => {
  it("summarises each year opened", () => {
    const c = cohorts(rows);
    expect(c.map((x) => x.year)).toEqual(["2024", "2025", "2026"]);
    expect(c[0]).toMatchObject({ pledges: 1, principal: 10000, stillOpen: 10000, redeemedPct: 0, medianDaysToRedeem: null, avgPledge: 10000 });
    expect(c[1]).toMatchObject({ pledges: 2, principal: 13000, stillOpen: 5000, redeemedPct: 0.5, medianDaysToRedeem: 180, avgPledge: 6500 });
    expect(c[2]).toMatchObject({ pledges: 6, principal: 76000, stillOpen: 73000, medianDaysToRedeem: 181 });
    expect(c[2].redeemedPct).toBeCloseTo(1 / 6);
  });
});

describe("weekdays", () => {
  it("counts pledges by day opened, Monday first", () => {
    expect(weekdays(rows)).toEqual([
      { label: "Mon", count: 1 }, { label: "Tue", count: 1 }, { label: "Wed", count: 1 },
      { label: "Thu", count: 1 }, { label: "Fri", count: 1 }, { label: "Sat", count: 2 }, { label: "Sun", count: 2 },
    ]);
  });
});

describe("interestWhatIf", () => {
  it("applies a monthly rate to the open book", () => {
    const w = interestWhatIf(rows, 0.02);
    expect(w.perMonth).toBeCloseTo(1760);
    expect(w.perYear).toBeCloseTo(21120);
    expect(w.accrued).toBeCloseTo(12157.33, 1);
  });
});

describe("loggingGap", () => {
  it("finds the longest run of months with no new pledge", () => {
    expect(loggingGap(rows)).toEqual({ from: "2024-10", to: "2025-05", months: 8 });
  });

  it("is null when there is no gap of two months or more", () => {
    expect(loggingGap(rows.filter((r) => r.year === "2026" && r.month >= "2026-08"))).toBeNull();
    expect(loggingGap([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run** `npx jest src/utils/analytics/report/pledgeBook` → FAIL (module missing).

- [ ] **Step 3: Implement** — `src/utils/analytics/report/pledgeBook.ts`:

```ts
import { PledgeRow } from "./pledges";
import { median, sum } from "../periods";

export interface PledgeStats {
  pledges: number;
  open: number;
  redeemed: number;
  principal: number;
  openBook: number;
  redeemedPrincipal: number;
  customers: number;
  avgPledge: number;
  medianPledge: number;
  redeemedPct: number; // 0..1
  medianDaysToRedeem: number | null;
  meanDaysToRedeem: number | null;
  openYearPlus: number; // open principal a year old or more
  openYearPlusShare: number; // of the open book, 0..1
  largestPledge: number;
}

export interface MonthPoint {
  key: string; // "2026-01"
  label: string; // "Jan 26"
  opened: number;
  openedCount: number;
  redeemed: number;
  redeemedCount: number;
  openAtEnd: number; // principal still open at month-end
}

export interface CountBucket {
  label: string;
  count: number;
  principal: number;
}

export interface Cohort {
  year: string;
  pledges: number;
  principal: number;
  stillOpen: number;
  redeemedPct: number;
  medianDaysToRedeem: number | null;
  avgPledge: number;
}

export interface InterestWhatIf {
  perMonth: number;
  perYear: number;
  accrued: number; // simple interest on open pledges to date
}

export interface LoggingGap {
  from: string; // "2024-10"
  to: string;
  months: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-01" → "Jan 26" */
export const monthLabel = (key: string): string =>
  `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`;

/** "2026-01" → "Jan 2026" */
export const monthLabelLong = (key: string): string =>
  `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

const monthKeysBetween = (first: string, last: string): string[] => {
  const keys: string[] = [];
  let y = Number(first.slice(0, 4));
  let m = Number(first.slice(5, 7));
  const endY = Number(last.slice(0, 4));
  const endM = Number(last.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    keys.push(`${y}-${pad(m)}`);
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return keys;
};

const time = (iso: string) => new Date(iso).getTime();

export const pledgeStats = (rows: PledgeRow[]): PledgeStats => {
  const open = rows.filter((r) => r.open);
  const principals = rows.map((r) => r.principal);
  const principal = sum(principals);
  const openBook = sum(open.map((r) => r.principal));
  const redeemDays = rows.filter((r) => r.daysToRedeem !== null).map((r) => r.daysToRedeem as number);
  const openYearPlus = sum(open.filter((r) => (r.daysOpen ?? 0) >= 365).map((r) => r.principal));
  return {
    pledges: rows.length,
    open: open.length,
    redeemed: rows.length - open.length,
    principal,
    openBook,
    redeemedPrincipal: principal - openBook,
    customers: new Set(rows.map((r) => r.userId)).size,
    avgPledge: rows.length ? principal / rows.length : 0,
    medianPledge: median(principals) ?? 0,
    redeemedPct: rows.length ? (rows.length - open.length) / rows.length : 0,
    medianDaysToRedeem: median(redeemDays),
    meanDaysToRedeem: redeemDays.length ? sum(redeemDays) / redeemDays.length : null,
    openYearPlus,
    openYearPlusShare: openBook ? openYearPlus / openBook : 0,
    largestPledge: principals.reduce((a, b) => Math.max(a, b), 0),
  };
};

/** Opened, redeemed and still-open principal for every month from the first pledge to now. */
export const monthlyBook = (rows: PledgeRow[], now: Date): MonthPoint[] => {
  if (rows.length === 0) return [];
  const first = rows.map((r) => r.month).sort()[0];
  const last = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  return monthKeysBetween(first, last > first ? last : first).map((key) => {
    const y = Number(key.slice(0, 4));
    const m = Number(key.slice(5, 7)) - 1;
    const start = new Date(y, m, 1).getTime();
    const end = new Date(y, m + 1, 1).getTime();
    const opened = rows.filter((r) => r.month === key);
    const redeemed = rows.filter(
      (r) => !r.open && r.closedDate && time(r.closedDate) >= start && time(r.closedDate) < end,
    );
    const openAtEnd = rows.filter(
      (r) => time(r.openDate) < end && (r.open || !r.closedDate || time(r.closedDate) >= end),
    );
    return {
      key,
      label: monthLabel(key),
      opened: sum(opened.map((r) => r.principal)),
      openedCount: opened.length,
      redeemed: sum(redeemed.map((r) => r.principal)),
      redeemedCount: redeemed.length,
      openAtEnd: sum(openAtEnd.map((r) => r.principal)),
    };
  });
};

export const AGE_LABELS = ["≤3 mo", "3–6 mo", "6–12 mo", "1–2 yr", "2 yr +"];
const AGE_MAX_DAYS = [91, 182, 365, 730, Infinity];

const byDays = (rows: PledgeRow[], days: (r: PledgeRow) => number | null): CountBucket[] => {
  const buckets = AGE_LABELS.map((label) => ({ label, count: 0, principal: 0 }));
  for (const r of rows) {
    const d = days(r);
    if (d === null) continue;
    const b = buckets[AGE_MAX_DAYS.findIndex((max) => d <= max)];
    b.count++;
    b.principal += r.principal;
  }
  return buckets;
};

/** Open pledges by how long they have been open. */
export const ageBuckets = (rows: PledgeRow[]) => byDays(rows, (r) => r.daysOpen);

/** Redeemed pledges by how long they took. */
export const redeemBuckets = (rows: PledgeRow[]) => byDays(rows, (r) => r.daysToRedeem);

export const SIZE_LABELS = ["<1K", "1–2.5K", "2.5–5K", "5–10K", "10–20K", "20–40K", "40K+"];
const SIZE_MIN = [0, 1000, 2500, 5000, 10000, 20000, 40000];

export const sizeBands = (rows: PledgeRow[]): CountBucket[] => {
  const bands = SIZE_LABELS.map((label) => ({ label, count: 0, principal: 0 }));
  for (const r of rows) {
    let i = SIZE_MIN.length - 1;
    while (i > 0 && r.principal < SIZE_MIN[i]) i--;
    bands[i].count++;
    bands[i].principal += r.principal;
  }
  return bands;
};

export const cohorts = (rows: PledgeRow[]): Cohort[] =>
  [...new Set(rows.map((r) => r.year))].sort().map((year) => {
    const s = pledgeStats(rows.filter((r) => r.year === year));
    return {
      year,
      pledges: s.pledges,
      principal: s.principal,
      stillOpen: s.openBook,
      redeemedPct: s.redeemedPct,
      medianDaysToRedeem: s.medianDaysToRedeem,
      avgPledge: s.avgPledge,
    };
  });

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const weekdays = (rows: PledgeRow[]) =>
  WEEKDAYS.map((label, i) => ({
    label,
    count: rows.filter((r) => r.weekday === (i + 1) % 7).length,
  }));

/** Illustration only: interest terms are not recorded (spec §12.2). */
export const interestWhatIf = (rows: PledgeRow[], ratePerMonth: number): InterestWhatIf => {
  const open = rows.filter((r) => r.open);
  const perMonth = sum(open.map((r) => r.principal)) * ratePerMonth;
  return {
    perMonth,
    perYear: perMonth * 12,
    accrued: sum(open.map((r) => (r.principal * ratePerMonth * (r.daysOpen ?? 0)) / 30)),
  };
};

/** Longest run (≥ 2 months) with no pledge opened, between the first and last month that have one. */
export const loggingGap = (rows: PledgeRow[]): LoggingGap | null => {
  if (rows.length === 0) return null;
  const has = new Set(rows.map((r) => r.month));
  const sorted = [...has].sort();
  const keys = monthKeysBetween(sorted[0], sorted[sorted.length - 1]);
  let best: LoggingGap | null = null;
  let i = 0;
  while (i < keys.length) {
    if (has.has(keys[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < keys.length && !has.has(keys[j + 1])) j++;
    const months = j - i + 1;
    if (months >= 2 && (!best || months > best.months)) best = { from: keys[i], to: keys[j], months };
    i = j + 1;
  }
  return best;
};
```

- [ ] **Step 4: Run** → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** — `git commit -m "Add rehan book calculations for the insights report"`

### Task 3: Items, customers and villages calculations

**Files:** Create `src/utils/analytics/report/itemsView.ts`, `itemsView.test.ts`, `pledgeCustomers.ts`, `pledgeCustomers.test.ts` (all under `src/utils/analytics/report/`)

**Interfaces:**
- Consumes: `PledgeRow`, `buildPledgeRows` (Task 1); `pledgeStats`, `monthLabel` (Task 2); `Bucket`, `sum` (periods); `VillageGroups`, `groupVillages`, `OTHER_VILLAGES`, `UNKNOWN_VILLAGE` (villages); `UserRow`, `AnalyticsData` (types).
- Produces: `ItemStat`, `itemStats(rows)`, `rankItems(rows, minPledges = 5)`, `QuarterMix`, `itemMixByQuarter(rows, now, quarters = 4, top = 3)`, `BundleStats`, `bundleStats(rows)`; `VillageStat`, `villageStats(rows, groups)`, `Concentration`, `concentration(rows)`, `Exposure`, `exposures(rows, users, limit)`, `RepeatBucket`, `repeatCustomers(rows)`, `AddedPoint`, `customersAdded(users, now)`, `Segment`, `customerSegments(data, rows, groups, village = "all")`.

- [ ] **Step 1: Failing tests** — `itemsView.test.ts`:

```ts
import { bundleStats, itemMixByQuarter, itemStats, rankItems } from "./itemsView";
import { buildPledgeRows } from "./pledges";
import { NOW, fixtureData } from "./fixture";

const rows = buildPledgeRows(fixtureData, NOW);

describe("itemStats", () => {
  it("summarises each item type, largest principal first", () => {
    const stats = itemStats(rows);
    expect(stats.map((s) => s.item)).toEqual(["Chain", "Kardhan", "Payal", "Locket", "Tika", "Unspecified", "Other"]);
    expect(stats[0]).toMatchObject({
      item: "Chain", pledges: 2, principal: 55000, avgTicket: 27500, openPrincipal: 55000, redeemedPct: 0, medianDaysToRedeem: null,
    });
    expect(stats[0].openShare).toBeCloseTo(55000 / 88000);
    expect(stats[3]).toMatchObject({ item: "Locket", openPrincipal: 0, redeemedPct: 1, medianDaysToRedeem: 180 });
  });
});

describe("rankItems", () => {
  it("groups small items into one closing row", () => {
    const ranked = rankItems(rows, 2);
    expect(ranked.map((r) => r.item)).toEqual(["Chain", "Payal", "All other items (5)"]);
    expect(ranked[2]).toMatchObject({ pledges: 5, principal: 34000, openPrincipal: 23000 });
    expect(ranked[2].redeemedPct).toBeCloseTo(2 / 5);
  });

  it("has no closing row when every item is large enough", () => {
    expect(rankItems(rows, 1).some((r) => r.item.startsWith("All other"))).toBe(false);
  });
});

describe("itemMixByQuarter", () => {
  it("counts the top items per calendar quarter, the rest together", () => {
    const mix = itemMixByQuarter(rows, NOW, 4, 3);
    expect(mix.buckets.map((b) => b.label)).toEqual(["Q1 '26", "Q2 '26", "Q3 '26", "Q4 '26"]);
    expect(mix.series).toEqual([
      { label: "Chain", values: [0, 0, 1, 0] },
      { label: "Kardhan", values: [1, 0, 0, 0] },
      { label: "Tika", values: [1, 0, 0, 0] },
      { label: "All other items", values: [0, 0, 3, 0] },
    ]);
  });

  it("is empty without pledges", () => {
    expect(itemMixByQuarter([], NOW).series).toEqual([]);
  });
});

describe("bundleStats", () => {
  it("compares bundles with single items", () => {
    const b = bundleStats(rows);
    expect(b).toMatchObject({ bundles: 1, singles: 8, avgBundle: 8000, avgSingle: 11375 });
    expect(b.bundleShare).toBeCloseTo(1 / 9);
    expect(b.premium).toBeCloseTo(8000 / 11375 - 1);
    expect(bundleStats([])).toMatchObject({ bundles: 0, bundleShare: 0, premium: null });
  });
});
```

`pledgeCustomers.test.ts`:

```ts
import {
  concentration, customerSegments, customersAdded, exposures, repeatCustomers, villageStats,
} from "./pledgeCustomers";
import { buildPledgeRows } from "./pledges";
import { NOW, fixtureData } from "./fixture";
import { groupVillages } from "../villages";

const groups = groupVillages(fixtureData.users);
const rows = buildPledgeRows(fixtureData, NOW, groups);

describe("villageStats", () => {
  it("ranks named villages by principal, then Other villages and Unknown", () => {
    const v = villageStats(rows, groups);
    expect(v.map((x) => x.village)).toEqual(["Manwal", "Kanja", "Other villages", "Unknown"]);
    expect(v[0]).toMatchObject({
      customersOnFile: 6, pledging: 2, pledges: 4, perCustomer: 2, principal: 23000, openPrincipal: 15000, avgTicket: 5750, redeemedPct: 0.25,
    });
    expect(v[0].openShare).toBeCloseTo(15000 / 88000);
    expect(v[3]).toMatchObject({ customersOnFile: 1, pledging: 2, pledges: 2, principal: 3000 });
  });
});

describe("concentration", () => {
  it("measures how much principal the largest customers hold", () => {
    const c = concentration(rows);
    expect(c.customers).toBe(7);
    expect(c.top10).toBeCloseTo(50000 / 99000);
    expect(c.top20).toBeCloseTo(70000 / 99000);
    expect(c.top50).toBeCloseTo(93000 / 99000);
    expect(c.tenLargest).toBeCloseTo(1);
    expect(c.curve).toHaveLength(8);
    expect(c.curve[0]).toEqual({ customerShare: 0, principalShare: 0 });
    expect(c.curve[7].principalShare).toBeCloseTo(1);
  });

  it("is zero without pledges", () => {
    expect(concentration([])).toEqual({
      customers: 0, top10: 0, top20: 0, top50: 0, tenLargest: 0, curve: [{ customerShare: 0, principalShare: 0 }],
    });
  });
});

describe("exposures", () => {
  it("lists customers by open principal", () => {
    const e = exposures(rows, fixtureData.users, 12);
    expect(e.map((x) => x.userId)).toEqual([11, 3, 1, 13, 99]);
    expect(e[2]).toEqual({
      userId: 1, name: "Ram", village: "Manwal", openPrincipal: 15000, openPledges: 3, oldestOpenDays: 761, redeemed: 0, totalPledges: 3,
    });
    expect(e[4]).toMatchObject({ name: "Customer #99", village: "Unknown" });
    expect(exposures(rows, fixtureData.users, 2)).toHaveLength(2);
  });
});

describe("repeatCustomers", () => {
  it("groups customers by how many pledges they made", () => {
    const r = repeatCustomers(rows);
    expect(r.map((b) => [b.label, b.customers, b.principal])).toEqual([
      ["1 pledge", 6, 84000], ["2", 0, 0], ["3", 1, 15000], ["4–6", 0, 0], ["7 or more", 0, 0],
    ]);
    expect(r[0].customerShare).toBeCloseTo(6 / 7);
    expect(r[2].principalShare).toBeCloseTo(15000 / 99000);
  });
});

describe("customersAdded", () => {
  it("counts new customers per month with a running total", () => {
    const a = customersAdded(fixtureData.users, NOW);
    expect(a).toHaveLength(11);
    expect(a[0]).toEqual({ key: "2025-12", label: "Dec 25", added: 1, total: 1 });
    expect(a[1]).toMatchObject({ label: "Jan 26", added: 10, total: 11 });
    expect(a[10]).toMatchObject({ label: "Oct 26", added: 0, total: 13 });
    expect(customersAdded([], NOW)).toEqual([]);
  });
});

describe("customerSegments", () => {
  it("splits customers by what they do with the shop", () => {
    expect(customerSegments(fixtureData, rows, groups)).toEqual([
      { label: "Open pledge only", customers: 3 },
      { label: "Pledges and bills", customers: 1 },
      { label: "Redeemed pledges only", customers: 2 },
      { label: "Bills only", customers: 4 },
      { label: "No activity yet", customers: 3 },
    ]);
    expect(customerSegments(fixtureData, rows, groups, "Kanja").map((s) => s.customers)).toEqual([0, 1, 1, 3, 0]);
  });
});
```

- [ ] **Step 2: Run** `npx jest src/utils/analytics/report` → FAIL (modules missing).

- [ ] **Step 3: Implement** — `itemsView.ts`:

```ts
import { PledgeRow } from "./pledges";
import { pledgeStats } from "./pledgeBook";
import { Bucket, sum } from "../periods";

export interface ItemStat {
  item: string;
  pledges: number;
  principal: number;
  avgTicket: number;
  openPrincipal: number;
  openShare: number; // of the open book of all rows given
  redeemedPct: number;
  medianDaysToRedeem: number | null;
}

export interface QuarterMix {
  buckets: Bucket[];
  series: { label: string; values: number[] }[];
}

export interface BundleStats {
  bundles: number;
  bundleShare: number;
  avgBundle: number;
  singles: number;
  avgSingle: number;
  premium: number | null; // average bundle vs average single item, e.g. 0.62 = +62 %
}

const openBookOf = (rows: PledgeRow[]) => sum(rows.filter((r) => r.open).map((r) => r.principal));

const statOf = (item: string, group: PledgeRow[], openBook: number): ItemStat => {
  const s = pledgeStats(group);
  return {
    item,
    pledges: s.pledges,
    principal: s.principal,
    avgTicket: s.avgPledge,
    openPrincipal: s.openBook,
    openShare: openBook ? s.openBook / openBook : 0,
    redeemedPct: s.redeemedPct,
    medianDaysToRedeem: s.medianDaysToRedeem,
  };
};

export const itemStats = (rows: PledgeRow[]): ItemStat[] => {
  const openBook = openBookOf(rows);
  const groups = new Map<string, PledgeRow[]>();
  for (const r of rows) {
    const list = groups.get(r.item) ?? [];
    list.push(r);
    groups.set(r.item, list);
  }
  return [...groups]
    .map(([item, group]) => statOf(item, group, openBook))
    .sort((a, b) => b.principal - a.principal || a.item.localeCompare(b.item));
};

/** Items with at least `minPledges` pledges, then the rest as "All other items (n)". */
export const rankItems = (rows: PledgeRow[], minPledges = 5): ItemStat[] => {
  const stats = itemStats(rows);
  const large = stats.filter((s) => s.pledges >= minPledges);
  const small = stats.filter((s) => s.pledges < minPledges);
  if (small.length === 0) return large;
  const smallItems = new Set(small.map((s) => s.item));
  return [
    ...large,
    statOf(`All other items (${small.length})`, rows.filter((r) => smallItems.has(r.item)), openBookOf(rows)),
  ];
};

const quarterOf = (iso: string) => {
  const d = new Date(iso);
  return { year: d.getFullYear(), q: Math.floor(d.getMonth() / 3) + 1 };
};

/** Pledges opened per calendar quarter for the last `quarters` quarters: the `top` items, then the rest. */
export const itemMixByQuarter = (rows: PledgeRow[], now: Date, quarters = 4, top = 3): QuarterMix => {
  const current = quarterOf(now.toISOString());
  const buckets: Bucket[] = [];
  for (let i = quarters - 1; i >= 0; i--) {
    const index = current.year * 4 + (current.q - 1) - i;
    const year = Math.floor(index / 4);
    const q = (index % 4) + 1;
    buckets.push({ key: `${year}-Q${q}`, label: `Q${q} '${String(year % 100).padStart(2, "0")}` });
  }
  const position = new Map(buckets.map((b, i) => [b.key, i]));
  const inRange = rows
    .map((r) => {
      const { year, q } = quarterOf(r.openDate);
      return { r, i: position.get(`${year}-Q${q}`) };
    })
    .filter((x): x is { r: PledgeRow; i: number } => x.i !== undefined);
  if (inRange.length === 0) return { buckets, series: [] };

  const totals = new Map<string, { count: number; principal: number }>();
  for (const { r } of inRange) {
    const t = totals.get(r.item) ?? { count: 0, principal: 0 };
    t.count++;
    t.principal += r.principal;
    totals.set(r.item, t);
  }
  const topItems = [...totals]
    .sort((a, b) => b[1].count - a[1].count || b[1].principal - a[1].principal || a[0].localeCompare(b[0]))
    .slice(0, top)
    .map(([item]) => item);
  const series = topItems.map((item) => ({ label: item, values: buckets.map(() => 0) }));
  const rest = { label: "All other items", values: buckets.map(() => 0) };
  for (const { r, i } of inRange) {
    const s = series.find((x) => x.label === r.item) ?? rest;
    s.values[i]++;
  }
  return { buckets, series: rest.values.some((v) => v > 0) ? [...series, rest] : series };
};

export const bundleStats = (rows: PledgeRow[]): BundleStats => {
  const bundles = rows.filter((r) => r.bundle);
  const singles = rows.filter((r) => !r.bundle);
  const avg = (list: PledgeRow[]) => (list.length ? sum(list.map((r) => r.principal)) / list.length : 0);
  const avgBundle = avg(bundles);
  const avgSingle = avg(singles);
  return {
    bundles: bundles.length,
    bundleShare: rows.length ? bundles.length / rows.length : 0,
    avgBundle,
    singles: singles.length,
    avgSingle,
    premium: avgBundle && avgSingle ? avgBundle / avgSingle - 1 : null,
  };
};
```

`pledgeCustomers.ts`:

```ts
import { AnalyticsData, UserRow } from "../types";
import { sum } from "../periods";
import { OTHER_VILLAGES, UNKNOWN_VILLAGE, VillageGroups } from "../villages";
import { PledgeRow } from "./pledges";
import { monthLabel, pledgeStats } from "./pledgeBook";

export interface VillageStat {
  village: string;
  customersOnFile: number;
  pledging: number;
  pledges: number;
  perCustomer: number; // pledges per pledging customer
  principal: number;
  openPrincipal: number;
  openShare: number;
  avgTicket: number;
  redeemedPct: number;
}

export interface Concentration {
  customers: number;
  top10: number;
  top20: number;
  top50: number;
  tenLargest: number;
  curve: { customerShare: number; principalShare: number }[]; // cumulative, largest customers first
}

export interface Exposure {
  userId: number;
  name: string;
  village: string;
  openPrincipal: number;
  openPledges: number;
  oldestOpenDays: number;
  redeemed: number;
  totalPledges: number;
}

export interface RepeatBucket {
  label: string;
  customers: number;
  customerShare: number;
  principal: number;
  principalShare: number;
}

export interface AddedPoint {
  key: string;
  label: string;
  added: number;
  total: number;
}

export interface Segment {
  label: string;
  customers: number;
}

const groupBy = <T, K>(list: T[], key: (t: T) => K): Map<K, T[]> => {
  const map = new Map<K, T[]>();
  for (const item of list) {
    const k = key(item);
    const bucket = map.get(k) ?? [];
    bucket.push(item);
    map.set(k, bucket);
  }
  return map;
};

const isNamed = (v: string) => v !== OTHER_VILLAGES && v !== UNKNOWN_VILLAGE;

export const villageStats = (rows: PledgeRow[], groups: VillageGroups): VillageStat[] => {
  const openBook = sum(rows.filter((r) => r.open).map((r) => r.principal));
  const byVillage = groupBy(rows, (r) => r.village);
  const villages = [...groups.order, ...[...byVillage.keys()].filter((v) => !groups.order.includes(v))];
  const stats = villages.map((village) => {
    const s = pledgeStats(byVillage.get(village) ?? []);
    return {
      village,
      customersOnFile: groups.customers.get(village) ?? 0,
      pledging: s.customers,
      pledges: s.pledges,
      perCustomer: s.customers ? s.pledges / s.customers : 0,
      principal: s.principal,
      openPrincipal: s.openBook,
      openShare: openBook ? s.openBook / openBook : 0,
      avgTicket: s.avgPledge,
      redeemedPct: s.redeemedPct,
    };
  });
  const named = stats
    .filter((s) => isNamed(s.village))
    .sort((a, b) => b.principal - a.principal || b.customersOnFile - a.customersOnFile || a.village.localeCompare(b.village));
  return [
    ...named,
    ...stats.filter((s) => s.village === OTHER_VILLAGES),
    ...stats.filter((s) => s.village === UNKNOWN_VILLAGE),
  ];
};

export const concentration = (rows: PledgeRow[]): Concentration => {
  const perCustomer = [...groupBy(rows, (r) => r.userId).values()]
    .map((list) => sum(list.map((r) => r.principal)))
    .sort((a, b) => b - a);
  const total = sum(perCustomer);
  const n = perCustomer.length;
  const shareOfTop = (count: number) => (total ? sum(perCustomer.slice(0, count)) / total : 0);
  const curve = [{ customerShare: 0, principalShare: 0 }];
  let running = 0;
  perCustomer.forEach((p, i) => {
    running += p;
    curve.push({ customerShare: (i + 1) / n, principalShare: total ? running / total : 0 });
  });
  return {
    customers: n,
    top10: shareOfTop(Math.ceil(n * 0.1)),
    top20: shareOfTop(Math.ceil(n * 0.2)),
    top50: shareOfTop(Math.ceil(n * 0.5)),
    tenLargest: shareOfTop(10),
    curve,
  };
};

/** Customers by open principal, largest first; customers with nothing open are left out. */
export const exposures = (rows: PledgeRow[], users: UserRow[], limit: number): Exposure[] => {
  const names = new Map(users.map((u) => [u.id, u.name]));
  return [...groupBy(rows, (r) => r.userId)]
    .map(([userId, list]) => {
      const open = list.filter((r) => r.open);
      return {
        userId,
        name: names.get(userId) ?? `Customer #${userId}`,
        village: list[0].village,
        openPrincipal: sum(open.map((r) => r.principal)),
        openPledges: open.length,
        oldestOpenDays: open.reduce((m, r) => Math.max(m, r.daysOpen ?? 0), 0),
        redeemed: list.length - open.length,
        totalPledges: list.length,
      };
    })
    .filter((e) => e.openPrincipal > 0)
    .sort((a, b) => b.openPrincipal - a.openPrincipal || a.userId - b.userId)
    .slice(0, limit);
};

const REPEAT = [
  { label: "1 pledge", min: 1, max: 1 },
  { label: "2", min: 2, max: 2 },
  { label: "3", min: 3, max: 3 },
  { label: "4–6", min: 4, max: 6 },
  { label: "7 or more", min: 7, max: Infinity },
];

export const repeatCustomers = (rows: PledgeRow[]): RepeatBucket[] => {
  const perCustomer = [...groupBy(rows, (r) => r.userId).values()].map((list) => ({
    count: list.length,
    principal: sum(list.map((r) => r.principal)),
  }));
  const total = sum(perCustomer.map((c) => c.principal));
  return REPEAT.map(({ label, min, max }) => {
    const inBucket = perCustomer.filter((c) => c.count >= min && c.count <= max);
    const principal = sum(inBucket.map((c) => c.principal));
    return {
      label,
      customers: inBucket.length,
      customerShare: perCustomer.length ? inBucket.length / perCustomer.length : 0,
      principal,
      principalShare: total ? principal / total : 0,
    };
  });
};

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/** New customers per month (from users.createdAt) with a running total, up to this month. */
export const customersAdded = (users: UserRow[], now: Date): AddedPoint[] => {
  const counts = new Map<string, number>();
  for (const u of users) {
    if (!u.createdAt) continue;
    const k = keyOf(new Date(u.createdAt));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  if (counts.size === 0) return [];
  const first = [...counts.keys()].sort()[0];
  const last = keyOf(now) > first ? keyOf(now) : first;
  const points: AddedPoint[] = [];
  let y = Number(first.slice(0, 4));
  let m = Number(first.slice(5, 7));
  let total = 0;
  for (;;) {
    const key = `${y}-${pad(m)}`;
    const added = counts.get(key) ?? 0;
    total += added;
    points.push({ key, label: monthLabel(key), added, total });
    if (key >= last) break;
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return points;
};

/** Customers on file by what they do with the shop; only the village filter applies (spec §12.1). */
export const customerSegments = (
  data: AnalyticsData,
  rows: PledgeRow[],
  groups: VillageGroups,
  village = "all",
): Segment[] => {
  const billed = new Set(data.lenden.map((b) => b.userId));
  const pledges = groupBy(rows, (r) => r.userId);
  const counts = { openOnly: 0, both: 0, redeemedOnly: 0, billsOnly: 0, none: 0 };
  for (const user of data.users) {
    if (village !== "all" && groups.of.get(user.id) !== village) continue;
    const list = pledges.get(user.id) ?? [];
    const hasBills = billed.has(user.id);
    if (list.length && hasBills) counts.both++;
    else if (list.some((r) => r.open)) counts.openOnly++;
    else if (list.length) counts.redeemedOnly++;
    else if (hasBills) counts.billsOnly++;
    else counts.none++;
  }
  return [
    { label: "Open pledge only", customers: counts.openOnly },
    { label: "Pledges and bills", customers: counts.both },
    { label: "Redeemed pledges only", customers: counts.redeemedOnly },
    { label: "Bills only", customers: counts.billsOnly },
    { label: "No activity yet", customers: counts.none },
  ];
};
```

- [ ] **Step 4: Run** → PASS; tsc clean.
- [ ] **Step 5: Commit** — `git commit -m "Add item and customer calculations for the insights report"`

---

### Task 4: Billing and together calculations

**Files:** Create `src/utils/analytics/report/billing.ts`, `billing.test.ts`, `together.ts`, `together.test.ts`

**Interfaces:**
- Consumes: `AnalyticsData`; `daysBetween`, `sum` (periods); `VillageGroups`, `villageOfUser`, `UNKNOWN_VILLAGE` (villages); `hasPhoto`, `PledgeRow` (Task 1).
- Produces: `BillFlag`, `BillRow`, `buildBillRows(data, groups, now?)`, `billLabel(row)`, `BillingSummary`, `billingSummary(rows)`, `waterfall(summary)`, `discountPerBill(rows)`, `BillGroup`, `numberedVsEarlier(rows)`; `LedgerScale`, `ledgerScale(pledges, bills)`, `VillageShare`, `villageShares(pledges, bills, order)`.

- [ ] **Step 1: Failing tests** — `billing.test.ts`:

```ts
import { billLabel, billingSummary, buildBillRows, discountPerBill, numberedVsEarlier, waterfall } from "./billing";
import { NOW, fixtureData, iso } from "./fixture";
import { groupVillages } from "../villages";

const groups = groupVillages(fixtureData.users);
const bills = buildBillRows(fixtureData, groups, NOW);
const byId = (id: number) => bills.find((b) => b.id === id)!;
const flagLabels = (id: number) => byId(id).flags.map((f) => f.label);

describe("buildBillRows", () => {
  it("orders bills newest first", () => {
    expect(bills.map((b) => b.id)).toEqual([4, 3, 2, 1, 5, 6]);
  });

  it("derives collected and pending from the balance", () => {
    expect(byId(3)).toMatchObject({ gross: 44545, net: 44545, collected: 42500, pending: 2045, received: 42500, daysOpen: 7, village: "Kanja" });
    expect(byId(5)).toMatchObject({ net: 15500, collected: 8500, pending: 7000, received: 0, daysOpen: 268, photo: true, overridden: true });
    expect(byId(6)).toMatchObject({ net: 19500, collected: 19500, pending: 0, received: 10000, daysOpen: null });
  });

  it("flags what needs a decision", () => {
    expect(flagLabels(1)).toEqual([]);
    expect(flagLabels(2)).toEqual(["Customer not on file"]);
    expect(flagLabels(3)).toEqual([]);
    expect(flagLabels(4)).toEqual(["Received field short"]);
    expect(flagLabels(5)).toEqual(["Received field blank", "Amount overridden", "No bill number"]);
    expect(byId(5).flags.map((f) => f.severity)).toEqual(["red", "grey", "grey"]);
    expect(byId(2)).toMatchObject({ customer: "Customer #99", village: "Unknown", onFile: false });
  });

  it("labels bills by number, or by ID when unnumbered", () => {
    expect(billLabel(byId(1))).toBe("#1");
    expect(billLabel(byId(5))).toBe("ID 5");
  });
});

describe("billingSummary and waterfall", () => {
  const s = billingSummary(bills);

  it("adds up the billing ledger", () => {
    expect(s).toMatchObject({ bills: 6, withBalance: 4, gross: 142545, discount: 2800, net: 139745, collected: 78700, pending: 61045 });
    expect(s.discountPct).toBeCloseTo(2800 / 142545);
    expect(s.collectedPct).toBeCloseTo(78700 / 139745);
    expect(s.pendingOffFilePct).toBeCloseTo(42500 / 61045);
  });

  it("walks from gross to cash", () => {
    expect(waterfall(s)).toEqual([
      { label: "Gross billed", value: 142545 },
      { label: "Discount", value: 2800 },
      { label: "Net billed", value: 139745 },
      { label: "Collected", value: 78700 },
      { label: "Pending dues", value: 61045 },
    ]);
  });

  it("is zero without bills", () => {
    expect(billingSummary([])).toMatchObject({ bills: 0, discountPct: 0, collectedPct: 0, pendingOffFilePct: 0 });
  });
});

describe("discountPerBill", () => {
  it("lists discount as a share of gross, oldest bill first", () => {
    const d = discountPerBill(bills);
    expect(d.bills.map((b) => b.label)).toEqual(["ID 6", "ID 5", "#1", "#2", "#3", "#6"]);
    expect(d.bills[2].pct).toBeCloseTo(0.05);
    expect(d.weighted).toBeCloseTo(2800 / 142545);
  });
});

describe("numberedVsEarlier", () => {
  it("compares numbered bills with earlier unnumbered ones", () => {
    const { numbered, earlier } = numberedVsEarlier(bills);
    expect(numbered).toMatchObject({
      bills: 4, gross: 106245, net: 104745, avgNet: 26186.25, pending: 54045, customers: 4, withPhoto: 0,
      from: iso(2026, 9, 8), to: iso(2026, 9, 30),
    });
    expect(numbered.discountRate).toBeCloseTo(1500 / 106245);
    expect(numbered.collectedShare).toBeCloseTo(50700 / 104745);
    expect(earlier).toMatchObject({
      bills: 2, gross: 36300, net: 35000, avgNet: 17500, collectedShare: 0.8, pending: 7000, customers: 2, withPhoto: 1,
      from: iso(2025, 12, 29), to: iso(2026, 1, 7),
    });
  });
});
```

`together.test.ts`:

```ts
import { ledgerScale, villageShares } from "./together";
import { buildBillRows } from "./billing";
import { buildPledgeRows } from "./pledges";
import { NOW, fixtureData } from "./fixture";
import { groupVillages } from "../villages";

const groups = groupVillages(fixtureData.users);
const pledges = buildPledgeRows(fixtureData, NOW, groups);
const bills = buildBillRows(fixtureData, groups, NOW);

describe("ledgerScale", () => {
  it("compares the pledge book with billing", () => {
    const s = ledgerScale(pledges, bills);
    expect(s).toMatchObject({ openBook: 88000, redeemedPrincipal: 11000, netBilled: 139745, pending: 61045 });
    expect(s.ratio).toBeCloseTo(88000 / 139745);
    expect(ledgerScale(pledges, []).ratio).toBeNull();
  });
});

describe("villageShares", () => {
  it("shows each village's share of each ledger", () => {
    const v = villageShares(pledges, bills, groups.order);
    expect(v.map((x) => x.village)).toEqual(["Manwal", "Kanja", "Other villages", "Unknown"]);
    expect(v[0].pledgeShare).toBeCloseTo(23000 / 99000);
    expect(v[0].billShare).toBeCloseTo(19500 / 139745);
    expect(v[1].billShare).toBeCloseTo(77745 / 139745);
    expect(v[2].billShare).toBe(0);
    expect(v[3].billShare).toBeCloseTo(42500 / 139745);
  });
});
```

- [ ] **Step 2: Run** → FAIL (modules missing).

- [ ] **Step 3: Implement** — `billing.ts`:

```ts
import { AnalyticsData } from "../types";
import { daysBetween, sum } from "../periods";
import { UNKNOWN_VILLAGE, VillageGroups, villageOfUser } from "../villages";
import { hasPhoto } from "./pledges";

export interface BillFlag {
  label: string;
  severity: "red" | "grey"; // red needs a decision; grey is information
}

export interface BillRow {
  id: number;
  billNo: number | null;
  userId: number;
  customer: string;
  village: string;
  onFile: boolean;
  date: string;
  gross: number;
  discount: number;
  net: number;
  received: number; // jama entries, or legacy jama
  collected: number; // net − baki (spec §12.3)
  pending: number; // baki on open bills
  open: boolean;
  daysOpen: number | null; // open bills with a balance
  overridden: boolean;
  photo: boolean;
  flags: BillFlag[];
}

export interface BillingSummary {
  bills: number;
  withBalance: number;
  gross: number;
  discount: number;
  discountPct: number;
  net: number;
  collected: number;
  collectedPct: number;
  pending: number;
  pendingOffFilePct: number; // share of pending on customers not on file
}

export interface BillGroup {
  bills: number;
  gross: number;
  net: number;
  avgNet: number;
  discountRate: number;
  collectedShare: number;
  pending: number;
  customers: number;
  withPhoto: number;
  from: string | null;
  to: string | null;
}

export const buildBillRows = (data: AnalyticsData, groups: VillageGroups, now: Date = new Date()): BillRow[] => {
  const users = new Map(data.users.map((u) => [u.id, u]));
  const entries = new Map<number, number>();
  for (const j of data.jama) entries.set(j.lendenId, (entries.get(j.lendenId) ?? 0) + j.amount);
  const nowIso = now.toISOString();
  return data.lenden
    .map((b) => {
      const user = users.get(b.userId);
      const gross = b.amount ?? 0;
      const discount = b.discount ?? 0;
      const net = b.remaining ?? gross - discount;
      const baki = b.baki ?? 0;
      const open = (b.status ?? 0) === 0;
      const collected = Math.max(0, net - baki);
      const received = entries.has(b.id) ? (entries.get(b.id) as number) : b.jama ?? 0;
      const pending = open ? baki : 0;
      const flags: BillFlag[] = [];
      if (!user) flags.push({ label: "Customer not on file", severity: "red" });
      if (received === 0 && collected > 0) flags.push({ label: "Received field blank", severity: "red" });
      else if (received > 0 && received < collected) flags.push({ label: "Received field short", severity: "red" });
      if (b.amountOverridden === 1) flags.push({ label: "Amount overridden", severity: "grey" });
      if (b.billNo == null) flags.push({ label: "No bill number", severity: "grey" });
      return {
        id: b.id,
        billNo: b.billNo ?? null,
        userId: b.userId,
        customer: user?.name ?? `Customer #${b.userId}`,
        village: user ? villageOfUser(groups, b.userId) : UNKNOWN_VILLAGE,
        onFile: !!user,
        date: b.date,
        gross,
        discount,
        net,
        received,
        collected,
        pending,
        open,
        daysOpen: open && pending > 0 ? Math.max(0, daysBetween(b.date, nowIso)) : null,
        overridden: b.amountOverridden === 1,
        photo: hasPhoto(b.media),
        flags,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.id - a.id);
};

export const billLabel = (row: BillRow): string => (row.billNo != null ? `#${row.billNo}` : `ID ${row.id}`);

export const billingSummary = (rows: BillRow[]): BillingSummary => {
  const gross = sum(rows.map((r) => r.gross));
  const discount = sum(rows.map((r) => r.discount));
  const net = sum(rows.map((r) => r.net));
  const collected = sum(rows.map((r) => r.collected));
  const pending = sum(rows.map((r) => r.pending));
  const offFile = sum(rows.filter((r) => !r.onFile).map((r) => r.pending));
  return {
    bills: rows.length,
    withBalance: rows.filter((r) => r.pending > 0).length,
    gross,
    discount,
    discountPct: gross ? discount / gross : 0,
    net,
    collected,
    collectedPct: net ? collected / net : 0,
    pending,
    pendingOffFilePct: pending ? offFile / pending : 0,
  };
};

export const waterfall = (s: BillingSummary) => [
  { label: "Gross billed", value: s.gross },
  { label: "Discount", value: s.discount },
  { label: "Net billed", value: s.net },
  { label: "Collected", value: s.collected },
  { label: "Pending dues", value: s.pending },
];

const oldestFirst = (rows: BillRow[]) =>
  [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.id - b.id);

export const discountPerBill = (rows: BillRow[]) => ({
  bills: oldestFirst(rows).map((r) => ({ label: billLabel(r), pct: r.gross ? r.discount / r.gross : 0 })),
  weighted: billingSummary(rows).discountPct,
});

const groupOf = (rows: BillRow[]): BillGroup => {
  const s = billingSummary(rows);
  const sorted = oldestFirst(rows);
  return {
    bills: s.bills,
    gross: s.gross,
    net: s.net,
    avgNet: s.bills ? s.net / s.bills : 0,
    discountRate: s.discountPct,
    collectedShare: s.collectedPct,
    pending: s.pending,
    customers: new Set(rows.map((r) => r.userId)).size,
    withPhoto: rows.filter((r) => r.photo).length,
    from: sorted[0]?.date ?? null,
    to: sorted[sorted.length - 1]?.date ?? null,
  };
};

export const numberedVsEarlier = (rows: BillRow[]) => ({
  numbered: groupOf(rows.filter((r) => r.billNo != null)),
  earlier: groupOf(rows.filter((r) => r.billNo == null)),
});
```

`together.ts`:

```ts
import { sum } from "../periods";
import { BillRow } from "./billing";
import { PledgeRow } from "./pledges";

export interface LedgerScale {
  openBook: number;
  redeemedPrincipal: number;
  netBilled: number;
  pending: number;
  ratio: number | null; // open book ÷ net billed
}

export interface VillageShare {
  village: string;
  pledgeShare: number; // of pledge principal
  billShare: number; // of net billed
}

export const ledgerScale = (pledges: PledgeRow[], bills: BillRow[]): LedgerScale => {
  const openBook = sum(pledges.filter((p) => p.open).map((p) => p.principal));
  const netBilled = sum(bills.map((b) => b.net));
  return {
    openBook,
    redeemedPrincipal: sum(pledges.filter((p) => !p.open).map((p) => p.principal)),
    netBilled,
    pending: sum(bills.map((b) => b.pending)),
    ratio: netBilled ? openBook / netBilled : null,
  };
};

/** Each village as a share of its own ledger, so the two can be compared side by side. */
export const villageShares = (pledges: PledgeRow[], bills: BillRow[], order: string[]): VillageShare[] => {
  const principal = sum(pledges.map((p) => p.principal));
  const net = sum(bills.map((b) => b.net));
  const extra = [...new Set([...pledges.map((p) => p.village), ...bills.map((b) => b.village)])].filter(
    (v) => !order.includes(v),
  );
  return [...order, ...extra].map((village) => ({
    village,
    pledgeShare: principal ? sum(pledges.filter((p) => p.village === village).map((p) => p.principal)) / principal : 0,
    billShare: net ? sum(bills.filter((b) => b.village === village).map((b) => b.net)) / net : 0,
  }));
};
```

- [ ] **Step 4: Run** → PASS; tsc clean.
- [ ] **Step 5: Commit** — `git commit -m "Add billing and cross-ledger calculations for the insights report"`

---

### Task 5: Data quality and key findings

**Files:** Create `src/utils/analytics/report/quality.ts`, `quality.test.ts`, `findings.ts`, `findings.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4; `formatCompactRupees`, `formatInr`, `formatPct` (format); `villageName`, `groupVillages`, `MIN_VILLAGE_CUSTOMERS`, `OTHER_VILLAGES`, `UNKNOWN_VILLAGE` (villages).
- Produces: `CheckTag`, `QualityCheck {tag,title,detail,badge}`, `Coverage {label,share}`, `QualityReport {checks,coverage}`, `dataQuality(data, now?)`; `FindingTag`, `Finding {tag,title,detail}`, `keyFindings(pledges, bills, names: Map<number,string>)`.

- [ ] **Step 1: Failing tests** — `quality.test.ts`:

```ts
import { dataQuality } from "./quality";
import { NOW, fixtureData } from "./fixture";

const report = dataQuality(fixtureData, NOW);
const detail = (title: string) => report.checks.find((c) => c.title === title)!.detail;

describe("dataQuality checks", () => {
  it("lists checks Fix first, then Check, Note and Good", () => {
    expect(report.checks.map((c) => [c.tag, c.title, c.badge])).toEqual([
      ["Fix", "Customer records are missing", "ID 99"],
      ["Fix", "Bill balances do not reconcile", "3 of 6"],
      ["Check", "Possible duplicate customers", "1 pair"],
      ["Check", "No new pledges logged for 8 months", "Oct 2024 – May 2025"],
      ["Check", "Few pledges have a photo", "11.1%"],
      ["Check", "Phone numbers are mostly missing", "1 of 13"],
      ["Check", "1 pledge has no amount", "ID 9"],
      ["Note", "Item names are free text", "7 item types"],
      ["Note", "Village names are grouped", "3 villages"],
      ["Good", "Dates and statuses are consistent", "0 exceptions"],
    ]);
  });

  it("explains each check with the numbers behind it", () => {
    expect(detail("Customer records are missing")).toBe(
      "1 customer ID used by pledges or bills is not in the customer file. It covers 1 pledge (₹1,000) and 1 bill with ₹42,500 still due. Restore the customer before chasing the dues.",
    );
    expect(detail("Bill balances do not reconcile")).toBe(
      "3 of 6 bills have a received (jama) amount that is blank or different from net minus balance. Jama adds up to ₹60,500; the balance fields imply ₹78,700 collected. Choose one field as the source of truth.",
    );
    expect(detail("Possible duplicate customers")).toBe(
      "1 name and village combination appears on more than one customer ID, for example Ram (IDs 1 and 12, Manwal).",
    );
    expect(detail("Few pledges have a photo")).toBe("1 of 9 pledges and 1 of 6 bills have a photo. ₹78,000 of the open book has none.");
    expect(detail("1 pledge has no amount")).toBe("ID 9 (Payal) is counted as ₹0, which slightly understates principal.");
    expect(detail("Item names are free text")).toBe(
      "9 pledge names were grouped into 7 item types by keyword. 1 fell to Other and 1 has no item name. Add a keyword to group new spellings.",
    );
    expect(detail("Village names are grouped")).toBe(
      "3 villages after cleaning spelling and punctuation. Villages with fewer than 5 customers are grouped as Other villages. 1 customer has no village.",
    );
  });

  it("turns a clean ledger into Good checks", () => {
    const clean = dataQuality({ ...fixtureData, rehan: [], rehanTx: [], lenden: [], jama: [] }, NOW);
    expect(clean.checks.find((c) => c.title === "Customer records are complete")?.tag).toBe("Good");
    expect(clean.checks.some((c) => c.tag === "Fix")).toBe(false);
  });
});

describe("field coverage", () => {
  it("measures how complete each field is", () => {
    expect(report.coverage.map((c) => c.label)).toEqual([
      "Pledges linked to a customer on file",
      "Pledges with an amount",
      "Pledges with an item name",
      "Pledges with a photo",
      "Customers with a village",
      "Customers with a phone number",
      "Bills with a bill number",
      "Bills where received matches balance",
      "Bills whose customer is on file",
    ]);
    const shares = report.coverage.map((c) => c.share);
    [8 / 9, 8 / 9, 1, 1 / 9, 12 / 13, 1 / 13, 4 / 6, 3 / 6, 5 / 6].forEach((v, i) => expect(shares[i]).toBeCloseTo(v));
  });
});
```

`findings.test.ts`:

```ts
import { keyFindings } from "./findings";
import { buildPledgeRows } from "./pledges";
import { buildBillRows } from "./billing";
import { NOW, fixtureData } from "./fixture";
import { groupVillages } from "../villages";

const groups = groupVillages(fixtureData.users);
const pledges = buildPledgeRows(fixtureData, NOW, groups);
const bills = buildBillRows(fixtureData, groups, NOW);
const names = new Map(fixtureData.users.map((u) => [u.id, u.name]));

describe("keyFindings", () => {
  it("writes the findings the data supports, Risk first", () => {
    expect(keyFindings(pledges, bills, names)).toEqual([
      {
        tag: "Risk",
        title: "₹61K of ₹1.4L billed is unpaid",
        detail: "70% of it (₹42.5K) sits on 1 bill whose customer is not in the customer file. The oldest unpaid bill is 268 days old.",
      },
      {
        tag: "Watch",
        title: "Chain is the largest open exposure at ₹55K",
        detail: "63% of the open book. 0% of Chain pledges have been redeemed, against 22% for everything in this view. Average ticket ₹27.5K.",
      },
      {
        tag: "Watch",
        title: "Only 11% of pledges have a photo",
        detail: "₹78K of the open book (6 pledges) has no photo on record.",
      },
      {
        tag: "Upside",
        title: "14% of customers have pledged more than once",
        detail: "1 of 7 customers account for 15% of principal. 0 customers have seven or more pledges.",
      },
      {
        tag: "Upside",
        title: "Billing and pledging serve different customers",
        detail: "Only 1 of 5 billed customers also pledges. Pledge customers are a ready audience for jewellery sales.",
      },
      {
        tag: "Data",
        title: "No new pledge was logged for 8 months",
        detail: "Oct 2024 to May 2025 has no new pledge. Confirm before treating it as a quiet period.",
      },
    ]);
  });

  it("flags an old open book", () => {
    const old = keyFindings(pledges.filter((p) => p.year <= "2025"), [], names);
    expect(old[0]).toEqual({
      tag: "Risk",
      title: "100% of open principal is a year old or more",
      detail: "2 pledges worth ₹15K are past 12 months and 1 pledge worth ₹10K is past 24 months. Redeemed pledges took a median of 180 days.",
    });
  });

  it("says nothing without data", () => {
    expect(keyFindings([], [], names)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run** → FAIL (modules missing).

- [ ] **Step 3: Implement** — `quality.ts`:

```ts
import { AnalyticsData } from "../types";
import { sum } from "../periods";
import { formatInr } from "../format";
import { MIN_VILLAGE_CUSTOMERS, groupVillages, villageName } from "../villages";
import { buildPledgeRows } from "./pledges";
import { buildBillRows } from "./billing";
import { OTHER_ITEM, UNSPECIFIED_ITEM } from "./items";
import { loggingGap, monthLabelLong } from "./pledgeBook";

export type CheckTag = "Fix" | "Check" | "Note" | "Good";

export interface QualityCheck {
  tag: CheckTag;
  title: string;
  detail: string;
  badge: string;
}

export interface Coverage {
  label: string;
  share: number; // 0..1
}

export interface QualityReport {
  checks: QualityCheck[];
  coverage: Coverage[];
}

const TAG_ORDER: CheckTag[] = ["Fix", "Check", "Note", "Good"];
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const idList = (ids: number[]) => (ids.length === 1 ? `ID ${ids[0]}` : `IDs ${ids.join(", ")}`);
const pct1 = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;
const share = (n: number, of: number) => (of ? n / of : 0);
const hasPhone = (mobile: string | null | undefined) => (mobile ?? "").trim() !== "";

/** Spec §12.7: always the whole ledger, never filtered. */
export const dataQuality = (data: AnalyticsData, now: Date = new Date()): QualityReport => {
  const groups = groupVillages(data.users);
  const pledges = buildPledgeRows(data, now, groups);
  const bills = buildBillRows(data, groups, now);
  const checks: QualityCheck[] = [];

  const missingPledges = pledges.filter((p) => !p.onFile);
  const missingBills = bills.filter((b) => !b.onFile);
  const missingIds = [...new Set([...missingPledges, ...missingBills].map((x) => x.userId))].sort((a, b) => a - b);
  if (missingIds.length) {
    const one = missingIds.length === 1;
    checks.push({
      tag: "Fix",
      title: "Customer records are missing",
      badge: idList(missingIds),
      detail:
        `${plural(missingIds.length, "customer ID")} used by pledges or bills ${one ? "is" : "are"} not in the customer file. ` +
        `${one ? "It covers" : "They cover"} ${plural(missingPledges.length, "pledge")} ` +
        `(${formatInr(sum(missingPledges.map((p) => p.principal)))}) and ${plural(missingBills.length, "bill")} ` +
        `with ${formatInr(sum(missingBills.map((b) => b.pending)))} still due. Restore the customer before chasing the dues.`,
    });
  } else {
    checks.push({
      tag: "Good",
      title: "Customer records are complete",
      badge: "0 missing",
      detail: "Every pledge and bill points to a customer on file.",
    });
  }

  const unreconciled = bills.filter((b) => b.received !== b.collected);
  if (unreconciled.length) {
    checks.push({
      tag: "Fix",
      title: "Bill balances do not reconcile",
      badge: `${unreconciled.length} of ${bills.length}`,
      detail:
        `${unreconciled.length} of ${bills.length} bills have a received (jama) amount that is blank or different from net minus balance. ` +
        `Jama adds up to ${formatInr(sum(bills.map((b) => b.received)))}; the balance fields imply ` +
        `${formatInr(sum(bills.map((b) => b.collected)))} collected. Choose one field as the source of truth.`,
    });
  } else if (bills.length) {
    checks.push({
      tag: "Good",
      title: "Bill balances reconcile",
      badge: `${bills.length} of ${bills.length}`,
      detail: "Every bill's received amount matches net minus balance.",
    });
  }

  const byNameVillage = new Map<string, number[]>();
  for (const u of data.users) {
    const key = `${u.name.trim().toLowerCase()}|${villageName(u.address).toLowerCase()}`;
    const ids = byNameVillage.get(key) ?? [];
    ids.push(u.id);
    byNameVillage.set(key, ids);
  }
  const duplicates = [...byNameVillage.values()].filter((ids) => ids.length > 1);
  if (duplicates.length) {
    const example = data.users.find((u) => u.id === duplicates[0][0])!;
    checks.push({
      tag: "Check",
      title: "Possible duplicate customers",
      badge: plural(duplicates.length, "pair"),
      detail:
        `${plural(duplicates.length, "name and village combination")} ${duplicates.length === 1 ? "appears" : "appear"} ` +
        `on more than one customer ID, for example ${example.name} (IDs ${duplicates[0].join(" and ")}, ` +
        `${villageName(example.address) || "no village"}).`,
    });
  }

  const gap = loggingGap(pledges);
  if (gap) {
    const from = monthLabelLong(gap.from);
    const to = monthLabelLong(gap.to);
    checks.push({
      tag: "Check",
      title: `No new pledges logged for ${gap.months} months`,
      badge: `${from} – ${to}`,
      detail: `${from} to ${to} has no new pledge. Confirm whether pledging paused or entries were skipped.`,
    });
  }

  if (pledges.length) {
    const withPhoto = pledges.filter((p) => p.photo).length;
    const photoShare = withPhoto / pledges.length;
    if (photoShare < 0.5) {
      const openNoPhoto = sum(pledges.filter((p) => p.open && !p.photo).map((p) => p.principal));
      checks.push({
        tag: "Check",
        title: "Few pledges have a photo",
        badge: pct1(photoShare),
        detail:
          `${withPhoto} of ${pledges.length} pledges and ${bills.filter((b) => b.photo).length} of ${bills.length} bills have a photo. ` +
          `${formatInr(openNoPhoto)} of the open book has none.`,
      });
    } else {
      checks.push({
        tag: "Good",
        title: "Most pledges have a photo",
        badge: pct1(photoShare),
        detail: `${withPhoto} of ${pledges.length} pledges have a photo.`,
      });
    }
  }

  if (data.users.length) {
    const phones = data.users.filter((u) => hasPhone(u.mobileNumber)).length;
    if (phones / data.users.length < 0.5) {
      checks.push({
        tag: "Check",
        title: "Phone numbers are mostly missing",
        badge: `${phones} of ${data.users.length}`,
        detail: `${phones} of ${data.users.length} customers have a mobile number, so reminders and collection calls cannot start from this data.`,
      });
    } else {
      checks.push({
        tag: "Good",
        title: "Most customers have a phone number",
        badge: `${phones} of ${data.users.length}`,
        detail: `${phones} of ${data.users.length} customers have a mobile number.`,
      });
    }
  }

  const noAmount = pledges.filter((p) => p.principal <= 0);
  if (noAmount.length === 1) {
    const p = noAmount[0];
    checks.push({
      tag: "Check",
      title: "1 pledge has no amount",
      badge: `ID ${p.id}`,
      detail: `ID ${p.id} (${p.name || "no item name"}) is counted as ₹0, which slightly understates principal.`,
    });
  } else if (noAmount.length > 1) {
    checks.push({
      tag: "Check",
      title: `${noAmount.length} pledges have no amount`,
      badge: `${noAmount.length} pledges`,
      detail: `${idList(noAmount.map((p) => p.id))} are counted as ₹0, which understates principal.`,
    });
  }

  if (pledges.length) {
    const types = new Set(pledges.map((p) => p.item)).size;
    const other = pledges.filter((p) => p.item === OTHER_ITEM).length;
    const unspecified = pledges.filter((p) => p.item === UNSPECIFIED_ITEM).length;
    checks.push({
      tag: "Note",
      title: "Item names are free text",
      badge: plural(types, "item type"),
      detail:
        `${plural(pledges.length, "pledge name")} ${pledges.length === 1 ? "was" : "were"} grouped into ${plural(types, "item type")} by keyword. ` +
        `${other} fell to Other and ${unspecified} ${unspecified === 1 ? "has" : "have"} no item name. Add a keyword to group new spellings.`,
    });
  }

  if (data.users.length) {
    const villages = new Set(data.users.map((u) => villageName(u.address).toLowerCase()).filter(Boolean)).size;
    const noVillage = data.users.filter((u) => villageName(u.address) === "").length;
    checks.push({
      tag: "Note",
      title: "Village names are grouped",
      badge: plural(villages, "village"),
      detail:
        `${plural(villages, "village")} after cleaning spelling and punctuation. Villages with fewer than ` +
        `${MIN_VILLAGE_CUSTOMERS} customers are grouped as Other villages.` +
        (noVillage ? ` ${plural(noVillage, "customer")} ${noVillage === 1 ? "has" : "have"} no village.` : ""),
    });
  }

  const closedNoDate = data.rehan.filter((r) => r.status === 1 && !r.closedDate).length;
  const closedBeforeOpen = data.rehan.filter(
    (r) => r.closedDate && new Date(r.closedDate).getTime() < new Date(r.openDate).getTime(),
  ).length;
  const openWithDate = data.rehan.filter((r) => (r.status ?? 0) === 0 && r.closedDate).length;
  const exceptions = closedNoDate + closedBeforeOpen + openWithDate;
  if (exceptions) {
    checks.push({
      tag: "Check",
      title: "Dates or statuses need a look",
      badge: plural(exceptions, "exception"),
      detail: `${closedNoDate} redeemed without a close date, ${closedBeforeOpen} closed before opening, ${openWithDate} open with a close date.`,
    });
  } else {
    checks.push({
      tag: "Good",
      title: "Dates and statuses are consistent",
      badge: "0 exceptions",
      detail: "No pledge closes before it opens, every redeemed pledge has a close date and every open one has none.",
    });
  }

  const coverage: Coverage[] = [
    { label: "Pledges linked to a customer on file", share: share(pledges.filter((p) => p.onFile).length, pledges.length) },
    { label: "Pledges with an amount", share: share(pledges.filter((p) => p.principal > 0).length, pledges.length) },
    { label: "Pledges with an item name", share: share(pledges.filter((p) => p.name.trim() !== "").length, pledges.length) },
    { label: "Pledges with a photo", share: share(pledges.filter((p) => p.photo).length, pledges.length) },
    { label: "Customers with a village", share: share(data.users.filter((u) => villageName(u.address) !== "").length, data.users.length) },
    { label: "Customers with a phone number", share: share(data.users.filter((u) => hasPhone(u.mobileNumber)).length, data.users.length) },
    { label: "Bills with a bill number", share: share(bills.filter((b) => b.billNo != null).length, bills.length) },
    { label: "Bills where received matches balance", share: share(bills.filter((b) => b.received === b.collected).length, bills.length) },
    { label: "Bills whose customer is on file", share: share(bills.filter((b) => b.onFile).length, bills.length) },
  ];

  return { checks: TAG_ORDER.flatMap((tag) => checks.filter((c) => c.tag === tag)), coverage };
};
```

`findings.ts`:

```ts
import { sum } from "../periods";
import { formatCompactRupees, formatInr, formatPct } from "../format";
import { OTHER_VILLAGES, UNKNOWN_VILLAGE } from "../villages";
import { PledgeRow } from "./pledges";
import { BillRow, billingSummary } from "./billing";
import { loggingGap, monthLabelLong, pledgeStats } from "./pledgeBook";
import { itemStats } from "./itemsView";

export type FindingTag = "Risk" | "Watch" | "Upside" | "Data";

export interface Finding {
  tag: FindingTag;
  title: string;
  detail: string;
}

const inrC = (n: number) => `₹${formatCompactRupees(n)}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const isNamed = (v: string) => v !== OTHER_VILLAGES && v !== UNKNOWN_VILLAGE;

/** Spec §12.6. `pledges` carry the report filters; `bills` follow the village filter only. */
export const keyFindings = (pledges: PledgeRow[], bills: BillRow[], names: Map<number, string>): Finding[] => {
  const out: Finding[] = [];
  const s = pledgeStats(pledges);
  const open = pledges.filter((p) => p.open);

  if (s.openBook > 0 && s.openYearPlusShare >= 0.25) {
    const y1 = open.filter((p) => (p.daysOpen ?? 0) >= 365);
    const y2 = open.filter((p) => (p.daysOpen ?? 0) >= 730);
    const verb = (n: number) => (n === 1 ? "is" : "are");
    out.push({
      tag: "Risk",
      title: `${formatPct(s.openYearPlusShare)} of open principal is a year old or more`,
      detail:
        `${plural(y1.length, "pledge")} worth ${inrC(sum(y1.map((p) => p.principal)))} ${verb(y1.length)} past 12 months and ` +
        `${plural(y2.length, "pledge")} worth ${inrC(sum(y2.map((p) => p.principal)))} ${verb(y2.length)} past 24 months.` +
        (s.medianDaysToRedeem !== null ? ` Redeemed pledges took a median of ${Math.round(s.medianDaysToRedeem)} days.` : ""),
    });
  }

  const b = billingSummary(bills);
  if (b.pending > 0) {
    const offFile = bills.filter((x) => !x.onFile && x.pending > 0);
    const offAmount = sum(offFile.map((x) => x.pending));
    const oldest = bills.reduce((m, x) => Math.max(m, x.daysOpen ?? 0), 0);
    const parts: string[] = [];
    if (offAmount > 0) {
      parts.push(
        `${formatPct(offAmount / b.pending)} of it (${inrC(offAmount)}) sits on ${plural(offFile.length, "bill")} whose customer is not in the customer file.`,
      );
    }
    parts.push(`The oldest unpaid bill is ${oldest} days old.`);
    out.push({ tag: "Risk", title: `${inrC(b.pending)} of ${inrC(b.net)} billed is unpaid`, detail: parts.join(" ") });
  }

  const openByVillage = new Map<string, number>();
  for (const p of open) openByVillage.set(p.village, (openByVillage.get(p.village) ?? 0) + p.principal);
  const named = [...openByVillage].filter(([v]) => isNamed(v)).sort((x, y) => y[1] - x[1]);
  if (s.openBook > 0 && named.length >= 3) {
    const [first, second] = named;
    const topShare = (first[1] + second[1]) / s.openBook;
    if (topShare >= 0.4) {
      out.push({
        tag: "Watch",
        title: `${first[0]} and ${second[0]} hold ${formatPct(topShare)} of the open book`,
        detail: `${first[0]} ${inrC(first[1])} and ${second[0]} ${inrC(second[1])} out of ${inrC(s.openBook)}.`,
      });
    }
  }

  const items = itemStats(pledges)
    .filter((i) => i.openPrincipal > 0)
    .sort((x, y) => y.openPrincipal - x.openPrincipal);
  if (items.length >= 2) {
    const top = items[0];
    out.push({
      tag: "Watch",
      title: `${top.item} is the largest open exposure at ${inrC(top.openPrincipal)}`,
      detail:
        `${formatPct(top.openShare)} of the open book. ${formatPct(top.redeemedPct)} of ${top.item} pledges have been redeemed, ` +
        `against ${formatPct(s.redeemedPct)} for everything in this view. Average ticket ${inrC(top.avgTicket)}.`,
    });
  }

  const villageRates = [...new Set(pledges.map((p) => p.village))]
    .filter(isNamed)
    .map((village) => {
      const vs = pledgeStats(pledges.filter((p) => p.village === village));
      return { village, pledges: vs.pledges, redeemed: vs.redeemed, rate: vs.redeemedPct, open: vs.openBook };
    })
    .filter((v) => v.pledges >= 10)
    .sort((x, y) => x.rate - y.rate);
  if (villageRates.length >= 2 && villageRates[0].rate < villageRates[villageRates.length - 1].rate) {
    const worst = villageRates[0];
    const best = villageRates[villageRates.length - 1];
    out.push({
      tag: "Watch",
      title: `${worst.village} has redeemed only ${formatPct(worst.rate)} of its pledges`,
      detail:
        `${worst.redeemed} of ${worst.pledges} pledges, with ${inrC(worst.open)} still open. The best village, ${best.village}, ` +
        `is at ${formatPct(best.rate)}. Everything in this view is at ${formatPct(s.redeemedPct)}.`,
    });
  }

  const openByCustomer = new Map<number, number>();
  for (const p of open) openByCustomer.set(p.userId, (openByCustomer.get(p.userId) ?? 0) + p.principal);
  const ranked = [...openByCustomer].filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
  if (ranked.length > 10 && s.openBook > 0) {
    const big = ranked.filter(([, v]) => v >= 50000).length;
    const [largestId, largest] = ranked[0];
    out.push({
      tag: "Watch",
      title: `The ten largest customers hold ${formatPct(sum(ranked.slice(0, 10).map(([, v]) => v)) / s.openBook)} of open principal`,
      detail:
        `${plural(big, "customer")} ${big === 1 ? "has" : "have"} ₹50,000 or more open. ` +
        `The largest is ${names.get(largestId) ?? `Customer #${largestId}`} at ${formatInr(largest)}.`,
    });
  }

  if (pledges.length) {
    const photoShare = pledges.filter((p) => p.photo).length / pledges.length;
    if (photoShare < 0.5) {
      const noPhoto = open.filter((p) => !p.photo);
      out.push({
        tag: "Watch",
        title: `Only ${formatPct(photoShare)} of pledges have a photo`,
        detail: `${inrC(sum(noPhoto.map((p) => p.principal)))} of the open book (${plural(noPhoto.length, "pledge")}) has no photo on record.`,
      });
    }
  }

  const perCustomer = new Map<number, { count: number; principal: number }>();
  for (const p of pledges) {
    const c = perCustomer.get(p.userId) ?? { count: 0, principal: 0 };
    c.count++;
    c.principal += p.principal;
    perCustomer.set(p.userId, c);
  }
  const repeat = [...perCustomer.values()].filter((c) => c.count > 1);
  if (repeat.length && s.principal > 0) {
    const seven = repeat.filter((c) => c.count >= 7).length;
    out.push({
      tag: "Upside",
      title: `${formatPct(repeat.length / perCustomer.size)} of customers have pledged more than once`,
      detail:
        `${repeat.length} of ${perCustomer.size} customers account for ${formatPct(sum(repeat.map((c) => c.principal)) / s.principal)} of principal. ` +
        `${plural(seven, "customer")} ${seven === 1 ? "has" : "have"} seven or more pledges.`,
    });
  }

  const billed = new Set(bills.filter((x) => x.onFile).map((x) => x.userId));
  const pledging = new Set(pledges.filter((p) => p.onFile).map((p) => p.userId));
  if (billed.size && pledging.size) {
    const both = [...billed].filter((u) => pledging.has(u)).length;
    if (both / billed.size < 0.5) {
      out.push({
        tag: "Upside",
        title: "Billing and pledging serve different customers",
        detail: `Only ${both} of ${billed.size} billed customers also ${both === 1 ? "pledges" : "pledge"}. Pledge customers are a ready audience for jewellery sales.`,
      });
    }
  }

  const gap = loggingGap(pledges);
  if (gap) {
    out.push({
      tag: "Data",
      title: `No new pledge was logged for ${gap.months} months`,
      detail: `${monthLabelLong(gap.from)} to ${monthLabelLong(gap.to)} has no new pledge. Confirm before treating it as a quiet period.`,
    });
  }

  return out;
};
```

- [ ] **Step 4: Run** → PASS; full `npx jest`; tsc clean.
- [ ] **Step 5: Commit** — `git commit -m "Add data quality checks and key findings for the insights report"`

---

### Task 6: Shared report UI components

**Files:**
- Modify: `src/components/analytics/BarChart.tsx` (add `labelEvery`)
- Create: `src/components/analytics/report/ReportCard.tsx`, `Segmented.tsx`, `HBars.tsx`, `DataTable.tsx`, `TagPill.tsx`, `PledgeFilterBar.tsx`

**Interfaces:**
- Consumes: `PledgeFilters`, `ALL_PLEDGES` (Task 1).
- Produces: `ReportCard {title, subtitle?, right?, children}`; `Segmented<T extends string> {options: {key: T; label: string}[]; value: T; onChange(T)}`; `HBars {rows: HBarRow[]; emptyText?; labelWidth?}` with `HBarRow {key, label, value, display, muted?, highlight?, color?, onPress?}`; `DataTable<R> {columns: Column<R>[]; rows: R[]; rowKey(R); initialSort?: {key, desc}; onRowPress?(R); emptyText?}` with `Column<R> {key, title, width, align?, text(R), sortValue?(R), shade?(R), render?(R)}`; `TagPill {label, tone?}`; `PledgeFilterBar {filters, options: {villages, items, years}, showing, total, onChange(f)}`; `BarChart` new optional prop `labelEvery?: number`.

UI has no Jest tests (Jest runs `.ts` in node only). Verification is `npx tsc --noEmit` and the full `npx jest` still passing.

- [ ] **Step 1: `BarChart.tsx`** — add `labelEvery?: number;` to `BarChartProps`, destructure it with default `1`, and change the label row to:

```tsx
      <View style={styles.labels}>
        {buckets.map((bucket, i) => (
          <Text key={bucket.key} style={styles.label} numberOfLines={1}>
            {i % labelEvery === 0 ? bucket.label : ""}
          </Text>
        ))}
      </View>
```

- [ ] **Step 2: `ReportCard.tsx`**

```tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";

/** A titled card with an optional one-line explanation and a control on the right. */
export const ReportCard: React.FC<{
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, right, children }) => (
  <View style={styles.card}>
    <View style={styles.head}>
      <View style={styles.headText}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
    {right ? <View style={styles.right}>{right}</View> : null}
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EEF0F2",
  },
  head: { flexDirection: "row", marginBottom: 8 },
  headText: { flex: 1 },
  title: { fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  subtitle: { fontSize: 12, color: "#777", marginTop: 3, lineHeight: 17 },
  right: { marginBottom: 10 },
});

export default ReportCard;
```

- [ ] **Step 3: `Segmented.tsx`**

```tsx
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
}

/** A row of small chips; scrolls sideways when there are many. */
const Segmented = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (key: T) => void;
}) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
    {options.map((o) => (
      <TouchableOpacity key={o.key} style={[styles.chip, value === o.key && styles.active]} onPress={() => onChange(o.key)}>
        <Text style={[styles.text, value === o.key && styles.activeText]}>{o.label}</Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

const styles = StyleSheet.create({
  row: { gap: 6 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E8D5AF",
    backgroundColor: "#fff",
  },
  active: { backgroundColor: "#8C5B14", borderColor: "#8C5B14" },
  text: { fontSize: 12, fontWeight: "700", color: "#8C5B14" },
  activeText: { color: "#fff" },
});

export default Segmented;
```

- [ ] **Step 4: `HBars.tsx`**

```tsx
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export interface HBarRow {
  key: string;
  label: string;
  value: number;
  display: string;
  muted?: boolean; // e.g. "All other items", "Other villages"
  highlight?: boolean; // the row picked in the filters
  color?: string;
  onPress?: () => void;
}

/** Horizontal bars, one row each, scaled to the largest value. */
const HBars: React.FC<{ rows: HBarRow[]; emptyText?: string; labelWidth?: number }> = ({
  rows,
  emptyText = "No data in this view",
  labelWidth = 104,
}) => {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0);
  if (max <= 0) return <Text style={styles.empty}>{emptyText}</Text>;
  return (
    <View>
      {rows.map((r) => {
        const fill = Math.max(0, r.value) / max;
        const body = (
          <View style={styles.row}>
            <Text style={[styles.label, { width: labelWidth }, r.highlight && styles.bold]} numberOfLines={1}>
              {r.label}
            </Text>
            <View style={styles.track}>
              <View
                style={{
                  flex: fill,
                  backgroundColor: r.color ?? (r.muted ? "#B9B2A6" : r.highlight ? "#8C5B14" : "#B8860B"),
                  borderRadius: 3,
                }}
              />
              <View style={{ flex: 1 - fill }} />
            </View>
            <Text style={[styles.value, r.highlight && styles.bold]}>{r.display}</Text>
          </View>
        );
        return r.onPress ? (
          <TouchableOpacity key={r.key} onPress={r.onPress}>
            {body}
          </TouchableOpacity>
        ) : (
          <View key={r.key}>{body}</View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  label: { fontSize: 12, color: "#444" },
  track: { flex: 1, height: 12, flexDirection: "row" },
  value: { minWidth: 64, textAlign: "right", fontSize: 12, fontWeight: "700", color: "#1A1A1A" },
  bold: { fontWeight: "800", color: "#1A1A1A" },
  empty: { color: "#999", fontSize: 13, paddingVertical: 12 },
});

export default HBars;
```

- [ ] **Step 5: `DataTable.tsx`**

```tsx
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export interface Column<R> {
  key: string;
  title: string;
  width: number;
  align?: "left" | "right";
  text: (row: R) => string;
  sortValue?: (row: R) => number | string; // tap the header to sort
  shade?: (row: R) => number; // 0..1, drawn as a bar behind the cell
  render?: (row: R) => React.ReactNode; // replaces text when given
}

/** A sideways-scrolling table; tap a sortable header to sort, tap again to flip. */
const DataTable = <R,>({
  columns,
  rows,
  rowKey,
  initialSort,
  onRowPress,
  emptyText = "No rows in this view",
}: {
  columns: Column<R>[];
  rows: R[];
  rowKey: (row: R) => string;
  initialSort?: { key: string; desc: boolean };
  onRowPress?: (row: R) => void;
  emptyText?: string;
}) => {
  const [sort, setSort] = useState(initialSort ?? null);
  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key);
    if (!col || !col.sortValue) return rows;
    const value = col.sortValue;
    return [...rows].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort!.desc ? -cmp : cmp;
    });
  }, [rows, columns, sort]);

  if (rows.length === 0) return <Text style={styles.empty}>{emptyText}</Text>;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View>
        <View style={[styles.row, styles.header]}>
          {columns.map((c) => (
            <TouchableOpacity
              key={c.key}
              disabled={!c.sortValue}
              onPress={() => setSort((s) => ({ key: c.key, desc: s?.key === c.key ? !s.desc : true }))}
              style={{ width: c.width }}
            >
              <Text style={[styles.headerText, c.align === "right" && styles.right]}>
                {c.title}
                {sort?.key === c.key ? (sort.desc ? " ↓" : " ↑") : ""}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {sorted.map((row) => {
          const cells = (
            <View style={styles.row}>
              {columns.map((c) => {
                const shade = c.shade ? Math.max(0, Math.min(1, c.shade(row))) : 0;
                return (
                  <View key={c.key} style={[styles.cell, { width: c.width }]}>
                    {shade > 0 && <View style={[styles.shade, { width: `${shade * 100}%` }]} />}
                    {c.render ? (
                      c.render(row)
                    ) : (
                      <Text style={[styles.cellText, c.align === "right" && styles.right]} numberOfLines={1}>
                        {c.text(row)}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          );
          return onRowPress ? (
            <TouchableOpacity key={rowKey(row)} onPress={() => onRowPress(row)}>
              {cells}
            </TouchableOpacity>
          ) : (
            <View key={rowKey(row)}>{cells}</View>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#F0F2F5" },
  header: { backgroundColor: "#FAF1E2" },
  headerText: { fontSize: 11, fontWeight: "800", color: "#8C5B14", paddingVertical: 8, paddingHorizontal: 6 },
  cell: { paddingVertical: 8, paddingHorizontal: 6, justifyContent: "center" },
  cellText: { fontSize: 12.5, color: "#1A1A1A" },
  right: { textAlign: "right" },
  shade: { position: "absolute", left: 0, top: 3, bottom: 3, backgroundColor: "#F3E3C3", borderRadius: 3 },
  empty: { color: "#999", fontSize: 13, paddingVertical: 12 },
});

export default DataTable;
```

- [ ] **Step 6: `TagPill.tsx`**

```tsx
import React from "react";
import { StyleSheet, Text } from "react-native";

const TONES: Record<string, { bg: string; fg: string }> = {
  Risk: { bg: "#FDECEC", fg: "#C62828" },
  Fix: { bg: "#FDECEC", fg: "#C62828" },
  red: { bg: "#FDECEC", fg: "#C62828" },
  Watch: { bg: "#FFF4E0", fg: "#B26A00" },
  Check: { bg: "#FFF4E0", fg: "#B26A00" },
  Upside: { bg: "#EEF8EF", fg: "#2E7D32" },
  Good: { bg: "#EEF8EF", fg: "#2E7D32" },
  Data: { bg: "#EEF2FB", fg: "#3557A7" },
  Note: { bg: "#EEF2FB", fg: "#3557A7" },
  grey: { bg: "#F1F1F1", fg: "#666" },
};

/** Small coloured label: finding and check tags, and bill flags (tone "red" / "grey"). */
export const TagPill: React.FC<{ label: string; tone?: string }> = ({ label, tone }) => {
  const t = TONES[tone ?? label] ?? TONES.grey;
  return <Text style={[styles.pill, { backgroundColor: t.bg, color: t.fg }]}>{label}</Text>;
};

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
  },
});

export default TagPill;
```

- [ ] **Step 7: `PledgeFilterBar.tsx`**

```tsx
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ALL_PLEDGES, PledgeFilters } from "../../../utils/analytics/report/pledges";
import Segmented from "./Segmented";

const ChipRow: React.FC<{
  label: string;
  allLabel: string;
  values: string[];
  value: string;
  onChange: (v: string) => void;
}> = ({ label, allLabel, values, value, onChange }) => (
  <View style={styles.group}>
    <Text style={styles.groupLabel}>{label}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {["all", ...values].map((v) => (
        <TouchableOpacity key={v} style={[styles.chip, value === v && styles.active]} onPress={() => onChange(v)}>
          <Text style={[styles.chipText, value === v && styles.activeText]}>{v === "all" ? allLabel : v}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

/** The report's pledge filters (spec §12.1), folded into one line until opened. */
const PledgeFilterBar: React.FC<{
  filters: PledgeFilters;
  options: { villages: string[]; items: string[]; years: string[] };
  showing: number;
  total: number;
  onChange: (f: PledgeFilters) => void;
}> = ({ filters, options, showing, total, onChange }) => {
  const [open, setOpen] = useState(false);
  const active = filters.village !== "all" || filters.item !== "all" || filters.year !== "all" || filters.status !== "all";
  const summary = [
    filters.village === "all" ? "All villages" : filters.village,
    filters.item === "all" ? "All items" : filters.item,
    filters.year === "all" ? "All years" : filters.year,
    filters.status === "all" ? "All" : filters.status === "open" ? "Open" : "Redeemed",
  ].join(" · ");
  return (
    <View style={styles.bar}>
      <TouchableOpacity style={styles.summaryRow} onPress={() => setOpen((o) => !o)}>
        <View style={styles.summaryText}>
          <Text style={styles.summary} numberOfLines={1}>{summary}</Text>
          <Text style={styles.showing}>
            Showing {showing} of {total} pledges
          </Text>
        </View>
        <Text style={styles.toggle}>{open ? "Done" : "Filter"}</Text>
      </TouchableOpacity>
      {open && (
        <View>
          <ChipRow label="Village" allLabel="All villages" values={options.villages} value={filters.village} onChange={(village) => onChange({ ...filters, village })} />
          <ChipRow label="Item" allLabel="All items" values={options.items} value={filters.item} onChange={(item) => onChange({ ...filters, item })} />
          <ChipRow label="Opened in" allLabel="All years" values={options.years} value={filters.year} onChange={(year) => onChange({ ...filters, year })} />
          <View style={styles.statusRow}>
            <Segmented
              options={[
                { key: "all", label: "All" },
                { key: "open", label: "Open" },
                { key: "redeemed", label: "Redeemed" },
              ]}
              value={filters.status}
              onChange={(status) => onChange({ ...filters, status })}
            />
            {active && (
              <TouchableOpacity onPress={() => onChange(ALL_PLEDGES)}>
                <Text style={styles.reset}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#EEF0F2", padding: 10 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  summaryText: { flex: 1 },
  summary: { fontSize: 13, fontWeight: "700", color: "#1A1A1A" },
  showing: { fontSize: 11, color: "#888", marginTop: 2 },
  toggle: { fontSize: 13, fontWeight: "800", color: "#8C5B14" },
  group: { marginTop: 10 },
  groupLabel: { fontSize: 10, fontWeight: "800", color: "#888", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 5 },
  chips: { gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1.5, borderColor: "#E8D5AF", backgroundColor: "#fff" },
  active: { backgroundColor: "#8C5B14", borderColor: "#8C5B14" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#8C5B14" },
  activeText: { color: "#fff" },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  reset: { fontSize: 13, fontWeight: "800", color: "#C62828", paddingHorizontal: 8 },
});

export default PledgeFilterBar;
```

- [ ] **Step 8: Verify** — `npx tsc --noEmit` clean; `npx jest` all pass.
- [ ] **Step 9: Commit** — `git commit -m "Add shared components for the insights report"`

---

### Task 7: Report tabs — Overview, Rehan book, Items, Customers & Villages

**Files:** Create `src/components/analytics/report/OverviewTab.tsx`, `RehanBookTab.tsx`, `ItemsTab.tsx`, `CustomersVillagesTab.tsx`

**Interfaces:**
- Consumes: Task 2 (`pledgeStats`, `monthlyBook`, `ageBuckets`, `redeemBuckets`, `sizeBands`, `cohorts`, `weekdays`, `interestWhatIf`), Task 3 (`rankItems`, `itemStats`, `itemMixByQuarter`, `bundleStats`, `villageStats`, `concentration`, `exposures`, `repeatCustomers`, `customersAdded`, `customerSegments`), Task 4 (`billingSummary`, `BillRow`), Task 5 (`keyFindings`), Task 6 components; `BarChart`, `StatTile`, `StatGrid` (existing); `formatCompactRupees`, `formatInr`, `formatPct` (format); `OTHER_VILLAGES`, `UNKNOWN_VILLAGE`, `VillageGroups` (villages).
- Produces: default-exported components with props:
  - `OverviewTab {pledges: PledgeRow[]; bills: BillRow[]; names: Map<number,string>; customersOnFile: number}`
  - `RehanBookTab {pledges: PledgeRow[]; now: Date}`
  - `ItemsTab {pledges: PledgeRow[]; rankingPledges: PledgeRow[]; selectedItem: string; now: Date}`
  - `CustomersVillagesTab {pledges: PledgeRow[]; rankingPledges: PledgeRow[]; allPledges: PledgeRow[]; data: AnalyticsData; groups: VillageGroups; village: string; onCustomerPress(userId, name)}`

Shared helpers used below (define at the top of each file that needs them):
```ts
const inrC = (n: number) => `₹${formatCompactRupees(n)}`;
const days = (n: number | null) => (n === null ? "—" : String(Math.round(n)));
```
Colours: opened/principal `#B8860B`, redeemed/good `#2E7D32`, secondary `#E3C489`, open principal `#8C5B14`; stacked item mix: `["#B8860B", "#E65100", "#2E7D32", "#9AA5B1"]`.

- [ ] **Step 1: `OverviewTab.tsx`**

```tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PledgeRow } from "../../../utils/analytics/report/pledges";
import { BillRow, billingSummary } from "../../../utils/analytics/report/billing";
import { pledgeStats } from "../../../utils/analytics/report/pledgeBook";
import { keyFindings } from "../../../utils/analytics/report/findings";
import { formatCompactRupees, formatInr, formatPct } from "../../../utils/analytics/format";
import { StatGrid, StatTile } from "../StatTile";
import ReportCard from "./ReportCard";
import TagPill from "./TagPill";

const inrC = (n: number) => `₹${formatCompactRupees(n)}`;

const OverviewTab: React.FC<{
  pledges: PledgeRow[];
  bills: BillRow[];
  names: Map<number, string>;
  customersOnFile: number;
}> = ({ pledges, bills, names, customersOnFile }) => {
  const s = pledgeStats(pledges);
  const b = billingSummary(bills);
  const findings = keyFindings(pledges, bills, names);
  const openCustomers = new Set(pledges.filter((p) => p.open).map((p) => p.userId)).size;
  const openShare = s.principal ? s.openBook / s.principal : 0;
  return (
    <View>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>OPEN PLEDGE BOOK</Text>
        <Text style={styles.big}>{inrC(s.openBook)}</Text>
        <Text style={styles.exact}>{formatInr(s.openBook)}</Text>
        <Text style={styles.lede}>
          {s.open} open {s.open === 1 ? "pledge" : "pledges"} held for {openCustomers}{" "}
          {openCustomers === 1 ? "customer" : "customers"}. That is {formatPct(openShare)} of the {inrC(s.principal)} principal in
          this view.
        </Text>
        <View style={styles.track}>
          <View style={{ flex: openShare, backgroundColor: "#8C5B14" }} />
          <View style={{ flex: 1 - openShare, backgroundColor: "#2E7D32" }} />
        </View>
        <View style={styles.trackLabels}>
          <Text style={styles.trackLabel}>Open {inrC(s.openBook)}</Text>
          <Text style={styles.trackLabel}>Redeemed {inrC(s.redeemedPrincipal)}</Text>
        </View>
      </View>

      <StatGrid>
        <StatTile label="Customers pledging" value={String(s.customers)} hint={`of ${customersOnFile} on file`} />
        <StatTile label="Median pledge" value={formatInr(s.medianPledge)} hint={`Average ${formatInr(s.avgPledge)}`} />
        <StatTile label="Redeemed" value={formatPct(s.redeemedPct)} hint={`${s.redeemed} of ${s.pledges} pledges`} tone="good" />
        <StatTile
          label="Median days to redeem"
          value={s.medianDaysToRedeem === null ? "—" : String(Math.round(s.medianDaysToRedeem))}
          hint={s.meanDaysToRedeem === null ? "nothing redeemed yet" : `mean ${Math.round(s.meanDaysToRedeem)}`}
        />
        <StatTile
          label="Open a year or more"
          value={inrC(s.openYearPlus)}
          hint={`${formatPct(s.openYearPlusShare)} of the open book`}
          tone="warn"
        />
        <StatTile label="Pending bill dues" value={inrC(b.pending)} hint={`of ${inrC(b.net)} net billed`} tone="warn" />
      </StatGrid>

      <ReportCard
        title="Key findings"
        subtitle={`Worked out from the current filters. Billing findings follow the village filter only. ${s.pledges} pledges in view.`}
      >
        {findings.length === 0 ? (
          <Text style={styles.muted}>Nothing stands out in this view yet.</Text>
        ) : (
          findings.map((f, i) => (
            <View key={i} style={styles.finding}>
              <TagPill label={f.tag} />
              <Text style={styles.findingTitle}>{f.title}</Text>
              <Text style={styles.findingDetail}>{f.detail}</Text>
            </View>
          ))
        )}
      </ReportCard>
    </View>
  );
};

const styles = StyleSheet.create({
  hero: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#EEF0F2" },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1, color: "#8C5B14" },
  big: { fontSize: 40, fontWeight: "900", color: "#1A1A1A", marginTop: 4 },
  exact: { fontSize: 13, color: "#777" },
  lede: { fontSize: 13, color: "#444", marginTop: 8, lineHeight: 19 },
  track: { flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", marginTop: 12, backgroundColor: "#EEE" },
  trackLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  trackLabel: { fontSize: 11, color: "#777" },
  muted: { color: "#999", fontSize: 13 },
  finding: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#F0F2F5", gap: 4 },
  findingTitle: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  findingDetail: { fontSize: 13, color: "#555", lineHeight: 19 },
});

export default OverviewTab;
```

- [ ] **Step 2: `RehanBookTab.tsx`**

```tsx
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { PledgeRow } from "../../../utils/analytics/report/pledges";
import {
  Cohort, ageBuckets, cohorts, interestWhatIf, monthlyBook, pledgeStats, redeemBuckets, sizeBands, weekdays,
} from "../../../utils/analytics/report/pledgeBook";
import { formatCompactRupees, formatInr, formatPct } from "../../../utils/analytics/format";
import BarChart from "../BarChart";
import { StatGrid, StatTile } from "../StatTile";
import ReportCard from "./ReportCard";
import Segmented from "./Segmented";
import DataTable from "./DataTable";

const inrC = (n: number) => `₹${formatCompactRupees(n)}`;
const days = (n: number | null) => (n === null ? "—" : String(Math.round(n)));
const count = (n: number) => String(Math.round(n));
type Metric = "principal" | "pledges";
const METRICS: { key: Metric; label: string }[] = [
  { key: "principal", label: "Principal" },
  { key: "pledges", label: "Pledges" },
];
const asBuckets = (labels: string[]) => labels.map((label) => ({ key: label, label }));

const RehanBookTab: React.FC<{ pledges: PledgeRow[]; now: Date }> = ({ pledges, now }) => {
  const [flowMetric, setFlowMetric] = useState<Metric>("principal");
  const [ageMetric, setAgeMetric] = useState<Metric>("principal");
  const [sizeMetric, setSizeMetric] = useState<Metric>("pledges");
  const [rate, setRate] = useState(0.02);

  const s = pledgeStats(pledges);
  const months = monthlyBook(pledges, now);
  const monthBuckets = months.map((m) => ({ key: m.key, label: m.label }));
  const every = Math.max(1, Math.ceil(months.length / 6));
  const age = ageBuckets(pledges);
  const redeem = redeemBuckets(pledges);
  const size = sizeBands(pledges);
  const interest = interestWhatIf(pledges, rate);
  const money = flowMetric === "principal";

  return (
    <View>
      <ReportCard
        title="Opened and redeemed per month"
        subtitle={`${s.pledges} pledges opened, ${s.redeemed} redeemed.`}
        right={<Segmented options={METRICS} value={flowMetric} onChange={setFlowMetric} />}
      >
        <BarChart
          buckets={monthBuckets}
          labelEvery={every}
          series={[
            { label: "Opened", color: "#B8860B", values: months.map((m) => (money ? m.opened : m.openedCount)) },
            { label: "Redeemed", color: "#2E7D32", values: months.map((m) => (money ? m.redeemed : m.redeemedCount)) },
          ]}
          formatValue={money ? formatCompactRupees : count}
        />
      </ReportCard>

      <ReportCard
        title="Open principal at month-end"
        subtitle={`Principal on open pledges at each month-end. Now ${inrC(months.length ? months[months.length - 1].openAtEnd : 0)}.`}
      >
        <BarChart
          buckets={monthBuckets}
          labelEvery={every}
          series={[{ label: "Open principal", color: "#8C5B14", values: months.map((m) => m.openAtEnd) }]}
          formatValue={formatCompactRupees}
        />
      </ReportCard>

      <ReportCard
        title="How long open pledges have been open"
        subtitle={`${formatPct(s.openYearPlusShare)} of open principal is a year old or more (${inrC(s.openYearPlus)}).`}
        right={<Segmented options={METRICS} value={ageMetric} onChange={setAgeMetric} />}
      >
        <BarChart
          buckets={asBuckets(age.map((b) => b.label))}
          series={[{ label: "Open", color: "#8C5B14", values: age.map((b) => (ageMetric === "principal" ? b.principal : b.count)) }]}
          formatValue={ageMetric === "principal" ? formatCompactRupees : count}
        />
      </ReportCard>

      <ReportCard
        title="Time taken to redeem"
        subtitle={`Median ${days(s.medianDaysToRedeem)} days, mean ${days(s.meanDaysToRedeem)}. ${s.redeemed} pledges redeemed.`}
      >
        <BarChart
          buckets={asBuckets(redeem.map((b) => b.label))}
          series={[{ label: "Redeemed", color: "#2E7D32", values: redeem.map((b) => b.count) }]}
          formatValue={count}
        />
      </ReportCard>

      <ReportCard
        title="Pledge size"
        subtitle={`Median ${formatInr(s.medianPledge)}, average ${formatInr(s.avgPledge)}. Largest ${formatInr(s.largestPledge)}.`}
        right={
          <Segmented
            options={[
              { key: "pledges" as Metric, label: "Pledges" },
              { key: "principal" as Metric, label: "Principal" },
            ]}
            value={sizeMetric}
            onChange={setSizeMetric}
          />
        }
      >
        <BarChart
          buckets={asBuckets(size.map((b) => b.label))}
          series={[{ label: "Pledges", color: "#B8860B", values: size.map((b) => (sizeMetric === "principal" ? b.principal : b.count)) }]}
          formatValue={sizeMetric === "principal" ? formatCompactRupees : count}
        />
      </ReportCard>

      <ReportCard title="Cohorts by year opened" subtitle="Each year's pledges: how much is still open and how fast the rest came back.">
        <DataTable<Cohort>
          rows={cohorts(pledges)}
          rowKey={(c) => c.year}
          columns={[
            { key: "year", title: "Opened", width: 64, text: (c) => c.year },
            { key: "pledges", title: "Pledges", width: 66, align: "right", text: (c) => String(c.pledges) },
            { key: "principal", title: "Principal", width: 86, align: "right", text: (c) => inrC(c.principal) },
            { key: "open", title: "Still open", width: 86, align: "right", text: (c) => inrC(c.stillOpen) },
            { key: "red", title: "Redeemed", width: 76, align: "right", text: (c) => formatPct(c.redeemedPct) },
            { key: "days", title: "Median days", width: 88, align: "right", text: (c) => days(c.medianDaysToRedeem) },
            { key: "avg", title: "Avg ticket", width: 82, align: "right", text: (c) => inrC(c.avgPledge) },
          ]}
        />
      </ReportCard>

      <ReportCard title="Day of the week opened" subtitle="Dates are ledger dates, not entry times.">
        <BarChart
          buckets={asBuckets(weekdays(pledges).map((d) => d.label))}
          series={[{ label: "Pledges", color: "#B8860B", values: weekdays(pledges).map((d) => d.count) }]}
          formatValue={count}
        />
      </ReportCard>

      <ReportCard
        title="Interest what-if"
        subtitle="Interest terms are not recorded. This applies a rate you choose to the open book, as an illustration only."
      >
        <View style={styles.rateRow}>
          <TouchableOpacity style={styles.rateButton} onPress={() => setRate((r) => Math.max(0.005, +(r - 0.005).toFixed(3)))}>
            <Text style={styles.rateButtonText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.rate}>{(rate * 100).toFixed(1)}% per month</Text>
          <TouchableOpacity style={styles.rateButton} onPress={() => setRate((r) => Math.min(0.05, +(r + 0.005).toFixed(3)))}>
            <Text style={styles.rateButtonText}>+</Text>
          </TouchableOpacity>
        </View>
        <StatGrid>
          <StatTile label="Per month" value={inrC(interest.perMonth)} hint="on the open book" tone="gold" />
          <StatTile label="Per year" value={inrC(interest.perYear)} hint="at the same rate" />
          <StatTile label="Accrued to date" value={inrC(interest.accrued)} hint="on open pledges, simple interest" />
        </StatGrid>
      </ReportCard>
    </View>
  );
};

const styles = StyleSheet.create({
  rateRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 12 },
  rateButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FAF1E2", alignItems: "center", justifyContent: "center" },
  rateButtonText: { fontSize: 22, fontWeight: "800", color: "#8C5B14" },
  rate: { fontSize: 16, fontWeight: "800", color: "#1A1A1A", minWidth: 130, textAlign: "center" },
});

export default RehanBookTab;
```

- [ ] **Step 3: `ItemsTab.tsx`**

```tsx
import React, { useState } from "react";
import { View } from "react-native";
import { PledgeRow } from "../../../utils/analytics/report/pledges";
import { ItemStat, bundleStats, itemMixByQuarter, itemStats, rankItems } from "../../../utils/analytics/report/itemsView";
import { formatCompactRupees, formatPct } from "../../../utils/analytics/format";
import BarChart from "../BarChart";
import { StatGrid, StatTile } from "../StatTile";
import ReportCard from "./ReportCard";
import Segmented from "./Segmented";
import HBars from "./HBars";
import DataTable from "./DataTable";

const inrC = (n: number) => `₹${formatCompactRupees(n)}`;
const days = (n: number | null) => (n === null ? "—" : String(Math.round(n)));
const MIX_COLORS = ["#B8860B", "#E65100", "#2E7D32", "#9AA5B1"];

type ItemMetric = "principal" | "open" | "pledges" | "avg" | "redeemed";
const ITEM_METRICS: { key: ItemMetric; label: string }[] = [
  { key: "principal", label: "Principal" },
  { key: "open", label: "Open" },
  { key: "pledges", label: "Pledges" },
  { key: "avg", label: "Avg ticket" },
  { key: "redeemed", label: "Redeemed" },
];
const metricValue = (s: ItemStat, m: ItemMetric) =>
  m === "principal" ? s.principal : m === "open" ? s.openPrincipal : m === "pledges" ? s.pledges : m === "avg" ? s.avgTicket : s.redeemedPct;
const metricText = (v: number, m: ItemMetric) => (m === "pledges" ? String(v) : m === "redeemed" ? formatPct(v) : inrC(v));

const ItemsTab: React.FC<{
  pledges: PledgeRow[];
  rankingPledges: PledgeRow[];
  selectedItem: string;
  now: Date;
}> = ({ pledges, rankingPledges, selectedItem, now }) => {
  const [metric, setMetric] = useState<ItemMetric>("principal");
  const ranked = rankItems(rankingPledges);
  const mix = itemMixByQuarter(pledges, now, 8, 3);
  const bundles = bundleStats(pledges);
  return (
    <View>
      <ReportCard
        title="Items ranked"
        subtitle="Item names are grouped by keyword. Items with fewer than 5 pledges are grouped together."
        right={<Segmented options={ITEM_METRICS} value={metric} onChange={setMetric} />}
      >
        <HBars
          rows={ranked.map((s) => ({
            key: s.item,
            label: s.item,
            value: metricValue(s, metric),
            display: metricText(metricValue(s, metric), metric),
            muted: s.item.startsWith("All other items"),
            highlight: s.item === selectedItem,
          }))}
        />
      </ReportCard>

      <ReportCard title="Which items are pledged, quarter by quarter" subtitle="Pledges opened per calendar quarter, last 8 quarters.">
        <BarChart
          stacked
          buckets={mix.buckets}
          series={mix.series.map((s, i) => ({ label: s.label, color: MIX_COLORS[i] ?? "#9AA5B1", values: s.values }))}
          formatValue={(v) => String(Math.round(v))}
        />
      </ReportCard>

      <ReportCard title="Single items and bundles" subtitle='A bundle is a pledge whose name lists two or more items, such as "Locket payal".'>
        <StatGrid>
          <StatTile label="Bundled pledges" value={formatPct(bundles.bundleShare)} hint={`${bundles.bundles} with two or more items`} />
          <StatTile label="Average bundle" value={inrC(bundles.avgBundle)} hint={`${bundles.bundles} pledges`} />
          <StatTile label="Average single item" value={inrC(bundles.avgSingle)} hint={`${bundles.singles} pledges`} />
          <StatTile
            label="Bundle premium"
            value={bundles.premium === null ? "—" : `${bundles.premium >= 0 ? "+" : ""}${formatPct(bundles.premium)}`}
            hint="average bundle vs a single item"
            tone="gold"
          />
        </StatGrid>
      </ReportCard>

      <ReportCard title="Item scorecard" subtitle="Tap a column to sort.">
        <DataTable<ItemStat>
          rows={itemStats(rankingPledges)}
          rowKey={(s) => s.item}
          initialSort={{ key: "principal", desc: true }}
          columns={[
            { key: "item", title: "Item", width: 120, text: (s) => s.item, sortValue: (s) => s.item },
            { key: "pledges", title: "Pledges", width: 64, align: "right", text: (s) => String(s.pledges), sortValue: (s) => s.pledges },
            { key: "principal", title: "Principal", width: 84, align: "right", text: (s) => inrC(s.principal), sortValue: (s) => s.principal },
            { key: "avg", title: "Avg ticket", width: 80, align: "right", text: (s) => inrC(s.avgTicket), sortValue: (s) => s.avgTicket },
            { key: "open", title: "Open", width: 80, align: "right", text: (s) => inrC(s.openPrincipal), sortValue: (s) => s.openPrincipal },
            { key: "share", title: "Share of open", width: 92, align: "right", text: (s) => formatPct(s.openShare), sortValue: (s) => s.openShare, shade: (s) => s.openShare },
            { key: "red", title: "Redeemed", width: 76, align: "right", text: (s) => formatPct(s.redeemedPct), sortValue: (s) => s.redeemedPct },
            { key: "days", title: "Median days", width: 86, align: "right", text: (s) => days(s.medianDaysToRedeem), sortValue: (s) => s.medianDaysToRedeem ?? -1 },
          ]}
        />
      </ReportCard>
    </View>
  );
};

export default ItemsTab;
```

- [ ] **Step 4: `CustomersVillagesTab.tsx`**

```tsx
import React, { useState } from "react";
import { View } from "react-native";
import { AnalyticsData } from "../../../utils/analytics/types";
import { OTHER_VILLAGES, UNKNOWN_VILLAGE, VillageGroups } from "../../../utils/analytics/villages";
import { PledgeRow } from "../../../utils/analytics/report/pledges";
import {
  Exposure, VillageStat, concentration, customerSegments, customersAdded, exposures, repeatCustomers, villageStats,
} from "../../../utils/analytics/report/pledgeCustomers";
import { formatCompactRupees, formatPct } from "../../../utils/analytics/format";
import BarChart from "../BarChart";
import { StatGrid, StatTile } from "../StatTile";
import ReportCard from "./ReportCard";
import Segmented from "./Segmented";
import HBars from "./HBars";
import DataTable from "./DataTable";

const inrC = (n: number) => `₹${formatCompactRupees(n)}`;

type VillageMetric = "principal" | "open" | "pledges" | "customers" | "per" | "redeemed";
const VILLAGE_METRICS: { key: VillageMetric; label: string }[] = [
  { key: "principal", label: "Principal" },
  { key: "open", label: "Open" },
  { key: "pledges", label: "Pledges" },
  { key: "customers", label: "Customers" },
  { key: "per", label: "Per customer" },
  { key: "redeemed", label: "Redeemed" },
];
const villageValue = (v: VillageStat, m: VillageMetric) =>
  m === "principal" ? v.principal : m === "open" ? v.openPrincipal : m === "pledges" ? v.pledges
    : m === "customers" ? v.pledging : m === "per" ? (v.pledging ? v.principal / v.pledging : 0) : v.redeemedPct;
const villageText = (n: number, m: VillageMetric) =>
  m === "pledges" || m === "customers" ? String(n) : m === "redeemed" ? formatPct(n) : inrC(n);

const CustomersVillagesTab: React.FC<{
  pledges: PledgeRow[];
  rankingPledges: PledgeRow[];
  allPledges: PledgeRow[];
  data: AnalyticsData;
  groups: VillageGroups;
  village: string;
  onCustomerPress: (userId: number, name: string) => void;
}> = ({ pledges, rankingPledges, allPledges, data, groups, village, onCustomerPress }) => {
  const [metric, setMetric] = useState<VillageMetric>("principal");
  const villages = villageStats(rankingPledges, groups);
  const conc = concentration(pledges);
  const top = exposures(pledges, data.users, 12);
  const watch = exposures(pledges, data.users, 15);
  const repeat = repeatCustomers(pledges);
  const repeaters = repeat.slice(1).reduce((n, b) => n + b.customers, 0);
  const added = customersAdded(data.users, new Date());
  const segments = customerSegments(data, allPledges, groups, village);
  return (
    <View>
      <ReportCard
        title="Villages ranked"
        subtitle="Villages with fewer than 5 customers are grouped as Other villages."
        right={<Segmented options={VILLAGE_METRICS} value={metric} onChange={setMetric} />}
      >
        <HBars
          rows={villages.map((v) => ({
            key: v.village,
            label: v.village,
            value: villageValue(v, metric),
            display: villageText(villageValue(v, metric), metric),
            muted: v.village === OTHER_VILLAGES || v.village === UNKNOWN_VILLAGE,
            highlight: v.village === village,
          }))}
        />
      </ReportCard>

      <ReportCard
        title="How concentrated is the principal?"
        subtitle={`Top 10% of customers hold ${formatPct(conc.top10)} of principal, top 20% hold ${formatPct(conc.top20)}.`}
      >
        <StatGrid>
          <StatTile label="Top 10% of customers" value={formatPct(conc.top10)} hint="of principal" tone="gold" />
          <StatTile label="Top 20%" value={formatPct(conc.top20)} hint="of principal" />
          <StatTile label="Top 50%" value={formatPct(conc.top50)} hint="of principal" />
          <StatTile label="Ten largest customers" value={formatPct(conc.tenLargest)} hint={`${conc.customers} customers in view`} />
        </StatGrid>
      </ReportCard>

      <ReportCard title="Village scorecard" subtitle="Tap a column to sort.">
        <DataTable<VillageStat>
          rows={villages}
          rowKey={(v) => v.village}
          initialSort={{ key: "principal", desc: true }}
          columns={[
            { key: "village", title: "Village", width: 116, text: (v) => v.village, sortValue: (v) => v.village },
            { key: "onfile", title: "On file", width: 60, align: "right", text: (v) => String(v.customersOnFile), sortValue: (v) => v.customersOnFile },
            { key: "pledging", title: "Pledging", width: 66, align: "right", text: (v) => String(v.pledging), sortValue: (v) => v.pledging },
            { key: "pledges", title: "Pledges", width: 62, align: "right", text: (v) => String(v.pledges), sortValue: (v) => v.pledges },
            { key: "per", title: "Per customer", width: 86, align: "right", text: (v) => v.perCustomer.toFixed(1), sortValue: (v) => v.perCustomer },
            { key: "principal", title: "Principal", width: 84, align: "right", text: (v) => inrC(v.principal), sortValue: (v) => v.principal },
            { key: "open", title: "Open", width: 80, align: "right", text: (v) => inrC(v.openPrincipal), sortValue: (v) => v.openPrincipal },
            { key: "share", title: "Share of open", width: 92, align: "right", text: (v) => formatPct(v.openShare), sortValue: (v) => v.openShare, shade: (v) => v.openShare },
            { key: "avg", title: "Avg ticket", width: 80, align: "right", text: (v) => inrC(v.avgTicket), sortValue: (v) => v.avgTicket },
            { key: "red", title: "Redeemed", width: 76, align: "right", text: (v) => formatPct(v.redeemedPct), sortValue: (v) => v.redeemedPct },
          ]}
        />
      </ReportCard>

      <ReportCard
        title="Largest open exposures by customer"
        subtitle={`Top ${top.length} by open principal. Together ${inrC(top.reduce((n, e) => n + e.openPrincipal, 0))}.`}
      >
        <HBars
          labelWidth={120}
          rows={top.map((e) => ({
            key: String(e.userId),
            label: e.name,
            value: e.openPrincipal,
            display: inrC(e.openPrincipal),
            onPress: () => onCustomerPress(e.userId, e.name),
          }))}
        />
      </ReportCard>

      <ReportCard
        title="Repeat customers"
        subtitle={`${formatPct(conc.customers ? repeaters / conc.customers : 0)} of customers pledged more than once (${repeaters} of ${conc.customers}).`}
      >
        <BarChart
          buckets={repeat.map((b) => ({ key: b.label, label: b.label }))}
          series={[
            { label: "Share of customers", color: "#B8860B", values: repeat.map((b) => b.customerShare * 100) },
            { label: "Share of principal", color: "#E65100", values: repeat.map((b) => b.principalShare * 100) },
          ]}
          formatValue={(v) => `${Math.round(v)}%`}
        />
      </ReportCard>

      <ReportCard
        title="Customers added over time"
        subtitle={`${added.length ? added[added.length - 1].total : 0} customers on file. A one-month spike is usually a paper ledger being entered, not growth.`}
      >
        <BarChart
          buckets={added.map((a) => ({ key: a.key, label: a.label }))}
          labelEvery={Math.max(1, Math.ceil(added.length / 6))}
          series={[{ label: "New customers", color: "#B8860B", values: added.map((a) => a.added) }]}
          formatValue={(v) => String(Math.round(v))}
        />
      </ReportCard>

      <ReportCard title="Customers by what they do with the shop" subtitle="Follows the village filter only.">
        <HBars
          labelWidth={150}
          rows={segments.map((s) => ({ key: s.label, label: s.label, value: s.customers, display: String(s.customers) }))}
        />
      </ReportCard>

      <ReportCard title="Customer watchlist" subtitle="The 15 customers with the most open principal in this view. Tap a row to open the customer.">
        <DataTable<Exposure>
          rows={watch}
          rowKey={(e) => String(e.userId)}
          initialSort={{ key: "open", desc: true }}
          onRowPress={(e) => onCustomerPress(e.userId, e.name)}
          columns={[
            { key: "name", title: "Customer", width: 140, text: (e) => e.name, sortValue: (e) => e.name },
            { key: "village", title: "Village", width: 100, text: (e) => e.village, sortValue: (e) => e.village },
            { key: "openn", title: "Open pledges", width: 86, align: "right", text: (e) => String(e.openPledges), sortValue: (e) => e.openPledges },
            { key: "open", title: "Open principal", width: 100, align: "right", text: (e) => inrC(e.openPrincipal), sortValue: (e) => e.openPrincipal, shade: (e) => (watch[0] ? e.openPrincipal / watch[0].openPrincipal : 0) },
            { key: "oldest", title: "Oldest open (days)", width: 116, align: "right", text: (e) => String(e.oldestOpenDays), sortValue: (e) => e.oldestOpenDays },
            { key: "red", title: "Redeemed", width: 76, align: "right", text: (e) => String(e.redeemed), sortValue: (e) => e.redeemed },
            { key: "total", title: "Total pledges", width: 90, align: "right", text: (e) => String(e.totalPledges), sortValue: (e) => e.totalPledges },
          ]}
        />
      </ReportCard>
    </View>
  );
};

export default CustomersVillagesTab;
```

- [ ] **Step 5: Verify** — `npx tsc --noEmit` clean; `npx jest` all pass.
- [ ] **Step 6: Commit** — `git commit -m "Add Overview, Rehan book, Items and Customers & Villages report tabs"`

---

### Task 8: Billing summary, Together, Data quality tabs and the screen

**Files:**
- Create: `src/components/analytics/report/BillingSummaryTab.tsx`, `TogetherTab.tsx`, `DataQualityTab.tsx`
- Rewrite: `src/screen/AnalyticsScreen.tsx`

**Interfaces:**
- Consumes: Tasks 1–7; existing `PeriodPicker`, `OverviewSection`, `SalesSection`, `BaakiAgingCard`, `MetalSection`, `CategoriesCard`, `TrendsSection`, `KeyCustomersCard`, `CustomersSection`, `VillagesSection` and their builders (`buildOverview`, `buildSalesView`, `baakiAging`, `buildMetalView`, `buildCategoryView`, `buildTrends`, `buildImportanceView`, `buildCustomersView`, `buildVillageView`) with the period state the current screen already has.
- Produces: `BillingSummaryTab {bills: BillRow[]}`, `TogetherTab {pledges: PledgeRow[]; bills: BillRow[]; order: string[]}`, `DataQualityTab {report: QualityReport}`; the screen.

- [ ] **Step 1: `BillingSummaryTab.tsx`**

```tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  BillGroup, BillRow, billLabel, billingSummary, discountPerBill, numberedVsEarlier, waterfall,
} from "../../../utils/analytics/report/billing";
import { formatCompactRupees, formatInr, formatPct } from "../../../utils/analytics/format";
import BarChart from "../BarChart";
import { StatGrid, StatTile } from "../StatTile";
import ReportCard from "./ReportCard";
import DataTable from "./DataTable";
import TagPill from "./TagPill";

const inrC = (n: number) => `₹${formatCompactRupees(n)}`;
const pct1 = (r: number) => `${(r * 100).toFixed(1)}%`;
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const COMPARE: { label: string; value: (g: BillGroup) => string }[] = [
  { label: "Bills", value: (g) => String(g.bills) },
  { label: "Gross billed", value: (g) => formatInr(g.gross) },
  { label: "Net billed", value: (g) => formatInr(g.net) },
  { label: "Average net per bill", value: (g) => formatInr(g.avgNet) },
  { label: "Discount rate", value: (g) => pct1(g.discountRate) },
  { label: "Collected share", value: (g) => formatPct(g.collectedShare) },
  { label: "Pending dues", value: (g) => formatInr(g.pending) },
  { label: "Customers", value: (g) => String(g.customers) },
  { label: "Bills with a photo", value: (g) => String(g.withPhoto) },
];

const BillingSummaryTab: React.FC<{ bills: BillRow[] }> = ({ bills }) => {
  const s = billingSummary(bills);
  const steps = waterfall(s);
  const discounts = discountPerBill(bills);
  const { numbered, earlier } = numberedVsEarlier(bills);
  const maxNet = bills.reduce((m, b) => Math.max(m, b.net), 0);
  return (
    <View>
      <ReportCard title="Billing summary" subtitle="Collected is net billed minus the balance field.">
        <StatGrid>
          <StatTile label="Bills" value={String(s.bills)} hint={`${s.withBalance} with a balance due`} />
          <StatTile label="Gross billed" value={inrC(s.gross)} hint={formatInr(s.gross)} tone="gold" />
          <StatTile label="Discount" value={inrC(s.discount)} hint={`${pct1(s.discountPct)} of gross`} />
          <StatTile label="Net billed" value={inrC(s.net)} hint={formatInr(s.net)} />
          <StatTile label="Collected" value={inrC(s.collected)} hint={`${formatPct(s.collectedPct)} of net`} tone="good" />
          <StatTile
            label="Pending dues"
            value={inrC(s.pending)}
            hint={s.pendingOffFilePct > 0 ? `${formatPct(s.pendingOffFilePct)} on customers missing from the file` : "all customers on file"}
            tone="warn"
          />
        </StatGrid>
      </ReportCard>

      <ReportCard title="From gross bill to cash" subtitle="Gross, less discount and old jewellery, is net; net splits into collected and pending.">
        <BarChart
          buckets={steps.map((x) => ({ key: x.label, label: x.label.split(" ")[0] }))}
          series={[{ label: "Amount", color: "#B8860B", values: steps.map((x) => x.value) }]}
          formatValue={formatCompactRupees}
        />
      </ReportCard>

      <ReportCard title="Collected and pending by bill" subtitle="Each bar is the net bill: green collected, orange still due.">
        {bills.length === 0 ? (
          <Text style={styles.muted}>No bills in this period</Text>
        ) : (
          bills.map((b) => (
            <View key={b.id} style={styles.billRow}>
              <Text style={styles.billLabel} numberOfLines={1}>
                {billLabel(b)}  {b.customer}
              </Text>
              <Text style={styles.billSub}>
                {shortDate(b.date)} · {inrC(b.net)}
              </Text>
              <View style={styles.track}>
                <View style={{ flex: maxNet ? b.collected / maxNet : 0, backgroundColor: "#2E7D32" }} />
                <View style={{ flex: maxNet ? b.pending / maxNet : 0, backgroundColor: "#E65100" }} />
                <View style={{ flex: maxNet ? Math.max(0, 1 - (b.collected + b.pending) / maxNet) : 1 }} />
              </View>
            </View>
          ))
        )}
      </ReportCard>

      <ReportCard title="Discount given per bill" subtitle={`Weighted average ${pct1(discounts.weighted)} of gross. Oldest bill first.`}>
        <BarChart
          buckets={discounts.bills.map((d, i) => ({ key: `${d.label}-${i}`, label: d.label }))}
          labelEvery={Math.max(1, Math.ceil(discounts.bills.length / 8))}
          series={[{ label: "Discount % of gross", color: "#B8860B", values: discounts.bills.map((d) => d.pct * 100) }]}
          formatValue={(v) => `${v.toFixed(1)}%`}
        />
      </ReportCard>

      <ReportCard title="Numbered bills against earlier bills" subtitle="Bills with a bill number compared with bills entered without one.">
        <DataTable<{ label: string; value: (g: BillGroup) => string }>
          rows={COMPARE}
          rowKey={(r) => r.label}
          columns={[
            { key: "metric", title: "", width: 150, text: (r) => r.label },
            { key: "numbered", title: `Numbered (${numbered.bills})`, width: 120, align: "right", text: (r) => r.value(numbered) },
            { key: "earlier", title: `Earlier (${earlier.bills})`, width: 120, align: "right", text: (r) => r.value(earlier) },
          ]}
        />
      </ReportCard>

      <ReportCard title="All bills" subtitle="Red flags need a decision. Grey flags are for information. Tap a column to sort.">
        <DataTable<BillRow>
          rows={bills}
          rowKey={(b) => String(b.id)}
          initialSort={{ key: "date", desc: true }}
          columns={[
            { key: "date", title: "Date", width: 96, text: (b) => shortDate(b.date), sortValue: (b) => new Date(b.date).getTime() },
            { key: "bill", title: "Bill", width: 56, text: (b) => billLabel(b) },
            { key: "customer", title: "Customer", width: 130, text: (b) => b.customer, sortValue: (b) => b.customer },
            { key: "village", title: "Village", width: 96, text: (b) => b.village, sortValue: (b) => b.village },
            { key: "gross", title: "Gross", width: 80, align: "right", text: (b) => formatInr(b.gross), sortValue: (b) => b.gross },
            { key: "disc", title: "Discount", width: 72, align: "right", text: (b) => formatInr(b.discount), sortValue: (b) => b.discount },
            { key: "net", title: "Net", width: 80, align: "right", text: (b) => formatInr(b.net), sortValue: (b) => b.net },
            { key: "coll", title: "Collected", width: 80, align: "right", text: (b) => formatInr(b.collected), sortValue: (b) => b.collected },
            { key: "pend", title: "Pending", width: 76, align: "right", text: (b) => formatInr(b.pending), sortValue: (b) => b.pending },
            { key: "days", title: "Days open", width: 70, align: "right", text: (b) => (b.daysOpen === null ? "–" : String(b.daysOpen)), sortValue: (b) => b.daysOpen ?? -1 },
            {
              key: "flags",
              title: "Flags",
              width: 300,
              text: (b) => b.flags.map((f) => f.label).join(", "),
              render: (b) => (
                <View style={styles.flags}>
                  {b.flags.map((f) => (
                    <TagPill key={f.label} label={f.label} tone={f.severity} />
                  ))}
                </View>
              ),
            },
          ]}
        />
      </ReportCard>
    </View>
  );
};

const styles = StyleSheet.create({
  muted: { color: "#999", fontSize: 13 },
  billRow: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#F0F2F5" },
  billLabel: { fontSize: 13, fontWeight: "700", color: "#1A1A1A" },
  billSub: { fontSize: 11, color: "#888", marginBottom: 4 },
  track: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: "#F2F2F2" },
  flags: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
});

export default BillingSummaryTab;
```

- [ ] **Step 2: `TogetherTab.tsx`**

```tsx
import React from "react";
import { View } from "react-native";
import { PledgeRow } from "../../../utils/analytics/report/pledges";
import { BillRow } from "../../../utils/analytics/report/billing";
import { ledgerScale, villageShares } from "../../../utils/analytics/report/together";
import { formatCompactRupees } from "../../../utils/analytics/format";
import BarChart from "../BarChart";
import ReportCard from "./ReportCard";
import HBars from "./HBars";

const inrC = (n: number) => `₹${formatCompactRupees(n)}`;

const TogetherTab: React.FC<{ pledges: PledgeRow[]; bills: BillRow[]; order: string[] }> = ({ pledges, bills, order }) => {
  const scale = ledgerScale(pledges, bills);
  const shares = villageShares(pledges, bills, order);
  return (
    <View>
      <ReportCard
        title="Scale of the two ledgers"
        subtitle={
          scale.ratio === null
            ? "Nothing has been billed yet."
            : `The open pledge book is ${scale.ratio.toFixed(1)} times everything billed so far.`
        }
      >
        <HBars
          labelWidth={150}
          rows={[
            { key: "open", label: "Open pledge book", value: scale.openBook, display: inrC(scale.openBook), color: "#8C5B14" },
            { key: "red", label: "Redeemed pledge principal", value: scale.redeemedPrincipal, display: inrC(scale.redeemedPrincipal), color: "#2E7D32" },
            { key: "net", label: "Net billed", value: scale.netBilled, display: inrC(scale.netBilled), color: "#B8860B" },
            { key: "pend", label: "Pending bill dues", value: scale.pending, display: inrC(scale.pending), color: "#E65100" },
          ]}
        />
      </ReportCard>

      <ReportCard
        title="Where each ledger is concentrated, by village"
        subtitle="Each village as a share of its own ledger, so the bars compare where business happens, not how big each ledger is."
      >
        <BarChart
          buckets={shares.map((s) => ({ key: s.village, label: s.village.slice(0, 7) }))}
          series={[
            { label: "Share of pledge principal", color: "#8C5B14", values: shares.map((s) => s.pledgeShare * 100) },
            { label: "Share of net billed", color: "#E65100", values: shares.map((s) => s.billShare * 100) },
          ]}
          formatValue={(v) => `${Math.round(v)}%`}
        />
      </ReportCard>
    </View>
  );
};

export default TogetherTab;
```

- [ ] **Step 3: `DataQualityTab.tsx`**

```tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { QualityReport } from "../../../utils/analytics/report/quality";
import { formatPct } from "../../../utils/analytics/format";
import ReportCard from "./ReportCard";
import TagPill from "./TagPill";

const DataQualityTab: React.FC<{ report: QualityReport }> = ({ report }) => (
  <View>
    <ReportCard title="Findings from the checks" subtitle="Checks run on the whole ledger, so they ignore the filters.">
      {report.checks.map((c) => (
        <View key={c.title} style={styles.check}>
          <View style={styles.checkHead}>
            <TagPill label={c.tag} />
            <Text style={styles.badge}>{c.badge}</Text>
          </View>
          <Text style={styles.title}>{c.title}</Text>
          <Text style={styles.detail}>{c.detail}</Text>
        </View>
      ))}
    </ReportCard>

    <ReportCard title="Field coverage" subtitle="Orange bars are below 50% coverage.">
      {report.coverage.map((c) => (
        <View key={c.label} style={styles.coverage}>
          <View style={styles.coverageHead}>
            <Text style={styles.coverageLabel}>{c.label}</Text>
            <Text style={styles.coveragePct}>{formatPct(c.share)}</Text>
          </View>
          <View style={styles.track}>
            <View style={{ flex: c.share, backgroundColor: c.share < 0.5 ? "#E65100" : "#3557A7" }} />
            <View style={{ flex: 1 - c.share }} />
          </View>
        </View>
      ))}
    </ReportCard>
  </View>
);

const styles = StyleSheet.create({
  check: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#F0F2F5", gap: 4 },
  checkHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { fontSize: 12, color: "#555", fontVariant: ["tabular-nums"] },
  title: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  detail: { fontSize: 13, color: "#555", lineHeight: 19 },
  coverage: { paddingVertical: 6 },
  coverageHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  coverageLabel: { fontSize: 13, color: "#1A1A1A", flex: 1 },
  coveragePct: { fontSize: 13, fontWeight: "700", color: "#1A1A1A" },
  track: { flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: "#E8ECF4" },
});

export default DataQualityTab;
```

- [ ] **Step 4: Rewrite `src/screen/AnalyticsScreen.tsx`.** Keep everything the current screen does for periods (grain, anchor, custom from/to, `period`, `previous`, `lastYear`, `canGoForward`, `trendGrain`, `onStep`, `onCustomChange`, `load`, focus reload, pull-to-refresh, error/loading states) exactly as it is now. Change the tab list and the content:

```tsx
const TABS = ["Overview", "Rehan book", "Items", "Customers & Villages", "Billing", "Together", "Data quality"] as const;
type Tab = (typeof TABS)[number];
const BILLING_TABS = ["Summary", "Sales", "Metal", "Trends", "Customers"] as const;
type BillingTab = (typeof BILLING_TABS)[number];
```

New state:
```tsx
  const [tab, setTab] = useState<Tab>("Overview");
  const [billingTab, setBillingTab] = useState<BillingTab>("Summary");
  const [filters, setFilters] = useState<PledgeFilters>(ALL_PLEDGES);
```

Derived values (after `data` is loaded; recompute only when `data` changes):
```tsx
  const report = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const groups = groupVillages(data.users);
    const pledges = buildPledgeRows(data, now, groups);
    return {
      now,
      groups,
      pledges,
      bills: buildBillRows(data, groups, now),
      names: new Map(data.users.map((u) => [u.id, u.name])),
      options: filterOptions(pledges, groups),
      quality: dataQuality(data, now),
    };
  }, [data]);
```

Filtered rows (recompute when `report` or `filters` change):
```tsx
  const view = useMemo(() => {
    if (!report) return null;
    const villageBills =
      filters.village === "all" ? report.bills : report.bills.filter((b) => b.village === filters.village);
    return {
      pledges: filterPledges(report.pledges, filters),
      byItemRank: filterPledges(report.pledges, filters, "item"),
      byVillageRank: filterPledges(report.pledges, filters, "village"),
      villageBills,
    };
  }, [report, filters]);
```

The header renders the horizontal tab chips as now, then:
- on `Overview`, `Rehan book`, `Items`, `Customers & Villages`, `Together`: `<PledgeFilterBar filters={filters} options={report.options} showing={view.pledges.length} total={report.pledges.length} onChange={setFilters} />`
- on `Billing`: the existing `<PeriodPicker …/>`, then `<Segmented options={BILLING_TABS.map((t) => ({ key: t, label: t }))} value={billingTab} onChange={setBillingTab} />`, and when `filters.village !== "all"` a muted line `Village: {filters.village} (Summary only)`
- on `Data quality`: nothing.

Start the content `useMemo` with `if (!data || !report || !view) return null;`, then `switch (tab)`:
```tsx
      case "Overview":
        return <OverviewTab pledges={view.pledges} bills={view.villageBills} names={report.names} customersOnFile={data.users.length} />;
      case "Rehan book":
        return <RehanBookTab pledges={view.pledges} now={report.now} />;
      case "Items":
        return <ItemsTab pledges={view.pledges} rankingPledges={view.byItemRank} selectedItem={filters.item} now={report.now} />;
      case "Customers & Villages":
        return (
          <CustomersVillagesTab
            pledges={view.pledges}
            rankingPledges={view.byVillageRank}
            allPledges={report.pledges}
            data={data}
            groups={report.groups}
            village={filters.village}
            onCustomerPress={openCustomer}
          />
        );
      case "Together":
        return <TogetherTab pledges={view.pledges} bills={view.villageBills} order={report.groups.order} />;
      case "Data quality":
        return <DataQualityTab report={report.quality} />;
      case "Billing":
        switch (billingTab) {
          case "Summary":
            return <BillingSummaryTab bills={view.villageBills.filter((b) => inPeriod(b.date, period))} />;
          case "Sales":
            return (
              <>
                <OverviewSection
                  view={buildOverview(data, period, previous, lastYear, now)}
                  previousLabel={previous?.label ?? null}
                  lastYearLabel={lastYear?.label ?? null}
                />
                <SalesSection view={buildSalesView(data, period)} onCustomerPress={openCustomer} />
                <BaakiAgingCard aging={baakiAging(data, now)} />
              </>
            );
          case "Metal":
            return (
              <>
                <MetalSection view={buildMetalView(data, period)} />
                <CategoriesCard categories={buildCategoryView(data, period, previous)} />
              </>
            );
          case "Trends":
            return <TrendsSection rows={buildTrends(data, trendGrain, now)} />;
          case "Customers":
            return (
              <>
                <KeyCustomersCard view={buildImportanceView(data, period)} onCustomerPress={openCustomer} />
                <CustomersSection view={buildCustomersView(data, period, now)} onCustomerPress={openCustomer} />
                <VillagesSection villages={buildVillageView(data, period, previous)} />
              </>
            );
        }
```
(`openCustomer`, `now`, `period`, `previous`, `lastYear`, `trendGrain` are the existing screen values; `RehanSection` is no longer used by the screen — leave its file in place.) Add `tab`, `billingTab`, `report` and `view` to the content `useMemo` dependencies. Import `inPeriod` from periods, the report builders from `../utils/analytics/report/*`, `groupVillages` from villages, and the new components.

- [ ] **Step 5: Verify** — `npx tsc --noEmit` clean; `npx jest` all pass.
- [ ] **Step 6: Commit** — `git commit -m "Rebuild Analytics as the insights report with Billing, Together and Data quality tabs"`

---

### Task 9: Verification and docs

- [ ] **Step 1:** `npx jest` and `npx tsc --noEmit` pass.
- [ ] **Step 2:** Append "## 13. Insights v3 implementation notes (2026-10-02)" to `agent/2026-10-02-analytics-design.md`: deviations from §12 (or "none"), and these behaviours: the item mix shows the last 8 calendar quarters; the concentration card shows four shares as tiles (no curve chart); the interest what-if uses −/+ buttons in 0.5 % steps from 0.5 % to 5 %; the Billing sub-tabs Sales, Metal, Trends and Customers are the v2 views and ignore the village filter; the filter bar folds into one line until tapped.
- [ ] **Step 3: Device checklist (owner):**
  1. Analytics opens on Overview: the open pledge book and the six tiles look right against what you know; key findings read sensibly.
  2. Filters: pick a village, an item, a year, Open/Redeemed — every pledge card changes and "Showing N of M" updates; Reset clears it.
  3. Rehan book charts scroll and labels are readable; interest −/+ changes the three numbers.
  4. Items: your common items (Payal, Locket, Chain…) appear with sensible totals; "Other" is small.
  5. Customers & Villages: villages match your area; tapping a watchlist row opens the customer.
  6. Billing → Summary: bill flags make sense; Sales/Metal/Trends/Customers still work with the time frame.
  7. Data quality: the checks match what you know needs fixing.
- [ ] **Step 4: Commit** — `git commit -m "Note insights v3 implementation details"`

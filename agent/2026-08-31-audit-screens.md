# Screen / UI layer audit — asha jewellery ledger

Branch `feat/lenden-itemised-billing`. Read-only audit of the screen and component layer.

## Summary

The money model is implemented three times with three different formulas, and the three copies
disagree. `AddTransactionScreen` computes `jama` as the sum of the itemised jama entries and stores
it; `NewCustomerScreen` computes the same bill but never stores `jama` or `status` at all;
`TransactionDetailScreen` recomputes `baki` from the `lenden.jama` *column*, which nothing has
updated since the row was created — every payment added from the detail screen writes only
`jama_entries` and `lenden.baki`, never `lenden.jama`. The consequence is the worst finding in this
audit: opening a Len-Den in edit mode makes the "Save Changes" button appear on its own, with the
outstanding balance already reset to the pre-payment figure, so one tap silently erases every
recorded payment from the customer's balance. A second data-loss bug sits in the same screen: the
Rehan edit path never loads `productName`/`amount` into its edit state, so saving any Rehan edit
writes `NULL` over the running gold-loan balance, and because the balance is then maintained with
`amount = amount ± ?`, `NULL` is absorbing — the balance can never be restored by further
transactions. Beyond that, the add-screen bill preview shows unclamped arithmetic while the save
path clamps at zero, so customer credit balances vanish on save; `NewCustomerScreen`'s money inputs
are the only ones in the app with no digit filter, admitting negative and `NaN` amounts; and no
screen guards against navigating away from unsaved edits.

Counts: **6 Critical**, **10 Important**, **6 Minor**.

Everything below was verified by reading the code. A short "suspected, not confirmed" section is at
the end.

---

# CRITICAL

## C1. Editing a Len-Den resets `baki` to the pre-payment figure, erasing every jama payment

**File:** `src/screen/TransactionDetailScreen.tsx:123-130`, `:216-219`, `:342-350`

```ts
// :123 — Auto-calculate Baki = Remaining - Jama (only for lenden in edit mode)
useEffect(() => {
  if (transactionType === "lenden" && isEditMode) {
    const rem = parseInt(editRemaining, 10) || 0;
    const jam = parseInt(editJama, 10) || 0;      // <-- editJama comes from lenden.jama COLUMN
    const calc = rem - jam;
    setEditBaki(calc >= 0 ? calc.toString() : "0");
  }
}, [editRemaining, editJama, transactionType, isEditMode]);
```

```ts
// :216 — editJama is seeded from the lenden.jama column, never from jamaEntries
setEditJama(lendenData.jama ? lendenData.jama.toString() : "");
```

**What.** `lenden.jama` is written in exactly two places in the whole codebase
(`grep "SET jama\|jama ="` over `entryDatabase.ts` returns only `createLenden` and
`updateLendenDetails`). Adding, editing or deleting a payment goes through
`createJamaEntry`/`editJamaEntry`/`deleteJamaEntry` + `updateLendenBaki`, and
`updateLendenBaki` (`entryDatabase.ts:1182`) writes only `baki` and `status`. So the moment a
payment is recorded from the detail screen, `lenden.jama` is stale — normally `NULL`.

The effect above then computes `baki = remaining - 0` and puts that in `editBaki`. Because
`editBaki` now differs from `originalBaki`, the `hasChanges` effect (`:136-171`) flips to true, and
the Save button at `:1039` (`isEditMode && hasChanges`) appears **without the user having edited
anything**. `handleSaveChanges` at `:348-349` then passes that value to `updateLendenDetails`, whose
SQL is a blind `UPDATE lenden SET ... jama = ?, baki = ? WHERE id = ?`.

**Failure scenario.**
1. Len-Den for Ramesh: amount ₹1000, no discount. DB: `remaining=1000, jama=NULL, baki=1000`.
2. Ramesh pays ₹400. Shopkeeper opens the entry → Payment Summary → "Add Jama Payment" → 400 → Add.
   `updateLendenBaki` writes `baki=600`. The bill table correctly shows FINAL BAKI ₹600.
3. Later the shopkeeper opens the same entry and taps **Edit** (say, to attach a bill photo).
   The read-only "Baki (auto)" field immediately reads **₹1000**, and a "Save Changes" button
   appears although nothing was typed.
4. Tap Save → `UPDATE lenden SET jama = NULL, baki = 1000`.
5. The customer card in `UserTransactionsScreen` and the "Total Baki" stat now show **₹1000
   outstanding instead of ₹600**. The ₹400 receipt still exists in `jama_entries`, so the bill table
   inside the entry says ₹600 while every summary says ₹1000. The shopkeeper bills ₹400 too much.

This hits every Len-Den whose payments were entered from the detail screen, and *every* Len-Den
created from `NewCustomerScreen` (see C3, which never writes `jama` in the first place).

**Suggested fix.** Delete `editJama`/`editBaki` as editable state. Derive both from `jamaEntries` at
render time (`totalJama = jamaEntries.reduce(...)`), and have the save path call
`updateLendenBaki(transactionId)` after writing amount/discount/remaining rather than sending a
hand-computed `jama`/`baki`. Long term, drop the `lenden.jama` column and treat `jama_entries` as
the single source of truth.

---

## C2. Editing a Rehan wipes its product name and running balance to NULL

**File:** `src/screen/TransactionDetailScreen.tsx:173-231` (loadData), `:334-340` (save)

```ts
// :175 — the rehan branch of loadData never touches editProductName / editAmount
if (transactionType === "rehan") {
  const rehanData = await getRehanById(transactionId);
  if (rehanData) {
    setRehan(rehanData);
    ...                       // no setEditProductName / setEditAmount / setOriginal*
  }
}
```

```ts
// :334 — but the save path sends them anyway
await updateRehanDetails(
  transactionId,
  finalPaths,
  editProductName.trim() || undefined,   // always "" -> undefined
  editAmount ? parseInt(editAmount, 10) : undefined,  // always "" -> undefined
);
```

`grep setEditAmount` confirms it is called only in the **lenden** branch (`:200`). For a Rehan,
`editProductName` and `editAmount` are `""` for the entire lifetime of the screen unless the user
types into them. `updateRehanDetails` (`entryDatabase.ts:381`) is unconditional:
`UPDATE rehan SET media = ?, productName = ?, amount = ? WHERE id = ?` with `productName || null`
and `amount || null`.

**Failure scenario.**
1. Rehan for Sita: gold chain, ₹25,000, three `rehan_transactions` bringing the balance to ₹18,000.
2. Shopkeeper opens the entry, taps **Edit**, taps Gallery and adds a photo of the pledge slip.
   (`hasChanges` is true because `mediaPaths` changed — the product-name field is visibly blank and
   the amount field is visibly blank, which is itself the tell.)
3. Tap **Save Changes** → `UPDATE rehan SET productName = NULL, amount = NULL`.
4. The Rehan now shows no amount and no product name. Its ₹18,000 balance is gone.
5. Worse, it is unrecoverable through the UI: the balance is maintained by
   `UPDATE rehan SET amount = amount ± ?` (`entryDatabase.ts:457`, `:505`), and in SQLite
   `NULL ± n = NULL`. Every subsequent Diya/Jama transaction leaves the balance `NULL`.

**Suggested fix.** In the rehan branch of `loadData`, seed all four states:
`setEditProductName(rehanData.productName ?? "")`, `setOriginalProductName(...)`,
`setEditAmount(rehanData.amount != null ? String(rehanData.amount) : "")`, `setOriginalAmount(...)`.
Additionally make `updateRehanDetails` patch only the fields it is given (`COALESCE` or a dynamic
SET list) so a screen bug can never null a balance.

---

## C3. `NewCustomerScreen` and `AddTransactionScreen` write different Len-Den records for identical input

**File:** `src/screen/NewCustomerScreen.tsx:248-256` vs `src/screen/AddTransactionScreen.tsx:167-195`

```ts
// NewCustomerScreen.tsx:248
const lendenId = await createLenden({
  userId,
  date: selectedDate.toISOString(),
  media: savedImagePaths,
  amount: lendenAmount ? parseInt(lendenAmount, 10) : undefined,
  discount: discount ? parseInt(discount, 10) : undefined,
  remaining: remaining || undefined,
  baki: baki || undefined,
  // no jama, no status
});
```

```ts
// AddTransactionScreen.tsx:176
const lendenId = await createLenden({
  ...,
  jama: totalJama,                      // present here
  baki: bakiVal,
  status: bakiVal === 0 ? 1 : 0,        // present here
});
```

**What.** Three divergences, all in the money path:
1. **`jama` never stored.** The new-customer path attaches jama entries to the row but leaves the
   `jama` column `NULL`, so the entry is born already suffering C1 — the first time anyone opens it
   in edit mode, `baki` resets to the full remaining.
2. **`status` never stored.** `createLenden` falls back to `lenden.status ?? 0`, so a Len-Den that
   was paid in full at creation is left **open**. The same input through `AddTransactionScreen` is
   auto-closed.
3. **`remaining: remaining || undefined` / `baki: baki || undefined`.** A legitimate `0` becomes
   `undefined`, then `createLenden` turns it into SQL `NULL` (`lenden.remaining || null`). A
   fully-settled entry stores `baki = NULL` rather than `0`.

**Failure scenario.** Home → New Customer → name "Meena", Len-Den, amount 5000, add a jama entry of
5000 (paid on the spot) → Save. Row stored as `amount=5000, remaining=5000, jama=NULL, baki=NULL,
status=0`. Meena's card in `UserTransactionsScreen` shows a ₹5000 "remaining" chip, **no CLOSED
badge**, and no jama chip — the ₹5000 she paid is invisible on every summary view. She appears in
the "Open" filter. If the shopkeeper then opens the entry and taps Edit, C1 fires and writes
`baki = 5000`, and she is billed ₹5000 she already paid.

**Suggested fix.** Extract one `buildLendenPayload(amount, discount, jamaEntries)` helper used by
both screens; it must always set `jama`, `baki` and `status`, and must pass `0` through (`?? `, not
`||`).

---

## C4. `NewCustomerScreen` money inputs have no digit filter — negative and NaN amounts are accepted

**File:** `src/screen/NewCustomerScreen.tsx:445-452`, `:464-471`, `:476-483`

```tsx
<TextInput ... value={rehanAmount}  onChangeText={setRehanAmount}  keyboardType="numeric" />
<TextInput ... value={lendenAmount} onChangeText={setLendenAmount} keyboardType="numeric" />
<TextInput ... value={discount}     onChangeText={setDiscount}     keyboardType="numeric" />
```

Every other money input in the app sanitises — `AddTransactionScreen.tsx:329` and `:350`,
`TransactionDetailScreen.tsx:545/590/649`, `AddJamaModal.tsx:113`,
`AddRehanTransactionModal.tsx:140` all use `text.replace(/[^0-9]/g, "")`. These three do not. RN's
`keyboardType="numeric"` maps to Android `TYPE_CLASS_NUMBER | FLAG_DECIMAL | FLAG_SIGNED`, so `-`
and `.` are typeable (and paste bypasses the keyboard entirely).

**Failure scenarios.**
- Type `-500` in the Len-Den amount → `parseInt("-500", 10) = -500` is stored as the amount, while
  the `remaining` memo (`:79-83`) clamps to `Math.max(0, -500) = 0`. The entry displays ₹-500 with
  ₹0 outstanding.
- Type `.5` or paste `1,200` → `parseInt` yields `NaN` / `1`. `NaN` is falsy, so
  `createLenden`'s `lenden.amount || null` stores **NULL** — the entry saves "successfully" with no
  amount and no error shown. Pasting `1,200` stores **₹1**.
- `1500.75` silently truncates to `1500`.

**Suggested fix.** Apply the same `text.replace(/[^0-9]/g, "")` used everywhere else, and reject
`Number.isNaN(parsed)` in `handleSave` with an alert instead of letting `|| null` swallow it.

---

## C5. The add-screen bill preview and the save path use different arithmetic; customer credit is silently destroyed

**File:** `src/screen/AddTransactionScreen.tsx:169-185` vs `src/components/BillTable.tsx:30-43`

```ts
// AddTransactionScreen.tsx:169 — the SAVE path clamps
const remainingVal = Math.max(0, lendenAmountVal - discountVal);
const bakiVal      = Math.max(0, remainingVal - totalJama);
...
status: bakiVal === 0 ? 1 : 0,   // auto-close
```

```ts
// BillTable.tsx:30 — the PREVIEW does not clamp
const remaining = amount - discount;
let runningBaki = remaining;              // :43
const bakiAfterJama = runningBaki - entry.amount;   // :77
```

**What.** The preview the shopkeeper reads before tapping Save is the true, signed arithmetic. What
is written is clamped at zero. The two never agree once a customer overpays or the discount exceeds
the amount.

**Failure scenario.** Add Transaction → Len-Den → amount 1000 → Add Jama Payment 1200 (the customer
handed over a round ₹1200 and is ₹200 in credit). The Payment Summary shows **FINAL BAKI ₹-200** —
correct, and exactly what the shopkeeper wants to see. Tap Save Transaction. The row is stored as
`baki = 0, status = 1`. The entry is closed, the card shows no baki chip, and the ₹200 the shop owes
back to the customer has no record anywhere. Same shape with discount > amount: preview REMAINING
₹-500, stored `remaining = 0`.

(`updateLendenBaki` in the database layer applies the same clamp at `entryDatabase.ts:1194`, so the
figure cannot be recovered later either — noted here only because these screens depend on it; the
database layer is another agent's scope.)

**Suggested fix.** Store the signed value and render a negative baki as "Advance / Jama Baki
₹200" in the summary views. If a clamp is genuinely wanted, apply it in `BillTable` too so the
preview cannot promise a number the save will not keep — and never auto-close on a clamped zero.

---

## C6. Saving a Len-Den edit never updates `status`, leaving increased balances marked CLOSED

**File:** `src/screen/TransactionDetailScreen.tsx:342-350`; `entryDatabase.ts:589-604`

`updateLendenDetails`'s SQL sets `media, amount, discount, remaining, jama, baki` — `status` is not
in the column list, and the screen never calls `updateLendenBaki` after an edit.

**Failure scenario.** Len-Den ₹1000, paid in full → `updateLendenBaki` set `baki=0, status=1`, the
entry shows the **CLOSED** badge. The shopkeeper realises the bill should have been ₹1500 and edits
the amount to 1500. Effects recompute `remaining=1500`, and (per C1, with `jama=NULL`)
`baki=1500`. Save writes `baki=1500` but leaves `status=1`.

Result: the entry still shows **CLOSED** in `TransactionDetailScreen:727` and
`UserTransactionsScreen:199`, is excluded by the "Open" filter, and carries a stored balance of
₹1500 when the true outstanding is ₹500. Two independent errors in one record — an invisible
₹1500 debt and a ₹1000 overcharge.

**Suggested fix.** Call `await updateLendenBaki(transactionId)` at the end of `handleSaveChanges`
for the lenden branch, and re-read the row, so `baki` and `status` are always derived together from
`jama_entries`.

---

# IMPORTANT

## I1. `NewCustomerScreen` lets an empty Len-Den be saved

**File:** `src/screen/NewCustomerScreen.tsx:193-206`

Validation checks only `name` and `entryType`. `AddTransactionScreen.tsx:147` requires an amount;
this screen does not. Home → New Customer → "Kamal" → Len-Den → Save (no amount, no discount, no
jama) creates a customer plus a Len-Den row of `amount=NULL, remaining=NULL, baki=NULL, status=0`.
It renders as an empty card (`UserTransactionsScreen:236` and `:254` both suppress everything) with
only a delete button as a way out.

**Fix.** Require `amount > 0` for `lenden`, matching `AddTransactionScreen`.

## I2. Unsaved edits are discarded silently on back-navigation

**File:** `src/screen/TransactionDetailScreen.tsx:419-428`, `:1039-1056`; `UpdateBhavScreen.tsx`

`grep -rn "beforeRemove\|usePreventRemove"` over `src/` and `App.tsx` returns nothing. In edit mode
the only safe exits are Cancel and Save. Type a corrected amount and discount into a Len-Den, then
press the Android hardware back button or the header back arrow — the screen unmounts and the edits
are gone with no prompt. Same on `UpdateBhavScreen` with typed-but-not-submitted rates.

**Fix.** `navigation.addListener("beforeRemove", ...)` (or `usePreventRemove`) gated on
`hasChanges`, offering Discard / Keep editing.

## I3. A fully-repaid Rehan renders a stray `0` (or crashes the list row)

**File:** `src/screen/UserTransactionsScreen.tsx:236`

```tsx
{item.amount && (
  <View style={styles.amountDateRow}> ... </View>
)}
```

`item.amount` is `number | undefined`. `createRehanTransaction` maintains the balance with
`UPDATE rehan SET amount = amount - ?` (`entryDatabase.ts:457`), so a final Jama that exactly clears
the loan leaves `amount = 0` — a real `0`, not NULL. `0 && (...)` evaluates to `0`, which React
Native renders as a text node outside `<Text>`.

**Scenario.** Rehan balance ₹5000 → open it → Add Transaction → Jama ₹5000 → back to the customer's
transaction list. The row renders a bare `0` above the card body at best, and throws
`Text strings must be rendered within a <Text> component` at worst, taking down the whole list.

**Fix.** `{item.amount ? ( ... ) : null}` — the ternary form already used correctly at `:257`,
`:265`, `:273`, `:283` in the same file.

## I4. Customer search re-queries on every keystroke with no ordering guard

**File:** `src/screen/ExistingCustomersScreen.tsx:81-123`

```ts
useFocusEffect(
  useCallback(() => { loadUsers(); },
    [filterName, filterAddress, filterMobile, filterDateFrom, filterDateTo, filterTransactionType]),
);
```

Every character typed into the search box changes `filterName`, which changes the callback identity,
which makes `useFocusEffect` tear down and re-run — one full `filterUsersWithCounts` query per
keystroke, with no debounce, no cancellation and no sequence check before `setUsers(data)`.

**Scenario.** Type "ram" quickly. Three overlapping queries. If the two-character query resolves
last, `setUsers` is called with the results for "ra" while the box reads "ram" — the list shows
customers that do not match what is on screen, and stays that way until the next keystroke.

**Fix.** Debounce ~300 ms and guard with a request sequence number or an `AbortController`-style
`isCurrent` flag in a cleanup function.

## I5. Filtered results are capped at 20 with no way to see the rest

**File:** `src/screen/ExistingCustomersScreen.tsx:225-226`, `:607-624`

```ts
const displayedUsers = showAll ? users : users.slice(0, DISPLAY_LIMIT);   // DISPLAY_LIMIT = 20
const hasMoreUsers = users.length > DISPLAY_LIMIT;
...
ListFooterComponent={ hasMoreUsers && !hasActiveFilters ? (<View All button/>) : null }
```

The slice always applies, but the "View All" button is hidden whenever a filter is active.

**Scenario.** Search "kumar", 26 customers match. Twenty are listed. The header even says
"26 customers". The remaining six are unreachable — no button, no pagination, and scrolling to the
bottom shows nothing. The shopkeeper concludes the customer does not exist.

**Fix.** Show the footer whenever `hasMoreUsers`, regardless of `hasActiveFilters`; also reset
`showAll` to `false` when filters change.

## I6. Date-range filter is shifted one day earlier in IST

**File:** `src/screen/ExistingCustomersScreen.tsx:90-95`

```ts
dateFrom: filterDateFrom ? filterDateFrom.toISOString().split("T")[0] : undefined,
dateTo:   filterDateTo   ? filterDateTo.toISOString().split("T")[0]   : undefined,
```

`DateTimePicker` returns local midnight. In IST (UTC+5:30), `new Date(2026, 7, 31)` →
`"2026-08-30T18:30:00.000Z"` → the payload carries **`2026-08-30`**. The SQL compares it with
`date(openDate) >= date(?)` (`entryDatabase.ts:1003`).

**Scenario.** Pick From = 31 Aug 2026. A transaction entered on 30 Aug at 2 PM IST
(`openDate` = `2026-08-30T08:30:00Z`, `date()` = `2026-08-30`) satisfies `>= 2026-08-30` and its
customer is included in a range the shopkeeper explicitly started on the 31st.

**Fix.** Format from local parts:
``const d = `${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}` `` — never
`toISOString()` for a calendar date.

## I7. "Add" is enabled for an amount of 0 and then does nothing

**File:** `src/components/AddJamaModal.tsx:65-73` and `:146-150`;
`src/components/AddRehanTransactionModal.tsx:53-59` and `:173-177`

```ts
const handleAdd = () => {
  const amountNum = parseInt(amount, 10);
  if (amountNum > 0) { onAdd(amountNum, selectedDate); ...; onClose(); }
  // else: no alert, no close, nothing
};
...
<TouchableOpacity ... onPress={handleAdd} disabled={!amount}>   // "0" is a truthy string
```

**Scenario.** Open Add Jama Payment, type `0` (a plausible typo while reaching for `100`), tap Add.
The button is fully enabled and styled active. Nothing happens — no entry, no message, no dismissal.
The shopkeeper taps it repeatedly, assumes the app has hung, and force-closes.

**Fix.** `disabled={!amount || parseInt(amount, 10) <= 0}`, plus an `Alert.alert` in the `else`
branch of `handleAdd`.

## I8. The date picker always opens on the current month, ignoring the date being edited

**File:** `src/components/CustomDatePicker.tsx:29-31`

```ts
const [currentMonth, setCurrentMonth] = useState(selectedDate.getMonth());
const [currentYear,  setCurrentYear]  = useState(selectedDate.getFullYear());
```

`useState` initialisers run once, at mount. Both `AddJamaModal` and `AddTransactionScreen` render
`CustomDatePicker` unconditionally (visibility is a prop, not conditional mounting), so it mounts
with `selectedDate = new Date()` when the parent first renders and never resyncs when the prop
changes.

**Scenario.** Open a Len-Den → pencil-edit a jama payment dated 12 Mar 2024 → the modal correctly
shows "12 Mar 2024" → tap the date button. The calendar opens on **the current month**, with no day
highlighted. Correcting the amount now also requires paging back 29 months, or the shopkeeper
re-dates the payment to today by accident.

**Fix.** Sync on open: `useEffect(() => { if (visible) { setCurrentMonth(selectedDate.getMonth());
setCurrentYear(selectedDate.getFullYear()); } }, [visible, selectedDate]);`

## I9. A partial failure while writing jama entries produces a duplicate Len-Den on retry

**File:** `src/screen/AddTransactionScreen.tsx:176-206` (same shape at `NewCustomerScreen.tsx:248-265`)

```ts
const lendenId = await createLenden({...});
for (const entry of jamaEntries) {
  await createJamaEntry({ lendenId, amount: entry.amount, date: entry.date });
}
...
} catch (error) { Alert.alert("Error", "Failed to save transaction. Please try again."); }
```

There is no transaction wrapper and no rollback. If the second of three `createJamaEntry` calls
throws (disk full, DB locked), the Len-Den row and the first payment are already committed, and the
user is told the save failed and invited to retry.

**Scenario.** Save fails after the row is written → shopkeeper taps Save Transaction again → a
second complete Len-Den for the same bill. The customer's outstanding total is now double, with a
stray orphan payment on the first copy.

**Fix.** Wrap creation + entries in `withTransactionAsync`, or make `createLenden` accept the jama
entries and write them atomically.

## I10. The edit pencil on the add screen's bill preview is wired to an empty function

**File:** `src/screen/AddTransactionScreen.tsx:381-389`

```tsx
onEditJama={(index) => {
  // Simple delete and re-add flow for now or implement full edit if needed
  // ... (empty body, five lines of comments)
}}
```

`BillTable.tsx:92` renders the pencil whenever `editable && onEditJama` — passing an empty function
satisfies that. On the add screen the pencil is visible on every jama row and does nothing at all.
`NewCustomerScreen` correctly omits the prop, so the same table has no pencil there — the
inconsistency makes it read as a bug rather than an unimplemented feature.

**Fix.** Don't pass `onEditJama` until it works (matching `NewCustomerScreen`), or implement it by
pre-filling the modal.

---

# MINOR

## M1. `x ? x.toString() : ""` turns a stored `0` into an empty field
`src/screen/TransactionDetailScreen.tsx:200-219` — six occurrences. `lenden.baki` of `0` (which
`updateLendenBaki` genuinely writes) loads as `""`, and on save `editBaki ? parseInt(...) : undefined`
sends `undefined`, which `updateLendenDetails` turns into `NULL`. A settled entry drifts from
`baki = 0` to `baki = NULL`. Use `x != null ? String(x) : ""`.

## M2. Async loads with no cancellation set state after unmount
`TransactionDetailScreen.tsx:132-134` / `:173`, `UserTransactionsScreen.tsx:57-75`,
`ExistingCustomersScreen.tsx:81`, `UpdateBhavScreen.tsx:71-100`. None returns a cleanup that marks
the request stale. Navigating away during a slow load produces a state update on an unmounted
component (and, per I4, can also apply a stale result).

## M3. Index-based keys on deletable rows
`BillTable.tsx:81` — `key={entry.id || index}`. On the add screens the local jama entries have no
`id`, so all keys are array indices while `onDeleteJama` removes by index, shifting every subsequent
key. Also `entry.id || index` would fall through for an id of `0`. Use a stable local uid.

## M4. `"0"` passes the add-screen amount validation
`AddTransactionScreen.tsx:147` — `if (!amount)` is false for the string `"0"`. Entering `0` saves a
Len-Den with `amount = NULL` (via `0 || null`), `baki = 0` and `status = 1` — an empty, already-closed
record. Parse before validating.

## M5. Duplicate image URIs collapse on save
`TransactionDetailScreen.tsx:314-329` — `newImages.indexOf(path)` returns the first match, so if the
same gallery asset is added twice both slots map to the same saved path.

## M6. `loadData` omitted from its own effect's deps
`TransactionDetailScreen.tsx:132-134` — harmless today (the function only closes over route params),
but it will silently rot the first time `loadData` reads a piece of state.

---

# Suspected, not confirmed

- **I3's exact failure mode.** That `{0 && <View/>}` yields a bare `0` in the tree is certain from
  the code; whether RN 0.81 (New Architecture) renders it as stray text or throws
  `Text strings must be rendered within a <Text> component` I could not verify without running the
  app. Either way it is wrong and the fix is the same one-character change.
- **`JSON.parse(item.media)` in render** (`UserTransactionsScreen.tsx:317`) is unguarded. The schema
  declares `media TEXT NOT NULL` and both create paths always `JSON.stringify`, so I could not
  construct a failing input — but a malformed/legacy row would crash the whole list rather than one
  card. Worth a `try/catch` regardless.
- **Comma input on Indian Android keypads** (C4). The `-` and `.` paths are certain from RN's
  `numeric` input-type flags; whether a comma is reachable depends on the OEM keyboard. The `-`
  and NaN cases are sufficient on their own.

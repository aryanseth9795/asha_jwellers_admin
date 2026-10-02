# Analytics Screen — Design Spec

**Date:** 2026-10-02
**Status:** Approved 2026-10-02 (P1 FY, P2 three numbers, P3 RFM tiers)
**Source:** `analytics plan .md` (owner's notes). The ChatGPT plan link could not be fetched (HTTP 403),
so requirements are reconstructed from the notes and the schema.

---

## 1. Requirements (from the notes)

| # | Owner asked for | Section |
|---|---|---|
| R1 | Monthly sales trend, revenue | Sales |
| R2 | How much baaki | Sales |
| R3 | How many customers; repeat customers; time gap before a customer buys again | Customers |
| R4 | Customer nature: good / medium / low engaging | Customers |
| R5 | How much rehan we have; avg time to close; monthly and annual rehan trend | Rehan |
| R6 | Gold vs silver sales by weight, each month | Metal |
| R7 | Old gold/silver received, by metal type | Metal |

## 2. Decisions already made

| # | Decision | Choice |
|---|---|---|
| A1 | Charts | Pure React Native views (bars, stacked bars, stat tiles). No new dependencies, no native rebuild, ships OTA. |
| A2 | Placement | One `AnalyticsScreen` pushed from Home, with a segmented control: **Sales / Customers / Rehan / Metal**. |
| A3 | Old metal type | Done on this branch (`2026-10-02-old-jewellery-adjustments-report.md`). |

## 3. Decisions approved 2026-10-02

| # | Question | Proposal | Why |
|---|---|---|---|
| P1 ✅ | Period | **Indian financial year (Apr–Mar)** selector, default current FY, plus "All time". Charts show the 12 months of the FY. | Matches how a shop does accounts and tax. The register would switch to FY too, for consistency. |
| P2 ✅ | What "revenue" means | Show three numbers, never one blended figure: **Sales** (gross bill value), **Collected** (cash actually received), **Baaki** (still owed). | The three answer different questions; a single "revenue" would hide credit sales. |
| P3 ✅ | Customer tiers | RFM score, explained in §6.3 | Simple, explainable, adapts to the shop's own data. |

## 4. Metric definitions

Every metric is defined against the existing schema. No new tables or columns.

### 4.1 Sales (Len-Den)

| Metric | Definition | Notes |
|---|---|---|
| Sales | Σ `lenden.amount` by `lenden.date` | `amount` is kept equal to the effective amount (item sum unless overridden — see `lendenAmount.ts`), so the stored column is used directly. |
| Old jewellery credit | Σ old item `value` by entry date | |
| Discount | Σ `lenden.discount` | |
| Net sales | Sales − old credit − discount = Σ `lenden.remaining` | Same formula as `lendenSettlement.ts`. |
| Collected | Σ `jama_entries.amount` by **payment date** | Cash-flow view: a payment counts in the month it was received. For legacy entries with no `jama_entries` rows, `lenden.jama` is used, dated at the bill date. `lenden.jama` is never added when `jama_entries` exist (it duplicates them). |
| Baaki outstanding | Σ `lenden.baki` where `status = 0` | A snapshot as of today, not per period. |
| Bills | count of `lenden` | |
| Average bill | Sales ÷ bills | |

Charts: monthly Sales bars, with Collected overlaid as a second bar; Baaki tile; top 5 customers by baaki.

### 4.2 Customers

| Metric | Definition |
|---|---|
| Total customers | count of `users` |
| Active in period | customers with any Len-Den or Rehan entry dated in the period |
| New in period | customers whose **first** entry (any type) falls in the period (`users.createdAt` is ignored: records created later for old customers would look new) |
| Buyers | customers with ≥ 1 Len-Den entry |
| Repeat customers | buyers with ≥ 2 Len-Den entries on **different days** (two bills on one day are one visit) |
| Repeat rate | repeat ÷ buyers |
| Re-purchase gap | for each repeat customer, the days between consecutive purchase days; report the **median** across all gaps, plus the distribution: < 1 month / 1–3 / 3–6 / 6–12 / > 12 months |

The median is used because a few customers returning after years would distort a mean.

### 4.3 Rehan

| Metric | Definition | Notes |
|---|---|---|
| Open rehan | count and Σ `amount` where `status = 0` | `amount` is the **current balance** (`createRehanTransaction` adds diya / subtracts jama). |
| Given out | initial principal at `openDate` + Σ `diya` transactions at their dates | Principal isn't stored, so it is reconstructed: `amount − Σdiya + Σjama`, clamped at ≥ 0. **Caveat:** if the amount was hand-edited on the detail screen, this reconstruction is off for that entry. |
| Recovered | Σ `jama` transactions by date | |
| New / closed per month | count by `openDate` / `closedDate` | |
| Time to close | `closedDate − openDate` in days for closed entries; **median** and average | Rows with no `closedDate` are skipped. |
| Annual trend | Given out, recovered and count per FY across all years | Covers "annual rehan trend". |

### 4.4 Metal

| Metric | Definition |
|---|---|
| New sold, by metal | Σ `lenden_items.weight` and Σ `total` grouped by `metal`, by entry date. `weight` is the line's total weight (`total = weight × rate`; `qty` is a piece count, not a multiplier). Items without weight add value only. |
| Old received, by metal | Same from `lenden_old_jewellery_items`; `metal = NULL` → **Unknown** bucket (never merged). |
| Net metal flow | sold − received, per metal, per month |

Charts: monthly stacked bars, gold vs silver weight (sold); the same for old received; tiles for FY totals.

## 5. Architecture

```
src/database/analyticsQueries.ts      raw rows, 6 flat SELECTs, no aggregation logic
src/utils/analytics/periods.ts        FY bounds, month buckets, day diffs (pure)
src/utils/analytics/sales.ts          rows → SalesView                     (pure, tested)
src/utils/analytics/customers.ts      rows → CustomersView incl. tiers     (pure, tested)
src/utils/analytics/rehan.ts          rows → RehanView                     (pure, tested)
src/utils/analytics/metal.ts          rows → MetalView                     (pure, tested)
src/components/charts/BarChart.tsx        vertical bars, optional 2nd series
src/components/charts/StackedBarChart.tsx gold/silver stacks
src/components/charts/StatTile.tsx
src/screen/AnalyticsScreen.tsx        segment + FY picker; load once on focus, useMemo per section
```

- **Load once, compute in JS.** A single shop's ledger is thousands of rows, not millions. Fetching
  flat rows once and aggregating in pure functions keeps every number unit-testable (Jest only runs
  `.ts` in node) and makes period switching instant, with no re-query.
- Queries select only the needed columns (no `media` JSON).
- Money is integer rupees; weights are rounded to milligrams after summing (same rule as the register).
- Dates are bucketed in **local** time (ISO strings are stored in UTC; a 1 a.m. IST sale must not
  land in the previous day or month).
- Empty states: each chart shows "No data for this period" instead of zero-height bars.

## 6. Section details

### 6.1 Header (all sections)
FY picker `◀ FY 2026-27 ▶` plus an "All time" toggle. Values in the Indian format (`1,82,500`), with compact
axis labels (`1.8L`, `45K`).

### 6.2 Sales
Tiles: Sales · Collected · Net after old/discount · Baaki outstanding · Bills · Avg bill.
Chart: monthly Sales vs Collected. List: top 5 baaki customers (tap → customer).

### 6.3 Customers — tiers (P3)
Scored among **buyers** over the selected period (all-time if "All time"):

| Factor | 3 points | 2 points | 1 point |
|---|---|---|---|
| Recency — days since last visit (as of today) | ≤ 90 | ≤ 365 | > 365 |
| Frequency — distinct purchase days | top third of buyers | middle third | bottom third |
| Monetary — total sales | top third | middle third | bottom third |

**Good** = 8–9, **Medium** = 6–7, **Low** = 3–5. Recency uses fixed day thresholds (meaningful on its own);
frequency and monetary use thirds, so tiers adapt to this shop's scale without hand-tuned rupee amounts.
Ties share the lower rank (a value scores by how many peers are strictly below it), so a crowd of one-visit buyers doesn't all land in the top third. With fewer than 3 buyers, everyone is Medium (thirds are
meaningless).

A separate **"High baaki"** flag (baaki > 50 % of that customer's net purchases) is shown as a badge, not
mixed into the tier. A loyal customer who pays late is a different signal from a disengaged one.

Display: tier counts as a 3-segment bar, a tap-through list per tier, plus repeat rate and the gap distribution.

### 6.4 Rehan
Tiles: Open count · Open balance · Median days to close. Charts: monthly given vs recovered; per-FY annual
bars (all years).

### 6.5 Metal
Tiles: gold sold g · silver sold g · old gold received g · old silver received g (Unknown note if any).
Charts: monthly stacked gold/silver for sold and for received.

## 7. Testing
Unit tests per pure module, at minimum: FY boundaries (31 Mar vs 1 Apr, UTC vs IST), legacy jama
fallback without double-counting, same-day bills as one visit, median with even counts, tier thirds
with ties and < 3 buyers, rehan principal clamp, unknown-metal isolation. Then typecheck and a device
check of each section against hand-counted sample data.

## 8. Out of scope
Exporting analytics (PDF/share), profit/margin (purchase cost isn't recorded), forecasting, push alerts.

## 9. Implementation notes (2026-10-02)

Built on `feat/old-jewellery-adjustments` per `agent/2026-10-02-analytics-plan.md`. Deviations and decisions made during implementation:

- **Rehan opened/closed per month** (§4.3) are shown as tile counts for the period, not a separate monthly chart; the monthly Rehan chart is given vs recovered.
- **Customer activity** (§4.2) counts Len-Den and Rehan *entries* only. Jama payments and rehan transactions are not visits, so a customer who only came in to pay keeps an older "last visit".
- **Re-purchase gaps** are measured between purchase days inside the selected period; a gap spanning an FY boundary is not counted in that FY.
- **Baaki outstanding** sums only positive `baki` on open entries; a negative stored baki (data error) is ignored rather than reducing the total.
- **Net metal flow** (§4.4) is not shown as its own figure; the Metal tab shows sold and received side by side, from which the net is read directly.
- **Old Jewellery register** "This Year" became "This FY" (Apr–Mar) to agree with Analytics.
- Known cosmetic edges, deferred: compact axis labels near unit boundaries (e.g. 99,999 shows "100K"); FY back-arrow has no lower bound (earlier years show the empty state); turning "All time" off returns to the current FY.

## 10. Dynamic dashboard (v2, approved 2026-10-02)

Owner request: "in-depth insight for each and every parameter, comparisons, enriched dashboard … dynamic, covers all future
transactions." Approved time-frame design plus these additions. All numbers keep their §4 definitions.

### 10.1 Time frames
Chips **Week · Month · Quarter · FY · Custom · All**, ◀ ▶ to step. Week = Mon–Sun (day bars); Month = calendar month
(week bars); Quarter = FY quarter Q1 Apr–Jun … Q4 Jan–Mar (week bars); FY = Apr–Mar (month bars); Custom = From–To
inclusive (bars: ≤ 31 days day, ≤ 184 week, ≤ 1100 month, else year); All = first to last FY in the data (year bars).
▶ stops at the period containing today.

### 10.2 Comparison
Every Overview KPI shows change vs the **previous equal period** (week, month, quarter, FY; Custom = same number of days
immediately before). Month and Quarter also show **vs same period last year**. Change = delta and % (no % when the
previous value is 0). Colour by meaning: up is good for sales, collected, collection rate, grams, customers; up is bad
for baaki and old-return %.

### 10.3 Tabs
**Overview** (KPIs + auto insights + sales chart with previous period overlaid) · **Sales** (+ baaki aging) ·
**Customers** (+ key customers) · **Villages** (new) · **Rehan** · **Metal** (+ categories) · **Trends** (new).

### 10.4 New metrics
| Metric | Definition |
|---|---|
| Collection rate | Collected ÷ net sales in the period; none when net sales is 0 |
| Old-return % | old jewellery value ÷ sales in the period |
| Baaki at period end | Σ over bills dated before the instant of max(0, net − payments dated before it); instant = period end, capped at now. Reconstructed from payment dates (legacy `lenden.jama` at bill date), so it can differ slightly from the stored `baki` if entries were hand-edited |
| Baaki aging | open entries (status 0, baki > 0) by bill age: 0–30, 31–90, 91–180, 181–365 days, > 1 year |
| Category | metal + purity of sold items: Gold 24KT/22KT/18KT, Silver Desi/Fancy, "(no purity)" when blank or legacy "Silver"; metal not gold/silver → "Unknown metal". Value, grams, item count, share, growth vs previous period; categories present only in the previous period are kept (shown as a fall) |
| Village | text before the first comma of `users.address`, whitespace collapsed, case-insensitive; blank → "No address". Display name = most common spelling. Customers (all-time), buyers and sales in the period, share, growth vs previous, open baaki |
| Key customers | top 10 buyers by period sales with share, lifetime sales, open baaki, visits; plus "top 20 % of buyers bring X % of sales" |
| Trends | last 8 weeks / 6 months / 4 quarters / 5 FYs (Custom → months, All → FYs): bills, sales, collected, collection rate, old returned, baaki at end, gold g, silver g, each with change vs the row before |

### 10.5 Insights (generated, shown only when the data supports them)
Sales up/down/flat vs previous · best day/week/month/year · top-selling category share · fastest-growing category ·
category falling > 10 % · top village share · top-20 % concentration (≥ 5 buyers) · baaki rose/fell · baaki older than
6 months · collection rate < 60 % · old jewellery ≥ 15 % of sales.

### 10.6 Dynamic by construction
Nothing is precomputed or stored. Every screen focus (and pull-to-refresh) re-reads the ledger and recomputes; villages,
categories and periods are discovered from the data, so new transactions, customers, villages and purities appear
without changing the app.

## 11. Dashboard v2 implementation notes (2026-10-02)

Built on `feat/old-jewellery-adjustments` per `agent/2026-10-02-dashboard-v2-plan.md`.

- **Trends compare five figures row to row** — sales, collected, baaki at end, gold g, silver g carry ▲/▼ vs the row before; bills, collection rate and old returned are shown as values only.
- **Trends ignore Custom and All** — they use months for Custom and financial years for All; the other tabs use the exact selected range.
- **Customers tab follows the selected time frame**, including its good / medium / low tiers (a single week makes tiers less meaningful).
- **Baaki at period end is reconstructed** from bill and payment dates; it can differ slightly from the stored baki if entries were hand-edited. "Baaki older than 6 months" and the aging card always use today's date.
- **Trends chart labels** are short forms of the period (FY "25-26", quarter "Q1 26", month "Aug", week "5 Oct"); the table shows full labels.
- **Printed bill** (owner change in 77b0ea8): the itemised old-jewellery table is no longer printed; the credit shows only in the Hindi payment summary. Old items, their metal and purity are still stored and feed Analytics.
- **In-progress periods are compared with the same number of days** of the previous / last-year period (e.g. 1–2 Oct vs 1–2 Sep); the chart overlay still shows the whole previous period; the newest Trends row is marked "(so far)".

## 12. Insights report layout (v3, approved 2026-10-02)

Source: owner-supplied `Rehan & Lenden Insights.html`, a static report built from an export of this ledger (549 pledges,
12 bills, 291 customers). v3 rebuilds that report inside the app on live data. Owner decisions: **follow the report's
layout**, **report filters for pledge charts + time frame for billing**, **Data quality tab**, **item types by keyword
rules** (no data-entry change).

### 12.1 Tabs
| Tab | Filters | Content |
|---|---|---|
| Overview | pledge filters | Key findings (Risk / Watch / Upside / Data) + headline numbers |
| Rehan book | pledge filters | opened vs redeemed per month · open principal at month-end · age of open pledges · time to redeem · pledge size · cohorts by year · day of week opened · interest what-if |
| Items | pledge filters (rankings ignore the item filter) | items ranked · item mix by quarter · single items vs bundles · item scorecard |
| Customers & Villages | pledge filters (rankings ignore the village filter) | villages ranked · concentration · village scorecard · largest open exposures · repeat customers · customers added per month · customers by activity · watchlist |
| Billing | time frame + village | sub-tabs: **Summary** (billing summary, gross → cash, collected vs pending per bill, discount per bill, numbered vs earlier bills, all bills with flags) · **Sales** (v2 KPIs with ▲▼, insights, sales chart, baaki aging) · **Metal** (v2 metal + categories) · **Trends** (v2) · **Customers** (v2 key customers, tiers, villages by sales) |
| Together | pledge filters (village also applies to bills) | scale of the two ledgers · village share in each ledger |
| Data quality | none (always the whole ledger) | checks tagged Fix / Check / Note / Good · field coverage |

Pledge filters: **Village** (grouped villages), **Item** (item types), **Opened in** (years present), **Status** (All /
Open / Redeemed), **Reset**, and "Showing N of M pledges".

### 12.2 Pledge definitions (rehan)
| Field | Definition |
|---|---|
| Principal | amount lent = `principalOf` (§4.3: current balance − Σdiya + Σjama, ≥ 0). The report used the stored amount because its export had no transactions; in the app the stored amount is a running balance |
| Open / redeemed | status 0 / status 1 |
| Open book | Σ principal of open pledges |
| Days open | today − opened (open pledges); days to redeem = closed − opened |
| Photo | `rehan.media` holds at least one image |
| Item type | first recognised item word in `productName` (§12.4); none → **Other**; blank or numbers only → **Unspecified** |
| Bundle | product name naming two or more different item types |
| Village | customer's village (§12.5) |

Buckets: age and time-to-redeem `≤3 mo, 3–6 mo, 6–12 mo, 1–2 yr, 2 yr +` (months = days ÷ 30.44); pledge size `<1K, 1–2.5K,
2.5–5K, 5–10K, 10–20K, 20–40K, 40K+`; pledges per customer `1, 2, 3, 4–6, 7+`. Concentration: customers ranked by
principal; share held by the top 10 %, 20 %, 50 % (counts rounded up) and the ten largest. Interest what-if: rate per
month (default 2 %, 0.5 % steps, 0.5–5 %): per month = open book × rate; per year = × 12; accrued to date = Σ open
principal × rate × days open ÷ 30.

### 12.3 Billing definitions (len-den)
Gross = amount; Net = gross − discount − old jewellery credit (stored `remaining`); **Collected = net − baki** (snapshot, as
in the report); Pending = baki on open bills; Received = Σ jama_entries (legacy `lenden.jama` when there are none).
Flags per bill: **Customer not on file** (red), **Received field blank** (received 0 while collected > 0, red),
**Received field short** (0 < received < collected, red), **Amount overridden** (grey), **No bill number** (grey).
Numbered vs earlier: bills with a bill number vs without — bills, gross, net, average net, discount rate, collected share,
pending, customers, bills with a photo. The v2 cash-by-payment-date "Collected" stays in the Sales sub-tab.

### 12.4 Item keyword rules
Lower-case the product name, split on non-letters, take the first word found here:
Payal: payal, paayal · Locket: locket, loket · Bunda: bunda · Anguthi: anguthi, angoothi, angothi, ring · Chain: chain ·
Kardhan: kardhan, kardhani, krdhn, krdhan · Chhagal: chhagal, chagal · Jhala: jhala · Tika: tika, tikka · Kil: kil, keel ·
Jhumka: jhumka, jhumki · Nathiya / Nathuni: nathiya, nthiya, nathuni, nath · Toda: toda · Tops: tops, top · Bali: bali ·
Mangalsutra: mangalsutra · Hath mehndi: hath, mehndi · Sikdi: sikdi · Haar: haar, har · Kundal: kundal ·
Kada: kada, bracelet · Guchha: guchha, chabhi · Jantar: jantar · Bal choti: bal, baal, choti · Latkan: latkan ·
Chudi: chudi, choodi · Peti: peti · Hasuli: hasuli, hansuli.
Reproduces the report's grouping of its 210 spellings, e.g. "Hk Payal" → Payal, "Krdhn hath mehndi" → Kardhan,
"Top locket" → Tops, "1 lar" → Other, "3.800" → Unspecified. Checked against the report: the same type on 549 of 549 pledges and the same 61 bundles. Unknown words are skipped, so new spellings fall to Other
until a keyword is added.

### 12.5 Villages (refines §10.4)
Text before the first comma of the address, punctuation removed, spaces collapsed, case-insensitive; display = most
common spelling. Blank → **Unknown**. Villages with fewer than **5 customers** are grouped as **Other villages**
(report rule). Recomputed from live data, so a village leaves "Other" once it reaches 5 customers.

### 12.6 Key findings (generated; each only when its condition holds)
Risk: open pledges a year old or more ≥ 25 % of open principal (counts and ₹ past 12 and 24 months; median days to
redeem) · unpaid billing (pending ₹ of net billed; share on customers not on file; oldest unpaid bill in days).
Watch: top two villages' share of the open book ≥ 40 % · item with the largest open exposure (share; its redemption rate
vs overall) · lowest redemption rate among villages with ≥ 10 pledges vs the best · ten largest customers' share of open
principal, customers with ≥ ₹50,000 open, the largest · photo coverage < 50 %.
Upside: customers with more than one pledge (share of customers and of principal; customers with 7+ pledges) · overlap
between billing and pledging customers.
Data: longest run of ≥ 2 months with no new pledge inside the logged span.

### 12.7 Data quality checks (whole ledger, unfiltered)
Fix: pledges or bills whose customer is missing · bills whose received differs from net − baki.
Check: possible duplicate customers (same cleaned name + village on more than one ID) · months with no new pledge ·
photo coverage of pledges and bills · phone coverage · pledges with no amount · status/date inconsistencies (closed
without a close date, close before open, open with a close date).
Note: item names that fall to Other · customers without a village. Good: a check that finds nothing.
Coverage bars: pledges linked to a customer · with an amount · with an item name · with a photo · customers with a
village · with a phone number · bills with a bill number · bills whose received matches the balance · bills whose
customer is on file. Bars below 50 % are orange.

### 12.8 Out of scope
The HTML's theme toggle and Chart/Table switches (the app shows one view per card, a table where the report's table is the
primary view) and click-to-filter on charts (filters are set from the filter bar).

## 13. Insights v3 implementation notes (2026-10-02)

Built on `feat/old-jewellery-adjustments` per `agent/2026-10-02-insights-v3-plan.md`. Deviations from §12 and decisions made while building:

- **Bundles:** "Krdhn hath mehndi" names Kardhan and Hath mehndi, so it is a bundle; the same rule reproduced the report's 61 bundles.
- **Concentration** counts the top 10 % / 20 % / 50 % of customers with whole-number rounding up (no floating-point drift), shown as four tiles rather than a curve chart.
- **Item mix** shows the last 8 calendar quarters.
- **Interest what-if** uses −/+ buttons in 0.5 % steps from 0.5 % to 5 %, default 2 % per month.
- **Billing sub-tabs** Sales, Metal, Trends and Customers are the v2 views: they follow the time frame but not the village filter; Summary follows both. Trends shows its own last periods regardless of the picker.
- **Filters** are set on the pledge tabs (the filter bar folds into one line until tapped); Billing shows the active village as a note.
- **Data quality** always uses the whole ledger. Duplicate-customer, logging-gap and no-amount checks show nothing when they find nothing (no separate Good line).

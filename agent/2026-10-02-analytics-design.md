# Analytics Screen — Design Spec

**Date:** 2026-10-02
**Status:** Draft — awaiting approval
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

## 3. Proposed decisions (need approval)

| # | Question | Proposal | Why |
|---|---|---|---|
| P1 | Period | **Indian financial year (Apr–Mar)** selector, default current FY, plus "All time". Charts show the 12 months of the FY. | Matches how a shop does accounts and tax. The register would switch to FY too, for consistency. |
| P2 | What "revenue" means | Show three numbers, never one blended figure: **Sales** (gross bill value), **Collected** (cash actually received), **Baaki** (still owed). | The three answer different questions; a single "revenue" would hide credit sales. |
| P3 | Customer tiers | RFM score, explained in §6.3 | Simple, explainable, adapts to the shop's own data. |

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
Ties at a boundary go to the higher third. With fewer than 3 buyers, everyone is Medium (thirds are
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

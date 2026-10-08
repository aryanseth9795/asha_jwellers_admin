# Adaptive A5 Bill Layout — Design & Implementation Plan

**Date:** 2026-10-05
**Status:** Implemented (Phases 0–5) on 2026-10-05 with the recommended answers to §9. Phase 6 not done. Device checks in §11 still to run. See §13.
**Scope:** Make the printed bill fill one A5 page cleanly, whatever the number of items: expand the header when there is room, shrink it when there is not, and move to proper multi-page bills only when one page truly cannot hold the content.
**Supersedes:** §5.4 "Vertical budget" and the "Multi-page bills" non-goal of `agent/2026-08-31-lenden-bill-design.md`.

---

## 1. Problem

Two complaints, one cause:

- **Few items → ugly blank band.** A 1-item bill leaves about **61 mm** of empty cream between the table and the summary. That is 29% of the page.
- **More items → spills onto a second page.** With payment details on, even **3 items** overflow. The page grows to 216 mm and the footer's "Thank you" strip lands alone on page 2.

The behaviour we want has three cases:

| Case | Content | Header | Pages |
|---|---|---|---|
| **1 — Roomy** | 1–2 items | **Expanded** to its natural, undistorted size; the page looks full | 1 |
| **2 — Tight** | ~4–5 items | **Shrunk just enough** for everything to fit; the page looks full | 1 |
| **3 — Overflow** | Too much for one page | **Not shrunk** (full banner) | 2+ |

## 2. What the code does today

All layout lives in `src/services/BillHtmlService.ts`. `expo-print` turns it into a PDF (`src/services/BillService.ts`).

| Part | Today | Effect |
|---|---|---|
| Header band | **Fixed** at 65.6 mm: the template's top 42.2% (93.7 mm natural) squashed vertically to 0.7 (`HEADER_COMPRESS_RATIO`), on **every** bill | The artwork is always distorted: the AJ ring prints as an oval, even with 1 item |
| Footer band | Fixed 32.9 mm, pushed down with `margin-top: auto` | Fine on one page; floats mid-page when the bill overflows |
| Middle | `flex: 1`, the summary (`.foot`) pushed down with `margin-top: auto` | All spare space becomes **one blank gap** between table and summary |
| Density | `items.length > 5` drops the milligram sub-line (`COMPACT_ITEM_THRESHOLD`) | Decided by **item count**, not space: 6 short items get compacted *and* still leave a 32 mm gap |
| Overflow | `.page { min-height: 210mm }` just grows; Chromium slices it into pages | No header on page 2, the table header sits flush against the paper edge, the footer floats, and a sliver page is possible |

### 2.1 Measurements

I rendered the real `buildBillHtml` output in headless Chromium (Edge) and measured every block with `getBoundingClientRect`. Android uses Noto Sans Devanagari, not Windows' Nirmala UI, so absolute numbers will shift by a few percent. The *shape* of the result is what matters.

| Block | Height |
|---|---|
| Header band (today, squashed) | 65.6 mm (natural, undistorted: **93.7 mm**) |
| Footer band | 32.9 mm |
| Customer box + paddings + table header | ~23.8 mm |
| Item row, with milligram line | **9.3 mm** |
| Item row, compact | **6.4 mm** |
| Total row | 6.6 mm |
| Summary — plain copy (1 row: दर प्रति ग्राम) | **6.3 mm** |
| Summary — full ledger (कुल राशि, पुराना सोना, पुरानी चाँदी, छूट, 2× जमा, बाकी, पिछला बाकी, कुल बाकी) | **55.0 mm** |

| Bill | Page height | Blank gap |
|---|---|---|
| Plain, 1 item | 210 mm | **61.3 mm** |
| Plain, 5 items | 210 mm | 24.2 mm |
| Plain, 6 items (compacted) | 210 mm | 32.4 mm |
| Plain, 12 items | **215.8 mm** (overflow) | 0 |
| Full ledger, 1 item | 210 mm | 12.5 mm |
| Full ledger, 3 items | **216.0 mm** (overflow) | 0 |
| Full ledger, 5 items | **234.6 mm** (overflow) | 0 |

### 2.2 Root causes

- **R1 — Fixed heights everywhere.** Nothing hands spare space back to the header, so it pools in one gap.
- **R2 — Decisions keyed to the wrong variable.** The item count drives density, but the summary alone ranges from 6 mm to 55 mm, which is as much as 9 item rows. Long names and addresses wrap too. Only the **real content height** can drive the layout.
- **R3 — Pagination left to the print engine.** Chromium's page slicing knows nothing about bands, continuation headers or anchored footers.
- **R4 — The header is always distorted.** The squash was a fixed trade-off made for the worst case and paid on every bill.

## 3. Engine constraints

These come from reading `node_modules/expo-print` (v15.0.8). They rule out some otherwise obvious designs.

| # | Constraint | Consequence |
|---|---|---|
| **C1** | The Android PDF renderer (`PrintPDFRenderTask.kt`) creates a bare `WebView` and **never enables JavaScript**, and Android WebViews ship with it off | The bill HTML must lay itself out **with no script**. A self-measuring page works in the preview but is wrong in the shared PDF. |
| **C2** | `printBill` calls `Print.printAsync({ html })` with **no width/height**. Android lays it out on Letter (612×792 pt), then re-lays it out for whatever paper the print dialog picks. | A printed bill can break differently from the shared PDF. Print the A5 PDF itself instead (§5.5). |
| **C3** | The PDF page is 420 × 595 pt = **148.2 × 209.9 mm**. The `.page` box is **210.0 mm** tall. | The box is 0.1 mm taller than the paper, which risks a blank sliver page. Use a **209.5 mm** page box. |
| **C4** | The preview uses `react-native-webview`, which runs JS. On Android it is the same Chromium with the same system fonts as the PDF renderer. | Heights measured in the preview carry over to the PDF. Pin `textZoom={100}` so system font scaling cannot skew them. |

## 4. Target behaviour

### 4.1 Definitions

| Symbol | Meaning | Value |
|---|---|---|
| `P` | Page box height | 209.5 mm |
| `F` | Footer band | 32.9 mm |
| `H_max` | Header at natural size, ratio 1.0, undistorted | 93.7 mm |
| `H_min` | Header floor, today's squash (ratio 0.7), already accepted in production | 65.6 mm |
| `S` | Safety margin for rounding and font differences | 1.0 mm |
| `C(d)` | Measured middle content (customer box + table + total + summary) at density `d` | measured |
| `A(d)` | Room left for the header, `P − F − S − C(d)` | derived |

### 4.2 The decision ladder

```
                 A(normal) ≥ H_max ?
                 ├─ yes → CASE 1  header = H_max (undistorted)
                 │                spare = A − H_max → ruled table filler (§5.3), never a blank gap
                 └─ no
                    A(normal) ≥ H_min ?
                    ├─ yes → CASE 2  header = A(normal)   (shrinks only as much as needed; page exactly full)
                    └─ no
                       A(compact) ≥ H_min ?
                       ├─ yes → CASE 2b compact rows/summary, header = min(H_max, A(compact))
                       └─ no  → CASE 3  multi-page, normal density, header = H_max on page 1,
                                        continuation strip on later pages, footer on the last page
```

Properties the planner guarantees, each pinned by a test:

- **Never a blank gap on one page.** `header + content + filler + footer = P − S` exactly.
- **Monotonic.** At the same density, more content never makes the header taller.
- **Case 3 never compresses the header**, as you asked.
- **No row or summary block is ever split** across pages.

### 4.3 Expected outcome (desktop metrics)

| Plain copy | Case | Header ratio | Today |
|---|---|---|---|
| 1 item | 1 | 1.00 + 32 mm ruled filler | 0.70 + 61 mm blank |
| 2–4 items | 1 | 1.00 + filler | 0.70 + blank |
| 5 items | 2 | 0.94 | 0.70 + 24 mm blank |
| 6 items | 2 | 0.84, milligram line kept | 0.70, compacted, 32 mm blank |
| 7 items | 2 | 0.74 | compacted + blank |
| 8–10 items | 2b | 0.89 → 0.75 | compacted + blank |
| 11+ items | 3 | 1.00, 2 pages (page 1 holds ~9 rows) | overflows untidily |

| Full ledger copy | Case |
|---|---|
| 1–2 items | 2 (ratio ~0.82 → ~0.72) |
| 3 items | 2b |
| 4+ items | 3 (rises to ~5 items in 2b if the compact summary of §7 lands) |

The device will shift these thresholds a little. That is exactly why the planner uses measured heights, not these numbers.

### 4.4 Spike evidence

A throwaway prototype rendered all three cases in headless Chromium. Its files stay in the session scratchpad and are not committed.

- **Case 1, 1 item:** header at ratio 1.0 (round AJ ring, unstretched photo). The item table runs down to the summary with ruled columns and the template's necklace watermark, like the original stationery.
- **Case 2, 6 items:** header ratio 0.84, every milligram line kept, page exactly full.
- **Case 3, 14 items:** printed to PDF it gives **exactly 2 A5 pages**. Page 1 has the full banner, 9 rows and "क्रमशः — पृष्ठ 2 पर जारी". Page 2 has a continuation strip (ASHA JEWELLERS · Invoice No. · name · पृष्ठ 2 / 2), rows 10–14, a ruled filler, totals, summary and a bottom-anchored footer.

The spike also corrects an old assumption. The 2026-08-31 design said the necklace watermark "cannot be clipped out" without dragging table lines along. A crop box of template x165–510, y905–1255 sits clear of the printed lines.

## 5. Architecture: Measure → Plan → Render

```
BillData + toggles
   │
   ├─▶ buildBillMeasureHtml(data)   same CSS and markup; the middle block rendered twice (normal + compact)
   │        │
   │        ▼
   │   hidden WebView + injected probe (injectedJavaScript; never inside the bill HTML)
   │        │ postMessage(BillMetrics)
   │        ▼
   ├─▶ planBillLayout(metrics) ── pure, unit-tested ──▶ BillLayoutPlan
   │                                                    │
   └────────────────────────────────────────────────────┴─▶ buildBillHtml(data, plan) ──▶ static HTML, no script
                                                                  │
                                         preview WebView ◀────────┼────────▶ printToFileAsync (A5) ─▶ share / print
```

### 5.0 Why this and not the alternatives

| Option | Verdict |
|---|---|
| **Pure CSS** (flex-shrink header, flexible filler) | Handles cases 1 and 2, but cannot express "if it overflows, go back to the full banner and paginate". Case 3 is a discontinuous rule. **Kept as a safety valve** (§5.3). |
| **Script inside the bill HTML** that measures itself | Dead in the Android PDF (C1). **Rejected.** |
| **Estimate heights in TypeScript** from item and summary counts | Fragile: Devanagari wrapping, device fonts, long names and addresses. **Kept only as the fallback** (§5.6). |
| **Measure in the preview, plan in pure TS, render static HTML** | Accurate, because the same engine and fonts render the PDF. Testable, because the planner is a pure function. Safe, because the output has no script. **Chosen.** |

### 5.1 Measurement

`src/services/bill/measure.ts`:

- `buildBillMeasureHtml(data)` reuses the real bill's CSS and partials. It renders the middle block twice, normal and compact, each in its own fixed 132 mm-wide container, so one load measures both densities.
- `BILL_PROBE_JS` waits for `document.fonts.ready`, then measures every block (px × 25.4 / 96 → mm) and posts:

```ts
interface DensityMetrics {
  frameMm: number;     // customer box incl. margins
  theadMm: number;
  rowMm: number[];     // one per item, in order
  totalRowMm: number;
  footMm: number;      // summary block incl. paddings
}
interface BillMetrics { v: 1; key: string; normal: DensityMetrics; compact: DensityMetrics }
```

- `parseBillMetrics(raw, expectedKey, itemCount)` rejects stale keys, a wrong row count, and non-finite, negative or absurd values (> 300 mm). It returns `null` rather than throwing.
- `key` is a cheap hash of the bill inputs, without the 151 KB template URI, so a late message from an old toggle state is ignored.

### 5.2 Planner (pure)

`src/services/bill/layoutPlan.ts`, next to a single `geometry.ts` that owns every mm constant now scattered at the top of `BillHtmlService.ts`:

```ts
type Density = "normal" | "compact";

type BillLayoutPlan =
  | { kind: "single"; density: Density; headerMm: number; fillerMm: number }
  | { kind: "multi"; density: "normal"; pages: PagePlan[] };

interface PagePlan {
  rows: { start: number; end: number }; // half-open item range
  fillerMm: number;
  // page 0 has the full header band and the customer box; the last page has total + summary + footer
}

function planBillLayout(m: BillMetrics, g: Geometry = GEOMETRY): BillLayoutPlan;
function estimateBillMetrics(data: BillData): BillMetrics; // §5.6 fallback
```

Pagination rules for case 3:

1. Page 1: full header, customer box, table header, then rows greedily while they fit above a 6 mm "क्रमशः" strip.
2. Middle pages: continuation strip (~14 mm), table header, rows, "क्रमशः" strip.
3. Last page: continuation strip, table header, remaining rows, total row, summary, footer band.
4. **Widow rule:** the last page carries at least 2 rows, or all remaining rows if fewer, so the totals never sit alone.
5. **Guards:** a row taller than a page gets a page of its own. A summary too tall for any page falls back to normal flow (pathological: 15+ jama entries). A hard cap of 10 pages.

### 5.3 Renderer

`buildBillHtml(data, plan)`. The signature gains `plan`. Its default is `planBillLayout(estimateBillMetrics(data))`, so existing callers and tests keep working.

- **Explicit pages.** Every page is `<div class="page">` with `height: 209.5mm; break-after: page`. Nothing relies on Chromium's slicing, so the PDF and any paper size print the same breaks.
- **Header band follows its own height.** Use `background-size: 100% 236.97%` (= 1 / 0.422) in place of today's absolute mm size. The artwork then always maps the template's top 42.2% onto whatever height the band gets. At ratio 1.0 it is undistorted.
- **Safety valve.** The band is `height: <plan>mm; flex: 0 1 auto; min-height: 65.6mm`. If the device's real content is 1–2 mm taller than measured, the header gives way instead of the footer being pushed off the page.
- **Ruled filler, not a gap.** A last `<tr class="filler" style="height: <plan>mm">` inside the same items table. The column rules line up for free, and the top and bottom borders are dropped. The necklace watermark sits in a crop-sized box centred in the Description/Weight span. It is left out below ~20 mm of filler.
- **Continuation strip.** Plain HTML: "ASHA JEWELLERS", Invoice No., customer name, "पृष्ठ n / N", on a thin gold rule. No artwork slice; see §9 Q5.
- **Density** comes from the plan, not `items.length`. Compact drops the milligram sub-line and tightens row and summary padding (§7).
- **Invariant:** the output never contains `<script`. A test pins this (C1).

### 5.4 Preview screen

Split `BillPreviewScreen.tsx` into the folder pattern recent commits use, with `src/screen/BillPreviewScreen.tsx` left as the one-line re-export shim that `verification/ui/sourceAudit.test.ts` already understands:

```
src/screen/BillPreview/
  index.tsx          — layout only (controls, preview, actions)
  useBillPreview.ts  — loading, bill no., toggles (moved from today's screen)
  useBillLayout.ts   — measure → plan → html state machine
  BillMeasurer.tsx   — the hidden WebView + probe
```

`useBillLayout` states are `measuring → ready | fallback`:

- Re-measure whenever the bill data or a toggle changes, but not the bill number (same height).
- While re-measuring, keep the previous preview visible under a light "updating" overlay. On first load, show the spinner.
- **Share and Print stay disabled until the plan is ready.** After a 2.5 s timeout, fall back to the estimator. The user is never blocked.
- Give both WebViews `textZoom={100}` (C4).
- The hidden WebView sits off-screen at 1×1 with `opacity: 0` and `pointerEvents="none"`. **Verify on device** that Android lays it out while invisible. If not, measure in the visible WebView first, then swap in the final HTML behind the spinner.

### 5.5 Print path (C2)

`printBill` should render the same A5 PDF as Share (`printToFileAsync` with 420 × 595 pt), then print that file with `Print.printAsync({ uri })`. The printed copy is then byte-for-byte the shared PDF, and the dialog scales an A5 page to whatever paper is loaded.

### 5.6 Fallback estimator

`estimateBillMetrics` uses constants calibrated from device measurements: row heights, summary row height, extra lines for names longer than about N characters. It inflates them by 10%. Erring tall makes it choose case 2 or 3 slightly early. That is better than an overflow, and the CSS safety valve absorbs the rest.

## 6. Header compression and distortion

Today's squash is vertical-only, and at 0.7 the AJ ring is visibly an oval.

The new design prints the header **undistorted** in case 1 and on page 1 of case 3. It squashes **only in case 2, and only as much as needed**: often 0.84–0.94, against a constant 0.7 today. The floor stays at 0.7, a look the shop already prints.

**Optional later (Phase 6):** distortion-free compression. Prepare two assets once: the top swoosh strip, stretched horizontally only, and the logo/photo/contact block, scaled uniformly and centred on the template's cream. It removes distortion entirely but costs asset work. Do it only if the case-2 squash still looks off on paper.

## 7. The summary block is the hidden variable

In full-ledger mode the summary is **55 mm, the height of 9 item rows**. That is why "3 items + payment details" overflows. Compact density (case 2b) should tighten the summary as well as the rows: smaller padding (0.9 → 0.5 mm) and `line-height: 1.25`. Expected saving is about 12–16 mm, roughly two more rows on one page, to be confirmed by measurement.

A further option (§9 Q6): print the जमा history as a small left-hand box beside the totals. The empty 70 mm to the left of the summary is unused today. Look at it only if Phase 5 measurements show it is needed.

## 8. Implementation plan

Each phase ships on its own and keeps `npm test` green. Tests go under `verification/`, following the new layout.

### Phase 0 — Geometry and safety fixes (small; ship first)
- `src/services/bill/geometry.ts`: move the template, page and band constants. `P = 209.5mm` (C3).
- `BillService.printBill`: print the A5 PDF file (§5.5).
- `BillPreviewScreen`: `textZoom={100}`.
- **Tests:** page box is 209.5 mm; geometry derivations, e.g. natural header = 93.68 mm and footer = 32.94 mm.
- **Accept:** a 1-item bill makes exactly 1 PDF page on device; Print and Share look identical.

### Phase 1 — Planner (pure, test-first)
- `src/services/bill/layoutPlan.ts`: `planBillLayout` and the types.
- **Tests** (`verification/services/bill/layoutPlan.test.ts`), using hand-built metrics from §2.1:
  - 1 row, plain → single, header = `H_max`, filler > 0, heights sum to `P − S`.
  - 6 rows → single, `H_min < header < H_max`, filler ≈ 0.
  - Header never grows as rows are added (property loop over 0..15 rows).
  - Just below `H_min` at normal but fits at compact → compact.
  - Fits neither → multi: page 1 header `H_max`, normal density.
  - Multi invariants: rows partition `[0, n)` in order; each page ≤ `P`; last page has ≥ 2 rows and the summary.
  - Full-ledger summary (55 mm) goes multi earlier than the plain copy with the same rows.
  - A row taller than a page, 0 items, and the 10-page cap.

### Phase 2 — Single-page renderer
- `BillHtmlService.buildBillHtml(data, plan?)`: header height and %-based `background-size`, flex safety valve, filler row and watermark box, plan-driven density.
- `estimateBillMetrics` with conservative constants.
- **Tests:** header height comes from the plan; filler row present at ≥ 2 mm and absent below; watermark only at ≥ 20 mm; compact drops the milligram line *because the plan says so*; **no `<script`** in output.
- **Update existing tests** that pin today's fixed behaviour: "keeps the header band compact (60–66 mm)", "drops the milligram sub-line" (6 items), "continue onto another page … min-height 210mm".

### Phase 3 — Multi-page renderer
- Render `plan.pages` as explicit pages: full header and customer box on page 1, continuation strip and "पृष्ठ n / N" after, "क्रमशः" strip on non-last pages, footer only on the last (pending §9 Q1).
- **Tests:** `.page` count equals `plan.pages.length`; exactly one footer band; continuation strip carries the invoice no. and name; item order and numbering preserved across pages; total row and summary only on the last page.

### Phase 4 — Measurement pipeline and screen
- `src/services/bill/measure.ts`: measure HTML, probe JS, `parseBillMetrics`.
- `src/screen/BillPreview/*` split and shim; `useBillLayout`; `BillMeasurer`.
- **Tests:** `parseBillMetrics` rejects a stale key, a wrong row count, NaN, negatives and > 300 mm; measure HTML holds both density containers and one row per item; key stable across bill-number edits and different across toggle changes.
- **Accept (device):** toggles re-plan within ~0.5 s; Share and Print are disabled while measuring; killing the measurer falls back within 2.5 s.

### Phase 5 — Cleanup and device QA
- `LendenItemsTable`: drop the item-count warning ("More than 5 items may not fit…"). The bill now always fits or paginates cleanly. Drop the `COMPACT_ITEM_THRESHOLD` export.
- Calibrate the estimator constants from real device measurements.
- Run the §11 checklist on paper.

### Phase 6 — Optional polish
- Distortion-free header (§6). Two-column summary (§7). Only if paper tests ask for them.

**Rough size:** Phase 0 ½ day, 1 one day, 2 one day, 3 one day, 4 1½ days, 5 ½ day plus printing. About 5–6 days.

## 9. Decisions for you

| # | Question | Options | Recommendation |
|---|---|---|---|
| **Q1** | Footer (T&C, signature, thank-you) on a multi-page bill | Last page only · every page | **Last page only.** Non-last pages end with "क्रमशः — पृष्ठ n+1 पर जारी" and the page number. Page 1 then holds ~9 rows instead of ~5. |
| **Q2** | Keep the compact step (drop the milligram line, tighten padding) before going to 2 pages? | Keep · never compact | **Keep.** Saves paper for 8–10-item bills, as today. |
| **Q3** | Header floor | 0.7 (today) · 0.75 · 0.65 | **0.7.** Already printed and accepted. |
| **Q4** | Necklace watermark in the ruled filler | Yes · plain ruled lines | **Yes.** It makes a short bill look like the original stationery. |
| **Q5** | Page 2+ header | HTML text strip · slice of the artwork | **Text strip.** No artwork slice crops cleanly: the swoosh and the logo's diamond overlap. |
| **Q6** | Full-ledger summary density | Tighter rows only · also move जमा history left | **Tighter rows first;** revisit after Phase 5. |

## 10. Risks

| Risk | Mitigation |
|---|---|
| Measured heights differ slightly from the PDF render | Same engine and fonts (C4), `textZoom` pinned, 1 mm safety, CSS header safety valve |
| Android skips layout for an invisible 1×1 WebView | Verify early in Phase 4; fallback is to measure in the visible WebView behind the spinner |
| Measurement slow or broken on a device | 2.5 s timeout → conservative estimator; Share and Print never blocked |
| Blank sliver page from the 210 mm vs 209.9 mm mismatch | 209.5 mm page box (Phase 0) |
| Paper size in the print dialog differs from A5 | Print the A5 PDF, not raw HTML (Phase 0) |
| iOS (if ever used) | Same design; iOS PDF uses WKWebView, which runs JS anyway. Verify fonts once. |

## 11. Device checklist (Phase 5)

For each of **1, 2, 4, 5, 6, 7, 9, 12, 25 items** × **plain / payment details / payment details + पिछला-कुल बाकी**, plus **one 60-character item name** and **a 3-line address**:

- [ ] Preview, shared PDF and printout show the same layout and page count.
- [ ] No blank gap larger than the filler; filler rules line up with the columns.
- [ ] Header undistorted in cases 1 and 3; squash in case 2 matches the planner's ratio.
- [ ] Multi-page: no split rows; page 1 header full; continuation strip on page 2+; footer anchored at the bottom of the last page; no blank trailing page.
- [ ] Toggling payment details re-plans; Share and Print are disabled during the re-plan.
- [ ] Printed on A5 paper, and on A4 with "fit to page".

## 12. Reproducing the measurements

1. Compile the builder: `npx tsc --outDir <tmp>/build --module commonjs --target es2020 --esModuleInterop --skipLibCheck --rootDir src src/services/BillHtmlService.ts`.
2. Generate bills from fixtures with a probe script appended. It reads `getBoundingClientRect` for `.band-header`, `.inv-frame`, `.items thead/tbody tr/tfoot`, `.summary` and `.middle`, then writes JSON into the DOM.
3. Run `msedge --headless=new --virtual-time-budget=3000 --dump-dom file:///…`.
4. For page counts, use `--print-to-pdf`. The bill's own `@page { size: A5 }` gives A5 pages.

## 13. Implementation notes (2026-10-05)

**Decisions taken** (§9, all as recommended): Q1 footer on the last page only · Q2 keep the compact step · Q3 header floor 0.7 · Q4 necklace watermark in the filler · Q5 text continuation strip · Q6 tighter summary rows only.

**Where the code lives**

| File | Role |
|---|---|
| `src/services/bill/geometry.ts` | Every mm constant: page box 209.5 mm, header 93.68 / 65.58 mm, footer 32.94 mm, strips, safety |
| `src/services/bill/layoutPlan.ts` | `planBillLayout`: the §4.2 ladder and §5.2 pagination (pure) |
| `src/services/bill/estimate.ts` | `estimateBillMetrics`: the fallback heights (pure) |
| `src/services/bill/measure.ts` | `billLayoutKey`, `BILL_PROBE_JS`, `parseBillMetrics` |
| `src/services/bill/summary.ts`, `types.ts` | Summary rows shared by renderer and estimator; `BillData` |
| `src/services/BillHtmlService.ts` | `buildBillHtml(data, plan?)` (explicit pages, no script) and `buildBillMeasureHtml` |
| `src/services/BillService.ts` | Share and Print both render the same A5 PDF |
| `src/screen/BillPreview/` | `index.tsx`, `useBillPreview.ts`, `useBillLayout.ts`, `BillMeasurer.tsx`, `styles.ts`; `BillPreviewScreen.tsx` is the shim |

**Deviations from the text above**

- `DensityMetrics` gained `tableChromeMm`: the table's own borders, about 0.26 mm.
- `buildBillMeasureHtml` sits in `BillHtmlService.ts`, so it reuses the printed bill's partials.
- The necklace watermark is faint (35% opacity) and centred behind every items table, on every page: 80% of the table height, at most 60 mm. It replaces the full-strength one that sat only in the filler. The table's lines and text paint over it.
- No 10-page cap: pagination always advances, so it terminates.

**Measured in desktop Chromium with the real probe** (24 bills; Android fonts will shift these slightly):

- **Plain copy:** 1–4 items, header 1.00 plus ruled filler. 5–7 items, header 0.94 → 0.74. 8–12 items, compact, header 0.99 → 0.75. 25 items, 3 pages.
- **Full ledger:** 1–2 items, header 0.82 → 0.72. 4–6 items, compact. 7+ items, 2 pages.
- Compact density shrinks rows from 9.28 to 5.56 mm and the full-ledger summary from 59.0 to 46.4 mm.
- Every one-page bill ends exactly at 209.5 mm with a 1.0 mm gap (the safety margin). Every PDF has the planned page count.

**Still to do on a device:** the §11 checklist. Also confirm Android lays out the hidden 320×320 measuring WebView. If it doesn't, the 2.5 s fallback estimate still gives a correct, slightly roomier layout.

## 14. A4 paper (2026-10-08)

The admin can print a long bill on A4. Every bill opens on A5, and the choice is not saved with the bill.

- **Geometry.** `geometry.ts` holds one `PaperGeometry` per paper in `PAPER`: the PDF size in points, the page box, and the bands worked out from the page width. A4 is a 209.5 × 296.5 mm box on a 595 × 842 pt PDF. Its header runs from 132.6 mm down to a 92.8 mm floor (0.7), and its footer is 46.6 mm.
- **Same text size on A4.** Fonts, margins and the fixed columns are as on A5. The Description column takes the extra width: about 105 mm against 44 mm. Scaling the whole A5 bill up would hold no more rows.
- **One pipeline.** `BillData.paper` feeds the measuring key (switching paper re-measures), the measuring width, `planBillLayout(metrics, paper)`, the estimator's wrap widths, `@page { size }` and the PDF size in `sharePdf` and `printBill`.
- **Screen.** `PaperPicker` shows the A5 | A4 buttons. When the A5 plan needs more than one page it says so: "A5 पर N पृष्ठ बनेंगे — एक पृष्ठ के लिए A4 चुनें".
- **Measured in desktop Edge with the real probe:**
  - Plain copy: 20 items fit on one A4 page (14 take 2 A5 pages); 24 items take 2 A4 pages.
  - Full ledger: 14 items fit on one A4 page (8 take 2 A5 pages); 20 items take 2 A4 pages.
  - Every PDF has the planned page count.
- **Printing.** The Android print dialog picks the paper itself and expo-print cannot preset it for a PDF. Choose A4 there for an A4 bill.

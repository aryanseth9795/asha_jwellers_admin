import { LendenItem } from "../types/entry";
import { formatBillDate, formatMetalPurity, formatRupees, formatWeight } from "../utils/billFormat";
import { estimateBillMetrics } from "./bill/estimate";
import {
  CONT_STRIP_MM,
  FOOTER_MM,
  HEADER_CROP_PCT,
  HEADER_MAX_MM,
  HEADER_MIN_MM,
  MIDDLE_PAD_TOP_MM,
  MIN_FILLER_MM,
  MORE_STRIP_MM,
  PAGE_H_MM,
  PAGE_W_MM,
  TEMPLATE_H,
  TEMPLATE_W,
  TPL_H_MM,
} from "./bill/geometry";
import { BillLayoutPlan, Density, PagePlan, planBillLayout } from "./bill/layoutPlan";
import { billSummaryRows } from "./bill/summary";
import { BillData } from "./bill/types";

export type { BillCustomer, BillData, BillJama } from "./bill/types";

// ---------------------------------------------------------------------------
// The bill is laid out from a plan (see bill/layoutPlan.ts and
// agent/2026-10-05-adaptive-bill-layout-plan.md): the header band's height,
// a ruled filler for spare space, the row density, and — for long bills —
// which rows go on which explicit A5 page. The output never holds a script:
// the Android PDF renderer runs none.
// ---------------------------------------------------------------------------

const GOLD = "#C08A2E";
const GOLD_SOFT = "#E3C489";
const CREAM = "#FDFBF7";
const HEAD_BG = "#FAF1E2";
const INK = "#1A1A1A";

/** The header band maps the template's top HEADER_CROP_PCT onto whatever height it is given. */
const HEADER_BG_PCT = (100 / HEADER_CROP_PCT).toFixed(3);

// The necklace watermark inside the template's printed table, clear of its column lines (template px).
const WM_X = 165;
const WM_Y = 908;
const WM_W = 345;
const WM_H = 344;
/** Faint enough that item text and column lines stay crisp over it. */
const WM_OPACITY = 0.35;
const WM_MAX_H_MM = 60;
// The crop box's background maps that template rectangle onto the box, whatever size the box ends up.
const WM_BG_SIZE = `${((TEMPLATE_W / WM_W) * 100).toFixed(2)}% ${((TEMPLATE_H / WM_H) * 100).toFixed(2)}%`;
const WM_BG_POS = `${((WM_X / (TEMPLATE_W - WM_W)) * 100).toFixed(2)}% ${((WM_Y / (TEMPLATE_H - WM_H)) * 100).toFixed(2)}%`;

const esc = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const mm = (value: number): string => `${value.toFixed(2)}mm`;

function billCss(templateDataUri: string, headerMm: number): string {
  return `
  :root { --tpl: url("${templateDataUri}"); }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A5; margin: 0; }
  html, body { width: ${mm(PAGE_W_MM)}; }
  body {
    background: ${CREAM};
    color: ${INK};
    font-family: "Noto Sans Devanagari", "Nirmala UI", "Mangal", sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: ${mm(PAGE_W_MM)};
    height: ${mm(PAGE_H_MM)};
    display: flex;
    flex-direction: column;
    break-after: page;
    page-break-after: always;
  }
  .page:last-child { break-after: auto; page-break-after: auto; }

  .band {
    width: 100%;
    background-image: var(--tpl);
    background-repeat: no-repeat;
  }
  .band-header {
    height: ${mm(headerMm)};
    flex: 0 1 auto;
    min-height: ${mm(HEADER_MIN_MM)};
    background-size: 100% ${HEADER_BG_PCT}%;
    background-position: center top;
  }
  .band-footer {
    height: ${mm(FOOTER_MM)};
    flex: none;
    margin-top: auto;
    background-size: ${mm(PAGE_W_MM)} ${mm(TPL_H_MM)};
    background-position: left bottom;
  }

  .middle {
    flex: 1 1 auto;
    background: ${CREAM};
    padding: ${mm(MIDDLE_PAD_TOP_MM)} 8mm 0;
    display: flex;
    flex-direction: column;
  }

  /* Customer invoice frame matching Final_templat.jpeg */
  .inv-frame {
    border: 0.35mm solid ${GOLD};
    border-radius: 2mm;
    padding: 1mm 2.5mm;
    margin-bottom: 1.5mm;
    display: flex;
    justify-content: space-between;
    font-size: 7.5pt;
    line-height: 1.15;
    background: #fff;
  }
  .inv-frame-left { flex: 1.35; }
  .inv-frame-right { flex: 0.95; padding-left: 3mm; }
  .inv-title {
    font-size: 9pt;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: #8C5B14;
    text-align: center;
    margin-bottom: 0.8mm;
  }
  .field-line {
    display: flex;
    align-items: flex-end;
    margin-bottom: 0.8mm;
  }
  .field-line:last-child { margin-bottom: 0; }
  .field-label {
    color: ${INK};
    white-space: nowrap;
    font-weight: 600;
  }
  .field-text {
    flex: 1;
    border-bottom: 0.2mm solid ${GOLD_SOFT};
    margin-left: 1.5mm;
    padding-left: 1mm;
    font-weight: 700;
    color: ${INK};
    min-height: 3.3mm;
  }

  table { width: 100%; border-collapse: collapse; }

  .items {
    font-size: 7.5pt;
    border: 0.35mm solid ${GOLD};
    border-radius: 1mm;
  }
  .items thead { display: table-header-group; }
  .items tr { break-inside: avoid; page-break-inside: avoid; }
  .items th, .items td { border: 0.2mm solid ${GOLD_SOFT}; padding: 1.2mm 1mm; }
  .items th { background: ${HEAD_BG}; font-size: 7.5pt; font-weight: 700; color: #8C5B14; }
  .items .c { text-align: center; }
  .items .r { text-align: right; }
  .items .desc { font-weight: 700; }
  .items .sub { font-size: 6.5pt; font-weight: 400; opacity: 0.75; }
  .items tr.filler td { border-top: none; border-bottom: none; padding: 0; }

  /* The template's necklace, faint and centred behind the items table, as on the printed stationery. */
  .items-wrap { position: relative; z-index: 0; }
  .items-wrap .wm {
    position: absolute;
    z-index: -1;
    left: 50%;
    top: 50%;
    height: 80%;
    max-height: ${mm(WM_MAX_H_MM)};
    aspect-ratio: ${WM_W} / ${WM_H};
    transform: translate(-50%, -50%);
    background-image: var(--tpl);
    background-repeat: no-repeat;
    background-size: ${WM_BG_SIZE};
    background-position: ${WM_BG_POS};
    opacity: ${WM_OPACITY};
  }

  .table-total-row td {
    background: ${HEAD_BG};
    font-weight: 700;
    font-size: 8pt;
  }
  .r-total {
    text-align: right;
    padding-right: 3mm;
    letter-spacing: 0.5px;
  }

  .foot {
    margin-top: auto;
    padding-top: 1.5mm;
    padding-bottom: 1mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .summary-wrap { display: flex; justify-content: flex-end; margin-bottom: 1.5mm; }
  .summary { width: 62mm; font-size: 8pt; border: 0.3mm solid ${GOLD}; }
  .summary td { border: 0.2mm solid ${GOLD_SOFT}; padding: 0.9mm 2mm; }
  .summary .sl { color: ${INK}; }
  .summary .sv { text-align: right; font-weight: 700; white-space: nowrap; }
  .summary .final td { background: ${HEAD_BG}; font-weight: 800; font-size: 9pt; }

  /* Multi-page bills: page 2 onward opens with this strip; every page but the last ends with the next one. */
  .cont {
    flex: none;
    height: ${mm(CONT_STRIP_MM)};
    margin: 0 8mm;
    padding-bottom: 1.5mm;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    border-bottom: 0.35mm solid ${GOLD};
    color: #8C5B14;
    font-size: 8pt;
    font-weight: 700;
  }
  .cont b { font-size: 11pt; letter-spacing: 2px; }
  .more {
    flex: none;
    height: ${mm(MORE_STRIP_MM)};
    margin-top: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #8C5B14;
    font-size: 7.5pt;
    font-weight: 700;
  }

  /* Compact density: the last step before a second page (plan §7). */
  .density-compact .items td { padding: 0.8mm 1mm; }
  .density-compact .summary { line-height: 1.25; }
  .density-compact .summary td { padding: 0.4mm 2mm; }
`;
}

function customerFrameHtml(data: BillData): string {
  const { customer } = data;
  return `<div class="inv-frame">
        <div class="inv-frame-left">
          <div class="field-line">
            <span class="field-label">Name :</span>
            <span class="field-text">${esc(customer.name)}</span>
          </div>
          <div class="field-line">
            <span class="field-label">Address :</span>
            <span class="field-text">${customer.address ? esc(customer.address) : ""}</span>
          </div>
          <div class="field-line">
            <span class="field-label">Phone Number :</span>
            <span class="field-text">${customer.mobile ? esc(customer.mobile) : ""}</span>
          </div>
        </div>
        <div class="inv-frame-right">
          <div class="inv-title">INVOICE</div>
          <div class="field-line">
            <span class="field-label">Invoice No. :</span>
            <span class="field-text">${data.billNo}</span>
          </div>
          <div class="field-line">
            <span class="field-label">Invoice Date :</span>
            <span class="field-text">${esc(formatBillDate(data.date))}</span>
          </div>
        </div>
      </div>`;
}

/** Compact density drops the "(3 ग्राम 500 मिली)" sub-line so more rows fit. */
function itemRowHtml(item: LendenItem, density: Density): string {
  let weightCell = "";
  if (item.weight !== null) {
    const w = formatWeight(item.weight);
    weightCell = density === "compact" || !w.sub ? esc(w.main) : `${esc(w.main)}<div class="sub">${esc(w.sub)}</div>`;
  }
  return `<tr>
        <td class="c">${item.position}</td>
        <td class="desc">${esc(item.name)}</td>
        <td class="c">${weightCell}</td>
        <td class="c">${item.qty ?? 1}</td>
        <td class="c">${esc(formatMetalPurity(item.metal, item.purity))}</td>
        <td class="r">${esc(formatRupees(item.total))}</td>
      </tr>`;
}

/** Spare space drawn as an empty table row, so the page reads as a printed bill rather than a blank gap. */
function fillerRowHtml(fillerMm: number): string {
  if (fillerMm < MIN_FILLER_MM) return "";
  return `<tr class="filler" style="height:${mm(fillerMm)}"><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
}

function itemsTableHtml(data: BillData, rows: LendenItem[], density: Density, fillerMm: number, withTotal: boolean): string {
  const totalQty = data.items.reduce((sum, i) => sum + (i.qty ?? 1), 0);
  const itemsTotal = data.items.reduce((sum, i) => sum + i.total, 0);
  return `<div class="items-wrap">
      <div class="wm"></div>
      <table class="items">
        <thead>
          <tr>
            <th style="width:9mm">Sl.No.</th>
            <th>Description</th>
            <th style="width:22mm">Weight</th>
            <th style="width:11mm">Qty.</th>
            <th style="width:23mm">Metal/Purity</th>
            <th style="width:23mm">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((item) => itemRowHtml(item, density)).join("")}${fillerRowHtml(fillerMm)}
        </tbody>${
          withTotal
            ? `
        <tfoot>
          <tr class="table-total-row">
            <td colspan="3" class="r-total">Total</td>
            <td class="c">${totalQty}</td>
            <td></td>
            <td class="r">${esc(formatRupees(itemsTotal))}</td>
          </tr>
        </tfoot>`
            : ""
        }
      </table>
      </div>`;
}

function footHtml(data: BillData): string {
  const rows = billSummaryRows(data);
  const summary = rows
    .map((r) => `<tr class="${r.final ? "final" : ""}"><td class="sl">${esc(r.label)}</td><td class="sv">${esc(r.value)}</td></tr>`)
    .join("");
  return `<div class="foot">${
    rows.length > 0 ? `<div class="summary-wrap"><table class="summary">${summary}</table></div>` : ""
  }</div>`;
}

function singlePageHtml(data: BillData, density: Density, fillerMm: number): string {
  return `<div class="page">
    <div class="band band-header"></div>
    <div class="middle">
      ${customerFrameHtml(data)}
      ${itemsTableHtml(data, data.items, density, fillerMm, true)}
      ${footHtml(data)}
    </div>
    <div class="band band-footer"></div>
  </div>`;
}

function continuedHeadHtml(data: BillData, pageNo: number, pageCount: number): string {
  return `<div class="cont"><b>ASHA JEWELLERS</b><span>Invoice No. ${data.billNo} · ${esc(
    data.customer.name,
  )} · पृष्ठ ${pageNo} / ${pageCount}</span></div>`;
}

function continuedFootHtml(pageNo: number, pageCount: number): string {
  return `<div class="more"><span>पृष्ठ ${pageNo} / ${pageCount}</span><span>क्रमशः — पृष्ठ ${
    pageNo + 1
  } पर जारी →</span></div>`;
}

/** One page of a long bill: the header band and customer box open page 1, the totals and footer close the last. */
function planPageHtml(data: BillData, page: PagePlan, index: number, count: number): string {
  const first = index === 0;
  const last = index === count - 1;
  return `<div class="page">
    ${first ? `<div class="band band-header"></div>` : continuedHeadHtml(data, index + 1, count)}
    <div class="middle">
      ${first ? customerFrameHtml(data) : ""}
      ${itemsTableHtml(data, data.items.slice(page.start, page.end), "normal", page.fillerMm, last)}
      ${last ? footHtml(data) : continuedFootHtml(index + 1, count)}
    </div>
    ${last ? `<div class="band band-footer"></div>` : ""}
  </div>`;
}

function documentHtml(data: BillData, density: Density, headerMm: number, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${billCss(data.templateDataUri, headerMm)}</style>
</head>
<body class="density-${density}">
  ${body}
</body>
</html>`;
}

/**
 * The bill's middle block once per density, for the preview to measure (see bill/measure.ts, which injects the
 * probe). Same CSS and partials as the printed bill, so the heights match; no bands, so no artwork is embedded.
 */
export function buildBillMeasureHtml(data: BillData, key: string): string {
  const block = (density: Density) => `<div class="measure density-${density}" data-density="${density}">
    <div class="middle">
      ${customerFrameHtml(data)}
      ${itemsTableHtml(data, data.items, density, 0, true)}
      ${footHtml(data)}
    </div>
  </div>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${billCss("", HEADER_MAX_MM)}
  .measure { width: ${mm(PAGE_W_MM)}; }
</style>
</head>
<body data-key="${esc(key)}">
  ${block("normal")}
  ${block("compact")}
</body>
</html>`;
}

/** The printable bill. Without a plan (e.g. before the preview has measured) the layout comes from an estimate. */
export function buildBillHtml(
  data: BillData,
  plan: BillLayoutPlan = planBillLayout(estimateBillMetrics(data)),
): string {
  if (plan.kind === "single") {
    return documentHtml(data, plan.density, plan.headerMm, singlePageHtml(data, plan.density, plan.fillerMm));
  }
  const pages = plan.pages.map((page, i) => planPageHtml(data, page, i, plan.pages.length)).join("");
  return documentHtml(data, plan.density, HEADER_MAX_MM, pages);
}

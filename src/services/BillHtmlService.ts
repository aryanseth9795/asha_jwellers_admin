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
// CALIBRATION: these fractions are aligned to the 2026-09-01 Asha Jewellers
// artwork. They are the only numbers to touch when the seams do not line up.
// ---------------------------------------------------------------------------
const TEMPLATE_W = 1024;
const TEMPLATE_H = 1536;
// The new artwork has a proprietor line below the contact details, so its
// header needs to extend to just above the invoice frame.
export const HEADER_CROP_PCT = 0.424;
// This is the visible height of the bottom artwork band, not its position.
// Its CSS `bottom: 0` placement keeps it flush with the page edge.
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
        <td class="c">${esc(
          [
            item.metal === "gold" ? "Gold" : item.metal === "silver" ? "Silver" : "",
            item.purity ?? "",
          ]
            .filter(Boolean)
            .join(" / "),
        )}</td>
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
  html, body { width: ${mm(PAGE_W_MM)}; min-height: ${mm(PAGE_H_MM)}; }
  body {
    background: ${CREAM};
    color: ${INK};
    font-family: "Noto Sans Devanagari", "Nirmala UI", "Mangal", sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* The footer reaches the page bottom when contents fit. Long tables grow
     into the following A5 page instead of being clipped behind the footer. */
  .page {
    width: ${mm(PAGE_W_MM)};
    min-height: ${mm(PAGE_H_MM)};
    display: flex;
    flex-direction: column;
  }

  .band {
    width: 100%;
    flex: none;
    background-image: var(--tpl);
    background-size: ${mm(PAGE_W_MM)} ${mm(TPL_H_MM)};
    background-repeat: no-repeat;
  }
  .band-header {
    height: ${mm(HEADER_H_MM)};
    background-position: 0 0;
  }
  .band-footer {
    height: ${mm(FOOTER_H_MM)};
    background-position: 0 ${mm(FOOTER_OFFSET_MM)};
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Continues the template's gold frame down the rebuilt middle. */
  .middle {
    min-height: ${mm(MIDDLE_H_MM)};
    flex: 1;
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
  .items thead { display: table-header-group; }
  .items tr { break-inside: avoid; page-break-inside: avoid; }
  .items th, .items td { border: 0.2mm solid ${GOLD_SOFT}; padding: 1.2mm 1mm; }
  .items th { background: ${HEAD_BG}; font-size: 8pt; font-weight: 700; }
  .items .c { text-align: center; }
  .items .r { text-align: right; }
  .items .desc { font-weight: 700; }
  .items .sub { font-size: 6.5pt; font-weight: 400; opacity: 0.75; }

  .foot {
    margin-top: auto;
    padding-bottom: 2mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }
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
            <th style="width:15mm">धातु / शुद्धता</th>
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

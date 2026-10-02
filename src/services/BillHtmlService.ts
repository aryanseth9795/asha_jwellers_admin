import { LendenItem, OldJewelleryItem } from "../types/entry";
import {
  formatBillDate,
  formatMetalPurity,
  formatRupees,
  formatWeight,
} from "../utils/billFormat";
import {
  calculateLendenSettlement,
  sumOldJewelleryValues,
} from "../utils/lendenSettlement";

// ---------------------------------------------------------------------------
// Template banding. See agent/2026-08-31-lenden-bill-design.md §5.2 and §5.3.
//
// The template (1024x1536, ratio 1:1.500) is TALLER than A5 (1:1.419). Both
// bands render at natural aspect ratio across the full page width and the
// rebuilt middle absorbs the difference.
//
// CALIBRATION: aligned to the Asha Jewellers final bill template artwork.
// ---------------------------------------------------------------------------
const TEMPLATE_W = 1024;
const TEMPLATE_H = 1536;

// Header extends down to just above the customer box (captures proprietor box at y=646).
export const HEADER_CROP_PCT = 0.422;
// Header display compression factor to compact the artwork header slightly and leave more room for items.
export const HEADER_COMPRESS_RATIO = 0.7;

// Footer visible fraction: from y=1308 to 1536 (captures Terms & Conditions, Signature, and Thank you flourish).
export const FOOTER_CROP_PCT = 0.1484;

const PAGE_W_MM = 148;
const PAGE_H_MM = 210;

const TPL_H_MM = PAGE_W_MM * (TEMPLATE_H / TEMPLATE_W);
const HEADER_H_MM = TPL_H_MM * HEADER_CROP_PCT * HEADER_COMPRESS_RATIO;
const FOOTER_H_MM = TPL_H_MM * FOOTER_CROP_PCT;
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
  oldJewelleryItems: OldJewelleryItem[];
  amount: number; // effective amount, per resolveEffectiveAmount
  discount: number;
  jamaEntries: BillJama[];
  baki: number;
  pichlaBaki: number; // sum of baki across other transactions (except current)
  totalBaki: number; // sum of baki across ALL customer transactions
  showPaymentDetails: boolean;
  showTotalBaki: boolean;
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

// Old jewellery is credited per metal: every old gold item adds to one line,
// every old silver item to another. Items saved before metal was tracked get
// their own line so they are never counted as gold or silver.
const OLD_JEWELLERY_LINES: { metal: OldJewelleryItem["metal"]; label: string }[] = [
  { metal: "gold", label: "पुराना सोना" },
  { metal: "silver", label: "पुरानी चाँदी" },
  { metal: null, label: "पुराना (अन्य)" },
];

const oldJewelleryRows = (items: OldJewelleryItem[]): string[] =>
  OLD_JEWELLERY_LINES.map(({ metal, label }) => ({
    label,
    value: sumOldJewelleryValues(items.filter((item) => (item.metal ?? null) === metal)),
  }))
    .filter((line) => line.value > 0)
    .map((line) => summaryRow(line.label, `-${formatRupees(line.value)}`));

export function buildBillHtml(data: BillData): string {
  const { items, customer } = data;
  const compact = items.length > COMPACT_ITEM_THRESHOLD;

  // const totalWeight = items.reduce((sum, i) => sum + (i.weight ?? 0), 0);
  const totalQty = items.reduce((sum, i) => sum + (i.qty ?? 1), 0);
  const itemsTotal = items.reduce((sum, i) => sum + i.total, 0);
  const oldJewelleryCredit = sumOldJewelleryValues(data.oldJewelleryItems);
  const totalJama = data.jamaEntries.reduce(
    (sum, jama) => sum + jama.amount,
    0,
  );
  const settlement = calculateLendenSettlement({
    grossTotal: data.amount,
    oldJewelleryCredit,
    discount: data.discount,
    jamaTotal: totalJama,
  });

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
      const metalPurity = formatMetalPurity(item.metal, item.purity);

      return `<tr>
        <td class="c">${item.position}</td>
        <td class="desc">${esc(item.name)}</td>
        <td class="c">${weightCell}</td>
        <td class="c">${item.qty ?? 1}</td>
        <td class="c">${esc(metalPurity)}</td>
        <td class="r">${esc(formatRupees(item.total))}</td>
      </tr>`;
    })
    .join("");

  const summary: string[] = [
    // summaryRow("कुल वजन", formatWeight(totalWeight).main),
  ];

  if (data.showPaymentDetails) {
    // Order: कुल राशि − पुराना सोना − पुरानी चाँदी − छूट − जमा = बाकी, then पिछला बाकी → कुल बाकी
    summary.push(summaryRow("कुल राशि", formatRupees(data.amount)));
    summary.push(...oldJewelleryRows(data.oldJewelleryItems));
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
    summary.push(summaryRow("बाकी", formatRupees(settlement.baki), "final"));
    // Optional पिछला बाकी + कुल बाकी rows — only visible when the nested toggle is on
    if (data.showTotalBaki) {
      summary.push(summaryRow("पिछला बाकी", formatRupees(data.pichlaBaki)));
      summary.push(summaryRow("कुल बाकी", formatRupees(data.pichlaBaki + settlement.baki), "final"));
    }
  } else {
    if (oldJewelleryCredit > 0) {
      summary.push(summaryRow("कुल राशि", formatRupees(data.amount)));
      summary.push(...oldJewelleryRows(data.oldJewelleryItems));
      if (data.discount > 0) {
        summary.push(summaryRow("छूट", `-${formatRupees(data.discount)}`));
      }
      summary.push(
        summaryRow(
          "कुल देय राशि",
          formatRupees(settlement.netPayable),
          "final",
        ),
      );
    }
    if (uniformRate !== null) {
      summary.push(summaryRow("दर प्रति ग्राम", formatRupees(uniformRate)));
    }
    if (data.discount > 0 && oldJewelleryCredit === 0) {
      summary.push(summaryRow("कुल राशि", formatRupees(data.amount)));
      summary.push(summaryRow("छूट", `-${formatRupees(data.discount)}`));
      summary.push(
        summaryRow(
          "कुल देय राशि",
          formatRupees(data.amount - data.discount),
          "final",
        ),
      );
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { --tpl: url("${data.templateDataUri}"); }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A5; margin: 0; }
  html, body {
    width: ${mm(PAGE_W_MM)};
    min-height: ${mm(PAGE_H_MM)};
    height: 100%;
  }
  body {
    background: ${CREAM};
    color: ${INK};
    font-family: "Noto Sans Devanagari", "Nirmala UI", "Mangal", sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: ${mm(PAGE_W_MM)};
    min-height: ${mm(PAGE_H_MM)};
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .band {
    width: 100%;
    flex: none;
    background-image: var(--tpl);
    background-repeat: no-repeat;
  }
  .band-header {
    height: ${mm(HEADER_H_MM)};
    background-size: ${mm(PAGE_W_MM)} ${mm(TPL_H_MM * HEADER_COMPRESS_RATIO)};
    background-position: center top;
  }
  .band-footer {
    height: ${mm(FOOTER_H_MM)};
    background-size: ${mm(PAGE_W_MM)} ${mm(TPL_H_MM)};
    background-position: left bottom;
    margin-top: auto;
    flex-shrink: 0;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .middle {
    min-height: ${mm(MIDDLE_H_MM)};
    flex: 1;
    background: ${CREAM};
    padding: 1.5mm 8mm 0;
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

</style>
</head>
<body>
  <div class="page">
    <div class="band band-header"></div>

    <div class="middle">
      <div class="inv-frame">
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
      </div>

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
          ${itemRows}
        </tbody>
        <tfoot>
          <tr class="table-total-row">
            <td colspan="3" class="r-total">Total</td>
            <td class="c">${totalQty}</td>
            <td></td>
            <td class="r">${esc(formatRupees(itemsTotal))}</td>
          </tr>
        </tfoot>
      </table>

      <div class="foot">
        ${
          data.showPaymentDetails ||
          data.discount > 0 ||
          oldJewelleryCredit > 0 ||
          uniformRate !== null
            ? `<div class="summary-wrap">
          <table class="summary">${summary.join("")}</table>
        </div>`
            : ""
        }
      </div>
    </div>

    <div class="band band-footer"></div>
  </div>
</body>
</html>`;
}

// The rows of the bill's summary box. Pure — the renderer prints them and the estimator counts them.

import { OldJewelleryItem } from "../../types/entry";
import { formatBillDate, formatRupees } from "../../utils/billFormat";
import { calculateLendenSettlement, sumOldJewelleryValues } from "../../utils/lendenSettlement";
import { BillData } from "./types";

export interface SummaryRow {
  label: string;
  value: string;
  /** The emphasised closing figure (बाकी, कुल बाकी, कुल देय राशि). */
  final: boolean;
}

const row = (label: string, value: string, final = false): SummaryRow => ({ label, value, final });

// Old jewellery is credited per metal: every old gold item adds to one line,
// every old silver item to another. Items saved before metal was tracked get
// their own line so they are never counted as gold or silver.
const OLD_JEWELLERY_LINES: { metal: OldJewelleryItem["metal"]; label: string }[] = [
  { metal: "gold", label: "पुराना सोना" },
  { metal: "silver", label: "पुरानी चाँदी" },
  { metal: null, label: "पुराना (अन्य)" },
];

const oldJewelleryRows = (items: OldJewelleryItem[]): SummaryRow[] =>
  OLD_JEWELLERY_LINES.map(({ metal, label }) => ({
    label,
    value: sumOldJewelleryValues(items.filter((item) => (item.metal ?? null) === metal)),
  }))
    .filter((line) => line.value > 0)
    .map((line) => row(line.label, `-${formatRupees(line.value)}`));

/** A single summary rate is only meaningful when every line shares it. */
export function uniformRate(data: BillData): number | null {
  const rates = data.items.map((i) => i.rate);
  return rates.length > 0 && rates.every((r) => r !== null && r === rates[0]) ? (rates[0] as number) : null;
}

/** The summary box's rows, in print order; empty when the bill has no summary box. */
export function billSummaryRows(data: BillData): SummaryRow[] {
  const oldJewelleryCredit = sumOldJewelleryValues(data.oldJewelleryItems);
  const totalJama = data.jamaEntries.reduce((sum, jama) => sum + jama.amount, 0);
  const settlement = calculateLendenSettlement({
    grossTotal: data.amount,
    oldJewelleryCredit,
    discount: data.discount,
    jamaTotal: totalJama,
  });
  const rate = uniformRate(data);
  const rows: SummaryRow[] = [];

  if (data.showPaymentDetails) {
    // Order: कुल राशि − पुराना सोना − पुरानी चाँदी − छूट − जमा = बाकी, then पिछला बाकी → कुल बाकी
    rows.push(row("कुल राशि", formatRupees(data.amount)));
    rows.push(...oldJewelleryRows(data.oldJewelleryItems));
    if (data.discount > 0) {
      rows.push(row("छूट", `-${formatRupees(data.discount)}`));
    }
    for (const jama of data.jamaEntries) {
      rows.push(row(`जमा (${formatBillDate(jama.date)})`, `-${formatRupees(jama.amount)}`));
    }
    rows.push(row("बाकी", formatRupees(settlement.baki), true));
    // Optional पिछला बाकी + कुल बाकी rows — only visible when the nested toggle is on
    if (data.showTotalBaki) {
      rows.push(row("पिछला बाकी", formatRupees(data.pichlaBaki)));
      rows.push(row("कुल बाकी", formatRupees(data.pichlaBaki + settlement.baki), true));
    }
    return rows;
  }

  if (oldJewelleryCredit > 0) {
    rows.push(row("कुल राशि", formatRupees(data.amount)));
    rows.push(...oldJewelleryRows(data.oldJewelleryItems));
    if (data.discount > 0) {
      rows.push(row("छूट", `-${formatRupees(data.discount)}`));
    }
    rows.push(row("कुल देय राशि", formatRupees(settlement.netPayable), true));
  }
  if (rate !== null) {
    rows.push(row("दर प्रति ग्राम", formatRupees(rate)));
  }
  if (data.discount > 0 && oldJewelleryCredit === 0) {
    rows.push(row("कुल राशि", formatRupees(data.amount)));
    rows.push(row("छूट", `-${formatRupees(data.discount)}`));
    rows.push(row("कुल देय राशि", formatRupees(data.amount - data.discount), true));
  }
  return rows;
}

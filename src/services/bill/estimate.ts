// Fallback heights for a bill, used when the preview cannot measure the real ones. Pure — safe to unit test.
//
// The constants are block heights measured in Chromium (plan §2.1), each inflated by INFLATE so the estimate errs
// tall: it may move a bill to the compact step or a second page a little early, but never lets it overflow a page.

import { formatWeight } from "../../utils/billFormat";
import { contentWidthMm, descWidthMm } from "./geometry";
import { BillMetrics, Density, DensityMetrics } from "./layoutPlan";
import { billSummaryRows } from "./summary";
import { BillData } from "./types";

const INFLATE = 1.1;

const FRAME_MM = 15.9; // customer box (3 lines) + its bottom margin
const FRAME_LINE_MM = 2.8; // each extra line a long name or address wraps to
const THEAD_MM = 6.4;
const ROW_MM: Record<Density, number> = { normal: 6.4, compact: 5.6 }; // a one-line item row
const SUB_LINE_MM = 2.9; // the "(3 ग्राम 500 मिली)" line, printed at normal density only
const DESC_LINE_MM = 3.7; // each extra line a long item name wraps to
const TOTAL_ROW_MM = 6.6;
const TABLE_CHROME_MM = 0.4;
const FOOT_PAD_MM = 2.5; // the summary block's top + bottom padding
const SUMMARY_FRAME_MM = 1.8; // the summary box's bottom margin and border
const SUMMARY_ROW_MM: Record<Density, number> = { normal: 6.1, compact: 4.7 };
// Calibrated on A5, where a line holds about 36 characters in the customer box and 28 in the Description column.
// Text keeps its size on A4, so a line there holds as many more as the box or column is wider.
const FRAME_CHARS_PER_MM = 36 / contentWidthMm("A5");
const DESC_CHARS_PER_MM = 28 / descWidthMm("A5");

/** Extra lines a text wraps to beyond its first, at roughly `perLine` characters a line. */
const extraLines = (text: string | null, perLine: number): number =>
  text ? Math.max(0, Math.ceil(text.length / perLine) - 1) : 0;

function densityMetrics(data: BillData, density: Density): DensityMetrics {
  const { customer, paper } = data;
  const frameChars = Math.round(FRAME_CHARS_PER_MM * contentWidthMm(paper));
  const descChars = Math.round(DESC_CHARS_PER_MM * descWidthMm(paper));
  const frameMm =
    FRAME_MM + FRAME_LINE_MM * (extraLines(customer.name, frameChars) + extraLines(customer.address, frameChars));

  const rowMm = data.items.map((item) => {
    const sub = density === "normal" && item.weight !== null && formatWeight(item.weight).sub !== "";
    // The weight cell's milligram line and a wrapped name sit side by side: the taller one sets the row.
    const extra = Math.max(sub ? SUB_LINE_MM : 0, DESC_LINE_MM * extraLines(item.name, descChars));
    return (ROW_MM[density] + extra) * INFLATE;
  });

  const summaryRows = billSummaryRows(data).length;
  const footMm = FOOT_PAD_MM + (summaryRows > 0 ? SUMMARY_FRAME_MM + summaryRows * SUMMARY_ROW_MM[density] : 0);

  return {
    frameMm: frameMm * INFLATE,
    theadMm: THEAD_MM * INFLATE,
    rowMm,
    totalRowMm: TOTAL_ROW_MM * INFLATE,
    tableChromeMm: TABLE_CHROME_MM * INFLATE,
    footMm: footMm * INFLATE,
  };
}

export function estimateBillMetrics(data: BillData): BillMetrics {
  return { v: 1, key: "estimate", normal: densityMetrics(data, "normal"), compact: densityMetrics(data, "compact") };
}

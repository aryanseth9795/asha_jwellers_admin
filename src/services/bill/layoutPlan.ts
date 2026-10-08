// Decides how a bill is laid out on its paper from the measured heights of its parts. Pure — safe to unit test.
// See agent/2026-10-05-adaptive-bill-layout-plan.md §4 (the decision ladder) and §5.2 (pagination).

import {
  CONT_STRIP_MM,
  MIDDLE_PAD_TOP_MM,
  MIN_FILLER_MM,
  MORE_STRIP_MM,
  PAPER,
  PaperGeometry,
  PaperSize,
  SAFETY_MM,
} from "./geometry";

export type Density = "normal" | "compact";

/** Heights of one density's blocks, in mm, as they render in the WebView (or as estimated). */
export interface DensityMetrics {
  /** The customer box and its bottom margin: from the box's top to the item table's top. */
  frameMm: number;
  theadMm: number;
  /** One per item, in order. */
  rowMm: number[];
  totalRowMm: number;
  /** What the table's own borders add beyond its rows. */
  tableChromeMm: number;
  /** The summary block, paddings included (just the paddings when there is no summary). */
  footMm: number;
}

export interface BillMetrics {
  v: 1;
  /** Which bill inputs these heights belong to; see billLayoutKey. */
  key: string;
  normal: DensityMetrics;
  compact: DensityMetrics;
}

/** One page of a multi-page bill: page 0 carries the header band and customer box, the last the totals and footer. */
export interface PagePlan {
  /** Half-open range of item indexes printed on this page. */
  start: number;
  end: number;
  fillerMm: number;
}

export type BillLayoutPlan =
  | { kind: "single"; density: Density; headerMm: number; fillerMm: number }
  | { kind: "multi"; density: "normal"; pages: PagePlan[] };

/** The last page must carry at least this many rows with the totals, so they never sit alone. */
const WIDOW_ROWS = 2;

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
const filler = (spare: number): number => (spare >= MIN_FILLER_MM ? spare : 0);

/** Everything between the header band and the footer band of a one-page bill. */
const middleMm = (d: DensityMetrics): number =>
  MIDDLE_PAD_TOP_MM + d.frameMm + d.tableChromeMm + d.theadMm + sum(d.rowMm) + d.totalRowMm + d.footMm;

/** Room left for the header band once the content, footer and safety margin are placed. */
const roomForHeader = (d: DensityMetrics, g: PaperGeometry): number =>
  g.pageHeightMm - g.footerMm - SAFETY_MM - middleMm(d);

export function planBillLayout(m: BillMetrics, paper: PaperSize): BillLayoutPlan {
  const g = PAPER[paper];
  const normal = roomForHeader(m.normal, g);
  if (normal >= g.headerMaxMm) {
    return { kind: "single", density: "normal", headerMm: g.headerMaxMm, fillerMm: filler(normal - g.headerMaxMm) };
  }
  if (normal >= g.headerMinMm) {
    return { kind: "single", density: "normal", headerMm: normal, fillerMm: 0 };
  }
  const compact = roomForHeader(m.compact, g);
  if (compact >= g.headerMinMm) {
    const headerMm = Math.min(g.headerMaxMm, compact);
    return { kind: "single", density: "compact", headerMm, fillerMm: filler(compact - headerMm) };
  }
  return { kind: "multi", density: "normal", pages: paginate(m.normal, g) };
}

export const pageCount = (plan: BillLayoutPlan): number => (plan.kind === "single" ? 1 : plan.pages.length);

/** Rows that fit on a page, given whether it is the first page (header band) and the last (totals + footer). */
const rowRoom = (d: DensityMetrics, g: PaperGeometry, first: boolean, last: boolean): number =>
  g.pageHeightMm -
  SAFETY_MM -
  (first ? g.headerMaxMm + MIDDLE_PAD_TOP_MM + d.frameMm : CONT_STRIP_MM + MIDDLE_PAD_TOP_MM) -
  d.tableChromeMm -
  d.theadMm -
  (last ? d.totalRowMm + d.footMm + g.footerMm : MORE_STRIP_MM);

function paginate(d: DensityMetrics, g: PaperGeometry): PagePlan[] {
  const rows = d.rowMm;
  const n = rows.length;
  const pages: PagePlan[] = [];
  let i = 0;
  let closed = false;

  while (i < n) {
    const first = pages.length === 0;
    const rest = sum(rows.slice(i));
    const lastRoom = rowRoom(d, g, first, true);
    if (rest <= lastRoom) {
      pages.push({ start: i, end: n, fillerMm: filler(lastRoom - rest) });
      closed = true;
      break;
    }

    const room = rowRoom(d, g, first, false);
    let j = i;
    let used = 0;
    while (j < n && used + rows[j] <= room) used += rows[j++];
    // A row taller than a whole page still gets a page of its own.
    if (j === i) j = i + 1;
    // Hold rows back so the totals never sit alone on the last page.
    if (n - j < WIDOW_ROWS) j = Math.max(i + 1, n - WIDOW_ROWS);

    const placed = sum(rows.slice(i, j));
    pages.push({ start: i, end: j, fillerMm: filler(Math.max(0, room - placed)) });
    i = j;
  }

  // The summary is too tall to share a page with any row: it gets a page to itself.
  if (!closed) pages.push({ start: n, end: n, fillerMm: 0 });
  return pages;
}

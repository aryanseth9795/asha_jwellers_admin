// Page and template geometry for the printed bill, in millimetres, for each paper size. Pure — safe to unit test.
//
// The template (1024x1536, ratio 1:1.500) is TALLER than A5 or A4 (1:1.414). Both bands render across the full
// page width and the rebuilt middle absorbs the difference. See agent/2026-10-05-adaptive-bill-layout-plan.md §4.1.
// Text keeps the same size on every paper, so a bigger sheet holds more rows rather than bigger ones.

export const TEMPLATE_W = 1024;
export const TEMPLATE_H = 1536;

// Header: the template's top down to just above its own customer box (captures the proprietor box at y=646).
export const HEADER_CROP_PCT = 0.422;
// Footer: from y=1308 to 1536 (Terms & Conditions, Signature and the Thank-you flourish).
export const FOOTER_CROP_PCT = 0.1484;
/** The header may be squashed vertically down to this fraction of its natural height, and no further. */
export const HEADER_MIN_RATIO = 0.7;

export type PaperSize = "A5" | "A4";

export interface PaperGeometry {
  /** The PDF page in PostScript points, the size expo-print renders it at. */
  widthPt: number;
  heightPt: number;
  /** The page box, kept just inside the PDF page: a box even a sliver too tall spills onto a blank extra page. */
  pageWidthMm: number;
  pageHeightMm: number;
  /** The template drawn across the full page width. */
  templateHeightMm: number;
  /** The header band at its natural, undistorted height. */
  headerMaxMm: number;
  headerMinMm: number;
  footerMm: number;
}

function paperGeometry(widthPt: number, heightPt: number, pageWidthMm: number, pageHeightMm: number): PaperGeometry {
  const templateHeightMm = pageWidthMm * (TEMPLATE_H / TEMPLATE_W);
  const headerMaxMm = templateHeightMm * HEADER_CROP_PCT;
  return {
    widthPt,
    heightPt,
    pageWidthMm,
    pageHeightMm,
    templateHeightMm,
    headerMaxMm,
    headerMinMm: headerMaxMm * HEADER_MIN_RATIO,
    footerMm: templateHeightMm * FOOTER_CROP_PCT,
  };
}

export const PAPER: Record<PaperSize, PaperGeometry> = {
  // 595 pt = 209.9 mm tall.
  A5: paperGeometry(420, 595, 148, 209.5),
  // 842 pt = 297.0 mm tall, 595 pt = 209.9 mm wide.
  A4: paperGeometry(595, 842, 209.5, 296.5),
};

/** Left unplanned on every page, for rounding and small font differences between the preview and the PDF. */
export const SAFETY_MM = 1;
/** The middle block's top padding, above the customer box (or, on a continuation page, above the table). */
export const MIDDLE_PAD_TOP_MM = 1.5;
/** The middle block's left and right padding; the customer box and items table span the page between. */
export const MIDDLE_PAD_SIDE_MM = 8;
/** The items table's fixed columns. Description takes whatever width is left, so it is the one that grows on A4. */
export const ITEM_COLUMN_MM = { slNo: 9, weight: 22, qty: 11, metalPurity: 23, amount: 23 };

/** The width the customer box and items table get on a page. */
export const contentWidthMm = (paper: PaperSize): number => PAPER[paper].pageWidthMm - 2 * MIDDLE_PAD_SIDE_MM;
/** The Description column's width on a page. */
export const descWidthMm = (paper: PaperSize): number =>
  contentWidthMm(paper) - Object.values(ITEM_COLUMN_MM).reduce((a, b) => a + b, 0);
/** The fixed-height strip that heads page 2 onward in place of the artwork header. */
export const CONT_STRIP_MM = 14;
/** The fixed-height "क्रमशः" strip that ends every page but the last. */
export const MORE_STRIP_MM = 6;
/** A ruled filler thinner than this is not drawn; the sliver stays as plain space. */
export const MIN_FILLER_MM = 2;

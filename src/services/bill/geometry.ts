// Page and template geometry for the printed A5 bill, in millimetres. Pure — safe to unit test.
//
// The template (1024x1536, ratio 1:1.500) is TALLER than A5 (1:1.419). Both bands render across the full page
// width and the rebuilt middle absorbs the difference. See agent/2026-10-05-adaptive-bill-layout-plan.md §4.1.

export const TEMPLATE_W = 1024;
export const TEMPLATE_H = 1536;

// A5 in PostScript points (148mm x 210mm), the size expo-print renders the PDF at.
export const A5_WIDTH_PT = 420;
export const A5_HEIGHT_PT = 595;

export const PAGE_W_MM = 148;
/** The PDF page is 595 pt = 209.9 mm tall; a 210 mm page box would spill a sliver onto a blank extra page. */
export const PAGE_H_MM = 209.5;

/** The template drawn across the full page width. */
export const TPL_H_MM = PAGE_W_MM * (TEMPLATE_H / TEMPLATE_W);

// Header: the template's top down to just above its own customer box (captures the proprietor box at y=646).
export const HEADER_CROP_PCT = 0.422;
// Footer: from y=1308 to 1536 (Terms & Conditions, Signature and the Thank-you flourish).
export const FOOTER_CROP_PCT = 0.1484;

/** The header band at its natural, undistorted height. */
export const HEADER_MAX_MM = TPL_H_MM * HEADER_CROP_PCT;
/** The header may be squashed vertically down to this fraction of its natural height, and no further. */
export const HEADER_MIN_RATIO = 0.7;
export const HEADER_MIN_MM = HEADER_MAX_MM * HEADER_MIN_RATIO;
export const FOOTER_MM = TPL_H_MM * FOOTER_CROP_PCT;

/** Left unplanned on every page, for rounding and small font differences between the preview and the PDF. */
export const SAFETY_MM = 1;
/** The middle block's top padding, above the customer box (or, on a continuation page, above the table). */
export const MIDDLE_PAD_TOP_MM = 1.5;
/** The fixed-height strip that heads page 2 onward in place of the artwork header. */
export const CONT_STRIP_MM = 14;
/** The fixed-height "क्रमशः" strip that ends every page but the last. */
export const MORE_STRIP_MM = 6;
/** A ruled filler thinner than this is not drawn; the sliver stays as plain space. */
export const MIN_FILLER_MM = 2;

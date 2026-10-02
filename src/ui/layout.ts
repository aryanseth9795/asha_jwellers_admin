/** Responsive layout values for a window width in dp (spec §6). Pure, so it is unit-tested. */
export interface Layout {
  width: number;
  /** Narrower than 340 dp: one tile column. */
  narrow: boolean;
  /** Narrower than 360 dp: tighter gutters. */
  compact: boolean;
  tileColumns: 1 | 2;
  gutter: number;
  /** Side of one tile in a three-column media grid with 16 dp padding and 12 dp gaps. */
  mediaTile: number;
}

export const layoutFor = (width: number): Layout => ({
  width,
  narrow: width < 340,
  compact: width < 360,
  tileColumns: width >= 340 ? 2 : 1,
  gutter: width < 360 ? 12 : 16,
  mediaTile: Math.max(0, Math.floor((width - 44) / 3)),
});

/** Label column of a horizontal bar chart: 30 % of the card, at least 84 dp, at most `max`. */
export const barLabelWidth = (cardWidth: number, max = 120): number =>
  Math.max(84, Math.min(max, Math.round(cardWidth * 0.3)));

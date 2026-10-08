import { barLabelWidth, layoutFor } from "../../src/ui/layout";

describe("layoutFor (spec §6)", () => {
  it("treats 320 dp as narrow and compact with one tile column", () => {
    expect(layoutFor(320)).toEqual({ width: 320, narrow: true, compact: true, tileColumns: 1, gutter: 12, mediaTile: 92 });
  });
  it("switches to two tile columns at exactly 340 dp", () => {
    expect(layoutFor(339).tileColumns).toBe(1);
    expect(layoutFor(339).narrow).toBe(true);
    expect(layoutFor(340).tileColumns).toBe(2);
    expect(layoutFor(340).narrow).toBe(false);
  });
  it("stops being compact at exactly 360 dp and widens the gutter", () => {
    expect(layoutFor(359)).toMatchObject({ compact: true, gutter: 12 });
    expect(layoutFor(360)).toMatchObject({ compact: false, gutter: 16, mediaTile: 105 });
  });
  it("sizes three media tiles from the live width", () => {
    expect(layoutFor(412).mediaTile).toBe(122);
    expect(layoutFor(0).mediaTile).toBe(0);
  });
});

describe("barLabelWidth (spec §5)", () => {
  it("is 30 % of the card, clamped to 84–120 dp", () => {
    expect(barLabelWidth(0)).toBe(84);
    expect(barLabelWidth(264)).toBe(84);
    expect(barLabelWidth(356)).toBe(107);
    expect(barLabelWidth(500)).toBe(120);
  });
  it("lets a caller raise the maximum for long names", () => {
    expect(barLabelWidth(600, 150)).toBe(150);
    expect(barLabelWidth(400, 150)).toBe(120);
  });
});

import {
  A5_HEIGHT_PT,
  FOOTER_MM,
  HEADER_MAX_MM,
  HEADER_MIN_MM,
  PAGE_H_MM,
  PAGE_W_MM,
} from "../../../src/services/bill/geometry";

const ptToMm = (pt: number) => (pt / 72) * 25.4;

describe("bill geometry", () => {
  it("keeps the page box inside the 595 pt PDF page so no sliver page is made", () => {
    expect(PAGE_H_MM).toBe(209.5);
    expect(PAGE_H_MM).toBeLessThan(ptToMm(A5_HEIGHT_PT));
    expect(PAGE_W_MM).toBe(148);
  });

  it("derives the natural header from the template's top 42.2 % at full page width", () => {
    expect(HEADER_MAX_MM).toBeCloseTo(93.68, 2);
  });

  it("floors the shrunk header at 0.7 of its natural height", () => {
    expect(HEADER_MIN_MM).toBeCloseTo(65.58, 2);
  });

  it("derives the footer from the template's bottom 14.84 %", () => {
    expect(FOOTER_MM).toBeCloseTo(32.94, 2);
  });
});

import { PAPER } from "../../../src/services/bill/geometry";

const ptToMm = (pt: number) => (pt / 72) * 25.4;

describe("bill geometry", () => {
  describe("A5", () => {
    const g = PAPER.A5;

    it("renders the PDF at 420 x 595 pt", () => {
      expect([g.widthPt, g.heightPt]).toEqual([420, 595]);
    });

    it("keeps the page box inside the 595 pt PDF page so no sliver page is made", () => {
      expect(g.pageHeightMm).toBe(209.5);
      expect(g.pageHeightMm).toBeLessThan(ptToMm(g.heightPt));
      expect(g.pageWidthMm).toBe(148);
      expect(g.pageWidthMm).toBeLessThan(ptToMm(g.widthPt));
    });

    it("derives the natural header from the template's top 42.2 % at full page width", () => {
      expect(g.headerMaxMm).toBeCloseTo(93.68, 2);
    });

    it("floors the shrunk header at 0.7 of its natural height", () => {
      expect(g.headerMinMm).toBeCloseTo(65.58, 2);
    });

    it("derives the footer from the template's bottom 14.84 %", () => {
      expect(g.footerMm).toBeCloseTo(32.94, 2);
    });
  });

  describe("A4", () => {
    const g = PAPER.A4;

    it("renders the PDF at 595 x 842 pt", () => {
      expect([g.widthPt, g.heightPt]).toEqual([595, 842]);
    });

    it("keeps the page box inside the A4 PDF page so no sliver page is made", () => {
      expect(g.pageHeightMm).toBe(296.5);
      expect(g.pageHeightMm).toBeLessThan(ptToMm(g.heightPt));
      expect(g.pageWidthMm).toBe(209.5);
      expect(g.pageWidthMm).toBeLessThan(ptToMm(g.widthPt));
    });

    it("draws the artwork across the wider page, so its bands grow with the width", () => {
      expect(g.templateHeightMm).toBeCloseTo(314.25, 2);
      expect(g.headerMaxMm).toBeCloseTo(132.61, 2);
      expect(g.headerMinMm).toBeCloseTo(92.83, 2);
      expect(g.footerMm).toBeCloseTo(46.63, 2);
    });

    it("leaves far more room between the bands than A5 does", () => {
      const room = (p: typeof g) => p.pageHeightMm - p.headerMinMm - p.footerMm;
      expect(room(g) - room(PAPER.A5)).toBeGreaterThan(40);
    });
  });
});

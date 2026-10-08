import {
  CONT_STRIP_MM,
  FOOTER_MM,
  HEADER_MAX_MM,
  HEADER_MIN_MM,
  MIDDLE_PAD_TOP_MM,
  MORE_STRIP_MM,
  PAGE_H_MM,
  SAFETY_MM,
} from "../../../src/services/bill/geometry";
import {
  BillLayoutPlan,
  BillMetrics,
  DensityMetrics,
  planBillLayout,
} from "../../../src/services/bill/layoutPlan";

// Hand-built from the desktop Chromium measurements in the plan (§2.1).
const density = (rowMm: number, n: number, footMm: number): DensityMetrics => ({
  frameMm: 15.9,
  theadMm: 6.4,
  rowMm: Array.from({ length: n }, () => rowMm),
  totalRowMm: 6.6,
  tableChromeMm: 0.4,
  footMm,
});
const PLAIN = { normalFoot: 10.3, compactFoot: 9 };
const LEDGER = { normalFoot: 59, compactFoot: 45 };
const metrics = (n: number, foot = PLAIN): BillMetrics => ({
  v: 1,
  key: "k",
  normal: density(9.3, n, foot.normalFoot),
  compact: density(6.4, n, foot.compactFoot),
});
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const content = (d: DensityMetrics) =>
  MIDDLE_PAD_TOP_MM + d.frameMm + d.tableChromeMm + d.theadMm + sum(d.rowMm) + d.totalRowMm + d.footMm;
const single = (plan: BillLayoutPlan) => {
  if (plan.kind !== "single") throw new Error(`expected a single page, got ${plan.kind}`);
  return plan;
};
const multi = (plan: BillLayoutPlan) => {
  if (plan.kind !== "multi") throw new Error(`expected several pages, got ${plan.kind}`);
  return plan;
};

/** Independent oracle: how tall a planned page of a multi-page bill really is. */
const pageHeight = (m: DensityMetrics, pages: { start: number; end: number; fillerMm: number }[], i: number) => {
  const p = pages[i];
  const first = i === 0;
  const last = i === pages.length - 1;
  return (
    (first ? HEADER_MAX_MM + MIDDLE_PAD_TOP_MM + m.frameMm : CONT_STRIP_MM + MIDDLE_PAD_TOP_MM) +
    m.tableChromeMm +
    m.theadMm +
    sum(m.rowMm.slice(p.start, p.end)) +
    p.fillerMm +
    (last ? m.totalRowMm + m.footMm + FOOTER_MM : MORE_STRIP_MM)
  );
};

describe("planBillLayout", () => {
  describe("case 1 — room to spare", () => {
    it("keeps the header at its natural size and gives the rest to a ruled filler", () => {
      const plan = single(planBillLayout(metrics(1)));
      expect(plan.density).toBe("normal");
      expect(plan.headerMm).toBeCloseTo(HEADER_MAX_MM, 5);
      expect(plan.fillerMm).toBeCloseTo(PAGE_H_MM - FOOTER_MM - SAFETY_MM - HEADER_MAX_MM - content(metrics(1).normal), 5);
      expect(plan.fillerMm).toBeGreaterThan(30);
    });

    it("fills the page exactly, leaving only the safety margin", () => {
      for (const n of [0, 1, 2, 3, 4]) {
        const m = metrics(n);
        const plan = single(planBillLayout(m));
        expect(plan.headerMm + content(m.normal) + plan.fillerMm + FOOTER_MM + SAFETY_MM).toBeCloseTo(PAGE_H_MM, 5);
      }
    });

    it("drops a filler too thin to draw", () => {
      const m = metrics(4);
      // Leave exactly 1 mm under the natural header.
      m.normal.rowMm[0] += PAGE_H_MM - FOOTER_MM - SAFETY_MM - HEADER_MAX_MM - content(m.normal) - 1;
      const plan = single(planBillLayout(m));
      expect(plan.headerMm).toBeCloseTo(HEADER_MAX_MM, 5);
      expect(plan.fillerMm).toBe(0);
    });
  });

  describe("case 2 — tight", () => {
    it("shrinks the header only as much as the content needs, so the page is exactly full", () => {
      const m = metrics(6);
      const plan = single(planBillLayout(m));
      expect(plan.density).toBe("normal");
      expect(plan.headerMm).toBeCloseTo(PAGE_H_MM - FOOTER_MM - SAFETY_MM - content(m.normal), 5);
      expect(plan.headerMm).toBeGreaterThan(HEADER_MIN_MM);
      expect(plan.headerMm).toBeLessThan(HEADER_MAX_MM);
      expect(plan.fillerMm).toBe(0);
    });

    it("never makes the header taller as rows are added at the same density", () => {
      let previous: { density: string; headerMm: number } | null = null;
      for (let n = 0; n <= 15; n++) {
        const plan = planBillLayout(metrics(n));
        if (plan.kind !== "single") break;
        if (previous && previous.density === plan.density) {
          expect(plan.headerMm).toBeLessThanOrEqual(previous.headerMm);
        }
        previous = plan;
      }
    });

    it("compacts rows and summary before giving up on one page, letting the header grow back", () => {
      const m = metrics(8);
      const plan = single(planBillLayout(m));
      expect(plan.density).toBe("compact");
      expect(plan.headerMm).toBeCloseTo(
        Math.min(HEADER_MAX_MM, PAGE_H_MM - FOOTER_MM - SAFETY_MM - content(m.compact)),
        5,
      );
      expect(plan.headerMm).toBeGreaterThanOrEqual(HEADER_MIN_MM);
    });
  });

  describe("case 3 — overflow", () => {
    it("goes to several pages at normal density when even compact rows cannot fit", () => {
      const plan = multi(planBillLayout(metrics(11)));
      expect(plan.density).toBe("normal");
      expect(plan.pages.length).toBeGreaterThanOrEqual(2);
      expect(plan.pages[0].start).toBe(0);
    });

    it("splits rows in order, fits every page and leaves at least two rows with the totals", () => {
      for (let n = 11; n <= 40; n++) {
        const m = metrics(n);
        const plan = multi(planBillLayout(m));
        const { pages } = plan;
        expect(pages[0].start).toBe(0);
        pages.forEach((p, i) => {
          if (i > 0) expect(p.start).toBe(pages[i - 1].end);
          expect(p.end).toBeGreaterThan(p.start);
          expect(p.fillerMm).toBeGreaterThanOrEqual(0);
          expect(pageHeight(m.normal, pages, i)).toBeLessThanOrEqual(PAGE_H_MM - SAFETY_MM + 1e-9);
        });
        const last = pages[pages.length - 1];
        expect(last.end).toBe(n);
        expect(last.end - last.start).toBeGreaterThanOrEqual(2);
      }
    });

    it("sends the full-ledger copy to two pages with fewer items than the plain copy", () => {
      const firstMulti = (foot: typeof PLAIN) => {
        for (let n = 0; n < 40; n++) if (planBillLayout(metrics(n, foot)).kind === "multi") return n;
        return Infinity;
      };
      expect(firstMulti(LEDGER)).toBeLessThan(firstMulti(PLAIN));
    });

    it("gives a row taller than a page a page of its own and still finishes", () => {
      const m = metrics(3);
      m.normal.rowMm[1] = 250;
      m.compact.rowMm[1] = 250;
      const plan = multi(planBillLayout(m));
      const lone = plan.pages.find((p) => p.start === 1);
      expect(lone).toEqual(expect.objectContaining({ start: 1, end: 2 }));
      expect(plan.pages[plan.pages.length - 1].end).toBe(3);
    });

    it("still ends on a page that carries the totals when the summary is taller than any page", () => {
      const m = metrics(12, { normalFoot: 300, compactFoot: 300 });
      const plan = multi(planBillLayout(m));
      const covered = plan.pages.flatMap((p) => Array.from({ length: p.end - p.start }, (_, k) => p.start + k));
      expect(covered).toEqual(Array.from({ length: 12 }, (_, k) => k));
      expect(plan.pages[plan.pages.length - 1].end).toBe(12);
    });
  });
});

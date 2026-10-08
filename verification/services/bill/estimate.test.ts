import { BillData } from "../../../src/services/BillHtmlService";
import { estimateBillMetrics } from "../../../src/services/bill/estimate";
import { planBillLayout } from "../../../src/services/bill/layoutPlan";
import { LendenItem } from "../../../src/types/entry";

const item = (over: Partial<LendenItem> = {}): LendenItem => ({
  id: 1,
  lendenId: 1,
  position: 1,
  metal: "gold",
  name: "मांगटीका",
  purity: "22KT",
  weight: 3.5,
  qty: 1,
  rate: 14500,
  total: 50750,
  ...over,
});
const items = (n: number) => Array.from({ length: n }, (_, i) => item({ id: i + 1, position: i + 1 }));

const data = (over: Partial<BillData> = {}): BillData => ({
  billNo: 9267,
  date: "2026-08-27",
  customer: { name: "सरिता शर्मा", address: "रामदशपुर, जौनपुर", mobile: "9415501122" },
  items: [item()],
  oldJewelleryItems: [],
  amount: 50750,
  discount: 0,
  jamaEntries: [],
  baki: 50750,
  pichlaBaki: 25000,
  totalBaki: 75750,
  showPaymentDetails: false,
  showTotalBaki: false,
  templateDataUri: "data:image/jpeg;base64,AAAA",
  paper: "A5",
  ...over,
});

const ledger = (over: Partial<BillData> = {}): BillData =>
  data({
    showPaymentDetails: true,
    showTotalBaki: true,
    discount: 650,
    jamaEntries: [
      { amount: 20000, date: "2026-08-27" },
      { amount: 10000, date: "2026-09-01" },
    ],
    oldJewelleryItems: [
      { id: 1, lendenId: 1, position: 1, description: "x", metal: "gold", purity: "22KT", weight: 4, value: 18000 },
      { id: 2, lendenId: 1, position: 2, description: "y", metal: "silver", purity: null, weight: null, value: 4500 },
    ],
    ...over,
  });

describe("estimateBillMetrics", () => {
  it("estimates one row per item, each at least as tall as measured in Chromium", () => {
    const m = estimateBillMetrics(data({ items: items(3) }));
    expect(m.normal.rowMm).toHaveLength(3);
    m.normal.rowMm.forEach((h) => expect(h).toBeGreaterThanOrEqual(9.3));
    m.compact.rowMm.forEach((h) => expect(h).toBeLessThan(9.3));
  });

  it("errs tall on the customer box, table and summary", () => {
    const m = estimateBillMetrics(data());
    expect(m.normal.frameMm).toBeGreaterThanOrEqual(15.9);
    expect(m.normal.theadMm).toBeGreaterThanOrEqual(6.4);
    expect(m.normal.totalRowMm).toBeGreaterThanOrEqual(6.6);
    expect(m.normal.footMm).toBeGreaterThanOrEqual(10.3);
  });

  it("only adds the milligram line's height where an item has one", () => {
    const m = estimateBillMetrics(data({ items: [item({ weight: 3.5 }), item({ id: 2, position: 2, weight: 4 })] }));
    expect(m.normal.rowMm[0]).toBeGreaterThan(m.normal.rowMm[1]);
  });

  it("adds a line for an item name too long for the Description column", () => {
    const long = "भारी कुंदन हार सेट झुमके और मांगटीका सहित दुल्हन सेट";
    const m = estimateBillMetrics(data({ items: [item(), item({ id: 2, position: 2, name: long })] }));
    expect(m.normal.rowMm[1]).toBeGreaterThan(m.normal.rowMm[0]);
  });

  it("grows the customer box for an address too long for one line", () => {
    const long = "ग्राम व पोस्ट रामदशपुर, तहसील मड़ियाहूं, जनपद जौनपुर, उत्तर प्रदेश";
    const short = estimateBillMetrics(data()).normal.frameMm;
    expect(estimateBillMetrics(data({ customer: { name: "सरिता", address: long, mobile: null } })).normal.frameMm).toBeGreaterThan(short);
  });

  it("grows the summary with every summary row, and tightens it when compact", () => {
    const plain = estimateBillMetrics(data());
    const full = estimateBillMetrics(ledger());
    expect(full.normal.footMm).toBeGreaterThan(plain.normal.footMm + 40);
    expect(full.compact.footMm).toBeLessThan(full.normal.footMm);
  });

  it("leaves only the paddings when the bill has no summary", () => {
    const none = estimateBillMetrics(data({ items: [item({ rate: null })] }));
    expect(none.normal.footMm).toBeLessThan(5);
  });

  it("sends a long full-ledger bill to two pages and keeps a one-item bill on one", () => {
    expect(planBillLayout(estimateBillMetrics(data()), "A5").kind).toBe("single");
    expect(planBillLayout(estimateBillMetrics(ledger({ items: items(8) })), "A5").kind).toBe("multi");
  });

  describe("on A4", () => {
    it("wraps a long item name less, as the Description column is far wider", () => {
      const long = "भारी कुंदन हार सेट झुमके और मांगटीका सहित दुल्हन सेट";
      const row = (paper: "A5" | "A4") =>
        estimateBillMetrics(data({ paper, items: [item({ name: long, weight: 4 })] })).normal.rowMm[0];
      expect(row("A4")).toBeLessThan(row("A5"));
    });

    it("keeps a short item name's row as tall as on A5", () => {
      const row = (paper: "A5" | "A4") => estimateBillMetrics(data({ paper })).normal.rowMm[0];
      expect(row("A4")).toBeCloseTo(row("A5"), 5);
    });

    it("fits on one A4 page the full-ledger bill that takes two A5 pages", () => {
      const bill = ledger({ paper: "A4", items: items(8) });
      expect(planBillLayout(estimateBillMetrics(bill), "A4").kind).toBe("single");
    });
  });
});

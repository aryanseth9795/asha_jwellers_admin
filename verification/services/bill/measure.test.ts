import { BillData, buildBillMeasureHtml } from "../../../src/services/BillHtmlService";
import { BILL_PROBE_JS, billLayoutKey, parseBillMetrics } from "../../../src/services/bill/measure";
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

const data = (over: Partial<BillData> = {}): BillData => ({
  billNo: 9267,
  date: "2026-08-27",
  customer: { name: "सरिता शर्मा", address: "रामदशपुर, जौनपुर", mobile: "9415501122" },
  items: [item(), item({ id: 2, position: 2, name: "अंगूठी" })],
  oldJewelleryItems: [],
  amount: 101500,
  discount: 0,
  jamaEntries: [],
  baki: 101500,
  pichlaBaki: 0,
  totalBaki: 101500,
  showPaymentDetails: false,
  showTotalBaki: false,
  templateDataUri: "data:image/jpeg;base64,AAAA",
  paper: "A5",
  ...over,
});

const density = (rows: number) => ({
  frameMm: 15.9,
  theadMm: 6.4,
  rowMm: Array.from({ length: rows }, () => 9.3),
  totalRowMm: 6.6,
  tableChromeMm: 0.3,
  footMm: 10.3,
});
const message = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ v: 1, key: "abc", normal: density(2), compact: density(2), ...over });

describe("billLayoutKey", () => {
  it("stays the same when only the bill number or the embedded template changes", () => {
    const key = billLayoutKey(data());
    expect(billLayoutKey(data({ billNo: 1 }))).toBe(key);
    expect(billLayoutKey(data({ templateDataUri: "data:image/jpeg;base64,BBBB" }))).toBe(key);
  });

  it("changes when a toggle or an item changes the bill's height", () => {
    const key = billLayoutKey(data());
    expect(billLayoutKey(data({ showPaymentDetails: true }))).not.toBe(key);
    expect(billLayoutKey(data({ showTotalBaki: true }))).not.toBe(key);
    expect(billLayoutKey(data({ items: [item()] }))).not.toBe(key);
  });

  it("changes when the paper changes, so the bill is measured again at the new width", () => {
    expect(billLayoutKey(data({ paper: "A4" }))).not.toBe(billLayoutKey(data()));
  });
});

describe("parseBillMetrics", () => {
  it("accepts a well-formed message for the expected bill", () => {
    const m = parseBillMetrics(message(), "abc", 2);
    expect(m?.normal.rowMm).toEqual([9.3, 9.3]);
    expect(m?.compact.footMm).toBe(10.3);
  });

  it("ignores a late message from an earlier toggle state", () => {
    expect(parseBillMetrics(message({ key: "old" }), "abc", 2)).toBeNull();
  });

  it("rejects a message whose row count does not match the items", () => {
    expect(parseBillMetrics(message({ compact: density(3) }), "abc", 2)).toBeNull();
    expect(parseBillMetrics(message({ normal: density(1) }), "abc", 2)).toBeNull();
  });

  it("rejects missing, non-finite, negative or absurd heights", () => {
    expect(parseBillMetrics(message({ normal: { ...density(2), footMm: undefined } }), "abc", 2)).toBeNull();
    expect(parseBillMetrics(message({ normal: { ...density(2), theadMm: "6" } }), "abc", 2)).toBeNull();
    expect(parseBillMetrics(message({ normal: { ...density(2), frameMm: -1 } }), "abc", 2)).toBeNull();
    expect(parseBillMetrics(message({ normal: { ...density(2), rowMm: [9.3, 301] } }), "abc", 2)).toBeNull();
    expect(parseBillMetrics(message({ compact: { ...density(2), rowMm: [9.3, null] } }), "abc", 2)).toBeNull();
  });

  it("rejects anything that is not a version-1 metrics message", () => {
    expect(parseBillMetrics("not json", "abc", 2)).toBeNull();
    expect(parseBillMetrics(message({ v: 2 }), "abc", 2)).toBeNull();
    expect(parseBillMetrics(JSON.stringify({ v: 1, key: "abc", error: "boom" }), "abc", 2)).toBeNull();
    expect(parseBillMetrics("null", "abc", 2)).toBeNull();
  });
});

describe("BILL_PROBE_JS", () => {
  it("is valid JavaScript that reports back through the React Native bridge", () => {
    expect(() => new Function(BILL_PROBE_JS)).not.toThrow();
    expect(BILL_PROBE_JS).toContain("window.ReactNativeWebView.postMessage");
    expect(BILL_PROBE_JS).toContain("document.fonts");
  });
});

describe("buildBillMeasureHtml", () => {
  const html = buildBillMeasureHtml(data(), "abc");
  const container = (density: string) => {
    const start = html.indexOf(`data-density="${density}"`);
    const next = html.indexOf('class="measure', start + 1);
    return html.slice(start, next === -1 ? undefined : next);
  };

  it("renders the bill's middle block once per density, tagged with the bill's key", () => {
    expect(html).toContain('data-key="abc"');
    expect(container("normal")).toContain('class="inv-frame"');
    expect(container("compact")).toContain('class="inv-frame"');
    expect(container("normal")).toContain('class="foot"');
  });

  it("prints one row per item in each density, without a filler", () => {
    for (const d of ["normal", "compact"]) {
      const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(container(d))?.[1] ?? "";
      expect(body.match(/<tr>/g)).toHaveLength(2);
      expect(body).not.toContain('class="filler"');
    }
  });

  it("drops the milligram line only in the compact copy", () => {
    expect(container("normal")).toContain("(3 ग्राम 500 मिली)");
    expect(container("compact")).not.toContain("(3 ग्राम 500 मिली)");
  });

  it("holds no script of its own: the probe is injected by the measuring WebView", () => {
    expect(html).not.toMatch(/<script/i);
  });

  it("lays the blocks out at the bill's page width, so names wrap as they will print", () => {
    expect(html).toContain(".measure { width: 148.00mm; }");
    expect(buildBillMeasureHtml(data({ paper: "A4" }), "abc")).toContain(".measure { width: 209.50mm; }");
  });
});

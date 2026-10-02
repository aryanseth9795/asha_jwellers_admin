import { buildBillHtml, BillData } from "./BillHtmlService";
import { LendenItem, OldJewelleryItem } from "../types/entry";

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
  date: "2026-08-27T00:00:00.000Z",
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
  ...over,
});

const oldJewelleryItem = (
  over: Partial<OldJewelleryItem> = {},
): OldJewelleryItem => ({
  id: 1,
  lendenId: 1,
  position: 1,
  description: "Old gold ring",
  weight: 4.2,
  value: 18000,
  ...over,
});

describe("buildBillHtml", () => {
  it("renders the customer, bill number and date", () => {
    const html = buildBillHtml(data());
    expect(html).toContain("सरिता शर्मा");
    expect(html).toContain("रामदशपुर, जौनपुर");
    expect(html).toContain("9415501122");
    expect(html).toContain("9267");
    expect(html).toContain("27/08/2026");
  });

  it("renders the item table with Qty, Weight, and Metal/Purity columns matching the final template", () => {
    const html = buildBillHtml(data());
    expect(html).toContain("मांगटीका");
    expect(html).toContain("22KT");
    expect(html).toContain("Gold / 22KT");
    expect(html).toContain("3.500 ग्राम");
    expect(html).toContain("(3 ग्राम 500 मिली)");
    expect(html).toContain("50,750/-");
    expect(html).toContain("Qty.");
    expect(html).toContain("Sl.No.");
    expect(html).toContain("Description");
    expect(html).toContain("Weight");
    expect(html).toContain("Metal/Purity");
    expect(html).toContain("Amount");
  });

  it("embeds the template exactly once and bands it with compressed header and bottom-anchored footer", () => {
    const html = buildBillHtml(data());
    expect(html.split("data:image/jpeg;base64,AAAA").length - 1).toBe(1);
    expect(html).toContain("band-header");
    expect(html).toContain("band-footer");
    expect(html).toContain("background-position: left bottom");
  });

  it("leaves address and mobile values blank when absent", () => {
    const html = buildBillHtml(
      data({ customer: { name: "सरिता", address: null, mobile: null } }),
    );
    expect(html).not.toContain("रामदशपुर, जौनपुर");
    expect(html).not.toContain("9415501122");
  });

  describe("summary rate row", () => {
    it("shows दर प्रति ग्राम when every item shares one rate and payment details are toggled off", () => {
      const html = buildBillHtml(
        data({ items: [item(), item({ id: 2, position: 2, rate: 14500 })] }),
      );
      expect(html).toContain("दर प्रति ग्राम");
    });

    it("omits दर प्रति ग्राम when rates differ", () => {
      const html = buildBillHtml(
        data({ items: [item(), item({ id: 2, position: 2, rate: 9000 })] }),
      );
      expect(html).not.toContain("दर प्रति ग्राम");
    });

    it("shows दर प्रति ग्राम for a single item", () => {
      const html = buildBillHtml(data({ items: [item()] }));
      expect(html).toContain("दर प्रति ग्राम");
    });

    it("omits दर प्रति ग्राम when the only item has no rate", () => {
      const html = buildBillHtml(data({ items: [item({ rate: null })] }));
      expect(html).not.toContain("दर प्रति ग्राम");
    });
  });

  describe("payment details toggle", () => {
    it("prints the plain sale copy when off without discount", () => {
      const html = buildBillHtml(data({ showPaymentDetails: false, discount: 0 }));
      expect(html).not.toContain("जमा");
      expect(html).not.toContain("बाकी");
    });

    it("prints छूट, जमा and बाकी when on", () => {
      const html = buildBillHtml(
        data({
          showPaymentDetails: true,
          discount: 650,
          jamaEntries: [{ amount: 50000, date: "2026-08-27T00:00:00.000Z" }],
          baki: 100,
        }),
      );
      expect(html).toContain("छूट");
      expect(html).toContain("जमा (27/08/2026)");
      expect(html).toContain("बाकी");
      expect(html).toContain("50,000/-");
    });

    it("renders पिछला बाकी on top and कुल बाकी at bottom when showTotalBaki is enabled", () => {
      const html = buildBillHtml(
        data({
          showPaymentDetails: true,
          showTotalBaki: true,
          pichlaBaki: 20000,
          amount: 50000,
          discount: 0,
          jamaEntries: [{ amount: 10000, date: "2026-08-27T00:00:00.000Z" }],
        }),
      );
      expect(html).toContain("पिछला बाकी");
      expect(html).toContain("20,000/-");
      expect(html).toContain("बाकी");
      expect(html).toContain("40,000/-");
      expect(html).toContain("कुल बाकी");
      expect(html).toContain("60,000/-");

      // Verify that "पिछला बाकी" appears before "कुल राशि" in the HTML
      const pichlaIndex = html.indexOf("पिछला बाकी");
      const kulRashiIndex = html.indexOf("कुल राशि");
      const kulBakiIndex = html.indexOf("कुल बाकी");
      expect(pichlaIndex).toBeLessThan(kulRashiIndex);
      expect(kulRashiIndex).toBeLessThan(kulBakiIndex);
    });
  });

  it("prints every old-jewellery item and subtracts their credit", () => {
    const html = buildBillHtml(
      data({
        amount: 50750,
        oldJewelleryItems: [
          oldJewelleryItem(),
          oldJewelleryItem({
            id: 2,
            position: 2,
            description: "Old silver anklet",
            weight: null,
            value: 4500,
          }),
        ],
      }),
    );

    expect(html).toContain("Old Jewellery Exchange");
    expect(html).toContain("Old gold ring");
    expect(html).toContain("Old silver anklet");
    expect(html).toContain("22,500/-");
    expect(html).toContain("28,250/-");
  });

  it("puts the payable amount into words with Rupees in words prefix", () => {
    const html = buildBillHtml(data());
    expect(html).toContain("Rupees in words :");
    expect(html).toContain("पचास हजार सात सौ पचास रुपये मात्र");
  });

  it("words the baki, not the gross, when payment details are shown", () => {
    const html = buildBillHtml(
      data({ showPaymentDetails: true, baki: 100, discount: 650 }),
    );
    expect(html).toContain("एक सौ रुपये मात्र");
  });

  it("drops the milligram sub-line once the table gets crowded", () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      item({ id: i + 1, position: i + 1 }),
    );
    const html = buildBillHtml(data({ items: many }));
    expect(html).not.toContain("(3 ग्राम 500 मिली)");
    expect(html).toContain("3.500 ग्राम");
  });

  it("escapes HTML in user-typed names", () => {
    const html = buildBillHtml(
      data({ items: [item({ name: "<script>x</script>" })] }),
    );
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("lets long item lists continue onto another A5 page without clipping rows", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      item({ id: i + 1, position: i + 1, name: `Item ${i + 1}` }),
    );
    const html = buildBillHtml(data({ items: many }));

    expect(html).toContain("min-height: 210.00mm");
    expect(html).toContain(".items tr { break-inside: avoid; page-break-inside: avoid; }");
    expect(html).toContain("Item 20");
    expect(html).not.toContain("overflow: hidden;");
  });
});

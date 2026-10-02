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
  metal: "gold",
  purity: "22KT",
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

  it("orders item columns as the template prints them: Weight, Qty., Metal/Purity", () => {
    const html = buildBillHtml(data({ items: [item({ qty: 2 })] }));
    const head = html.slice(html.indexOf('<table class="items">'), html.indexOf("</thead>"));
    expect(head.indexOf("Weight")).toBeLessThan(head.indexOf("Qty."));
    expect(head.indexOf("Qty.")).toBeLessThan(head.indexOf("Metal/Purity"));
    const row = html.slice(html.indexOf("<tbody>"), html.indexOf("</tbody>"));
    expect(row.indexOf("3.500 ग्राम")).toBeLessThan(row.indexOf(">2<"));
    expect(row.indexOf(">2<")).toBeLessThan(row.indexOf("Gold / 22KT"));
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

    it("renders पिछला बाकी after बाकी and कुल बाकी at bottom when showTotalBaki is enabled", () => {
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

      // Order: कुल राशि → जमा → बाकी → पिछला बाकी → कुल बाकी
      const kulRashiIndex = html.indexOf("कुल राशि");
      const jamaIndex = html.indexOf("जमा (");
      const bakiIndex = html.indexOf(">बाकी<");
      const pichlaIndex = html.indexOf("पिछला बाकी");
      const kulBakiIndex = html.indexOf("कुल बाकी");
      expect(kulRashiIndex).toBeLessThan(jamaIndex);
      expect(jamaIndex).toBeLessThan(bakiIndex);
      expect(bakiIndex).toBeLessThan(pichlaIndex);
      expect(pichlaIndex).toBeLessThan(kulBakiIndex);
    });
  });

  it("shows old jewellery only as a summary credit, not as an itemised table", () => {
    const html = buildBillHtml(
      data({
        amount: 50750,
        oldJewelleryItems: [
          oldJewelleryItem(),
          oldJewelleryItem({
            id: 2,
            position: 2,
            description: "Old silver anklet",
            metal: "silver",
            purity: "Desi",
            weight: null,
            value: 4500,
          }),
        ],
      }),
    );

    expect(html).not.toContain("old-jewellery");
    expect(html).not.toContain("Old gold ring");
    expect(html).not.toContain("Old silver anklet");
    expect(html).toContain("कुल राशि");
    expect(html).toContain("-18,000/-");
    expect(html).toContain("-4,500/-");
    expect(html).toContain("कुल देय राशि");
    expect(html).toContain("28,250/-");
  });

  describe("old jewellery summary lines", () => {
    const items = [
      oldJewelleryItem({ id: 1, position: 1, metal: "gold", value: 18000 }),
      oldJewelleryItem({ id: 2, position: 2, metal: "silver", value: 4500 }),
      oldJewelleryItem({ id: 3, position: 3, metal: "gold", value: 12000 }),
      oldJewelleryItem({ id: 4, position: 4, metal: null, purity: null, value: 1000 }),
    ];
    const row = (label: string, value: string) =>
      `<td class="sl">${label}</td><td class="sv">${value}</td>`;

    it("totals old gold and old silver on separate lines, gold first", () => {
      const html = buildBillHtml(data({ amount: 100000, oldJewelleryItems: items }));
      expect(html).toContain(row("पुराना सोना", "-30,000/-"));
      expect(html).toContain(row("पुरानी चाँदी", "-4,500/-"));
      expect(html).toContain(row("पुराना (अन्य)", "-1,000/-"));
      expect(html).not.toContain("पुराना दाम");
      expect(html.indexOf("पुराना सोना")).toBeLessThan(html.indexOf("पुरानी चाँदी"));
      expect(html.indexOf("पुरानी चाँदी")).toBeLessThan(html.indexOf("पुराना (अन्य)"));
      expect(html).toContain(row("कुल देय राशि", "64,500/-"));
    });

    it("uses the same lines when payment details are shown", () => {
      const html = buildBillHtml(
        data({ amount: 100000, oldJewelleryItems: items, showPaymentDetails: true, baki: 64500 }),
      );
      expect(html).toContain(row("पुराना सोना", "-30,000/-"));
      expect(html).toContain(row("पुरानी चाँदी", "-4,500/-"));
      expect(html).toContain(row("बाकी", "64,500/-"));
    });

    it("leaves out a metal with no old items", () => {
      const html = buildBillHtml(
        data({ amount: 100000, oldJewelleryItems: [oldJewelleryItem({ metal: "gold", value: 18000 })] }),
      );
      expect(html).toContain(row("पुराना सोना", "-18,000/-"));
      expect(html).not.toContain("पुरानी चाँदी");
      expect(html).not.toContain("पुराना (अन्य)");
    });
  });

  it("puts the payable amount into words with Rupees in words prefix", () => {
    const html = buildBillHtml(data());
    expect(html).toContain("Rupees in words :");
    expect(html).toContain("पचास हजार सात सौ पचास रुपये मात्र");
  });

  it("words the baki, not the gross, when payment details are shown", () => {
    const html = buildBillHtml(
      data({
        showPaymentDetails: true,
        discount: 650,
        jamaEntries: [{ amount: 50000, date: "2026-08-27T00:00:00.000Z" }],
      }),
    );
    expect(html).toContain("एक सौ रुपये मात्र");
    expect(html).not.toContain("पचास हजार सात सौ पचास रुपये मात्र");
  });

  it("words the कुल बाकी figure when the total baki row is shown", () => {
    const html = buildBillHtml(
      data({
        showPaymentDetails: true,
        showTotalBaki: true,
        discount: 650,
        pichlaBaki: 25000,
        jamaEntries: [{ amount: 50000, date: "2026-08-27T00:00:00.000Z" }],
      }),
    );
    expect(html).toContain("25,100/-");
    expect(html).toContain("पच्चीस हजार एक सौ रुपये मात्र");
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

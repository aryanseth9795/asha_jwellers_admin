import { buildBillHtml, BillData } from "../../src/services/BillHtmlService";
import { CONT_STRIP_MM, HEADER_MAX_MM, HEADER_MIN_MM, MORE_STRIP_MM } from "../../src/services/bill/geometry";
import { BillLayoutPlan } from "../../src/services/bill/layoutPlan";
import { LendenItem, OldJewelleryItem } from "../../src/types/entry";

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
          jamaEntries: [{ amount: 50000, date: "2026-08-27" }],
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
          jamaEntries: [{ amount: 10000, date: "2026-08-27" }],
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

  it("prints the invoice date and each jama date of plain stored days as that same day", () => {
    const html = buildBillHtml(
      data({
        date: "2026-09-15",
        showPaymentDetails: true,
        jamaEntries: [{ amount: 10000, date: "2026-09-01" }],
      }),
    );
    expect(html).toContain("15/09/2026");
    expect(html).toContain("जमा (01/09/2026)");
  });

  it("does not print the amount in words", () => {
    const html = buildBillHtml(data({ showPaymentDetails: true, showTotalBaki: true, pichlaBaki: 25000 }));
    expect(html).not.toContain("Rupees in words");
    expect(html).not.toContain("रुपये मात्र");
  });

  it("shows कुल बाकी as the last bold figure when the total baki row is on", () => {
    const html = buildBillHtml(
      data({
        showPaymentDetails: true,
        showTotalBaki: true,
        discount: 650,
        pichlaBaki: 25000,
        jamaEntries: [{ amount: 50000, date: "2026-08-27" }],
      }),
    );
    expect(html).toContain("25,100/-");
  });

  describe("single-page layout plan", () => {
    const headerHeight = (html: string) => Number(/\.band-header \{\s*height: ([\d.]+)mm/.exec(html)?.[1]);
    const plan = (over: Partial<{ density: "normal" | "compact"; headerMm: number; fillerMm: number }> = {}): BillLayoutPlan => ({
      kind: "single",
      density: "normal",
      headerMm: 80,
      fillerMm: 0,
      ...over,
    });

    it("prints the header band at the planned height and scales the artwork to that height", () => {
      const html = buildBillHtml(data(), plan({ headerMm: 80 }));
      expect(headerHeight(html)).toBe(80);
      expect(html).toContain("background-size: 100% 236.967%");
    });

    it("lets the header give way, down to its floor, if the content is a little taller than measured", () => {
      const rule = /\.band-header \{[^}]*\}/.exec(buildBillHtml(data(), plan()))?.[0] ?? "";
      expect(rule).toContain("flex: 0 1 auto");
      expect(rule).toContain(`min-height: ${HEADER_MIN_MM.toFixed(2)}mm`);
    });

    it("keeps the header at its natural size for a one-item bill when no plan is given", () => {
      expect(headerHeight(buildBillHtml(data()))).toBeCloseTo(HEADER_MAX_MM, 1);
    });

    it("rules the spare space as an empty table row with every column line", () => {
      const html = buildBillHtml(data(), plan({ fillerMm: 31 }));
      const row = /<tr class="filler"[^>]*>([\s\S]*?)<\/tr>/.exec(html);
      expect(row?.[0]).toContain("height:31.00mm");
      expect(row?.[1].match(/<td/g)).toHaveLength(6);
    });

    it("leaves the filler row out when the plan has no spare space", () => {
      expect(buildBillHtml(data(), plan({ fillerMm: 0 }))).not.toContain('class="filler"');
    });

    it("lays the necklace watermark faintly behind the items table, filler or not", () => {
      for (const fillerMm of [0, 31]) {
        const html = buildBillHtml(data(), plan({ fillerMm }));
        expect(html).toMatch(/<div class="items-wrap">\s*<div class="wm"><\/div>\s*<table class="items">/);
      }
    });

    it("keeps the watermark faint, behind the table's lines and text, and inside the table", () => {
      const css = buildBillHtml(data(), plan());
      const wrap = /\.items-wrap \{[^}]*\}/.exec(css)?.[0] ?? "";
      const wm = /\.items-wrap \.wm \{[^}]*\}/.exec(css)?.[0] ?? "";
      expect(wrap).toContain("position: relative");
      expect(wrap).toContain("z-index: 0");
      expect(wm).toContain("z-index: -1");
      expect(Number(/opacity: ([\d.]+)/.exec(wm)?.[1])).toBeLessThanOrEqual(0.5);
      // Sized from the table's own height, so it never spills past the table.
      expect(wm).toContain("height: 80%");
      expect(wm).toContain("aspect-ratio: 345 / 344");
    });

    it("no longer draws a second, full-strength necklace inside the filler row", () => {
      const row = /<tr class="filler"[^>]*>([\s\S]*?)<\/tr>/.exec(buildBillHtml(data(), plan({ fillerMm: 31 })));
      expect(row?.[1]).not.toContain("wm");
    });

    it("drops the milligram sub-line because the plan says compact, not because of the item count", () => {
      const two = [item(), item({ id: 2, position: 2 })];
      expect(buildBillHtml(data({ items: two }), plan({ density: "compact" }))).not.toContain("(3 ग्राम 500 मिली)");
      const six = Array.from({ length: 6 }, (_, i) => item({ id: i + 1, position: i + 1 }));
      expect(buildBillHtml(data({ items: six }), plan({ density: "normal" }))).toContain("(3 ग्राम 500 मिली)");
    });

    it("marks the density on the body so compact rows and summary tighten up", () => {
      expect(buildBillHtml(data(), plan({ density: "compact" }))).toContain('<body class="density-compact">');
      expect(buildBillHtml(data(), plan({ density: "normal" }))).toContain('<body class="density-normal">');
    });

    it("never puts a script in the bill: the Android PDF renderer runs none", () => {
      expect(buildBillHtml(data(), plan())).not.toMatch(/<script/i);
      expect(buildBillHtml(data({ showPaymentDetails: true }))).not.toMatch(/<script/i);
    });
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

    expect(html).toContain("209.50mm");
    expect(html).not.toContain("210.00mm");
    expect(html).toContain(".items tr { break-inside: avoid; page-break-inside: avoid; }");
    expect(html.split('<div class="page">').length - 1).toBeGreaterThanOrEqual(2);
    expect(html).toContain("Item 20");
    expect(html).not.toContain("overflow: hidden;");
  });

  describe("multi-page layout plan", () => {
    const named = (n: number) =>
      Array.from({ length: n }, (_, i) => item({ id: i + 1, position: i + 1, name: `Item ${i + 1}` }));
    const twoPages: BillLayoutPlan = {
      kind: "multi",
      density: "normal",
      pages: [
        { start: 0, end: 9, fillerMm: 1.5 },
        { start: 9, end: 14, fillerMm: 40 },
      ],
    };
    const pagesOf = (html: string) => html.split('<div class="page">').slice(1);
    const render = (plan = twoPages, n = 14) => buildBillHtml(data({ items: named(n) }), plan);

    it("draws each planned page as its own fixed A5 page", () => {
      expect(pagesOf(render())).toHaveLength(2);
      expect(render()).toContain("break-after: page");
    });

    it("prints the full header band and the customer box on the first page only", () => {
      const [first, second] = pagesOf(render());
      expect(first).toContain("band-header");
      expect(first).toContain("inv-frame");
      expect(second).not.toContain("band-header");
      expect(second).not.toContain("inv-frame");
      expect(Number(/\.band-header \{\s*height: ([\d.]+)mm/.exec(render())?.[1])).toBeCloseTo(HEADER_MAX_MM, 1);
    });

    it("heads later pages with a strip naming the shop, invoice, customer and page", () => {
      const second = pagesOf(render())[1];
      expect(second).toContain('class="cont"');
      expect(second).toContain("ASHA JEWELLERS");
      expect(second).toContain("Invoice No. 9267");
      expect(second).toContain("सरिता शर्मा");
      expect(second).toContain("पृष्ठ 2 / 2");
    });

    it("ends every page but the last with a continued strip", () => {
      const [first, second] = pagesOf(render());
      expect(first).toContain('class="more"');
      expect(first).toContain("पृष्ठ 1 / 2");
      expect(first).toContain("क्रमशः — पृष्ठ 2 पर जारी");
      expect(second).not.toContain('class="more"');
    });

    it("keeps the planned rows on each page, in order, with a table header on every page", () => {
      const [first, second] = pagesOf(render());
      expect(first).toContain("Item 9<");
      expect(first).not.toContain("Item 10<");
      expect(second).toContain("Item 10<");
      expect(second).toContain("Item 14<");
      expect(first).toContain("<thead>");
      expect(second).toContain("<thead>");
    });

    it("prints the totals, summary and footer only on the last page", () => {
      const [first, second] = pagesOf(render());
      for (const part of ["table-total-row", 'class="summary"', "band-footer"]) {
        expect(first).not.toContain(part);
        expect(second).toContain(part);
      }
    });

    it("rules each page's spare space as planned", () => {
      const [first, second] = pagesOf(render());
      expect(first).not.toContain('class="filler"');
      expect(second).toContain("height:40.00mm");
    });

    it("gives a middle page both strips and no footer", () => {
      const three: BillLayoutPlan = {
        kind: "multi",
        density: "normal",
        pages: [
          { start: 0, end: 9, fillerMm: 0 },
          { start: 9, end: 25, fillerMm: 0 },
          { start: 25, end: 30, fillerMm: 0 },
        ],
      };
      const middle = pagesOf(render(three, 30))[1];
      expect(middle).toContain('class="cont"');
      expect(middle).toContain("पृष्ठ 2 / 3");
      expect(middle).toContain("क्रमशः — पृष्ठ 3 पर जारी");
      expect(middle).not.toContain("band-footer");
    });

    it("sizes the strips exactly as the planner counts them", () => {
      const html = render();
      expect(/\.cont \{[^}]*height: ([\d.]+)mm/.exec(html)?.[1]).toBe(CONT_STRIP_MM.toFixed(2));
      expect(/\.more \{[^}]*height: ([\d.]+)mm/.exec(html)?.[1]).toBe(MORE_STRIP_MM.toFixed(2));
    });

    it("lays the faint watermark behind the table on every page", () => {
      for (const page of pagesOf(render())) expect(page).toContain('<div class="wm"></div>');
    });

    it("never puts a script in a multi-page bill", () => {
      expect(render()).not.toMatch(/<script/i);
    });
  });
});

import { dataQuality } from "../../../../src/utils/analytics/report/quality";
import { NOW, fixtureData } from "./fixture";

const report = dataQuality(fixtureData, NOW);
const detail = (title: string) => report.checks.find((c) => c.title === title)!.detail;

describe("dataQuality checks", () => {
  it("lists checks Fix first, then Check, Note and Good", () => {
    expect(report.checks.map((c) => [c.tag, c.title, c.badge])).toEqual([
      ["Fix", "Customer records are missing", "ID 99"],
      ["Fix", "Bill balances do not reconcile", "3 of 6"],
      ["Check", "Possible duplicate customers", "1 pair"],
      ["Check", "No new pledges logged for 8 months", "Oct 2024 – May 2025"],
      ["Check", "Few pledges have a photo", "11.1%"],
      ["Check", "Phone numbers are mostly missing", "1 of 13"],
      ["Check", "1 pledge has no amount", "ID 9"],
      ["Note", "Item names are free text", "7 item types"],
      ["Note", "Village names are grouped", "3 villages"],
      ["Good", "Dates and statuses are consistent", "0 exceptions"],
    ]);
  });

  it("explains each check with the numbers behind it", () => {
    expect(detail("Customer records are missing")).toBe(
      "1 customer ID used by pledges or bills is not in the customer file. It covers 1 pledge (₹1,000) and 1 bill with ₹42,500 still due. Restore the customer before chasing the dues.",
    );
    expect(detail("Bill balances do not reconcile")).toBe(
      "3 of 6 bills have a received (jama) amount that is blank or different from net minus balance. Jama adds up to ₹60,500; the balance fields imply ₹78,700 collected. Choose one field as the source of truth.",
    );
    expect(detail("Possible duplicate customers")).toBe(
      "1 name and village combination appears on more than one customer ID, for example Ram (IDs 1 and 12, Manwal).",
    );
    expect(detail("Few pledges have a photo")).toBe("1 of 9 pledges and 1 of 6 bills have a photo. ₹78,000 of the open book has none.");
    expect(detail("1 pledge has no amount")).toBe("ID 9 (Payal) is counted as ₹0, which slightly understates principal.");
    expect(detail("Item names are free text")).toBe(
      "9 pledge names were grouped into 7 item types by keyword. 1 fell to Other and 1 has no item name. Add a keyword to group new spellings.",
    );
    expect(detail("Village names are grouped")).toBe(
      "3 villages after cleaning spelling and punctuation. Villages with fewer than 5 customers are grouped as Other villages. 1 customer has no village.",
    );
  });

  it("turns a clean ledger into Good checks", () => {
    const clean = dataQuality({ ...fixtureData, rehan: [], rehanTx: [], lenden: [], jama: [] }, NOW);
    expect(clean.checks.find((c) => c.title === "Customer records are complete")?.tag).toBe("Good");
    expect(clean.checks.some((c) => c.tag === "Fix")).toBe(false);
  });
});

describe("field coverage", () => {
  it("measures how complete each field is", () => {
    expect(report.coverage.map((c) => c.label)).toEqual([
      "Pledges linked to a customer on file",
      "Pledges with an amount",
      "Pledges with an item name",
      "Pledges with a photo",
      "Customers with a village",
      "Customers with a phone number",
      "Bills with a bill number",
      "Bills where received matches balance",
      "Bills whose customer is on file",
    ]);
    const shares = report.coverage.map((c) => c.share);
    [8 / 9, 8 / 9, 8 / 9, 1 / 9, 12 / 13, 1 / 13, 4 / 6, 3 / 6, 5 / 6].forEach((v, i) => expect(shares[i]).toBeCloseTo(v));
  });
});

import { billLabel, billingSummary, buildBillRows, discountPerBill, numberedVsEarlier, waterfall } from "./billing";
import { NOW, fixtureData, iso } from "./fixture";
import { groupVillages } from "../villages";

const groups = groupVillages(fixtureData.users);
const bills = buildBillRows(fixtureData, groups, NOW);
const byId = (id: number) => bills.find((b) => b.id === id)!;
const flagLabels = (id: number) => byId(id).flags.map((f) => f.label);

describe("buildBillRows", () => {
  it("orders bills newest first", () => {
    expect(bills.map((b) => b.id)).toEqual([4, 3, 2, 1, 5, 6]);
  });

  it("derives collected and pending from the balance", () => {
    expect(byId(3)).toMatchObject({ gross: 44545, net: 44545, collected: 42500, pending: 2045, received: 42500, daysOpen: 7, village: "Kanja" });
    expect(byId(5)).toMatchObject({ net: 15500, collected: 8500, pending: 7000, received: 0, daysOpen: 268, photo: true, overridden: true });
    expect(byId(6)).toMatchObject({ net: 19500, collected: 19500, pending: 0, received: 10000, daysOpen: null });
  });

  it("flags what needs a decision", () => {
    expect(flagLabels(1)).toEqual([]);
    expect(flagLabels(2)).toEqual(["Customer not on file"]);
    expect(flagLabels(3)).toEqual([]);
    expect(flagLabels(4)).toEqual(["Received field short"]);
    expect(flagLabels(5)).toEqual(["Received field blank", "Amount overridden", "No bill number"]);
    expect(byId(5).flags.map((f) => f.severity)).toEqual(["red", "grey", "grey"]);
    expect(byId(2)).toMatchObject({ customer: "Customer #99", village: "Unknown", onFile: false });
  });

  it("labels bills by number, or by ID when unnumbered", () => {
    expect(billLabel(byId(1))).toBe("#1");
    expect(billLabel(byId(5))).toBe("ID 5");
  });
});

describe("billingSummary and waterfall", () => {
  const s = billingSummary(bills);

  it("adds up the billing ledger", () => {
    expect(s).toMatchObject({ bills: 6, withBalance: 4, gross: 142545, discount: 2800, net: 139745, collected: 78700, pending: 61045 });
    expect(s.discountPct).toBeCloseTo(2800 / 142545);
    expect(s.collectedPct).toBeCloseTo(78700 / 139745);
    expect(s.pendingOffFilePct).toBeCloseTo(42500 / 61045);
  });

  it("walks from gross to cash", () => {
    expect(waterfall(s)).toEqual([
      { label: "Gross billed", value: 142545 },
      { label: "Discount", value: 2800 },
      { label: "Net billed", value: 139745 },
      { label: "Collected", value: 78700 },
      { label: "Pending dues", value: 61045 },
    ]);
  });

  it("is zero without bills", () => {
    expect(billingSummary([])).toMatchObject({ bills: 0, discountPct: 0, collectedPct: 0, pendingOffFilePct: 0 });
  });
});

describe("discountPerBill", () => {
  it("lists discount as a share of gross, oldest bill first", () => {
    const d = discountPerBill(bills);
    expect(d.bills.map((b) => b.label)).toEqual(["ID 6", "ID 5", "#1", "#2", "#3", "#6"]);
    expect(d.bills[2].pct).toBeCloseTo(0.05);
    expect(d.weighted).toBeCloseTo(2800 / 142545);
  });
});

describe("numberedVsEarlier", () => {
  it("compares numbered bills with earlier unnumbered ones", () => {
    const { numbered, earlier } = numberedVsEarlier(bills);
    expect(numbered).toMatchObject({
      bills: 4, gross: 106245, net: 104745, avgNet: 26186.25, pending: 54045, customers: 4, withPhoto: 0,
      from: iso(2026, 9, 8), to: iso(2026, 9, 30),
    });
    expect(numbered.discountRate).toBeCloseTo(1500 / 106245);
    expect(numbered.collectedShare).toBeCloseTo(50700 / 104745);
    expect(earlier).toMatchObject({
      bills: 2, gross: 36300, net: 35000, avgNet: 17500, collectedShare: 0.8, pending: 7000, customers: 2, withPhoto: 1,
      from: iso(2025, 12, 29), to: iso(2026, 1, 7),
    });
  });
});

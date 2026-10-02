import {
  concentration, customerSegments, customersAdded, exposures, repeatCustomers, villageStats,
} from "./pledgeCustomers";
import { buildPledgeRows } from "./pledges";
import { NOW, fixtureData } from "./fixture";
import { groupVillages } from "../villages";

const groups = groupVillages(fixtureData.users);
const rows = buildPledgeRows(fixtureData, NOW, groups);

describe("villageStats", () => {
  it("ranks named villages by principal, then Other villages and Unknown", () => {
    const v = villageStats(rows, groups);
    expect(v.map((x) => x.village)).toEqual(["Manwal", "Kanja", "Other villages", "Unknown"]);
    expect(v[0]).toMatchObject({
      customersOnFile: 6, pledging: 2, pledges: 4, perCustomer: 2, principal: 23000, openPrincipal: 15000, avgTicket: 5750, redeemedPct: 0.25,
    });
    expect(v[0].openShare).toBeCloseTo(15000 / 88000);
    expect(v[3]).toMatchObject({ customersOnFile: 1, pledging: 2, pledges: 2, principal: 3000 });
  });
});

describe("concentration", () => {
  it("measures how much principal the largest customers hold", () => {
    const c = concentration(rows);
    expect(c.customers).toBe(7);
    expect(c.top10).toBeCloseTo(50000 / 99000);
    expect(c.top20).toBeCloseTo(70000 / 99000);
    expect(c.top50).toBeCloseTo(93000 / 99000);
    expect(c.tenLargest).toBeCloseTo(1);
    expect(c.curve).toHaveLength(8);
    expect(c.curve[0]).toEqual({ customerShare: 0, principalShare: 0 });
    expect(c.curve[7].principalShare).toBeCloseTo(1);
  });

  it("is zero without pledges", () => {
    expect(concentration([])).toEqual({
      customers: 0, top10: 0, top20: 0, top50: 0, tenLargest: 0, curve: [{ customerShare: 0, principalShare: 0 }],
    });
  });

  it("rounds the top shares up exactly, without floating-point drift", () => {
    const base = rows[0];
    const equal = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ ...base, id: i + 1, userId: i + 1, principal: 1000 }));
    expect(concentration(equal(30)).top10).toBeCloseTo(3 / 30);
    expect(concentration(equal(30)).top20).toBeCloseTo(6 / 30);
    expect(concentration(equal(35)).top20).toBeCloseTo(7 / 35);
  });
});

describe("exposures", () => {
  it("lists customers by open principal", () => {
    const e = exposures(rows, fixtureData.users, 12);
    expect(e.map((x) => x.userId)).toEqual([11, 3, 1, 13, 99]);
    expect(e[2]).toEqual({
      userId: 1, name: "Ram", village: "Manwal", openPrincipal: 15000, openPledges: 3, oldestOpenDays: 761, redeemed: 0, totalPledges: 3,
    });
    expect(e[4]).toMatchObject({ name: "Customer #99", village: "Unknown" });
    expect(exposures(rows, fixtureData.users, 2)).toHaveLength(2);
  });
});

describe("repeatCustomers", () => {
  it("groups customers by how many pledges they made", () => {
    const r = repeatCustomers(rows);
    expect(r.map((b) => [b.label, b.customers, b.principal])).toEqual([
      ["1 pledge", 6, 84000], ["2", 0, 0], ["3", 1, 15000], ["4–6", 0, 0], ["7 or more", 0, 0],
    ]);
    expect(r[0].customerShare).toBeCloseTo(6 / 7);
    expect(r[2].principalShare).toBeCloseTo(15000 / 99000);
  });
});

describe("customersAdded", () => {
  it("counts new customers per month with a running total", () => {
    const a = customersAdded(fixtureData.users, NOW);
    expect(a).toHaveLength(11);
    expect(a[0]).toEqual({ key: "2025-12", label: "Dec 25", added: 1, total: 1 });
    expect(a[1]).toMatchObject({ label: "Jan 26", added: 10, total: 11 });
    expect(a[10]).toMatchObject({ label: "Oct 26", added: 0, total: 13 });
    expect(customersAdded([], NOW)).toEqual([]);
  });
});

describe("customerSegments", () => {
  it("splits customers by what they do with the shop", () => {
    expect(customerSegments(fixtureData, rows, groups)).toEqual([
      { label: "Open pledge only", customers: 3 },
      { label: "Pledges and bills", customers: 1 },
      { label: "Redeemed pledges only", customers: 2 },
      { label: "Bills only", customers: 4 },
      { label: "No activity yet", customers: 3 },
    ]);
    expect(customerSegments(fixtureData, rows, groups, "Kanja").map((s) => s.customers)).toEqual([0, 1, 1, 3, 0]);
  });
});

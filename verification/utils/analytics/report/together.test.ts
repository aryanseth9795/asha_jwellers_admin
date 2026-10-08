import { ledgerScale, villageShares } from "../../../../src/utils/analytics/report/together";
import { buildBillRows } from "../../../../src/utils/analytics/report/billing";
import { buildPledgeRows } from "../../../../src/utils/analytics/report/pledges";
import { NOW, fixtureData } from "./fixture";
import { groupVillages } from "../../../../src/utils/analytics/villages";

const groups = groupVillages(fixtureData.users);
const pledges = buildPledgeRows(fixtureData, NOW, groups);
const bills = buildBillRows(fixtureData, groups, NOW);

describe("ledgerScale", () => {
  it("compares the pledge book with billing", () => {
    const s = ledgerScale(pledges, bills);
    expect(s).toMatchObject({ openBook: 88000, redeemedPrincipal: 11000, netBilled: 139745, pending: 61045 });
    expect(s.ratio).toBeCloseTo(88000 / 139745);
    expect(ledgerScale(pledges, []).ratio).toBeNull();
  });
});

describe("villageShares", () => {
  it("shows each village's share of each ledger", () => {
    const v = villageShares(pledges, bills, groups.order);
    expect(v.map((x) => x.village)).toEqual(["Manwal", "Kanja", "Other villages", "Unknown"]);
    expect(v[0].pledgeShare).toBeCloseTo(23000 / 99000);
    expect(v[0].billShare).toBeCloseTo(19500 / 139745);
    expect(v[1].billShare).toBeCloseTo(77745 / 139745);
    expect(v[2].billShare).toBe(0);
    expect(v[3].billShare).toBeCloseTo(42500 / 139745);
  });
});

import { ALL_PLEDGES, buildPledgeRows, filterOptions, filterPledges, hasPhoto } from "./pledges";
import { NOW, fixtureData } from "./fixture";
import { groupVillages } from "../villages";

const rows = buildPledgeRows(fixtureData, NOW);
const byId = (id: number) => rows.find((r) => r.id === id)!;
const ids = (list: { id: number }[]) => list.map((r) => r.id);

describe("hasPhoto", () => {
  it("reads only a non-empty JSON array as a photo", () => {
    expect(hasPhoto('["a.jpg"]')).toBe(true);
    expect(hasPhoto("[]")).toBe(false);
    expect(hasPhoto("")).toBe(false);
    expect(hasPhoto(null)).toBe(false);
    expect(hasPhoto("not json")).toBe(false);
  });
});

describe("buildPledgeRows", () => {
  it("enriches each pledge", () => {
    expect(byId(1)).toMatchObject({
      item: "Payal", photo: true, principal: 10000, balance: 10000, open: true,
      daysOpen: 761, daysToRedeem: null, village: "Manwal", onFile: true,
      year: "2024", month: "2024-09", weekday: 0,
    });
  });

  it("uses the amount lent, not the topped-up balance", () => {
    expect(byId(4)).toMatchObject({ principal: 20000, balance: 25000, item: "Kardhan", village: "Kanja", daysOpen: 265 });
  });

  it("measures redeemed pledges and spots bundles", () => {
    expect(byId(3)).toMatchObject({ open: false, daysOpen: null, daysToRedeem: 180, bundle: true, item: "Locket" });
  });

  it("keeps pledges whose customer is missing", () => {
    expect(byId(8)).toMatchObject({ onFile: false, village: "Unknown", item: "Other" });
    expect(byId(7)).toMatchObject({ item: "Unspecified", village: "Unknown" });
    expect(byId(6).village).toBe("Other villages");
  });
});

describe("filterPledges", () => {
  it("applies each filter", () => {
    expect(ids(filterPledges(rows, ALL_PLEDGES))).toHaveLength(9);
    expect(ids(filterPledges(rows, { ...ALL_PLEDGES, village: "Manwal" }))).toEqual([1, 2, 3, 9]);
    expect(ids(filterPledges(rows, { ...ALL_PLEDGES, item: "Chain" }))).toEqual([2, 6]);
    expect(ids(filterPledges(rows, { ...ALL_PLEDGES, year: "2025" }))).toEqual([2, 3]);
    expect(ids(filterPledges(rows, { ...ALL_PLEDGES, status: "redeemed" }))).toEqual([3, 5]);
    expect(ids(filterPledges(rows, { ...ALL_PLEDGES, status: "open" }))).toEqual([1, 2, 4, 6, 7, 8, 9]);
  });

  it("can ignore one dimension so a ranking compares against the rest", () => {
    const f = { ...ALL_PLEDGES, village: "Manwal", item: "Payal" };
    expect(ids(filterPledges(rows, f))).toEqual([1, 9]);
    expect(ids(filterPledges(rows, f, "village"))).toEqual([1, 9]);
    expect(ids(filterPledges(rows, f, "item"))).toEqual([1, 2, 3, 9]);
  });

  it("returns nothing, not an error, for an empty selection", () => {
    expect(filterPledges(rows, { ...ALL_PLEDGES, village: "Nowhere" })).toEqual([]);
  });
});

describe("filterOptions", () => {
  it("lists villages, items by principal and years", () => {
    expect(filterOptions(rows, groupVillages(fixtureData.users))).toEqual({
      villages: ["Manwal", "Kanja", "Other villages", "Unknown"],
      items: ["Chain", "Kardhan", "Payal", "Locket", "Tika", "Unspecified", "Other"],
      years: ["2024", "2025", "2026"],
    });
  });

  it("leaves out villages that have no pledges", () => {
    const only = rows.filter((r) => r.village === "Manwal");
    expect(filterOptions(only, groupVillages(fixtureData.users)).villages).toEqual(["Manwal"]);
  });
});

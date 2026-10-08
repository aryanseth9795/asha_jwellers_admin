import { buildVillageView, groupVillages, villageKey, villageLabel, villageName } from "../../../src/utils/analytics/villages";
import { fixtureData } from "./report/fixture";
import { fyPeriod } from "../../../src/utils/analytics/periods";
import { AnalyticsData, LendenRow } from "../../../src/utils/analytics/types";

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const empty: AnalyticsData = {
  users: [], lenden: [], jama: [], rehan: [], rehanTx: [], soldItems: [], oldItems: [],
};
let nextId = 1;
const bill = (userId: number, date: string, amount: number, o: Partial<LendenRow> = {}): LendenRow => ({
  id: nextId++, userId, date, amount, discount: null, jama: null, baki: 0, status: 1, ...o,
});

describe("village names", () => {
  it("uses the text before the first comma, ignoring case and spacing", () => {
    expect(villageKey("Ramdaspur, Jaunpur")).toBe("ramdaspur");
    expect(villageKey("  ramdaspur  ,Jaunpur")).toBe("ramdaspur");
    expect(villageKey("Malhani   road")).toBe("malhani road");
    expect(villageKey(null)).toBe("");
    expect(villageKey(undefined)).toBe("");
    expect(villageLabel("Ramdaspur, Jaunpur")).toBe("Ramdaspur");
    expect(villageLabel("  ")).toBe("No address");
  });
});

describe("buildVillageView", () => {
  const data: AnalyticsData = {
    ...empty,
    users: [
      { id: 1, name: "A", address: "Ramdaspur, Jaunpur" },
      { id: 2, name: "B", address: "ramdaspur  ,Jaunpur" },
      { id: 3, name: "C", address: "Malhani" },
      { id: 4, name: "D", address: null },
      { id: 5, name: "E", address: "  Malhani road" },
    ],
    lenden: [
      bill(1, iso(2026, 5, 1), 100000, { baki: 20000, status: 0 }),
      bill(2, iso(2026, 6, 1), 50000),
      bill(3, iso(2026, 5, 1), 30000),
      bill(3, iso(2025, 5, 1), 10000),
      bill(4, iso(2026, 7, 1), 5000),
      bill(1, iso(2025, 5, 1), 40000),
    ],
  };
  const view = buildVillageView(data, fyPeriod(2026), fyPeriod(2025));

  it("ranks villages by sales and keeps villages without sales", () => {
    expect(view.map((v) => v.name)).toEqual(["Ramdaspur", "Malhani", "No address", "Malhani road"]);
  });

  it("counts customers, buyers, sales, share, open baaki and growth", () => {
    expect(view[0]).toMatchObject({
      key: "ramdaspur", customers: 2, buyers: 2, sales: 150000, openBaaki: 20000,
    });
    expect(view[0].share).toBeCloseTo(150000 / 185000);
    expect(view[0].growth?.pct).toBeCloseTo(2.75);
    expect(view[1].growth?.pct).toBeCloseTo(2);
    expect(view[2]).toMatchObject({ key: "", customers: 1, buyers: 1, sales: 5000 });
    expect(view[2].growth?.pct).toBeNull();
    expect(view[3]).toMatchObject({ customers: 1, buyers: 0, sales: 0, share: 0 });
  });

  it("has no growth without a previous period", () => {
    expect(buildVillageView(data, fyPeriod(2026), null)[0].growth).toBeNull();
  });
});

describe("village cleaning and grouping (spec §12.5)", () => {
  it("drops punctuation", () => {
    expect(villageName("Manwal .")).toBe("Manwal");
    expect(villageName("Manwal, Jaunpur")).toBe("Manwal");
    expect(villageName("Kanja-")).toBe("Kanja");
  });

  it("groups small villages and blank addresses", () => {
    const groups = groupVillages(fixtureData.users);
    expect(groups.of.get(1)).toBe("Manwal");
    expect(groups.of.get(12)).toBe("Manwal");
    expect(groups.of.get(3)).toBe("Kanja");
    expect(groups.of.get(11)).toBe("Other villages");
    expect(groups.of.get(13)).toBe("Unknown");
    expect(groups.customers.get("Manwal")).toBe(6);
    expect(groups.customers.get("Kanja")).toBe(5);
    expect(groups.order).toEqual(["Manwal", "Kanja", "Other villages", "Unknown"]);
  });
});

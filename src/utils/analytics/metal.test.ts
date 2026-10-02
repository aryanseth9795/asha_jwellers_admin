import { fyPeriod } from "./periods";
import { buildMetalView } from "./metal";
import { AnalyticsData } from "./types";

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const FY26 = fyPeriod(2026);
const empty: AnalyticsData = {
  users: [], lenden: [], jama: [], rehan: [], rehanTx: [], soldItems: [], oldItems: [],
};
const entry = (id: number, date: string) => ({
  id, userId: 1, date, amount: 0, discount: null, jama: null, baki: null, status: 1,
});

describe("buildMetalView", () => {
  const data: AnalyticsData = {
    ...empty,
    lenden: [entry(1, iso(2026, 4, 5)), entry(2, iso(2026, 5, 5)), entry(3, iso(2025, 5, 5))],
    soldItems: [
      { lendenId: 1, metal: "gold", weight: 10.1, total: 70000 },
      { lendenId: 1, metal: "gold", weight: 0.2, total: 1400 },
      { lendenId: 2, metal: "silver", weight: 250, total: 25000 },
      { lendenId: 2, metal: "Silver", weight: 5, total: 500 }, // unexpected value
      { lendenId: 2, metal: null, weight: null, total: 300 },
      { lendenId: 3, metal: "gold", weight: 99, total: 999999 }, // previous FY
    ],
    oldItems: [
      { lendenId: 1, metal: "gold", weight: 4, value: 20000 },
      { lendenId: 2, metal: null, weight: 2, value: 1000 },
    ],
  };
  const view = buildMetalView(data, FY26);

  it("totals sold weight and value per metal within the FY", () => {
    expect(view.sold.gold).toEqual({ weight: 10.3, value: 71400 });
    expect(view.sold.silver).toEqual({ weight: 250, value: 25000 });
  });

  it("keeps null and unexpected metal values out of gold and silver", () => {
    expect(view.sold.unknown).toEqual({ weight: 5, value: 800 });
    expect(view.received.unknown).toEqual({ weight: 2, value: 1000 });
    expect(view.received.gold).toEqual({ weight: 4, value: 20000 });
  });

  it("builds monthly weight series per metal", () => {
    expect(view.soldGold[0]).toBe(10.3); // Apr
    expect(view.soldSilver[1]).toBe(250); // May
    expect(view.receivedGold[0]).toBe(4);
  });

  it("returns zeros with no data", () => {
    const blank = buildMetalView(empty, FY26);
    expect(blank.sold.gold).toEqual({ weight: 0, value: 0 });
    expect(blank.soldGold.every((v: number) => v === 0)).toBe(true);
  });
});

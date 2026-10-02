import {
  OldJewelleryRegisterRow,
  filterRegister,
  summarizeRegister,
} from "./oldJewelleryRegister";

const row = (
  overrides: Partial<OldJewelleryRegisterRow>,
): OldJewelleryRegisterRow => ({
  id: 1,
  lendenId: 1,
  position: 1,
  description: "old chain",
  metal: "gold",
  purity: "22KT",
  weight: 10,
  value: 50000,
  date: "2026-09-15T10:00:00.000Z",
  billNo: 1,
  userId: 1,
  userName: "Ram",
  ...overrides,
});

const NOW = new Date(2026, 9, 2); // 2 Oct 2026, local time

describe("summarizeRegister", () => {
  it("totals gold, silver and untracked metal separately", () => {
    const summary = summarizeRegister([
      row({ metal: "gold", weight: 10, value: 50000 }),
      row({ metal: "gold", weight: 2.5, value: 12000 }),
      row({ metal: "silver", weight: 100, value: 8000 }),
      row({ metal: null, weight: 4, value: 1000 }),
    ]);

    expect(summary.gold).toEqual({ count: 2, weight: 12.5, value: 62000 });
    expect(summary.silver).toEqual({ count: 1, weight: 100, value: 8000 });
    expect(summary.unknown).toEqual({ count: 1, weight: 4, value: 1000 });
    expect(summary.total).toEqual({ count: 4, weight: 116.5, value: 71000 });
  });

  it("counts items without a weight but adds nothing to the weight", () => {
    const summary = summarizeRegister([row({ weight: null, value: 3000 })]);
    expect(summary.gold).toEqual({ count: 1, weight: 0, value: 3000 });
  });

  it("does not drift on fractional gram sums", () => {
    const summary = summarizeRegister([
      row({ weight: 0.1 }),
      row({ weight: 0.2 }),
    ]);
    expect(summary.gold.weight).toBe(0.3);
  });

  it("returns zeroes for an empty register", () => {
    const empty = { count: 0, weight: 0, value: 0 };
    expect(summarizeRegister([])).toEqual({
      gold: empty,
      silver: empty,
      unknown: empty,
      total: empty,
    });
  });
});

describe("filterRegister", () => {
  const rows = [
    row({ id: 1, metal: "gold", date: new Date(2026, 9, 1).toISOString() }),
    row({ id: 2, metal: "silver", date: new Date(2026, 8, 30).toISOString() }),
    row({ id: 3, metal: null, date: new Date(2026, 0, 1).toISOString() }),
    row({ id: 4, metal: "gold", date: new Date(2025, 11, 31).toISOString() }),
  ];
  const ids = (result: OldJewelleryRegisterRow[]) => result.map((r) => r.id);

  it("keeps everything for all metals and all time", () => {
    expect(ids(filterRegister(rows, { metal: "all", period: "all" }, NOW))).toEqual(
      [1, 2, 3, 4],
    );
  });

  it("filters by metal, excluding untracked items", () => {
    expect(ids(filterRegister(rows, { metal: "gold", period: "all" }, NOW))).toEqual([
      1, 4,
    ]);
    expect(
      ids(filterRegister(rows, { metal: "silver", period: "all" }, NOW)),
    ).toEqual([2]);
  });

  it("limits to the current calendar month", () => {
    expect(ids(filterRegister(rows, { metal: "all", period: "month" }, NOW))).toEqual(
      [1],
    );
  });

  it("limits to the current calendar year", () => {
    expect(ids(filterRegister(rows, { metal: "all", period: "year" }, NOW))).toEqual([
      1, 2, 3,
    ]);
  });
});

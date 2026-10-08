import { change } from "../../../src/utils/analytics/compare";

describe("change", () => {
  it("gives delta and percent against the previous value", () => {
    expect(change(120, 100)).toEqual({ current: 120, previous: 100, delta: 20, pct: 0.2 });
    expect(change(80, 100).pct).toBeCloseTo(-0.2);
    expect(change(-50, -100).pct).toBeCloseTo(0.5);
  });

  it("has no percent when the previous value is zero", () => {
    expect(change(5, 0)).toEqual({ current: 5, previous: 0, delta: 5, pct: null });
    expect(change(0, 0).pct).toBeNull();
  });
});

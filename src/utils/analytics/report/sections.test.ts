import { DEFAULT_VIEW, FIRST_VIEWS, SECTIONS, controlsFor, sectionOf } from "./sections";

const views = SECTIONS.flatMap((s) => s.subTabs.map((t) => t.key));

describe("Analytics sections (UI revamp spec §5)", () => {
  it("has the four sections from the owner's diagram, in order", () => {
    expect(SECTIONS.map((s) => s.label)).toEqual(["Overview", "Customer", "Rehan", "Lenden"]);
  });
  it("lists each section's sub-tabs in order", () => {
    expect(SECTIONS.map((s) => s.subTabs.map((t) => t.label))).toEqual([
      ["Findings", "Together", "Data quality"],
      ["Rehan", "Lenden"],
      ["Book", "Items"],
      ["Summary", "Sales", "Metal", "Trends"],
    ]);
  });
  it("shows each of the 11 former views exactly once", () => {
    expect(views).toHaveLength(11);
    expect(new Set(views).size).toBe(11);
  });
  it("uses pledge filters on pledge views, the time frame on billing views and nothing on data quality", () => {
    expect(Object.fromEntries(views.map((v) => [v, controlsFor(v)]))).toEqual({
      "overview/findings": "pledge",
      "overview/together": "pledge",
      "overview/quality": "none",
      "customer/rehan": "pledge",
      "customer/lenden": "timeframe",
      "rehan/book": "pledge",
      "rehan/items": "pledge",
      "lenden/summary": "timeframe",
      "lenden/sales": "timeframe",
      "lenden/metal": "timeframe",
      "lenden/trends": "timeframe",
    });
  });
  it("keeps every sub-tab inside its own section", () => {
    for (const s of SECTIONS) for (const t of s.subTabs) expect(sectionOf(t.key)).toBe(s.key);
  });
  it("opens on Overview → Findings and each section on its first sub-tab", () => {
    expect(DEFAULT_VIEW).toBe("overview/findings");
    expect(FIRST_VIEWS).toEqual({
      overview: "overview/findings",
      customer: "customer/rehan",
      rehan: "rehan/book",
      lenden: "lenden/summary",
    });
  });
});

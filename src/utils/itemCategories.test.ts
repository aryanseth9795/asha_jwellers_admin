import { ITEM_TYPES } from "./analytics/report/items";
import { BASE_CATEGORIES, OTHER_CATEGORY, categoryOptions, resolveCategory } from "./itemCategories";

const times = (s: string, n: number): string[] => Array(n).fill(s);

describe("BASE_CATEGORIES", () => {
  it("is the 28 item types in rule order, then Other", () => {
    expect(ITEM_TYPES).toHaveLength(28);
    expect(BASE_CATEGORIES).toEqual([...ITEM_TYPES, "Other"]);
    expect(BASE_CATEGORIES[0]).toBe("Payal");
    expect(BASE_CATEGORIES[BASE_CATEGORIES.length - 1]).toBe(OTHER_CATEGORY);
  });
});

describe("categoryOptions", () => {
  it("returns just the base list when nothing is stored", () => {
    expect(categoryOptions([])).toEqual(BASE_CATEGORIES);
    expect(categoryOptions([null, null, "", "  "])).toEqual(BASE_CATEGORIES);
  });

  it("does not repeat base categories, whatever their case", () => {
    expect(categoryOptions(["Chain", "chain", "OTHER", "payal"])).toEqual(BASE_CATEGORIES);
  });

  it("adds custom categories after the base list, most used first", () => {
    const stored = [...times("Watch", 2), ...times("Silver coin", 5), null, "Chain"];
    expect(categoryOptions(stored)).toEqual([...BASE_CATEGORIES, "Silver coin", "Watch"]);
  });

  it("merges case variants and shows the most common spelling; ties go alphabetically", () => {
    const stored = [...times("Silver coin", 1), ...times("silver COIN", 3), "Bell", "Anklet"];
    expect(categoryOptions(stored)).toEqual([...BASE_CATEGORIES, "silver COIN", "Anklet", "Bell"]);
  });
});

describe("resolveCategory", () => {
  it("gives Other for empty or punctuation-only input", () => {
    expect(resolveCategory("")).toBe("Other");
    expect(resolveCategory("   ")).toBe("Other");
    expect(resolveCategory(" ... ")).toBe("Other");
  });

  it("maps a case-insensitive match to the canonical name", () => {
    expect(resolveCategory("payal")).toBe("Payal");
    expect(resolveCategory("  NATHIYA / nathuni ")).toBe("Nathiya / Nathuni");
    expect(resolveCategory("hath MEHNDI")).toBe("Hath mehndi");
    expect(resolveCategory("other")).toBe("Other");
  });

  it("matches a stored custom category when options are passed", () => {
    const options = categoryOptions(["Silver coin"]);
    expect(resolveCategory("SILVER  coin", options)).toBe("Silver coin");
  });

  it("trims a new category and capitalises the first letter", () => {
    expect(resolveCategory("  silver   coin ")).toBe("Silver coin");
    expect(resolveCategory("watch")).toBe("Watch");
  });
});

import { canonicalVillages, normaliseVillageForSave, resolveVillage, villageKey } from "./villageNames";

const times = (s: string, n: number): string[] => Array(n).fill(s);

describe("villageKey", () => {
  it("lower-cases, drops punctuation and collapses spaces", () => {
    expect(villageKey("Manwal .")).toBe("manwal");
    expect(villageKey("  Rampur   Kalan, ")).toBe("rampur kalan");
    expect(villageKey("...")).toBe("");
  });

  it("keeps Hindi letters and combining marks", () => {
    expect(villageKey("मनवाल।")).toBe("मनवाल");
  });
});

describe("canonicalVillages", () => {
  it("merges punctuation variants and shows the most common spelling", () => {
    const out = canonicalVillages([...times("Manwal", 72), ...times("Manwal .", 2)]);
    expect(out).toEqual([{ name: "Manwal", count: 74 }]);
  });

  it("keeps real spelling differences separate", () => {
    const out = canonicalVillages([...times("Chhoonchhe", 2), "Chhonchhe"]);
    expect(out).toEqual([
      { name: "Chhoonchhe", count: 2 },
      { name: "Chhonchhe", count: 1 },
    ]);
  });

  it("merges case and space variants", () => {
    const out = canonicalVillages(["rampur  kalan", "Rampur Kalan", "RAMPUR KALAN"]);
    expect(out).toHaveLength(1);
    expect(out[0].count).toBe(3);
  });

  it("gives a tie to the earliest seen spelling", () => {
    expect(canonicalVillages(["manwal", "Manwal"])).toEqual([{ name: "manwal", count: 2 }]);
    expect(canonicalVillages(["Manwal", "manwal"])).toEqual([{ name: "Manwal", count: 2 }]);
  });

  it("sorts by count desc then name", () => {
    const out = canonicalVillages(["B", "A", "C", "C"]);
    expect(out.map((v) => v.name)).toEqual(["C", "A", "B"]);
  });

  it("ignores null, empty and punctuation-only addresses", () => {
    expect(canonicalVillages([])).toEqual([]);
    expect(canonicalVillages([null, "", "   ", ".", "Manwal"])).toEqual([{ name: "Manwal", count: 1 }]);
  });
});

describe("resolveVillage", () => {
  const villages = [{ name: "Manwal" }, { name: "Rampur Kalan" }];

  it("returns the canonical name for an existing village", () => {
    expect(resolveVillage("manwal .", villages)).toBe("Manwal");
    expect(resolveVillage("  rampur   kalan ", villages)).toBe("Rampur Kalan");
  });

  it("tidies and capitalises a new village", () => {
    expect(resolveVillage("  new   village ", villages)).toBe("New village");
    expect(resolveVillage("Chhonchhe", villages)).toBe("Chhonchhe");
  });

  it("returns an empty string for blank input", () => {
    expect(resolveVillage("   ", villages)).toBe("");
  });
});

describe("normaliseVillageForSave", () => {
  const villages = [{ name: "Manwal" }, { name: "मनवाल" }];

  it("resolves a raw spelling to the canonical village", () => {
    expect(normaliseVillageForSave("manwal .", villages)).toBe("Manwal");
  });

  it("resolves a Hindi village", () => {
    expect(normaliseVillageForSave(" मनवाल। ", villages)).toBe("मनवाल");
  });

  it("returns null for empty or punctuation-only input", () => {
    expect(normaliseVillageForSave("", villages)).toBeNull();
    expect(normaliseVillageForSave("   ", villages)).toBeNull();
    expect(normaliseVillageForSave(".", villages)).toBeNull();
  });

  it("tidies a new village", () => {
    expect(normaliseVillageForSave("  new   place ", villages)).toBe("New place");
  });
});

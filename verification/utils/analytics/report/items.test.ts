import { isBundle, itemTypeOf, itemTypesIn } from "../../../../src/utils/analytics/report/items";

describe("itemTypeOf", () => {
  it("takes the first recognised item word", () => {
    expect(itemTypeOf("Hk Payal")).toBe("Payal");
    expect(itemTypeOf("Krdhn hath mehndi")).toBe("Kardhan");
    expect(itemTypeOf("Top locket")).toBe("Tops");
    expect(itemTypeOf("Nthiya sahara")).toBe("Nathiya / Nathuni");
    expect(itemTypeOf("B kada  dana")).toBe("Kada");
    expect(itemTypeOf("Chabhi mala")).toBe("Guchha");
    expect(itemTypeOf("Har")).toBe("Haar");
    expect(itemTypeOf("Baal choti")).toBe("Bal choti");
  });

  it("uses Other for unrecognised names and Unspecified for blank or numbers", () => {
    expect(itemTypeOf("1 lar")).toBe("Other");
    expect(itemTypeOf("मांगटीका")).toBe("Other");
    expect(itemTypeOf("3.800")).toBe("Unspecified");
    expect(itemTypeOf("")).toBe("Unspecified");
    expect(itemTypeOf(null)).toBe("Unspecified");
    expect(itemTypeOf(undefined)).toBe("Unspecified");
  });
});

describe("bundles", () => {
  it("lists each item type once, in order", () => {
    expect(itemTypesIn("Locket half kardhan")).toEqual(["Locket", "Kardhan"]);
    expect(itemTypesIn("Payal payal")).toEqual(["Payal"]);
  });

  it("is a bundle when two or more item types are named", () => {
    expect(isBundle("Locket payal")).toBe(true);
    expect(isBundle("Jhala payal")).toBe(true);
    expect(isBundle("Payal 48 gm")).toBe(false);
    expect(isBundle(null)).toBe(false);
  });
});

import { fnv1a } from "../../src/backup/checksum";

describe("fnv1a", () => {
  it("matches the published FNV-1a 32-bit vectors", () => {
    expect(fnv1a("")).toBe("811c9dc5");
    expect(fnv1a("a")).toBe("e40c292c");
    expect(fnv1a("foobar")).toBe("bf9cf968");
  });

  it("gives a stable 8-hex result for Hindi text", () => {
    const text = "आशा ज्वेलर्स - रेहन";
    const first = fnv1a(text);
    expect(first).toMatch(/^[0-9a-f]{8}$/);
    expect(fnv1a(text)).toBe(first);
    expect(fnv1a(text + " ")).not.toBe(first);
  });
});

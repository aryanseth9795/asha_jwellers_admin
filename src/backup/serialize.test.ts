import { fnv1a } from "./checksum";
import { BACKUP_FORMAT, BACKUP_VERSION, DATA_FILES, LocalSnapshot, TABLE_KEYS } from "./format";
import { serializeSnapshot } from "./serialize";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const T = "2026-10-01T10:00:00.000Z";

const snapshot = (): LocalSnapshot => ({
  customers: [
    { id: 1, uuid: U(1), name: "Ram", address: "Main road", mobileNumber: "9999", nickname: null, createdAt: T, updatedAt: T },
    { id: 2, uuid: U(2), name: "Sita", address: null, mobileNumber: null, nickname: "S", createdAt: T, updatedAt: T },
  ],
  rehan: [
    {
      id: 10, uuid: U(10), userId: 1, productName: "Chain", category: "Chain", amount: 5000, status: 1, openDate: T, closedDate: null,
      media: ["/data/photos/a.jpg", "/data/photos/gone.jpg", "C:\\photos\\b.png"], updatedAt: T,
    },
    {
      id: 11, uuid: U(11), userId: 999, productName: "Ring", category: null, amount: 100, status: 1, openDate: T, closedDate: null,
      media: [], updatedAt: T,
    },
  ],
  rehanTransactions: [{ id: 20, uuid: U(20), rehanId: 10, type: "diya", amount: 500, date: T, updatedAt: T }],
  lenden: [
    {
      id: 30, uuid: U(30), userId: 2, date: T, amount: 9000, discount: 0, remaining: 4000, jama: 5000, baki: 4000,
      status: 1, billNo: 7, amountOverridden: null, media: ["/data/photos/bill.jpg"], updatedAt: T,
    },
  ],
  lendenItems: [
    { id: 40, uuid: U(40), lendenId: 30, position: 0, name: "Ring", category: "Ring", metal: "gold", purity: "22k", weight: 5.5, qty: 1, rate: 6000, total: 9000, updatedAt: T },
  ],
  oldJewellery: [
    { id: 50, uuid: U(50), lendenId: 30, position: 0, description: "Old bangle", metal: "silver", purity: null, weight: 20, value: 300, updatedAt: T },
  ],
  jamaEntries: [
    { id: 60, uuid: U(60), lendenId: 30, amount: 5000, date: T, updatedAt: T },
    { id: 61, uuid: U(61), lendenId: 999, amount: 1, date: T, updatedAt: T },
  ],
});

const exists = (p: string) => p !== "/data/photos/gone.jpg";

describe("serializeSnapshot", () => {
  const result = serializeSnapshot(snapshot(), { createdAt: T, mediaExists: exists });
  const rows = (k: keyof typeof DATA_FILES) => JSON.parse(result.files[DATA_FILES[k]]);

  it("writes a file for every table, with numeric ids dropped", () => {
    expect(Object.keys(result.files).sort()).toEqual(TABLE_KEYS.map((k) => DATA_FILES[k]).sort());
    expect(rows("customers")[0]).toEqual({
      uuid: U(1), name: "Ram", address: "Main road", mobileNumber: "9999", nickname: null, createdAt: T, updatedAt: T,
    });
    expect(rows("customers")).toHaveLength(2);
    expect(JSON.stringify(result.files)).not.toContain('"id"');
  });

  it("uses a null customerUuid when no customer has the id", () => {
    expect(rows("rehan")).toEqual([
      {
        uuid: U(10), customerUuid: U(1), productName: "Chain", category: "Chain", amount: 5000, status: 1, openDate: T, closedDate: null,
        media: [`media/${U(10)}/1-a.jpg`, `media/${U(10)}/2-b.png`], updatedAt: T,
      },
      {
        uuid: U(11), customerUuid: null, productName: "Ring", category: null, amount: 100, status: 1, openDate: T, closedDate: null,
        media: [], updatedAt: T,
      },
    ]);
  });

  it("maps children to parent uuids and leaves out orphans with a warning", () => {
    expect(rows("rehanTransactions")).toEqual([
      { uuid: U(20), rehanUuid: U(10), type: "diya", amount: 500, date: T, updatedAt: T },
    ]);
    expect(rows("lenden")[0]).toMatchObject({ uuid: U(30), customerUuid: U(2), billNo: 7, media: [`media/${U(30)}/1-bill.jpg`] });
    expect(rows("lendenItems")[0]).toMatchObject({ uuid: U(40), lendenUuid: U(30), name: "Ring", category: "Ring", total: 9000 });
    expect(rows("oldJewellery")[0]).toMatchObject({ uuid: U(50), lendenUuid: U(30), description: "Old bangle" });
    expect(rows("jamaEntries")).toEqual([{ uuid: U(60), lendenUuid: U(30), amount: 5000, date: T, updatedAt: T }]);
    expect(result.manifest.warnings).toContain("1 jama_entries rows had no parent record and were left out");
  });

  it("carries category on rehan and bill items, null included", () => {
    expect(rows("rehan").map((r: { category: string | null }) => r.category)).toEqual(["Chain", null]);
    expect(rows("lendenItems").map((i: { category: string | null }) => i.category)).toEqual(["Ring"]);
  });

  it("strips ?query and #hash from photo base names", () => {
    const s = snapshot();
    s.rehan[0].media = ["file:///data/photos/c.jpg?t=123/4", "/data/photos/d.jpg#frag", "/data/photos/e.jpg?x=1#y"];
    const r = serializeSnapshot(s, { createdAt: T, mediaExists: () => true });
    expect(r.mediaCopies.slice(0, 3).map((m) => m.to)).toEqual([
      `media/${U(10)}/1-c.jpg`,
      `media/${U(10)}/2-d.jpg`,
      `media/${U(10)}/3-e.jpg`,
    ]);
    // the copy still reads the original path
    expect(r.mediaCopies[0].from).toBe("file:///data/photos/c.jpg?t=123/4");
  });

  it("lists photos for copying and counts missing ones", () => {
    expect(result.mediaCopies).toEqual([
      { from: "/data/photos/a.jpg", to: `media/${U(10)}/1-a.jpg` },
      { from: "C:\\photos\\b.png", to: `media/${U(10)}/2-b.png` },
      { from: "/data/photos/bill.jpg", to: `media/${U(30)}/1-bill.jpg` },
    ]);
    expect(result.manifest.media).toEqual({ count: 3, missing: 1 });
    expect(result.manifest.warnings).toContain("1 photos listed on records were not found on the phone and were left out");
    expect(result.manifest.warnings).toHaveLength(2);
  });

  it("records counts and checksums of the exact file text", () => {
    expect(result.manifest.format).toBe(BACKUP_FORMAT);
    expect(result.manifest.version).toBe(BACKUP_VERSION);
    expect(result.manifest.createdAt).toBe(T);
    const counts: Record<string, number> = {
      customers: 2, rehan: 2, rehanTransactions: 1, lenden: 1, lendenItems: 1, oldJewellery: 1, jamaEntries: 1,
    };
    for (const k of TABLE_KEYS) {
      const path = DATA_FILES[k];
      expect(result.manifest.files[path]).toEqual({ count: counts[k], checksum: fnv1a(result.files[path]) });
    }
    expect(Object.keys(result.manifest.files)).toHaveLength(7);
  });

  it("writes empty tables and no warnings for an empty snapshot", () => {
    const empty = serializeSnapshot(
      { customers: [], rehan: [], rehanTransactions: [], lenden: [], lendenItems: [], oldJewellery: [], jamaEntries: [] },
      { createdAt: T, mediaExists: () => true },
    );
    expect(empty.files[DATA_FILES.customers]).toBe("[]");
    expect(empty.manifest.files[DATA_FILES.customers]).toEqual({ count: 0, checksum: fnv1a("[]") });
    expect(empty.manifest.warnings).toEqual([]);
    expect(empty.manifest.media).toEqual({ count: 0, missing: 0 });
    expect(empty.mediaCopies).toEqual([]);
  });

  it("exports the calendar days exactly as stored", () => {
    const s = snapshot();
    s.rehan[0].openDate = "2026-09-15";
    s.rehan[0].closedDate = "2026-09-20";
    s.rehanTransactions[0].date = "2026-09-16";
    s.lenden[0].date = "2026-09-17";
    s.jamaEntries[0].date = "2026-09-18";
    // A timestamp not yet migrated goes out unchanged too; the import reads it as its local day.
    s.rehan[1].openDate = T;
    const r = serializeSnapshot(s, { createdAt: T, mediaExists: exists });
    const out = (k: keyof typeof DATA_FILES) => JSON.parse(r.files[DATA_FILES[k]]);
    expect(out("rehan").map((x: { openDate: string; closedDate: string | null }) => [x.openDate, x.closedDate])).toEqual([
      ["2026-09-15", "2026-09-20"],
      [T, null],
    ]);
    expect(out("rehanTransactions")[0].date).toBe("2026-09-16");
    expect(out("lenden")[0].date).toBe("2026-09-17");
    expect(out("jamaEntries")[0].date).toBe("2026-09-18");
  });

  it("drops rehan transactions and len-den items whose parent is not in the snapshot", () => {
    const s = snapshot();
    s.rehanTransactions.push({ id: 21, uuid: U(21), rehanId: 404, type: "jama", amount: 1, date: T, updatedAt: T });
    s.lendenItems.push({ ...s.lendenItems[0], id: 41, uuid: U(41), lendenId: 404 });
    const r = serializeSnapshot(s, { createdAt: T, mediaExists: exists });
    expect(JSON.parse(r.files[DATA_FILES.rehanTransactions])).toHaveLength(1);
    expect(r.manifest.warnings).toContain("1 rehan_transactions rows had no parent record and were left out");
    expect(r.manifest.warnings).toContain("1 lenden_items rows had no parent record and were left out");
  });
});

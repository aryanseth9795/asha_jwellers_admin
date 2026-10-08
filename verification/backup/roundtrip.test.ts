/**
 * Round trip of backup v2 (backup spec §6.2 and §9).
 *
 * Part 1 is pure: snapshot → serializeSnapshot → validateBackup → planMerge, and the backup rows mapped back by uuid
 * equal the snapshot field for field.
 *
 * Part 2 runs the real database layer (initDatabase, the app's own create functions, readSnapshot, applyReplace,
 * applyMerge) on node:sqlite through a small expo-sqlite stand-in. The stand-in refuses any statement sent to the
 * module-level connection while an exclusive transaction is open, so it also proves every apply statement goes through
 * the transaction object. It is skipped where node:sqlite is not available.
 */

jest.mock("expo-sqlite", () => require("../support/sqliteStandIn").createSqliteStandIn());
// The services are loaded only for their pure photo-name helpers; their native modules are never called here.
jest.mock("expo-file-system", () => ({ File: {} }));
jest.mock("expo-file-system/legacy", () => ({}));
jest.mock("expo-sharing", () => ({}));
jest.mock("react-native-zip-archive", () => ({}));

import {
  BackupData,
  LocalSnapshot,
  MergePlan,
  TABLE_KEYS,
  UUID_RE,
} from "../../src/backup/format";
import { serializeSnapshot } from "../../src/backup/serialize";
import { validateBackup } from "../../src/backup/validate";
import { planMerge } from "../../src/backup/plan";
import {
  createJamaEntry,
  createLenden,
  createRehan,
  createRehanTransaction,
  createUser,
  initDatabase,
  updateLendenBaki,
} from "../../src/database/entryDatabase";
import { replaceLendenItems, setLendenBillNo } from "../../src/database/lendenItems";
import { replaceLendenOldJewelleryItems } from "../../src/database/lendenOldJewelleryItems";
import { applyMerge, applyReplace, mediaKey, newUuids, readSnapshot } from "../../src/database/backupQueries";
import { isSafeMediaPath, photoFileName, previewWarnings } from "../../src/services/BackupImportService";
import { parseDay } from "../../src/utils/dates";
import type { SqliteStandIn } from "../support/sqliteStandIn";

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const T1 = "2026-01-01T10:00:00.000Z";
const T2 = "2026-02-01T10:00:00.000Z";
const CREATED = "2026-10-03T12:00:00.000Z";
// Calendar days (rehan.openDate/closedDate and every other date) are plain YYYY-MM-DD on the phone.
const D1 = "2026-01-01";
const D2 = "2026-02-01";

const baseName = (p: string) => p.split("/").pop() as string;

const emptySnapshot = (): LocalSnapshot => ({
  customers: [],
  rehan: [],
  rehanTransactions: [],
  lenden: [],
  lendenItems: [],
  oldJewellery: [],
  jamaEntries: [],
});

/** Every table and every field, null-able fields both set and null, orphans, photos (two with the same name). */
const fullSnapshot = (): LocalSnapshot => ({
  customers: [
    { id: 1, uuid: u(1), name: "राम कुमार", address: "Manwal", mobileNumber: "9876543210", nickname: "RK", createdAt: T1, updatedAt: T2 },
    { id: 2, uuid: u(2), name: "Shyam", address: null, mobileNumber: null, nickname: null, createdAt: T1, updatedAt: T1 },
  ],
  rehan: [
    {
      id: 5,
      uuid: u(10),
      userId: 1,
      productName: "Chain",
      category: "Chain",
      amount: 1150,
      status: 0,
      openDate: D1,
      closedDate: null,
      media: ["file:///phone/images/a.jpg", "file:///phone/images/b.jpg"],
      updatedAt: T2,
    },
    {
      id: 6,
      uuid: u(11),
      userId: 2,
      productName: null,
      category: null,
      amount: null,
      status: null,
      openDate: D1,
      closedDate: D2,
      media: [],
      updatedAt: T2,
    },
    // Orphan: the customer is not on file.
    {
      id: 7,
      uuid: u(12),
      userId: 999,
      productName: "Ring",
      category: "Ring",
      amount: 400,
      status: 1,
      openDate: D1,
      closedDate: D2,
      media: [],
      updatedAt: T1,
    },
  ],
  rehanTransactions: [
    { id: 1, uuid: u(13), rehanId: 5, type: "diya", amount: 200, date: D1, updatedAt: T1 },
    { id: 2, uuid: u(14), rehanId: 5, type: "jama", amount: 50, date: D2, updatedAt: T2 },
  ],
  lenden: [
    {
      id: 3,
      uuid: u(20),
      userId: 1,
      date: D1,
      amount: 5000,
      discount: 100,
      remaining: 4900,
      jama: 300,
      baki: 4600,
      status: 0,
      billNo: 7,
      amountOverridden: 0,
      media: ["file:///phone/other/a.jpg"],
      updatedAt: T2,
    },
    // Orphan len-den (userId 0 = customer not on file) with every null-able field null.
    {
      id: 4,
      uuid: u(21),
      userId: 0,
      date: D2,
      amount: null,
      discount: null,
      remaining: null,
      jama: null,
      baki: null,
      status: null,
      billNo: null,
      amountOverridden: null,
      media: [],
      updatedAt: T2,
    },
  ],
  lendenItems: [
    {
      id: 1,
      uuid: u(22),
      lendenId: 3,
      position: 1,
      name: "Chain",
      category: "Chain",
      metal: "gold",
      purity: "22KT",
      weight: 12.345,
      qty: 2,
      rate: 6000,
      total: 4000,
      updatedAt: T1,
    },
    {
      id: 2,
      uuid: u(23),
      lendenId: 3,
      position: 2,
      name: "",
      category: null,
      metal: null,
      purity: null,
      weight: null,
      qty: null,
      rate: null,
      total: 1000,
      updatedAt: T1,
    },
  ],
  oldJewellery: [
    { id: 1, uuid: u(24), lendenId: 3, position: 1, description: "Old ring", metal: "silver", purity: "Desi", weight: 2.5, value: 300, updatedAt: T1 },
    { id: 2, uuid: u(25), lendenId: 4, position: 1, description: "Scrap", metal: null, purity: null, weight: null, value: 50, updatedAt: T2 },
  ],
  jamaEntries: [
    { id: 1, uuid: u(26), lendenId: 3, amount: 300, date: D2, updatedAt: T2 },
    { id: 2, uuid: u(27), lendenId: 4, amount: 0, date: D2, updatedAt: T2 },
  ],
});

const validated = (snapshot: LocalSnapshot) => {
  const result = serializeSnapshot(snapshot, { createdAt: CREATED, mediaExists: () => true });
  const check = validateBackup({
    manifestText: JSON.stringify(result.manifest, null, 2),
    files: result.files,
    mediaPaths: new Set(result.mediaCopies.map((m) => m.to)),
  });
  if (!check.ok) throw new Error(`backup did not validate: ${check.errors.join("; ")}`);
  return { ...result, data: check.data };
};

describe("backup round trip (pure)", () => {
  const snapshot = fullSnapshot();
  const { manifest, mediaCopies, data } = validated(snapshot);

  it("exports every row and photo with no warnings", () => {
    expect(manifest.warnings).toEqual([]);
    expect(manifest.media).toEqual({ count: 3, missing: 0 });
    for (const k of TABLE_KEYS) expect(data[k]).toHaveLength(snapshot[k].length);
  });

  it("plans every row as new against an empty phone", () => {
    const plan = planMerge(data, emptySnapshot());
    for (const k of TABLE_KEYS) {
      expect(plan.summary[k]).toEqual({ total: data[k].length, insert: data[k].length, same: 0, conflict: 0 });
    }
    expect(plan.insert).toEqual(data);
    expect(plan.applyToBalance).toEqual([]);
    expect(plan.recomputeLenden).toEqual([]);
    expect(plan.billNoClashes).toEqual([]);
  });

  it("plans every row as already here against the phone it came from", () => {
    const plan = planMerge(data, snapshot);
    for (const k of TABLE_KEYS) {
      expect(plan.summary[k]).toEqual({ total: data[k].length, insert: 0, same: data[k].length, conflict: 0 });
      expect(plan.insert[k]).toEqual([]);
    }
    expect(plan.conflicts).toEqual([]);
    expect(plan.billNoClashes).toEqual([]);
  });

  it("maps back by uuid to the snapshot, field for field", () => {
    const customerUuid = new Map(snapshot.customers.map((c) => [c.id, c.uuid]));
    const rehanUuid = new Map(snapshot.rehan.map((r) => [r.id, r.uuid]));
    const lendenUuid = new Map(snapshot.lenden.map((l) => [l.id, l.uuid]));
    const byUuid = <T extends { uuid: string }>(rows: T[], uuid: string): T => {
      const found = rows.find((r) => r.uuid === uuid);
      if (!found) throw new Error(`missing ${uuid}`);
      return found;
    };
    /** Photos: same count and order; each restored path is the zip copy of the original file. */
    const sameMedia = (uuid: string, original: string[], restored: string[]) => {
      expect(restored).toHaveLength(original.length);
      restored.forEach((rel, i) => {
        expect(rel).toBe(`media/${uuid}/${i + 1}-${baseName(original[i])}`);
        expect(mediaCopies).toContainEqual({ from: original[i], to: rel });
      });
    };

    for (const { id, ...rest } of snapshot.customers) expect(byUuid(data.customers, rest.uuid)).toEqual(rest);
    for (const { id, userId, media, ...rest } of snapshot.rehan) {
      const row = byUuid(data.rehan, rest.uuid);
      expect(row).toEqual({ ...rest, customerUuid: customerUuid.get(userId) ?? null, media: row.media });
      sameMedia(rest.uuid, media, row.media);
    }
    for (const { id, rehanId, ...rest } of snapshot.rehanTransactions) {
      expect(byUuid(data.rehanTransactions, rest.uuid)).toEqual({ ...rest, rehanUuid: rehanUuid.get(rehanId) });
    }
    for (const { id, userId, media, ...rest } of snapshot.lenden) {
      const row = byUuid(data.lenden, rest.uuid);
      expect(row).toEqual({ ...rest, customerUuid: customerUuid.get(userId) ?? null, media: row.media });
      sameMedia(rest.uuid, media, row.media);
    }
    for (const [table, rows] of [
      ["lendenItems", snapshot.lendenItems],
      ["oldJewellery", snapshot.oldJewellery],
      ["jamaEntries", snapshot.jamaEntries],
    ] as const) {
      for (const { id, lendenId, ...rest } of rows) {
        expect(byUuid(data[table] as { uuid: string }[], rest.uuid)).toEqual({ ...rest, lendenUuid: lendenUuid.get(lendenId) });
      }
    }
    // Orphans keep "customer not on file".
    expect(byUuid(data.rehan, u(12)).customerUuid).toBeNull();
    expect(byUuid(data.lenden, u(21)).customerUuid).toBeNull();
  });
});

describe("photo file names on import", () => {
  const R = "0a1b2c3d-0000-4000-8000-00000000abcd";

  it("names a photo <recordUuid>-<n>-<name>, keeping only safe characters", () => {
    expect(photoFileName(R, 1, `media/${R}/1-IMG 2024 (1).jpg`)).toBe(`${R}-1-IMG20241.jpg`);
    expect(photoFileName(R, 2, "images/1696_abc.jpg")).toBe(`${R}-2-1696_abc.jpg`);
    expect(photoFileName(R, 1, `media/${R}/1-फोटो.jpg`)).toBe(`${R}-1-photo.jpg`);
    expect(photoFileName(R, 1, `media/${R}/1-`)).toBe(`${R}-1-photo`);
  });

  it("never lets a path escape the images folder", () => {
    for (const evil of [`media/${R}/../../../databases/x.db`, "images/..", "images/..\\..\\x", "media/a/.."]) {
      const name = photoFileName(R, 1, evil);
      expect(name).toMatch(/^[A-Za-z0-9._-]+$/);
      expect(name.startsWith(`${R}-1-`)).toBe(true);
      expect(name).not.toContain("/");
      expect(name.slice(`${R}-1-`.length)).not.toMatch(/^\.\.?$/);
    }
  });

  it("keeps the same name across export → import cycles, so re-imports reuse the file", () => {
    const first = photoFileName(R, 1, `media/${R}/1-1696_abc.jpg`);
    expect(first).toBe(`${R}-1-1696_abc.jpg`);
    // The restored file is exported again as media/<uuid>/1-<restored name>.
    expect(photoFileName(R, 1, `media/${R}/1-${first}`)).toBe(first);
  });

  it("accepts only plain paths under the expected folder", () => {
    expect(isSafeMediaPath(`media/${R}/1-a.jpg`, "media")).toBe(true);
    expect(isSafeMediaPath("images/a.jpg", "images")).toBe(true);
    expect(isSafeMediaPath("images/a.jpg", "media")).toBe(false);
    expect(isSafeMediaPath(`media/${R}/../x.jpg`, "media")).toBe(false);
    expect(isSafeMediaPath("media/./a.jpg", "media")).toBe(false);
    expect(isSafeMediaPath("/media/a.jpg", "media")).toBe(false);
    expect(isSafeMediaPath("media\\..\\a.jpg", "media")).toBe(false);
    expect(isSafeMediaPath("media//a.jpg", "media")).toBe(false);
    expect(isSafeMediaPath("media/", "media")).toBe(false);
    expect(isSafeMediaPath("file:///data/x.jpg", "images")).toBe(false);
  });
});

describe("import preview notes", () => {
  it("shows the export's own notes, less the missing-photos one, then what the check found", () => {
    expect(
      previewWarnings(
        [
          "2 lenden_items rows had no parent record and were left out",
          "3 photos listed on records were not found on the phone and were left out",
          5,
        ],
        ["1 date could not be read and was kept exactly as stored"],
      ),
    ).toEqual([
      "2 lenden_items rows had no parent record and were left out",
      "1 date could not be read and was kept exactly as stored",
    ]);
    expect(previewWarnings(undefined, [])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Part 2: the database layer on real SQLite.

const sqliteMock = jest.requireMock("expo-sqlite") as SqliteStandIn;
const describeDb = sqliteMock.__available ? describe : describe.skip;

/** Snapshot with numeric ids replaced by uuids, so two phones can be compared. Rows stay in id order. */
const canonical = (s: LocalSnapshot) => {
  const cu = new Map(s.customers.map((c) => [c.id, c.uuid]));
  const ru = new Map(s.rehan.map((r) => [r.id, r.uuid]));
  const lu = new Map(s.lenden.map((l) => [l.id, l.uuid]));
  return {
    customers: s.customers.map(({ id, ...rest }) => rest),
    rehan: s.rehan.map(({ id, userId, media, ...rest }) => ({ ...rest, customerUuid: cu.get(userId) ?? null, photos: media.length })),
    rehanTransactions: s.rehanTransactions.map(({ id, rehanId, ...rest }) => ({ ...rest, rehanUuid: ru.get(rehanId) })),
    lenden: s.lenden.map(({ id, userId, media, ...rest }) => ({ ...rest, customerUuid: cu.get(userId) ?? null, photos: media.length })),
    lendenItems: s.lendenItems.map(({ id, lendenId, ...rest }) => ({ ...rest, lendenUuid: lu.get(lendenId) })),
    oldJewellery: s.oldJewellery.map(({ id, lendenId, ...rest }) => ({ ...rest, lendenUuid: lu.get(lendenId) })),
    jamaEntries: s.jamaEntries.map(({ id, lendenId, ...rest }) => ({ ...rest, lendenUuid: lu.get(lendenId) })),
  };
};

/** Where the import would copy each photo: <recordUuid>-<n>.jpg in a fake images folder. */
const fakeMediaMap = (records: { uuid: string; media: string[] }[]) => {
  const map = new Map<string, string>();
  for (const r of records) r.media.forEach((rel, i) => map.set(mediaKey(r.uuid, rel), `file:///new/images/${r.uuid}-${i + 1}.jpg`));
  return map;
};

const freshPhone = async () => {
  sqliteMock.__reset();
  await initDatabase();
};

/** A realistic phone, written through the app's own create functions. */
const seedPhone = async () => {
  await freshPhone();
  const ram = await createUser({ name: "राम कुमार", address: "Manwal", mobileNumber: "9876543210", nickname: "RK" });
  const shyam = await createUser({ name: "Shyam" });
  const chain = await createRehan({
    userId: ram,
    media: ["file:///phone/images/a.jpg", "file:///phone/images/b.jpg"],
    openDate: D1,
    productName: "Chain",
    category: "Chain",
    amount: 1000,
  });
  await createRehanTransaction({ rehanId: chain, type: "diya", amount: 200, date: D1 });
  await createRehanTransaction({ rehanId: chain, type: "jama", amount: 50, date: D2 });
  const ring = await createRehan({ userId: shyam, openDate: D1, productName: "Ring" });
  sqliteMock.__raw().prepare("UPDATE rehan SET status = NULL, closedDate = ? WHERE id = ?").run(D2, ring);

  const bill = await createLenden({
    userId: ram,
    date: D1,
    media: ["file:///phone/other/a.jpg"],
    amount: 5000,
    discount: 100,
    remaining: 4900,
    status: 0,
  });
  await setLendenBillNo(bill, 7);
  await replaceLendenItems(bill, [
    { name: "Chain", category: "Chain", metal: "gold", purity: "22KT", weight: 12.345, qty: 2, rate: 6000, total: 4000 },
    { name: "Misc", total: 1000 },
  ]);
  await replaceLendenOldJewelleryItems(bill, [
    { description: "Old ring", metal: "silver", purity: "Desi", weight: 2.5, value: 300 },
  ]);
  await createJamaEntry({ lendenId: bill, amount: 300, date: D2 });
  await updateLendenBaki(bill);
  const orphan = await createLenden({ userId: 0, date: D2, amount: 800, remaining: 800 });
  await replaceLendenOldJewelleryItems(orphan, [{ description: "Scrap", value: 50 }]);
  await createJamaEntry({ lendenId: orphan, amount: 100, date: D2 });
  return { ram, shyam, chain, ring, bill, orphan };
};

const totalRows = (data: BackupData) => TABLE_KEYS.reduce((n, k) => n + data[k].length, 0);

describeDb("backupQueries on SQLite", () => {
  let log: jest.SpyInstance;
  beforeAll(() => {
    log = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });
  afterAll(() => log.mockRestore());

  it("reads every table with uuids, parsed photo lists and stored values", async () => {
    const ids = await seedPhone();
    const snap = await readSnapshot();
    expect(snap.customers).toHaveLength(2);
    expect(snap.rehan.map((r) => r.id)).toEqual([ids.chain, ids.ring]);
    expect(snap.rehan[0].media).toEqual(["file:///phone/images/a.jpg", "file:///phone/images/b.jpg"]);
    expect(snap.rehan[0].amount).toBe(1150);
    expect(snap.rehan[1].status).toBeNull();
    expect(snap.lenden[0]).toMatchObject({ billNo: 7, baki: 4600, status: 0, amountOverridden: 0 });
    expect(snap.lendenItems[0]).toMatchObject({ weight: 12.345, category: "Chain", qty: 2 });
    for (const k of TABLE_KEYS) for (const row of snap[k]) expect(UUID_RE.test(row.uuid)).toBe(true);
  });

  it("reads an unreadable photo list as no photos", async () => {
    const ids = await seedPhone();
    sqliteMock.__raw().prepare("UPDATE rehan SET media = 'not json' WHERE id = ?").run(ids.ring);
    const snap = await readSnapshot();
    expect(snap.rehan.find((r) => r.id === ids.ring)?.media).toEqual([]);
  });

  it("restores a phone exactly into an empty install (Replace and restore)", async () => {
    await seedPhone();
    const before = await readSnapshot();
    const { data } = validated(before);

    await freshPhone();
    const map = fakeMediaMap([...data.rehan, ...data.lenden]);
    const counts = await applyReplace(data, map);
    const after = await readSnapshot();

    expect(canonical(after)).toEqual(canonical(before));
    for (const k of TABLE_KEYS) expect(counts[k]).toBe(data[k].length);
    // Photos point at the copied files, in the original order.
    for (const r of [...data.rehan, ...data.lenden]) {
      const restored = [...after.rehan, ...after.lenden].find((x) => x.uuid === r.uuid);
      expect(restored?.media).toEqual(r.media.map((rel) => map.get(mediaKey(r.uuid, rel))));
    }
    // Orphans stay "customer not on file".
    expect(after.lenden.find((l) => l.uuid === data.lenden[1].uuid)?.userId).toBe(0);
    // And the restored phone exports the same rows again (photo names aside).
    const rows = (s: LocalSnapshot) => {
      const { files } = validated(s);
      return Object.fromEntries(
        Object.entries(files).map(([path, text]) => [
          path,
          (JSON.parse(text) as Record<string, unknown>[]).map(({ media, ...rest }) => ({ ...rest, photos: Array.isArray(media) ? media.length : undefined })),
        ]),
      );
    };
    expect(rows(after)).toEqual(rows(before));
  });

  it("replaces whatever was on the phone", async () => {
    await seedPhone();
    const backup = await readSnapshot();
    const { data } = validated(backup);

    await freshPhone();
    const other = await createUser({ name: "Someone else" });
    await createRehan({ userId: other, openDate: D1, productName: "Kada", amount: 99 });
    await applyReplace(data, fakeMediaMap([...data.rehan, ...data.lenden]));
    expect(canonical(await readSnapshot())).toEqual(canonical(backup));
  });

  it("rolls a failed restore back completely", async () => {
    await seedPhone();
    const { data } = validated(await readSnapshot());

    await freshPhone();
    await createUser({ name: "Keep me" });
    const before = await readSnapshot();
    // No photo locations: the restore fails after the deletes and inserts have started.
    await expect(applyReplace(data, new Map())).rejects.toThrow();
    expect(await readSnapshot()).toEqual(before);
  });

  it("merges into a phone that has part of the data, applying diya/jama and recalculating baki", async () => {
    await seedPhone();
    const full = await readSnapshot();
    const { data } = validated(full);

    // The other phone has this backup without the jama transaction, the bill's jama payment and the orphan bill.
    const jamaTx = data.rehanTransactions.find((t) => t.type === "jama")!;
    const billUuid = full.lenden[0].uuid;
    const payment = data.jamaEntries.find((j) => j.lendenUuid === billUuid)!;
    const orphanUuid = full.lenden[1].uuid;
    const partial: BackupData = {
      ...data,
      rehanTransactions: data.rehanTransactions.filter((t) => t.uuid !== jamaTx.uuid),
      lenden: data.lenden.filter((l) => l.uuid !== orphanUuid),
      oldJewellery: data.oldJewellery.filter((o) => o.lendenUuid !== orphanUuid),
      jamaEntries: data.jamaEntries.filter((j) => j.lendenUuid === billUuid && j.uuid !== payment.uuid),
    };
    await freshPhone();
    await applyReplace(partial, fakeMediaMap([...partial.rehan, ...partial.lenden]));
    const raw = sqliteMock.__raw();
    // That phone's stored values match its own rows: no jama yet, and the customer was renamed there.
    raw.prepare("UPDATE rehan SET amount = 1200 WHERE uuid = ?").run(jamaTx.rehanUuid);
    raw.prepare("UPDATE lenden SET baki = 4900, status = 0 WHERE uuid = ?").run(billUuid);
    raw.prepare("UPDATE users SET name = 'Ram K.' WHERE uuid = ?").run(data.customers[0].uuid);

    const plan = planMerge(data, await readSnapshot());
    expect(plan.applyToBalance).toEqual([jamaTx.uuid]);
    expect(plan.recomputeLenden).toEqual([billUuid]);
    expect(plan.conflicts).toEqual([{ table: "customers", uuid: data.customers[0].uuid }]);

    const counts = await applyMerge(plan, fakeMediaMap([...plan.insert.rehan, ...plan.insert.lenden]));
    expect(TABLE_KEYS.reduce((n, k) => n + counts[k], 0)).toBe(totalRows(plan.insert));

    const after = await readSnapshot();
    const chain = after.rehan.find((r) => r.uuid === jamaTx.rehanUuid)!;
    expect(chain.amount).toBe(1150); // 1200 − 50 jama
    const tx = after.rehanTransactions.find((t) => t.uuid === jamaTx.uuid)!;
    expect(tx).toMatchObject({ rehanId: chain.id, type: "jama", amount: 50, date: jamaTx.date, updatedAt: jamaTx.updatedAt });

    const bill = after.lenden.find((l) => l.uuid === billUuid)!;
    expect(bill).toMatchObject({ baki: 4600, status: 0 });
    expect(after.jamaEntries.find((j) => j.uuid === payment.uuid)?.lendenId).toBe(bill.id);
    // Same result as the app's own updateLendenBaki.
    await updateLendenBaki(bill.id);
    expect((await readSnapshot()).lenden.find((l) => l.uuid === billUuid)).toMatchObject({ baki: 4600, status: 0 });

    // The orphan bill arrives with its own payment and old jewellery, still "customer not on file".
    const orphan = after.lenden.find((l) => l.uuid === orphanUuid)!;
    expect(orphan.userId).toBe(0);
    expect(after.jamaEntries.filter((j) => j.lendenId === orphan.id)).toHaveLength(1);
    expect(after.oldJewellery.filter((o) => o.lendenId === orphan.id)).toHaveLength(1);
    // The conflicting customer is kept as on this phone.
    expect(after.customers[0].name).toBe("Ram K.");
  });

  it("closes a bill whose baki reaches 0, as updateLendenBaki does", async () => {
    await seedPhone();
    const full = await readSnapshot();
    const { data } = validated(full);
    const billUuid = full.lenden[0].uuid;
    const extra: BackupData = {
      ...data,
      jamaEntries: [
        ...data.jamaEntries,
        { uuid: u(900), lendenUuid: billUuid, amount: 5000, date: D2, updatedAt: T2 },
      ],
    };
    const plan = planMerge(extra, full);
    await applyMerge(plan, new Map());
    const bill = (await readSnapshot()).lenden.find((l) => l.uuid === billUuid)!;
    expect(bill).toMatchObject({ baki: 0, status: 1 });
  });

  it("changes nothing when the same backup is merged twice", async () => {
    await seedPhone();
    const { data } = validated(await readSnapshot());
    await freshPhone();
    const first = planMerge(data, await readSnapshot());
    await applyMerge(first, fakeMediaMap([...first.insert.rehan, ...first.insert.lenden]));
    const once = await readSnapshot();

    const second = planMerge(data, once);
    expect(totalRows(second.insert)).toBe(0);
    expect(second.applyToBalance).toEqual([]);
    expect(second.recomputeLenden).toEqual([]);
    await applyMerge(second, new Map());
    expect(await readSnapshot()).toEqual(once);
  });

  it("rolls a failed merge back completely", async () => {
    await seedPhone();
    const { data } = validated(await readSnapshot());
    await freshPhone();
    await createUser({ name: "Keep me" });
    const before = await readSnapshot();
    const plan: MergePlan = planMerge(data, before);
    await expect(applyMerge(plan, new Map())).rejects.toThrow();
    expect(await readSnapshot()).toEqual(before);
  });

  it("makes fresh uuids for an old backup", async () => {
    await freshPhone();
    const ids = await newUuids(50);
    expect(ids).toHaveLength(50);
    expect(new Set(ids).size).toBe(50);
    for (const id of ids) expect(UUID_RE.test(id)).toBe(true);
    expect(await newUuids(0)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Part 3: calendar days. Backups made before the change carry timestamps; the phone holds plain days once migrated.

describeDb("calendar days through a backup", () => {
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;
  beforeAll(() => {
    log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterAll(() => {
    log.mockRestore();
    warn.mockRestore();
  });

  const CALENDAR = [
    ["rehan", "openDate"],
    ["rehan", "closedDate"],
    ["lenden", "date"],
    ["jama_entries", "date"],
    ["rehan_transactions", "date"],
  ] as const;

  /** Every stored calendar value per column, in id order. */
  const storedDays = () =>
    Object.fromEntries(
      CALENDAR.map(([table, column]) => [
        `${table}.${column}`,
        sqliteMock.__raw().prepare(`SELECT ${column} AS value FROM ${table} ORDER BY id`).all().map((r) => r.value),
      ]),
    );

  /** The timestamp the old app stored for a picked day: local midnight. */
  const oldStamp = (day: string) => parseDay(day).toISOString();
  /** Noon of that day: the kind of timestamp the old "today" defaults wrote. */
  const noonStamp = (day: string) => {
    const d = parseDay(day);
    d.setHours(12);
    return d.toISOString();
  };

  /** The phone before the update: seedPhone with every calendar value as the old app stored it, user_version unset. */
  const oldPhone = async () => {
    await seedPhone();
    const raw = sqliteMock.__raw();
    for (const [table, column] of CALENDAR) {
      for (const r of raw.prepare(`SELECT id, ${column} AS value FROM ${table} WHERE ${column} IS NOT NULL`).all()) {
        raw.prepare(`UPDATE ${table} SET ${column} = ? WHERE id = ?`).run(oldStamp(String(r.value)), r.id);
      }
    }
    raw.exec("PRAGMA user_version = 0");
  };

  /** A backup of that phone as the old app exported it: the stored timestamps, as they are. */
  const backupOf = (snapshot: LocalSnapshot) => {
    const result = serializeSnapshot(snapshot, { createdAt: CREATED, mediaExists: () => true });
    return {
      manifestText: JSON.stringify(result.manifest, null, 2),
      files: result.files,
      mediaPaths: new Set(result.mediaCopies.map((m) => m.to)),
    };
  };

  it("imports an older backup as plain days, and merging it after the migration finds every row already here", async () => {
    await oldPhone();
    const before = await readSnapshot();
    const older = backupOf(before);
    // Export writes what is stored: the older backup carries timestamps.
    expect(JSON.parse(older.files["data/rehan.json"])[0].openDate).toBe(oldStamp(D1));

    // The update arrives and the migration rewrites the phone's own values, leaving updatedAt alone.
    await initDatabase();
    const migrated = await readSnapshot();
    expect(migrated.rehan.map((r) => [r.openDate, r.closedDate])).toEqual([
      [D1, null],
      [D1, D2],
    ]);
    expect(migrated.jamaEntries.map((j) => j.date)).toEqual([D2, D2]);
    for (const k of TABLE_KEYS) {
      expect(migrated[k].map((r) => r.updatedAt)).toEqual(before[k].map((r) => r.updatedAt));
    }

    // The import validates the older backup into plain days before planning...
    const check = validateBackup(older);
    if (!check.ok) throw new Error(check.errors.join("; "));
    // ...so a merge into the migrated phone finds every row already here: no inserts and no conflicts.
    const plan = planMerge(check.data, migrated);
    for (const k of TABLE_KEYS) {
      expect(plan.summary[k]).toEqual({ total: check.data[k].length, insert: 0, same: check.data[k].length, conflict: 0 });
    }
    expect(plan.conflicts).toEqual([]);
    expect(plan.applyToBalance).toEqual([]);
    expect(plan.recomputeLenden).toEqual([]);
    await applyMerge(plan, new Map());
    expect(await readSnapshot()).toEqual(migrated);

    // Replace and restore of the older backup lands as the same plain days.
    await freshPhone();
    await applyReplace(check.data, fakeMediaMap([...check.data.rehan, ...check.data.lenden]));
    expect(canonical(await readSnapshot())).toEqual(canonical(migrated));
  });

  it("stores plain days even when the rows handed to the importer carry timestamps", async () => {
    await seedPhone();
    const days = storedDays();
    const { data } = validated(await readSnapshot());
    // Rows that skipped validation, with timestamps in every calendar field.
    const stamped: BackupData = {
      ...data,
      rehan: data.rehan.map((r) => ({
        ...r,
        openDate: oldStamp(r.openDate),
        closedDate: r.closedDate === null ? null : noonStamp(r.closedDate),
      })),
      rehanTransactions: data.rehanTransactions.map((t) => ({ ...t, date: noonStamp(t.date) })),
      lenden: data.lenden.map((l) => ({ ...l, date: oldStamp(l.date) })),
      jamaEntries: data.jamaEntries.map((j) => ({ ...j, date: noonStamp(j.date) })),
    };

    await freshPhone();
    await applyReplace(stamped, fakeMediaMap([...stamped.rehan, ...stamped.lenden]));
    expect(storedDays()).toEqual(days);

    await freshPhone();
    const plan = planMerge(stamped, await readSnapshot());
    await applyMerge(plan, fakeMediaMap([...plan.insert.rehan, ...plan.insert.lenden]));
    expect(storedDays()).toEqual(days);
  });
  it("an export holding dates that cannot be read passes its own check with a warning, restores exactly and re-plans as already here", async () => {
    await seedPhone();
    const raw = sqliteMock.__raw();
    // Values the migration could not read and left exactly as they were.
    raw.prepare("UPDATE rehan SET closedDate = 'garbage' WHERE closedDate IS NOT NULL").run();
    raw.prepare("UPDATE lenden SET date = 'not a date' WHERE userId = 0").run();
    raw.prepare("UPDATE jama_entries SET date = '2026-02-30' WHERE id = (SELECT MIN(id) FROM jama_entries)").run();
    const phone = await readSnapshot();

    // The same validateBackup call the export makes before it shares or keeps a backup: it passes, with a warning.
    const check = validateBackup(backupOf(phone));
    if (!check.ok) throw new Error(check.errors.join("; "));
    expect(check.warnings).toEqual(["3 dates could not be read and were kept exactly as stored"]);
    expect(check.data.rehan.map((r) => r.closedDate)).toEqual([null, "garbage"]);
    expect(check.data.lenden.map((l) => l.date)).toEqual([D1, "not a date"]);
    expect(check.data.jamaEntries.map((j) => j.date)).toEqual(["2026-02-30", D2]);

    // Merging it into the phone it came from: every row is already here.
    const plan = planMerge(check.data, phone);
    for (const k of TABLE_KEYS) {
      expect(plan.summary[k]).toEqual({ total: check.data[k].length, insert: 0, same: check.data[k].length, conflict: 0 });
    }
    expect(plan.conflicts).toEqual([]);

    // Replace and restore stores every value exactly as it was.
    await freshPhone();
    await applyReplace(check.data, fakeMediaMap([...check.data.rehan, ...check.data.lenden]));
    expect(canonical(await readSnapshot())).toEqual(canonical(phone));

    // So does a safe merge into an empty phone.
    await freshPhone();
    const intoEmpty = planMerge(check.data, await readSnapshot());
    await applyMerge(intoEmpty, fakeMediaMap([...intoEmpty.insert.rehan, ...intoEmpty.insert.lenden]));
    expect(canonical(await readSnapshot())).toEqual(canonical(phone));
  });
});

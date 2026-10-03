import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupData,
  DATA_FILES,
  Manifest,
  TABLE_KEYS,
} from "./format";
import { fnv1a } from "./checksum";
import { validateBackup, validateData } from "./validate";

const U = {
  cust: "11111111-1111-4111-8111-111111111111",
  cust2: "11111111-1111-4111-8111-111111111112",
  rehan: "22222222-2222-4222-8222-222222222221",
  tx: "33333333-3333-4333-8333-333333333331",
  lenden: "44444444-4444-4444-8444-444444444441",
  item: "55555555-5555-4555-8555-555555555551",
  old: "66666666-6666-4666-8666-666666666661",
  jama: "77777777-7777-4777-8777-777777777771",
};
const T = "2026-01-01T00:00:00.000Z";

const goodData = (): BackupData => ({
  customers: [
    { uuid: U.cust, name: "Ram", address: null, mobileNumber: "999", nickname: null, createdAt: T, updatedAt: T },
    { uuid: U.cust2, name: "Sita", address: "Gali 1", mobileNumber: null, nickname: "S", createdAt: T, updatedAt: T },
  ],
  rehan: [
    {
      uuid: U.rehan,
      customerUuid: U.cust,
      productName: "Ring",
      amount: 5000,
      status: 0,
      openDate: T,
      closedDate: null,
      media: [`media/${U.rehan}/1-a.jpg`],
      updatedAt: T,
    },
  ],
  rehanTransactions: [{ uuid: U.tx, rehanUuid: U.rehan, type: "diya", amount: 100, date: T, updatedAt: T }],
  lenden: [
    {
      uuid: U.lenden,
      customerUuid: null,
      date: T,
      amount: 1000,
      discount: 0,
      remaining: 1000,
      jama: 0,
      baki: 1000,
      status: null,
      billNo: 7,
      amountOverridden: 0,
      media: [],
      updatedAt: T,
    },
  ],
  lendenItems: [
    {
      uuid: U.item,
      lendenUuid: U.lenden,
      position: 0,
      name: "Chain",
      metal: "gold",
      purity: "22k",
      weight: 10.5,
      qty: 1,
      rate: 6000,
      total: 1000,
      updatedAt: T,
    },
  ],
  oldJewellery: [
    {
      uuid: U.old,
      lendenUuid: U.lenden,
      position: 0,
      description: "old ring",
      metal: null,
      purity: null,
      weight: null,
      value: 200,
      updatedAt: T,
    },
  ],
  jamaEntries: [{ uuid: U.jama, lendenUuid: U.lenden, amount: 50, date: T, updatedAt: T }],
});

const mediaSet = () => new Set([`media/${U.rehan}/1-a.jpg`]);

interface Input {
  manifestText: string | null;
  files: Record<string, string | undefined>;
  mediaPaths: Set<string>;
}

/** Build a valid backup input; `tweak` can change the data before it is written and checksummed. */
const build = (data: BackupData = goodData()): { input: Input; manifest: Manifest } => {
  const files: Record<string, string | undefined> = {};
  const manifest: Manifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: T,
    files: {},
    media: { count: 1, missing: 0 },
    warnings: [],
  };
  for (const k of TABLE_KEYS) {
    const text = JSON.stringify(data[k], null, 2);
    files[DATA_FILES[k]] = text;
    manifest.files[DATA_FILES[k]] = { count: data[k].length, checksum: fnv1a(text) };
  }
  return { input: { manifestText: JSON.stringify(manifest), files, mediaPaths: mediaSet() }, manifest };
};

const errorsOf = (r: ReturnType<typeof validateBackup>): string[] => {
  if (r.ok) throw new Error("expected failure");
  return r.errors;
};

describe("validateBackup", () => {
  it("accepts a valid backup and returns the manifest and data", () => {
    const { input, manifest } = build();
    const r = validateBackup(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.manifest).toEqual(manifest);
      expect(r.data).toEqual(goodData());
    }
  });

  it("rejects a missing manifest", () => {
    const { input } = build();
    const errors = errorsOf(validateBackup({ ...input, manifestText: null }));
    expect(errors).toEqual(["Not an AJ backup"]);
  });

  it("rejects an unparseable manifest", () => {
    const { input } = build();
    const errors = errorsOf(validateBackup({ ...input, manifestText: "{nope" }));
    expect(errors).toEqual(["Not an AJ backup"]);
  });

  it("rejects a manifest with another format", () => {
    const { input } = build();
    const m = { ...JSON.parse(input.manifestText as string), format: "other" };
    expect(errorsOf(validateBackup({ ...input, manifestText: JSON.stringify(m) }))).toEqual(["Not an AJ backup"]);
  });

  it("rejects an unsupported version", () => {
    const { input } = build();
    const m = { ...JSON.parse(input.manifestText as string), version: 9 };
    expect(errorsOf(validateBackup({ ...input, manifestText: JSON.stringify(m) }))).toEqual([
      "Unsupported backup version 9",
    ]);
  });

  it("rejects a missing data file", () => {
    const { input } = build();
    delete input.files[DATA_FILES.rehan];
    expect(errorsOf(validateBackup(input))).toEqual([`Backup is incomplete: ${DATA_FILES.rehan} is missing`]);
  });

  it("rejects a file whose checksum does not match", () => {
    const { input } = build();
    input.files[DATA_FILES.customers] = (input.files[DATA_FILES.customers] as string) + " ";
    expect(errorsOf(validateBackup(input))).toEqual([`Backup is damaged: ${DATA_FILES.customers} failed its check`]);
  });

  it("rejects a file the manifest does not list", () => {
    const { input } = build();
    const m = JSON.parse(input.manifestText as string);
    delete m.files[DATA_FILES.jamaEntries];
    expect(errorsOf(validateBackup({ ...input, manifestText: JSON.stringify(m) }))).toEqual([
      `Backup is damaged: ${DATA_FILES.jamaEntries} failed its check`,
    ]);
  });

  it("rejects a file that is not a JSON array", () => {
    const { input, manifest } = build();
    const text = '{"a":1}';
    input.files[DATA_FILES.customers] = text;
    manifest.files[DATA_FILES.customers] = { count: 0, checksum: fnv1a(text) };
    expect(errorsOf(validateBackup({ ...input, manifestText: JSON.stringify(manifest) }))).toEqual([
      `Backup is damaged: ${DATA_FILES.customers} is not a list of records`,
    ]);
  });

  it("rejects a file that is not valid JSON", () => {
    const { input, manifest } = build();
    const text = "[1,";
    input.files[DATA_FILES.customers] = text;
    manifest.files[DATA_FILES.customers] = { count: 0, checksum: fnv1a(text) };
    expect(errorsOf(validateBackup({ ...input, manifestText: JSON.stringify(manifest) }))).toEqual([
      `Backup is damaged: ${DATA_FILES.customers} is not a list of records`,
    ]);
  });

  it("rejects a row count that differs from the manifest", () => {
    const { input, manifest } = build();
    manifest.files[DATA_FILES.customers].count = 5;
    expect(errorsOf(validateBackup({ ...input, manifestText: JSON.stringify(manifest) }))).toEqual([
      `Backup is damaged: ${DATA_FILES.customers} has 2 records but the backup lists 5`,
    ]);
  });

  it("reports data problems from validateData", () => {
    const data = goodData();
    data.rehan[0].customerUuid = "99999999-9999-4999-8999-999999999999";
    const { input } = build(data);
    expect(errorsOf(validateBackup(input))).toEqual(["rehan row 1: customerUuid does not match any customer"]);
  });

  it("returns at most 5 messages", () => {
    const data = goodData();
    data.customers = Array.from({ length: 8 }, () => ({ ...data.customers[0], name: "" }));
    data.customers.forEach((c, i) => (c.uuid = `11111111-1111-4111-8111-1111111111${10 + i}`));
    data.rehan = [];
    data.rehanTransactions = [];
    data.lenden = [];
    data.lendenItems = [];
    data.oldJewellery = [];
    data.jamaEntries = [];
    const { input } = build(data);
    expect(errorsOf(validateBackup(input))).toHaveLength(5);
  });

  it("stops at the first failing category", () => {
    const { input } = build();
    delete input.files[DATA_FILES.rehan];
    input.files[DATA_FILES.customers] = "garbage"; // would fail the checksum, but files are checked first
    expect(errorsOf(validateBackup(input))).toEqual([`Backup is incomplete: ${DATA_FILES.rehan} is missing`]);
  });
});

describe("validateData", () => {
  it("returns no problems for valid data", () => {
    expect(validateData(goodData(), mediaSet())).toEqual([]);
  });

  it("accepts empty tables", () => {
    const empty: BackupData = {
      customers: [],
      rehan: [],
      rehanTransactions: [],
      lenden: [],
      lendenItems: [],
      oldJewellery: [],
      jamaEntries: [],
    };
    expect(validateData(empty, new Set())).toEqual([]);
  });

  it("flags a row that is not an object", () => {
    const data = goodData();
    (data.customers as unknown[])[1] = 5;
    expect(validateData(data, mediaSet())).toEqual(["customers row 2: is not a record"]);
  });

  it("flags a bad uuid", () => {
    const data = goodData();
    data.customers[0].uuid = "not-a-uuid";
    expect(validateData(data, mediaSet())).toContain("customers row 1: uuid is not valid");
  });

  it("flags a duplicate uuid within a table", () => {
    const data = goodData();
    data.customers[1].uuid = data.customers[0].uuid;
    expect(validateData(data, mediaSet())).toEqual(["customers row 2: uuid is used by more than one record"]);
  });

  it("flags an empty required string", () => {
    const data = goodData();
    data.customers[0].name = "";
    expect(validateData(data, mediaSet())).toEqual(["customers row 1: name is missing"]);
  });

  it("flags null where null is not allowed", () => {
    const data = goodData();
    (data.rehanTransactions[0] as unknown as Record<string, unknown>).amount = null;
    expect(validateData(data, mediaSet())).toEqual(["rehanTransactions row 1: amount is not a number"]);
  });

  it("allows null where the type allows it", () => {
    const data = goodData();
    data.rehan[0].amount = null;
    data.rehan[0].productName = null;
    data.lenden[0].billNo = null;
    data.lenden[0].status = null;
    expect(validateData(data, mediaSet())).toEqual([]);
  });

  it("flags a non-finite or non-numeric number", () => {
    const data = goodData();
    (data.jamaEntries[0] as unknown as Record<string, unknown>).amount = "50";
    (data.lendenItems[0] as unknown as Record<string, unknown>).total = Infinity;
    const problems = validateData(data, mediaSet());
    expect(problems).toContain("jamaEntries row 1: amount is not a number");
    expect(problems).toContain("lendenItems row 1: total is not a number");
  });

  it("flags a missing optional-typed field (undefined is not null)", () => {
    const data = goodData();
    delete (data.customers[0] as unknown as Record<string, unknown>).address;
    expect(validateData(data, mediaSet())).toEqual(["customers row 1: address is missing"]);
  });

  it("flags a transaction type other than diya or jama", () => {
    const data = goodData();
    (data.rehanTransactions[0] as unknown as Record<string, unknown>).type = "loan";
    expect(validateData(data, mediaSet())).toEqual(['rehanTransactions row 1: type must be "diya" or "jama"']);
  });

  it("flags a rehanUuid that does not resolve", () => {
    const data = goodData();
    data.rehanTransactions[0].rehanUuid = "99999999-9999-4999-8999-999999999999";
    expect(validateData(data, mediaSet())).toEqual([
      "rehanTransactions row 1: rehanUuid does not match any rehan",
    ]);
  });

  it("flags a lendenUuid that does not resolve, in every child table", () => {
    const data = goodData();
    const bad = "99999999-9999-4999-8999-999999999999";
    data.lendenItems[0].lendenUuid = bad;
    data.oldJewellery[0].lendenUuid = bad;
    data.jamaEntries[0].lendenUuid = bad;
    expect(validateData(data, mediaSet())).toEqual([
      "lendenItems row 1: lendenUuid does not match any len-den",
      "oldJewellery row 1: lendenUuid does not match any len-den",
      "jamaEntries row 1: lendenUuid does not match any len-den",
    ]);
  });

  it("flags a customerUuid that does not resolve on len-den, and accepts null", () => {
    const data = goodData();
    expect(validateData(data, mediaSet())).toEqual([]); // lenden customerUuid is null
    data.lenden[0].customerUuid = "99999999-9999-4999-8999-999999999999";
    expect(validateData(data, mediaSet())).toEqual(["lenden row 1: customerUuid does not match any customer"]);
  });

  it("flags media that is not in the zip", () => {
    const data = goodData();
    expect(validateData(data, new Set())).toEqual([
      `rehan row 1: photo ${data.rehan[0].media[0]} is not in the backup`,
    ]);
  });

  it("flags media that is not a list of strings", () => {
    const data = goodData();
    (data.lenden[0] as unknown as Record<string, unknown>).media = "x.jpg";
    expect(validateData(data, mediaSet())).toEqual(["lenden row 1: media is not a list"]);
  });
});

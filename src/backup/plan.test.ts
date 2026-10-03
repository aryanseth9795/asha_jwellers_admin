import {
  BackupData,
  LocalSnapshot,
  TABLE_KEYS,
  TableKey,
} from "./format";
import { countRows, planMerge } from "./plan";

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const T = "2026-01-01T00:00:00.000Z";

const C1 = u(1);
const C2 = u(2);
const R1 = u(10);
const RT1 = u(11);
const RT2 = u(12);
const L1 = u(20);
const LI1 = u(21);
const OJ1 = u(22);
const J1 = u(23);
const J2 = u(24);

const makeBackup = (): BackupData => ({
  customers: [
    { uuid: C1, name: "Ram", address: "Manwal", mobileNumber: "111", nickname: "R", createdAt: T, updatedAt: T },
    { uuid: C2, name: "Shyam", address: null, mobileNumber: null, nickname: null, createdAt: T, updatedAt: T },
  ],
  rehan: [
    {
      uuid: R1,
      customerUuid: C1,
      productName: "Chain",
      category: "Chain",
      amount: 1000,
      status: 0,
      openDate: "2026-01-02T00:00:00.000Z",
      closedDate: null,
      media: ["media/" + R1 + "/1-a.jpg"],
      updatedAt: T,
    },
  ],
  rehanTransactions: [
    { uuid: RT1, rehanUuid: R1, type: "diya", amount: 200, date: "2026-01-03T00:00:00.000Z", updatedAt: T },
    { uuid: RT2, rehanUuid: R1, type: "jama", amount: 100, date: "2026-01-04T00:00:00.000Z", updatedAt: T },
  ],
  lenden: [
    {
      uuid: L1,
      customerUuid: C1,
      date: "2026-01-05T00:00:00.000Z",
      amount: 5000,
      discount: 100,
      remaining: 4900,
      jama: 300,
      baki: 4600,
      status: 0,
      billNo: 7,
      amountOverridden: 0,
      media: [],
      updatedAt: T,
    },
  ],
  lendenItems: [
    {
      uuid: LI1,
      lendenUuid: L1,
      position: 0,
      name: "Ring",
      category: "Ring",
      metal: "gold",
      purity: "22k",
      weight: 5,
      qty: 1,
      rate: 1000,
      total: 5000,
      updatedAt: T,
    },
  ],
  oldJewellery: [
    {
      uuid: OJ1,
      lendenUuid: L1,
      position: 0,
      description: "Old ring",
      metal: "gold",
      purity: "20k",
      weight: 2,
      value: 100,
      updatedAt: T,
    },
  ],
  jamaEntries: [
    { uuid: J1, lendenUuid: L1, amount: 100, date: "2026-01-06T00:00:00.000Z", updatedAt: T },
    { uuid: J2, lendenUuid: L1, amount: 200, date: "2026-01-07T00:00:00.000Z", updatedAt: T },
  ],
});

/** Local snapshot with numeric ids built from backup data (media made absolute). */
const toSnapshot = (data: BackupData): LocalSnapshot => {
  const cId = new Map(data.customers.map((c, i) => [c.uuid, i + 1]));
  const rId = new Map(data.rehan.map((r, i) => [r.uuid, i + 1]));
  const lId = new Map(data.lenden.map((l, i) => [l.uuid, i + 1]));
  return {
    customers: data.customers.map((c) => ({ ...c, id: cId.get(c.uuid)! })),
    rehan: data.rehan.map(({ customerUuid, media, ...r }) => ({
      ...r,
      id: rId.get(r.uuid)!,
      userId: customerUuid === null ? 0 : cId.get(customerUuid) ?? 0,
      media: media.map((m) => "/phone/" + m),
    })),
    rehanTransactions: data.rehanTransactions.map(({ rehanUuid, ...t }, i) => ({
      ...t,
      id: i + 1,
      rehanId: rId.get(rehanUuid)!,
    })),
    lenden: data.lenden.map(({ customerUuid, media, ...l }) => ({
      ...l,
      id: lId.get(l.uuid)!,
      userId: customerUuid === null ? 0 : cId.get(customerUuid) ?? 0,
      media: media.map((m) => "/phone/" + m),
    })),
    lendenItems: data.lendenItems.map(({ lendenUuid, ...i }, n) => ({
      ...i,
      id: n + 1,
      lendenId: lId.get(lendenUuid)!,
    })),
    oldJewellery: data.oldJewellery.map(({ lendenUuid, ...o }, n) => ({
      ...o,
      id: n + 1,
      lendenId: lId.get(lendenUuid)!,
    })),
    jamaEntries: data.jamaEntries.map(({ lendenUuid, ...j }, n) => ({
      ...j,
      id: n + 1,
      lendenId: lId.get(lendenUuid)!,
    })),
  };
};

const emptySnapshot = (): LocalSnapshot => toSnapshot({
  customers: [],
  rehan: [],
  rehanTransactions: [],
  lenden: [],
  lendenItems: [],
  oldJewellery: [],
  jamaEntries: [],
});

const insertCounts = (data: BackupData) => countRows(data);

describe("countRows", () => {
  it("counts rows per table", () => {
    expect(countRows(makeBackup())).toEqual({
      customers: 2,
      rehan: 1,
      rehanTransactions: 2,
      lenden: 1,
      lendenItems: 1,
      oldJewellery: 1,
      jamaEntries: 2,
    });
  });
});

describe("planMerge into an empty phone", () => {
  it("inserts everything and applies nothing to balances", () => {
    const backup = makeBackup();
    const plan = planMerge(backup, emptySnapshot());
    expect(plan.insert).toEqual(backup);
    expect(plan.applyToBalance).toEqual([]);
    expect(plan.recomputeLenden).toEqual([]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.billNoClashes).toEqual([]);
    const counts = insertCounts(backup);
    for (const k of TABLE_KEYS) {
      expect(plan.summary[k]).toEqual({ total: counts[k], insert: counts[k], same: 0, conflict: 0 });
    }
  });
});

describe("planMerge idempotence", () => {
  it("re-planning data already on the phone inserts nothing", () => {
    const backup = makeBackup();
    const plan = planMerge(backup, toSnapshot(backup));
    const counts = countRows(backup);
    for (const k of TABLE_KEYS) {
      expect(plan.summary[k]).toEqual({ total: counts[k], insert: 0, same: counts[k], conflict: 0 });
      expect(plan.insert[k]).toEqual([]);
    }
    expect(plan.applyToBalance).toEqual([]);
    expect(plan.recomputeLenden).toEqual([]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.billNoClashes).toEqual([]);
  });

  it("re-planning identical data with photos gives 0 inserts and 0 conflicts", () => {
    const backup = makeBackup();
    backup.lenden[0].media = ["media/" + L1 + "/1-a.jpg", "media/" + L1 + "/2-b.jpg"];
    const plan = planMerge(backup, toSnapshot(backup));
    for (const k of TABLE_KEYS) {
      expect(plan.summary[k].insert).toBe(0);
      expect(plan.summary[k].conflict).toBe(0);
    }
    expect(plan.conflicts).toEqual([]);
  });

  it("keeps summary totals consistent", () => {
    const backup = makeBackup();
    const local = toSnapshot(backup);
    local.customers[0].name = "Changed";
    local.rehanTransactions.pop();
    const plan = planMerge(backup, local);
    for (const k of TABLE_KEYS) {
      const s = plan.summary[k];
      expect(s.insert + s.same + s.conflict).toBe(s.total);
    }
  });
});

describe("customers", () => {
  it("inserts absent, matches same, flags different", () => {
    const backup = makeBackup();
    const local = emptySnapshot();
    local.customers.push({ ...backup.customers[0], id: 1 }); // C1 same
    // C2 absent
    const plan = planMerge(backup, local);
    expect(plan.summary.customers).toEqual({ total: 2, insert: 1, same: 1, conflict: 0 });
    expect(plan.insert.customers.map((c) => c.uuid)).toEqual([C2]);
  });

  it.each(["name", "address", "mobileNumber", "nickname", "createdAt"] as const)(
    "is a conflict when %s differs",
    (field) => {
      const backup = makeBackup();
      const local = toSnapshot(backup);
      (local.customers[0] as any)[field] = "different";
      const plan = planMerge(backup, local);
      expect(plan.summary.customers).toEqual({ total: 2, insert: 0, same: 1, conflict: 1 });
      expect(plan.conflicts).toContainEqual({ table: "customers", uuid: C1 });
      expect(plan.insert.customers).toEqual([]);
    },
  );

  it("ignores updatedAt differences", () => {
    const backup = makeBackup();
    const local = toSnapshot(backup);
    local.customers[0].updatedAt = "2027-01-01T00:00:00.000Z";
    expect(planMerge(backup, local).summary.customers.same).toBe(2);
  });
});

describe("rehan", () => {
  it("inserts an absent rehan with all its transactions, not applied to balance", () => {
    const backup = makeBackup();
    const local = toSnapshot(backup);
    local.rehan = [];
    local.rehanTransactions = [];
    const plan = planMerge(backup, local);
    expect(plan.summary.rehan).toEqual({ total: 1, insert: 1, same: 0, conflict: 0 });
    expect(plan.summary.rehanTransactions).toEqual({ total: 2, insert: 2, same: 0, conflict: 0 });
    expect(plan.insert.rehanTransactions.map((t) => t.uuid)).toEqual([RT1, RT2]);
    expect(plan.applyToBalance).toEqual([]);
  });

  it("inserts missing transactions of a present rehan and applies them to the balance", () => {
    const backup = makeBackup();
    const local = toSnapshot(backup);
    local.rehanTransactions = local.rehanTransactions.filter((t) => t.uuid !== RT2);
    const plan = planMerge(backup, local);
    expect(plan.summary.rehan).toEqual({ total: 1, insert: 0, same: 1, conflict: 0 });
    expect(plan.summary.rehanTransactions).toEqual({ total: 2, insert: 1, same: 1, conflict: 0 });
    expect(plan.insert.rehan).toEqual([]);
    expect(plan.insert.rehanTransactions.map((t) => t.uuid)).toEqual([RT2]);
    expect(plan.applyToBalance).toEqual([RT2]);
  });

  it("flags a transaction that differs from the local one", () => {
    const backup = makeBackup();
    const local = toSnapshot(backup);
    local.rehanTransactions[0].amount = 999;
    const plan = planMerge(backup, local);
    expect(plan.summary.rehanTransactions).toEqual({ total: 2, insert: 0, same: 1, conflict: 1 });
    expect(plan.conflicts).toContainEqual({ table: "rehanTransactions", uuid: RT1 });
    expect(plan.applyToBalance).toEqual([]);
  });

  it.each([
    ["customerUuid (userId)", (r: LocalSnapshot["rehan"][number]) => (r.userId = 2)],
    ["productName", (r: LocalSnapshot["rehan"][number]) => (r.productName = "Other")],
    ["status", (r: LocalSnapshot["rehan"][number]) => (r.status = 1)],
    ["category", (r: LocalSnapshot["rehan"][number]) => (r.category = "Other")],
    ["category (null on the phone)", (r: LocalSnapshot["rehan"][number]) => (r.category = null)],
    ["openDate", (r: LocalSnapshot["rehan"][number]) => (r.openDate = "2025-01-01T00:00:00.000Z")],
    ["closedDate", (r: LocalSnapshot["rehan"][number]) => (r.closedDate = "2026-02-01T00:00:00.000Z")],
  ])("is a conflict when %s differs, and its children still follow per-child rules", (_n, mutate) => {
    const backup = makeBackup();
    const local = toSnapshot(backup);
    mutate(local.rehan[0]);
    local.rehanTransactions = local.rehanTransactions.filter((t) => t.uuid !== RT2);
    const plan = planMerge(backup, local);
    expect(plan.summary.rehan).toEqual({ total: 1, insert: 0, same: 0, conflict: 1 });
    expect(plan.conflicts).toContainEqual({ table: "rehan", uuid: R1 });
    expect(plan.insert.rehan).toEqual([]);
    expect(plan.insert.rehanTransactions.map((t) => t.uuid)).toEqual([RT2]);
    expect(plan.applyToBalance).toEqual([RT2]);
    expect(plan.summary.rehanTransactions).toEqual({ total: 2, insert: 1, same: 1, conflict: 0 });
  });

  it("does not compare the amount", () => {
    const backup = makeBackup();
    const local = toSnapshot(backup);
    local.rehan[0].amount = 12345;
    expect(planMerge(backup, local).summary.rehan).toEqual({ total: 1, insert: 0, same: 1, conflict: 0 });
  });

  it("flags a rehan whose photo count differs, and matches an equal count with other file names", () => {
    const backup = makeBackup();
    const fewer = toSnapshot(backup);
    fewer.rehan[0].media = [];
    const plan = planMerge(backup, fewer);
    expect(plan.summary.rehan).toEqual({ total: 1, insert: 0, same: 0, conflict: 1 });
    expect(plan.conflicts).toContainEqual({ table: "rehan", uuid: R1 });

    const sameCount = toSnapshot(backup);
    sameCount.rehan[0].media = ["/phone/other-name.jpg"];
    expect(planMerge(backup, sameCount).summary.rehan).toEqual({ total: 1, insert: 0, same: 1, conflict: 0 });
  });

  it("treats a local rehan with an unknown userId as customerUuid null", () => {
    const backup = makeBackup();
    backup.rehan[0].customerUuid = null;
    const local = toSnapshot(makeBackup());
    local.rehan[0].userId = 999;
    expect(planMerge(backup, local).summary.rehan).toEqual({ total: 1, insert: 0, same: 1, conflict: 0 });
    // and it differs from a backup that does name a customer
    expect(planMerge(makeBackup(), local).summary.rehan.conflict).toBe(1);
  });
});

describe("lenden", () => {
  it("inserts an absent len-den with its items, old jewellery and jama entries", () => {
    const backup = makeBackup();
    const local = emptySnapshot();
    local.customers = toSnapshot(backup).customers;
    const plan = planMerge(backup, local);
    expect(plan.summary.lenden).toEqual({ total: 1, insert: 1, same: 0, conflict: 0 });
    expect(plan.summary.lendenItems.insert).toBe(1);
    expect(plan.summary.oldJewellery.insert).toBe(1);
    expect(plan.summary.jamaEntries.insert).toBe(2);
    expect(plan.recomputeLenden).toEqual([]);
  });

  it("inserts new jama entries into a present len-den and asks for a recompute (deduplicated)", () => {
    const backup = makeBackup();
    const local = toSnapshot(backup);
    local.jamaEntries = [];
    const plan = planMerge(backup, local);
    expect(plan.summary.lenden).toEqual({ total: 1, insert: 0, same: 1, conflict: 0 });
    expect(plan.summary.jamaEntries).toEqual({ total: 2, insert: 2, same: 0, conflict: 0 });
    expect(plan.insert.jamaEntries.map((j) => j.uuid)).toEqual([J1, J2]);
    expect(plan.recomputeLenden).toEqual([L1]);
  });

  it("flags a jama entry that differs", () => {
    const backup = makeBackup();
    const local = toSnapshot(backup);
    local.jamaEntries[0].amount = 1;
    const plan = planMerge(backup, local);
    expect(plan.summary.jamaEntries).toEqual({ total: 2, insert: 0, same: 1, conflict: 1 });
    expect(plan.conflicts).toContainEqual({ table: "jamaEntries", uuid: J1 });
    expect(plan.recomputeLenden).toEqual([]);
  });

  it("never inserts items or old jewellery of a present len-den", () => {
    const backup = makeBackup();
    const local = toSnapshot(backup);
    local.lendenItems = [];
    local.oldJewellery = [];
    const plan = planMerge(backup, local);
    expect(plan.insert.lendenItems).toEqual([]);
    expect(plan.insert.oldJewellery).toEqual([]);
    expect(plan.summary.lendenItems).toEqual({ total: 1, insert: 0, same: 0, conflict: 1 });
    expect(plan.summary.oldJewellery).toEqual({ total: 1, insert: 0, same: 0, conflict: 1 });
    expect(plan.conflicts).toContainEqual({ table: "lendenItems", uuid: LI1 });
    expect(plan.conflicts).toContainEqual({ table: "oldJewellery", uuid: OJ1 });
  });

  it.each([
    ["customerUuid (userId)", (l: LocalSnapshot["lenden"][number]) => (l.userId = 2)],
    ["date", (l: LocalSnapshot["lenden"][number]) => (l.date = "2025-01-01T00:00:00.000Z")],
    ["amount", (l: LocalSnapshot["lenden"][number]) => (l.amount = 1)],
    ["discount", (l: LocalSnapshot["lenden"][number]) => (l.discount = 1)],
    ["remaining", (l: LocalSnapshot["lenden"][number]) => (l.remaining = 1)],
    ["status", (l: LocalSnapshot["lenden"][number]) => (l.status = 1)],
    ["billNo", (l: LocalSnapshot["lenden"][number]) => (l.billNo = 99)],
    ["amountOverridden", (l: LocalSnapshot["lenden"][number]) => (l.amountOverridden = 1)],
  ])("is a conflict when %s differs, and children still follow per-child rules", (_n, mutate) => {
    const backup = makeBackup();
    const local = toSnapshot(backup);
    mutate(local.lenden[0]);
    local.jamaEntries = local.jamaEntries.filter((j) => j.uuid !== J2);
    const plan = planMerge(backup, local);
    expect(plan.summary.lenden).toEqual({ total: 1, insert: 0, same: 0, conflict: 1 });
    expect(plan.conflicts).toContainEqual({ table: "lenden", uuid: L1 });
    expect(plan.insert.lenden).toEqual([]);
    expect(plan.insert.jamaEntries.map((j) => j.uuid)).toEqual([J2]);
    expect(plan.recomputeLenden).toEqual([L1]);
  });

  it("does not compare jama or baki", () => {
    const backup = makeBackup();
    const local = toSnapshot(backup);
    local.lenden[0].jama = 0;
    local.lenden[0].baki = 1;
    expect(planMerge(backup, local).summary.lenden).toEqual({ total: 1, insert: 0, same: 1, conflict: 0 });
  });

  it("flags a len-den whose photo count differs, and matches an equal count with other file names", () => {
    const backup = makeBackup();
    const more = toSnapshot(backup);
    more.lenden[0].media = ["/x.jpg"];
    const plan = planMerge(backup, more);
    expect(plan.summary.lenden).toEqual({ total: 1, insert: 0, same: 0, conflict: 1 });
    expect(plan.conflicts).toContainEqual({ table: "lenden", uuid: L1 });

    const withPhoto = makeBackup();
    withPhoto.lenden[0].media = ["media/" + L1 + "/1-a.jpg"];
    const sameCount = toSnapshot(withPhoto);
    sameCount.lenden[0].media = ["/phone/renamed.jpg"];
    expect(planMerge(withPhoto, sameCount).summary.lenden).toEqual({ total: 1, insert: 0, same: 1, conflict: 0 });
  });

  it("treats a local len-den with an unknown userId as customerUuid null", () => {
    const backup = makeBackup();
    backup.lenden[0].customerUuid = null;
    const local = toSnapshot(makeBackup());
    local.lenden[0].userId = 999;
    expect(planMerge(backup, local).summary.lenden.same).toBe(1);
  });
});

describe("billNoClashes", () => {
  it("lists sorted distinct bill numbers of inserted len-den used by a different local len-den", () => {
    const backup = makeBackup();
    const extra = (n: number, bill: number | null) => ({
      ...backup.lenden[0],
      uuid: u(100 + n),
      billNo: bill,
    });
    backup.lenden = [backup.lenden[0], extra(1, 9), extra(2, 3), extra(3, 9), extra(4, null), extra(5, 50)];
    backup.lendenItems = [];
    backup.oldJewellery = [];
    backup.jamaEntries = [];

    const local = emptySnapshot();
    local.customers = toSnapshot(makeBackup()).customers;
    const base = toSnapshot(makeBackup()).lenden[0];
    // local bills: 7 (same uuid as backup L1 -> not an insert), 3, 9, 4 (other uuids)
    local.lenden = [
      { ...base, id: 1 },
      { ...base, id: 2, uuid: u(200), billNo: 3 },
      { ...base, id: 3, uuid: u(201), billNo: 9 },
      { ...base, id: 4, uuid: u(202), billNo: 4 },
    ];
    const plan = planMerge(backup, local);
    expect(plan.insert.lenden.map((l) => l.uuid)).toEqual([u(101), u(102), u(103), u(104), u(105)]);
    expect(plan.billNoClashes).toEqual([3, 9]);
  });

  it("is empty when the matching bill number belongs to the same len-den", () => {
    const backup = makeBackup();
    expect(planMerge(backup, toSnapshot(backup)).billNoClashes).toEqual([]);
  });
});

describe("conflicts list and tables", () => {
  it("exposes only known tables", () => {
    const backup = makeBackup();
    const local = toSnapshot(backup);
    local.customers[1].name = "X";
    local.lendenItems = [];
    const plan = planMerge(backup, local);
    const tables = new Set<TableKey>(TABLE_KEYS);
    for (const c of plan.conflicts) expect(tables.has(c.table)).toBe(true);
    expect(plan.conflicts).toEqual([
      { table: "customers", uuid: C2 },
      { table: "lendenItems", uuid: LI1 },
    ]);
  });
});

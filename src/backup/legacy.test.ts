import { BackupError, UUID_RE } from "./format";
import { convertLegacy } from "./legacy";

const WARNING =
  "This is an old backup: jama payments, rehan diya/jama, bill items and old jewellery are not in it and cannot be restored.";

const counter = () => {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
};

const KEPT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const KEPT2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const KEPT3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const users = [
  { id: 1, name: "Ram", address: "Gali", mobileNumber: "999", nickname: "R", createdAt: "2024-01-01T00:00:00.000Z" },
  { id: 2, name: "Sita", address: null, mobileNumber: null, nickname: null, createdAt: "2024-02-01T00:00:00.000Z" },
];

describe("convertLegacy", () => {
  it("converts users, rehan and len-den and always warns", () => {
    const { data, warnings } = convertLegacy(
      {
        users,
        rehan: [
          {
            id: 10,
            userId: 2,
            media: JSON.stringify(["images/a.jpg", "images/b.jpg"]),
            status: 1,
            openDate: "2024-03-01T00:00:00.000Z",
            closedDate: "2024-04-01T00:00:00.000Z",
            productName: "Ring",
            amount: 5000,
            originalMedia: "[]",
          },
        ],
        lenden: [
          {
            id: 20,
            userId: 1,
            date: "2024-05-01T00:00:00.000Z",
            media: "[]",
            amount: 900,
            discount: 100,
            remaining: 800,
            jama: 300,
            baki: 500,
            status: 0,
            billNo: 12,
            amountOverridden: 0,
            originalMedia: "[]",
          },
        ],
      },
      counter(),
    );
    expect(warnings).toEqual([WARNING]);
    expect(data.customers).toEqual([
      {
        uuid: "00000000-0000-4000-8000-000000000001",
        name: "Ram",
        address: "Gali",
        mobileNumber: "999",
        nickname: "R",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      {
        uuid: "00000000-0000-4000-8000-000000000002",
        name: "Sita",
        address: null,
        mobileNumber: null,
        nickname: null,
        createdAt: "2024-02-01T00:00:00.000Z",
        updatedAt: "2024-02-01T00:00:00.000Z",
      },
    ]);
    expect(data.rehan).toEqual([
      {
        uuid: "00000000-0000-4000-8000-000000000003",
        customerUuid: "00000000-0000-4000-8000-000000000002",
        productName: "Ring",
        amount: 5000,
        status: 1,
        openDate: "2024-03-01T00:00:00.000Z",
        closedDate: "2024-04-01T00:00:00.000Z",
        media: ["images/a.jpg", "images/b.jpg"],
        updatedAt: "2024-03-01T00:00:00.000Z",
      },
    ]);
    expect(data.lenden).toEqual([
      {
        uuid: "00000000-0000-4000-8000-000000000004",
        customerUuid: "00000000-0000-4000-8000-000000000001",
        date: "2024-05-01T00:00:00.000Z",
        amount: 900,
        discount: 100,
        remaining: 800,
        jama: 300,
        baki: 500,
        status: 0,
        billNo: 12,
        amountOverridden: 0,
        media: [],
        updatedAt: "2024-05-01T00:00:00.000Z",
      },
    ]);
  });

  it("leaves the child tables empty", () => {
    const { data } = convertLegacy({ users: [], rehan: [], lenden: [] }, counter());
    expect(data.rehanTransactions).toEqual([]);
    expect(data.lendenItems).toEqual([]);
    expect(data.oldJewellery).toEqual([]);
    expect(data.jamaEntries).toEqual([]);
  });

  it("keeps valid uuids from a refined backup and generates the rest", () => {
    const { data } = convertLegacy(
      {
        users: [{ ...users[0], uuid: KEPT }, { ...users[1], uuid: "not-valid" }],
        rehan: [{ id: 1, userId: 1, uuid: KEPT2, media: "[]", openDate: "2024-03-01T00:00:00.000Z" }],
        lenden: [{ id: 1, userId: 1, uuid: KEPT3, media: "[]", date: "2024-03-01T00:00:00.000Z" }],
      },
      counter(),
    );
    expect(data.customers[0].uuid).toBe(KEPT);
    expect(UUID_RE.test(data.customers[1].uuid)).toBe(true);
    expect(data.customers[1].uuid).not.toBe("not-valid");
    expect(data.rehan[0].uuid).toBe(KEPT2);
    expect(data.lenden[0].uuid).toBe(KEPT3);
  });

  it("does not reuse a kept uuid that appears twice", () => {
    const { data } = convertLegacy(
      {
        users: [{ ...users[0], uuid: KEPT }, { ...users[1], uuid: KEPT }],
        rehan: [],
        lenden: [],
      },
      counter(),
    );
    expect(data.customers[0].uuid).toBe(KEPT);
    expect(data.customers[1].uuid).not.toBe(KEPT);
  });

  it("uses userUuid as the customer link when it matches a customer", () => {
    const { data } = convertLegacy(
      {
        users: [{ ...users[0], uuid: KEPT }, { ...users[1], uuid: KEPT2 }],
        // userId says user 1 but userUuid says KEPT2 (Sita): userUuid wins
        rehan: [{ id: 1, userId: 1, userUuid: KEPT2, media: "[]", openDate: "2024-03-01T00:00:00.000Z" }],
        lenden: [{ id: 1, userId: 2, userUuid: KEPT, media: "[]", date: "2024-03-01T00:00:00.000Z" }],
      },
      counter(),
    );
    expect(data.rehan[0].customerUuid).toBe(KEPT2);
    expect(data.lenden[0].customerUuid).toBe(KEPT);
  });

  it("falls back to userId when userUuid is invalid or matches no customer", () => {
    const { data } = convertLegacy(
      {
        users: [{ ...users[0], uuid: KEPT }],
        rehan: [{ id: 1, userId: 1, userUuid: "junk", media: "[]", openDate: "2024-03-01T00:00:00.000Z" }],
        lenden: [{ id: 1, userId: 1, userUuid: KEPT3, media: "[]", date: "2024-03-01T00:00:00.000Z" }],
      },
      counter(),
    );
    expect(data.rehan[0].customerUuid).toBe(KEPT);
    expect(data.lenden[0].customerUuid).toBe(KEPT);
  });

  it("gives null for an orphan user link", () => {
    const { data } = convertLegacy(
      {
        users,
        rehan: [{ id: 1, userId: 999, media: "[]", openDate: "2024-03-01T00:00:00.000Z" }],
        lenden: [{ id: 1, userId: null, media: "[]", date: "2024-03-01T00:00:00.000Z" }],
      },
      counter(),
    );
    expect(data.rehan[0].customerUuid).toBeNull();
    expect(data.lenden[0].customerUuid).toBeNull();
  });

  it("applies defaults for missing status and amountOverridden", () => {
    const { data } = convertLegacy(
      {
        users: [],
        rehan: [{ id: 1, userId: 1, media: "[]", openDate: "2024-03-01T00:00:00.000Z" }],
        lenden: [{ id: 1, userId: 1, media: "[]", date: "2024-03-01T00:00:00.000Z", amount: 10 }],
      },
      counter(),
    );
    expect(data.rehan[0].status).toBe(0);
    expect(data.rehan[0].closedDate).toBeNull();
    expect(data.rehan[0].productName).toBeNull();
    expect(data.rehan[0].amount).toBeNull();
    expect(data.lenden[0].status).toBeNull();
    expect(data.lenden[0].amountOverridden).toBe(1);
    expect(data.lenden[0].billNo).toBeNull();
    expect(data.lenden[0].discount).toBeNull();
  });

  it("treats missing media as an empty list without a warning", () => {
    const { data, warnings } = convertLegacy(
      {
        users: [],
        rehan: [{ id: 1, userId: 1, openDate: "2024-03-01T00:00:00.000Z" }],
        lenden: [{ id: 1, userId: 1, media: null, date: "2024-03-01T00:00:00.000Z" }],
      },
      counter(),
    );
    expect(data.rehan[0].media).toEqual([]);
    expect(data.lenden[0].media).toEqual([]);
    expect(warnings).toEqual([WARNING]);
  });

  it("gives [] plus a warning for bad media JSON", () => {
    const { data, warnings } = convertLegacy(
      {
        users: [],
        rehan: [{ id: 1, userId: 1, media: "{oops", openDate: "2024-03-01T00:00:00.000Z" }],
        lenden: [{ id: 1, userId: 1, media: '"just a string"', date: "2024-03-01T00:00:00.000Z" }],
      },
      counter(),
    );
    expect(data.rehan[0].media).toEqual([]);
    expect(data.lenden[0].media).toEqual([]);
    expect(warnings).toEqual([WARNING, "2 old records had unreadable photo lists and were restored without photos"]);
  });

  it("keeps only string entries of the media list", () => {
    const { data } = convertLegacy(
      {
        users: [],
        rehan: [{ id: 1, userId: 1, media: JSON.stringify(["images/a.jpg", 5, null, ""]), openDate: "2024-03-01T00:00:00.000Z" }],
        lenden: [],
      },
      counter(),
    );
    expect(data.rehan[0].media).toEqual(["images/a.jpg"]);
  });

  it("throws BackupError when users, rehan or lenden is not an array", () => {
    for (const bad of [
      { users: {}, rehan: [], lenden: [] },
      { users: [], rehan: "x", lenden: [] },
      { users: [], rehan: [], lenden: undefined },
    ]) {
      expect(() => convertLegacy(bad, counter())).toThrow(BackupError);
      expect(() => convertLegacy(bad, counter())).toThrow("Not an AJ backup");
    }
  });

  it("skips rows that are not objects", () => {
    const { data } = convertLegacy({ users: [users[0], null, 5], rehan: [null], lenden: ["x"] }, counter());
    expect(data.customers).toHaveLength(1);
    expect(data.rehan).toHaveLength(0);
    expect(data.lenden).toHaveLength(0);
  });
});

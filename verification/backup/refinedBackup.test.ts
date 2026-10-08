import * as fs from "fs";
import * as path from "path";
import { LEGACY_WARNING, convertLegacy } from "../../src/backup/legacy";
import { UUID_RE } from "../../src/backup/format";
import { validateData } from "../../src/backup/validate";
import { toDay } from "../../src/utils/dates";

/**
 * The owner's real refined export lives in docs/refined-backup. That folder is git-ignored customer data, so on any
 * machine without it the whole suite is skipped and never fails.
 */
const DIR = path.join(__dirname, "..", "..", "docs", "refined-backup");
const present = fs.existsSync(path.join(DIR, "users.json"));
const load = (name: string): Record<string, unknown>[] => JSON.parse(fs.readFileSync(path.join(DIR, name), "utf8"));

(present ? describe : describe.skip)("refined real backup (docs/refined-backup)", () => {
  const users = present ? load("users.json") : [];
  const rehan = present ? load("rehan.json") : [];
  const lenden = present ? load("lenden.json") : [];
  let n = 0;
  const newUuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  const { data, warnings } = present
    ? convertLegacy({ users, rehan, lenden }, newUuid, new Date(2026, 9, 4, 12))
    : { data: null as never, warnings: [] as string[] };

  it("converts and validates with no problems; the only warning is the old-backup notice", () => {
    const media = new Set([...data.rehan, ...data.lenden].flatMap((r) => r.media));
    expect(validateData(data, media)).toEqual([]);
    expect(warnings).toEqual([LEGACY_WARNING]);
  });

  it("keeps every row: 286 customers, 549 rehan, 12 len-den", () => {
    expect([data.customers.length, data.rehan.length, data.lenden.length]).toEqual([286, 549, 12]);
  });

  it("keeps uuids, maps userUuid to customerUuid and keeps categories", () => {
    expect(data.customers.map((c) => c.uuid)).toEqual(users.map((u) => u.uuid));
    expect(data.rehan.map((r) => r.uuid)).toEqual(rehan.map((r) => r.uuid));
    expect(data.lenden.map((l) => l.uuid)).toEqual(lenden.map((l) => l.uuid));
    expect(data.customers.every((c) => UUID_RE.test(c.uuid))).toBe(true);
    expect(data.rehan.map((r) => r.customerUuid)).toEqual(rehan.map((r) => r.userUuid));
    expect(data.lenden.map((l) => l.customerUuid)).toEqual(lenden.map((l) => l.userUuid));
    expect(data.rehan.map((r) => r.category)).toEqual(rehan.map((r) => r.category ?? null));
  });

  it("stores every openDate as the local day of the old timestamp", () => {
    expect(data.rehan.map((r) => r.openDate)).toEqual(rehan.map((r) => toDay(new Date(r.openDate as string))));
  });
});

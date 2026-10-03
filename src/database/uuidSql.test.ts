import { UUID_RE } from "../backup/format";
import { UUID_SQL, reusableUuid } from "./uuidSql";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-9bbb-bbbbbbbbbbbb";

describe("UUID_SQL", () => {
  it("does not use abs(random()), which overflows on the smallest 64-bit integer", () => {
    expect(UUID_SQL).not.toContain("abs(");
    expect(UUID_SQL).toContain("substr('89ab', 1 + (random() & 3), 1)");
  });

  it("yields valid v4 uuids and survives random() = INT64_MIN when run in SQLite", () => {
    // node:sqlite ships with Node 22.5+; skip quietly where it is not available.
    let DatabaseSync: (new (path: string) => { prepare: (sql: string) => { all: () => Record<string, string>[] } }) | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      DatabaseSync = require("node:sqlite").DatabaseSync;
    } catch {
      return;
    }
    if (!DatabaseSync) return;
    const db = new DatabaseSync(":memory:");
    const rows = db
      .prepare(
        `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 300) SELECT ${UUID_SQL} AS u FROM n`,
      )
      .all();
    expect(rows).toHaveLength(300);
    for (const r of rows) expect(UUID_RE.test(r.u)).toBe(true);
    // (-9223372036854775808 & 3) is 0: the digit is '8', no overflow error.
    const edge = db.prepare("SELECT substr('89ab', 1 + (-9223372036854775807 - 1 & 3), 1) AS v").all();
    expect(edge[0].v).toBe("8");
  });
});

describe("reusableUuid", () => {
  it("keeps a valid uuid once and remembers it", () => {
    const taken = new Set<string>();
    expect(reusableUuid(A, taken)).toBe(A);
    expect(taken.has(A)).toBe(true);
    expect(reusableUuid(B, taken)).toBe(B);
  });

  it("returns null for missing, malformed or already-used uuids", () => {
    const taken = new Set<string>([A]);
    expect(reusableUuid(undefined, taken)).toBeNull();
    expect(reusableUuid(null, taken)).toBeNull();
    expect(reusableUuid("", taken)).toBeNull();
    expect(reusableUuid("not-a-uuid", taken)).toBeNull();
    expect(reusableUuid(A, taken)).toBeNull();
  });
});

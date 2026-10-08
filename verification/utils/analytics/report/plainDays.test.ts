import { billingSummary, buildBillRows, discountPerBill, numberedVsEarlier } from "../../../../src/utils/analytics/report/billing";
import { itemMixByQuarter } from "../../../../src/utils/analytics/report/itemsView";
import { ageBuckets, monthlyBook, redeemBuckets } from "../../../../src/utils/analytics/report/pledgeBook";
import { buildPledgeRows } from "../../../../src/utils/analytics/report/pledges";
import { dataQuality } from "../../../../src/utils/analytics/report/quality";
import { NOW, day, midnightIso } from "./fixture";
import { groupVillages } from "../../../../src/utils/analytics/villages";
import { AnalyticsData, LendenRow, RehanRow } from "../../../../src/utils/analytics/types";

// Calendar dates are stored as plain `YYYY-MM-DD` days now; rows from before the migration are ISO
// timestamps. The report works in calendar days, so the same day must read the same in every form.
type Stamp = (y: number, m: number, d: number) => string;
const noon: Stamp = (y, m, d) => new Date(y, m - 1, d, 12).toISOString();
const FORMS: [string, Stamp][] = [
  ["a plain day", day],
  ["an ISO local-midnight timestamp", midnightIso],
  ["an ISO noon timestamp", noon],
];

// Early, midday and late on 2 Oct 2026: the day counts must not move with the time of day.
const NOWS = [new Date(2026, 9, 2, 0, 5), NOW, new Date(2026, 9, 2, 23, 55)];

const empty: AnalyticsData = {
  users: [{ id: 1, name: "Ram", address: "Manwal" }],
  lenden: [], jama: [], rehan: [], rehanTx: [], soldItems: [], oldItems: [],
};
const pledge = (id: number, openDate: string, o: Partial<RehanRow> = {}): RehanRow => ({
  id, userId: 1, openDate, closedDate: null, status: 0, amount: 1000, productName: "Chain", media: "[]", ...o,
});
const redeemed = (id: number, openDate: string, closedDate: string): RehanRow =>
  pledge(id, openDate, { closedDate, status: 1 });
const bill = (id: number, date: string, o: Partial<LendenRow> = {}): LendenRow => ({
  id, userId: 1, date, amount: 1000, discount: null, remaining: 1000, jama: null, baki: 1000, status: 0,
  billNo: null, amountOverridden: 0, media: "[]", ...o,
});

/** y, m, d of the calendar day `n` days before (or, if negative, after) `from`. */
const daysFrom = (from: Date, n: number): [number, number, number] => {
  const t = new Date(from.getFullYear(), from.getMonth(), from.getDate() - n);
  return [t.getFullYear(), t.getMonth() + 1, t.getDate()];
};

// Bucket edges: ages are counted in whole calendar days.
const AGES: [number, string][] = [
  [0, "≤3 mo"], [91, "≤3 mo"], [92, "3–6 mo"], [182, "3–6 mo"], [183, "6–12 mo"],
  [364, "6–12 mo"], [365, "1–2 yr"], [729, "1–2 yr"], [730, "2 yr +"],
];

describe.each(FORMS)("pledges with dates stored as %s", (_name, stored) => {
  it("reads the year, month and weekday of the day opened", () => {
    const rows = buildPledgeRows(
      {
        ...empty,
        rehan: [
          pledge(1, stored(2025, 12, 31)), // Wednesday
          pledge(2, stored(2026, 1, 1)), // Thursday
          pledge(3, stored(2026, 3, 31)), // Tuesday
          pledge(4, stored(2026, 4, 1)), // Wednesday
        ],
      },
      NOW,
    );
    expect(rows.map((r) => [r.year, r.month, r.weekday])).toEqual([
      ["2025", "2025-12", 3],
      ["2026", "2026-01", 4],
      ["2026", "2026-03", 2],
      ["2026", "2026-04", 3],
    ]);
  });

  it("counts days open and days to redeem in calendar days, at any time of day", () => {
    const data: AnalyticsData = {
      ...empty,
      rehan: [
        pledge(1, stored(2025, 12, 31)),
        pledge(2, stored(2026, 9, 25)),
        pledge(3, stored(2026, 10, 2)), // opened today
        redeemed(4, stored(2026, 1, 10), stored(2026, 7, 10)),
        redeemed(5, stored(2026, 5, 5), stored(2026, 5, 5)), // opened and redeemed on one day
      ],
    };
    for (const now of NOWS) {
      const rows = buildPledgeRows(data, now);
      expect(rows.map((r) => [r.daysOpen, r.daysToRedeem])).toEqual([
        [275, null], [7, null], [0, null], [null, 181], [null, 0],
      ]);
    }
  });

  it.each(AGES)("puts a pledge open %i days in the %s age bucket", (age, label) => {
    for (const now of NOWS) {
      const rows = buildPledgeRows({ ...empty, rehan: [pledge(1, stored(...daysFrom(now, age)))] }, now);
      expect(ageBuckets(rows).filter((b) => b.count).map((b) => b.label)).toEqual([label]);
    }
  });

  it.each(AGES)("puts a pledge redeemed after %i days in the %s redeem bucket", (days, label) => {
    const [y, m, dd] = [2025, 1, 10];
    const closed = daysFrom(new Date(y, m - 1, dd), -days);
    const rows = buildPledgeRows({ ...empty, rehan: [redeemed(1, stored(y, m, dd), stored(...closed))] }, NOW);
    expect(redeemBuckets(rows).filter((b) => b.count).map((b) => b.label)).toEqual([label]);
  });

  it("books a pledge opened on the last day of a month and redeemed on the first of the next", () => {
    const rows = buildPledgeRows(
      { ...empty, rehan: [redeemed(1, stored(2026, 3, 31), stored(2026, 4, 1))] },
      NOW,
    );
    const months = monthlyBook(rows, NOW);
    const at = (key: string) => months.find((m) => m.key === key)!;
    expect(months[0].key).toBe("2026-03");
    expect(at("2026-03")).toMatchObject({ opened: 1000, openedCount: 1, redeemed: 0, redeemedCount: 0, openAtEnd: 1000 });
    expect(at("2026-04")).toMatchObject({ opened: 0, openedCount: 0, redeemed: 1000, redeemedCount: 1, openAtEnd: 0 });
  });

  it("counts a pledge in the calendar quarter of the day opened", () => {
    const rows = buildPledgeRows(
      {
        ...empty,
        rehan: [
          pledge(1, stored(2025, 12, 31)), // before the four quarters shown
          pledge(2, stored(2026, 3, 31)), // Q1
          pledge(3, stored(2026, 4, 1)), // Q2
          pledge(4, stored(2026, 6, 30)), // Q2
          pledge(5, stored(2026, 7, 1)), // Q3
          pledge(6, stored(2026, 9, 30)), // Q3
          pledge(7, stored(2026, 10, 1)), // Q4
        ],
      },
      NOW,
    );
    const mix = itemMixByQuarter(rows, NOW, 4, 3);
    expect(mix.buckets.map((b) => b.label)).toEqual(["Q1 '26", "Q2 '26", "Q3 '26", "Q4 '26"]);
    expect(mix.series).toEqual([{ label: "Chain", values: [1, 2, 2, 1] }]);
  });
});

describe("pledges opened in one form and redeemed in another", () => {
  const PAIRS: [string, string, Stamp, Stamp][] = FORMS.flatMap(([a, open]) =>
    FORMS.map(([b, close]): [string, string, Stamp, Stamp] => [a, b, open, close]),
  );

  it.each(PAIRS)("counts days to redeem the same when opened as %s and redeemed as %s", (_a, _b, open, close) => {
    const rows = buildPledgeRows({ ...empty, rehan: [redeemed(1, open(2026, 1, 10), close(2026, 7, 10))] }, NOW);
    expect(rows[0].daysToRedeem).toBe(181);
  });

  it.each(PAIRS)("does not call a same-day redeem a close before the opening: %s, then %s", (_a, _b, open, close) => {
    const report = dataQuality({ ...empty, rehan: [redeemed(1, open(2026, 9, 15), close(2026, 9, 15))] }, NOW);
    expect(report.checks.some((c) => c.title === "Dates or statuses need a look")).toBe(false);
    expect(report.checks.some((c) => c.title === "Dates and statuses are consistent")).toBe(true);
  });

  it.each(PAIRS)("flags a redeem on the day before the opening: %s, then %s", (_a, _b, open, close) => {
    const report = dataQuality({ ...empty, rehan: [redeemed(1, open(2026, 9, 15), close(2026, 9, 14))] }, NOW);
    const check = report.checks.find((c) => c.title === "Dates or statuses need a look");
    expect(check?.detail).toBe("0 redeemed without a close date, 1 closed before opening, 0 open with a close date.");
  });
});

describe.each(FORMS)("bills with dates stored as %s", (_name, stored) => {
  const groups = groupVillages(empty.users);

  it("counts days open in calendar days, at any time of day", () => {
    const data: AnalyticsData = {
      ...empty,
      lenden: [
        bill(1, stored(2026, 9, 25)),
        bill(2, stored(2026, 1, 7)),
        bill(3, stored(2026, 10, 2)), // billed today
        bill(4, stored(2026, 9, 25), { status: 1, baki: 0 }), // closed
      ],
    };
    for (const now of NOWS) {
      const rows = buildBillRows(data, groups, now);
      expect(Object.fromEntries(rows.map((r) => [r.id, r.daysOpen]))).toEqual({ 1: 7, 2: 268, 3: 0, 4: null });
    }
  });

  it("lists bills newest day first and sums them whatever the form", () => {
    const rows = buildBillRows(
      {
        ...empty,
        lenden: [
          bill(1, stored(2026, 9, 8), { billNo: 1 }),
          bill(2, stored(2026, 9, 9), { billNo: 2 }),
          bill(3, stored(2026, 9, 7)),
        ],
      },
      groups,
      NOW,
    );
    expect(rows.map((r) => r.id)).toEqual([2, 1, 3]);
    expect(discountPerBill(rows).bills.map((b) => b.label)).toEqual(["ID 3", "#1", "#2"]);
    expect(billingSummary(rows)).toMatchObject({ bills: 3, gross: 3000, pending: 3000 });
    const { numbered, earlier } = numberedVsEarlier(rows);
    expect([numbered.from, numbered.to]).toEqual([stored(2026, 9, 8), stored(2026, 9, 9)]);
    expect([earlier.from, earlier.to]).toEqual([stored(2026, 9, 7), stored(2026, 9, 7)]);
  });
});

describe("bills dated the same day in different forms", () => {
  it("fall back to the bill id, newest first, because the time of day is not part of the date", () => {
    const groups = groupVillages(empty.users);
    const lateEvening = new Date(2026, 8, 8, 23, 30).toISOString();
    const rows = buildBillRows(
      {
        ...empty,
        lenden: [
          bill(1, lateEvening),
          bill(2, day(2026, 9, 8)),
          bill(3, midnightIso(2026, 9, 8)),
          bill(4, noon(2026, 9, 8)),
          bill(5, day(2026, 9, 7)),
        ],
      },
      groups,
      NOW,
    );
    expect(rows.map((r) => r.id)).toEqual([4, 3, 2, 1, 5]);
    expect(discountPerBill(rows).bills.map((b) => b.label)).toEqual(["ID 5", "ID 1", "ID 2", "ID 3", "ID 4"]);
  });
});

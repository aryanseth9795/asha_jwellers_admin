import { UNREADABLE_AGING, baakiAging, baakiAt } from "./baki";
import { buildCategoryView } from "./categories";
import { buildCustomersView, countNewCustomers } from "./customers";
import { buildImportanceView } from "./importance";
import { buildMetalView } from "./metal";
import { buildOverview } from "./overview";
import {
  Period, allPeriod, customPeriod, fyPeriod, monthPeriod, previousPeriod, quarterPeriod, samePeriodLastYear, weekPeriod,
} from "./periods";
import { buildRehanView } from "./rehan";
import { buildSalesView } from "./sales";
import { buildTrends } from "./trends";
import { AnalyticsData, LendenRow, RehanRow } from "./types";
import { buildVillageView, groupVillages } from "./villages";
import { billingSummary, buildBillRows, discountPerBill, numberedVsEarlier } from "./report/billing";
import { keyFindings } from "./report/findings";
import { NOW, fixtureData, iso, mapDates } from "./report/fixture";
import { bundleStats, itemMixByQuarter, itemStats, rankItems } from "./report/itemsView";
import {
  ageBuckets, cohorts, interestWhatIf, loggingGap, monthlyBook, pledgeStats, redeemBuckets, weekdays,
} from "./report/pledgeBook";
import {
  concentration, customerSegments, customersAdded, exposures, repeatCustomers, villageStats,
} from "./report/pledgeCustomers";
import { buildPledgeRows, filterOptions } from "./report/pledges";
import { dataQuality } from "./report/quality";
import { ledgerScale, villageShares } from "./report/together";
import { normalizeDay, parseDay } from "../dates";

// The migration changes the form a calendar date is stored in, never the day it names. Analytics
// work in calendar days, so the same ledger has to give the same answers whether its dates are
// the old ISO timestamps, the migrated plain days, or (while the migration is under way) a mix.

const asPlainDay = (stored: string) => normalizeDay(stored);
const asMidnight = (stored: string) => parseDay(normalizeDay(stored)).toISOString();

// The report fixture, plus the rows it leaves out: item lines, more payments, two bills on one day,
// a pledge opened and redeemed on one day, and bills and pledges on the edge days of the weeks,
// months, quarters and financial years. All dates are old-style noon timestamps.
const richer = (data: AnalyticsData): AnalyticsData => {
  const sameDayBill = (id: number): LendenRow => ({
    id, userId: 4, date: iso(2026, 9, 12), amount: 5000, discount: null, remaining: 5000, jama: null,
    baki: 2000, status: 0, billNo: id, amountOverridden: 0, media: "[]",
  });
  const edgeBill = (id: number, date: string): LendenRow => ({
    id, userId: 5, date, amount: 1000, discount: null, remaining: 1000, jama: 1000,
    baki: 0, status: 1, billNo: id, amountOverridden: 0, media: "[]",
  });
  const pledge = (id: number, openDate: string, o: Partial<RehanRow> = {}): RehanRow => ({
    id, userId: 2, openDate, closedDate: null, status: 0, amount: 1000, productName: "Ring", media: "[]", ...o,
  });
  return {
    ...data,
    lenden: [
      ...data.lenden,
      sameDayBill(7),
      sameDayBill(8),
      edgeBill(9, iso(2026, 4, 1)), // first day of FY 2026-27 and of Q1
      edgeBill(10, iso(2026, 3, 31)), // last day of FY 2025-26
      edgeBill(11, iso(2026, 10, 1)), // first day of October and of Q3
      edgeBill(12, iso(2026, 9, 28)), // the Monday that starts the week of 2 Oct
      edgeBill(13, iso(2026, 10, 4)), // the Sunday that ends it
    ],
    jama: [
      ...data.jama,
      { lendenId: 1, amount: 3000, date: iso(2026, 9, 12) },
      { lendenId: 5, amount: 9000, date: iso(2026, 2, 3) },
    ],
    rehan: [
      ...data.rehan,
      pledge(10, iso(2026, 9, 15), { closedDate: iso(2026, 9, 15), status: 1, amount: 0 }), // opened and redeemed on one day
      pledge(11, iso(2026, 4, 1)),
      pledge(12, iso(2026, 3, 31)),
    ],
    rehanTx: [...data.rehanTx, { rehanId: 3, type: "jama", amount: 8000, date: iso(2026, 3, 31) }],
    soldItems: [
      { lendenId: 1, metal: "gold", purity: "22KT", weight: 10, total: 9500 },
      { lendenId: 3, metal: "silver", purity: "Desi", weight: 300, total: 44545 },
      { lendenId: 5, metal: "gold", purity: "18KT", weight: 6, total: 16000 },
      { lendenId: 6, metal: "gold", purity: "22KT", weight: 8, total: 20300 },
    ],
    oldItems: [{ lendenId: 6, metal: "gold", weight: 2, value: 800 }],
  };
};

// Every table in a different form, and the forms alternating inside each table.
const mixedForms = (data: AnalyticsData): AnalyticsData => {
  const forms = [asPlainDay, asMidnight, (stored: string) => stored];
  const pick = (i: number, stored: string) => forms[i % forms.length](stored);
  return {
    ...data,
    lenden: data.lenden.map((b, i) => ({ ...b, date: pick(i, b.date) })),
    jama: data.jama.map((j, i) => ({ ...j, date: pick(i + 1, j.date) })),
    rehan: data.rehan.map((r, i) => ({
      ...r,
      openDate: pick(i, r.openDate),
      closedDate: r.closedDate === null ? null : pick(i + 1, r.closedDate),
    })),
    rehanTx: data.rehanTx.map((t, i) => ({ ...t, date: pick(i + 2, t.date) })),
  };
};

// Dates that pass through an answer untouched (a bill's own date) differ between forms by
// definition; compare them as the day they name.
const ISO_STAMP = /^\d{4}-\d{2}-\d{2}T/;
const settle = (value: unknown): unknown => {
  if (typeof value === "string") return ISO_STAMP.test(value) ? normalizeDay(value) : value;
  if (Array.isArray(value)) return value.map(settle);
  if (value instanceof Date) return value;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, settle(v)]));
  }
  return value;
};

const answers = (data: AnalyticsData, now: Date) => {
  const groups = groupVillages(data.users);
  const pledges = buildPledgeRows(data, now, groups);
  const bills = buildBillRows(data, groups, now);
  const periods: Period[] = [
    weekPeriod(now),
    monthPeriod(now),
    quarterPeriod(now),
    fyPeriod(2026),
    fyPeriod(2025),
    customPeriod(new Date(2026, 8, 1), new Date(2026, 8, 30)),
    allPeriod([...data.lenden.map((b) => b.date), ...data.rehan.map((r) => r.openDate)]),
  ];
  return {
    byPeriod: periods.map((period) => ({
      label: period.label,
      period,
      sales: buildSalesView(data, period),
      metal: buildMetalView(data, period),
      categories: buildCategoryView(data, period, previousPeriod(period)),
      villages: buildVillageView(data, period, previousPeriod(period)),
      importance: buildImportanceView(data, period),
      customers: buildCustomersView(data, period, now),
      newCustomers: countNewCustomers(data, period),
      rehan: buildRehanView(data, period),
      overview: buildOverview(data, period, previousPeriod(period), samePeriodLastYear(period), now),
    })),
    trends: (["week", "month", "quarter", "fy"] as const).map((grain) => buildTrends(data, grain, now)),
    baki: {
      aging: baakiAging(data, now),
      at: [new Date(2026, 3, 1), new Date(2026, 8, 1), new Date(2026, 9, 1), now].map((at) => baakiAt(data, at)),
    },
    pledges,
    bills,
    quality: dataQuality(data, now),
    billing: { summary: billingSummary(bills), discount: discountPerBill(bills), groups: numberedVsEarlier(bills) },
    book: {
      stats: pledgeStats(pledges),
      monthly: monthlyBook(pledges, now),
      age: ageBuckets(pledges),
      redeem: redeemBuckets(pledges),
      cohorts: cohorts(pledges),
      weekdays: weekdays(pledges),
      interest: interestWhatIf(pledges, 0.02),
      gap: loggingGap(pledges),
    },
    items: {
      stats: itemStats(pledges),
      ranked: rankItems(pledges, 2),
      mix: itemMixByQuarter(pledges, now),
      bundles: bundleStats(pledges),
    },
    people: {
      villages: villageStats(pledges, groups),
      concentration: concentration(pledges),
      exposures: exposures(pledges, data.users, 5),
      repeat: repeatCustomers(pledges),
      added: customersAdded(data.users, now),
      segments: customerSegments(data, pledges, groups),
    },
    together: { scale: ledgerScale(pledges, bills), shares: villageShares(pledges, bills, groups.order) },
    findings: keyFindings(pledges, bills, new Map(data.users.map((u) => [u.id, u.name]))),
  };
};

const reference = richer(fixtureData);
const VARIANTS: [string, AnalyticsData][] = [
  ["plain days", mapDates(reference, asPlainDay)],
  ["ISO local-midnight timestamps", mapDates(reference, asMidnight)],
  ["a mix of plain days and both kinds of timestamp", mixedForms(reference)],
];
// Early, midday and late on 2 Oct 2026. No entry is dated that day, so time of day must not matter.
const NOWS: [string, Date][] = [
  ["just after midnight", new Date(2026, 9, 2, 0, 5)],
  ["midday", NOW],
  ["just before midnight", new Date(2026, 9, 2, 23, 55)],
];

describe("the reference ledger", () => {
  const result = answers(reference, NOW);
  const period = (label: string) => result.byPeriod.find((p) => p.label === label)!;

  it("puts the bills and pledges on edge days in the right week, month, quarter and financial year", () => {
    expect(period("28 Sep – 4 Oct 2026").sales.bills).toBe(4); // bills 12, 4, 11 and 13
    expect(period("Oct 2026").sales.bills).toBe(2); // bills 11 and 13
    expect(period("Q3 FY 2026-27").sales.bills).toBe(2);
    expect(period("1 Sep 2026 – 30 Sep 2026").sales.bills).toBe(7); // 28 Sep is in, 1 Oct is out
    expect(period("FY 2026-27").sales.bills).toBe(10); // 1 Apr 2026 is in, 31 Mar is out
    expect(period("FY 2025-26").sales.bills).toBe(3); // bills 5, 6 and 10
    expect(period("FY 2026-27").rehan.opened).toBe(6); // pledges 6 to 11
    expect(period("FY 2025-26").rehan.opened).toBe(5); // pledges 2 to 5 and 12
  });

  it("is not an empty comparison", () => {
    expect(result.pledges).toHaveLength(12);
    expect(result.bills).toHaveLength(13);
    expect(period("FY 2026-27").sales.sales).toBe(120245);
    expect(result.baki.aging.reduce((total, bucket) => total + bucket.count, 0)).toBeGreaterThan(0);
  });
});

describe.each(VARIANTS)("a ledger stored as %s", (_name, data) => {
  it.each(NOWS)("gives the answers the old noon timestamps gave, %s", (_label, now) => {
    expect(settle(answers(data, now))).toEqual(settle(answers(reference, now)));
  });
});

describe("a ledger of ISO local-midnight timestamps and its plain-day equivalent", () => {
  const midnight = mapDates(reference, asMidnight);
  const plain = mapDates(reference, asPlainDay);
  const groups = groupVillages(reference.users);

  const ages = (data: AnalyticsData, now: Date) => {
    const pledges = buildPledgeRows(data, now, groups);
    const bills = buildBillRows(data, groups, now);
    const customers = buildCustomersView(data, allPeriod(data.lenden.map((b) => b.date)), now).customers;
    return {
      pledgeDays: pledges.map((p) => [p.id, p.daysOpen, p.daysToRedeem]),
      billDays: bills.map((b) => [b.id, b.daysOpen]),
      lastVisit: customers.map((c) => [c.userId, c.daysSinceLastVisit]),
      pledgeAges: ageBuckets(pledges),
      redeemAges: redeemBuckets(pledges),
      baakiAging: baakiAging(data, now),
    };
  };

  it.each(NOWS)("have the same days open, age buckets and baaki aging, %s", (_label, now) => {
    const expected = ages(midnight, now);
    expect(ages(plain, now)).toEqual(expected);
    // and the comparison is not between two empty answers
    expect(expected.pledgeAges.reduce((n, b) => n + b.count, 0)).toBeGreaterThan(0);
    expect(expected.redeemAges.reduce((n, b) => n + b.count, 0)).toBeGreaterThan(0);
    expect(expected.baakiAging.reduce((n, b) => n + b.count, 0)).toBeGreaterThan(0);
    expect(expected.billDays.some(([, days]) => days !== null)).toBe(true);
    expect(expected.lastVisit.length).toBeGreaterThan(0);
  });
});

// The backup rules let a date that cannot be read pass through untouched, so analytics can meet one.
// It must not take the screen down: such a row has no age, and falls outside every period.
describe("a ledger with dates that cannot be read", () => {
  const BAD = "not a date";
  const garbled: AnalyticsData = {
    ...reference,
    lenden: reference.lenden.map((b, i) => (i % 3 === 0 ? { ...b, date: BAD } : b)),
    jama: reference.jama.map((j, i) => (i % 2 === 0 ? { ...j, date: BAD } : j)),
    rehan: reference.rehan.map((r, i) =>
      i % 3 === 0 ? { ...r, openDate: BAD } : i % 3 === 1 && r.closedDate ? { ...r, closedDate: BAD } : r,
    ),
    rehanTx: reference.rehanTx.map((t) => ({ ...t, date: BAD })),
  };

  it.each(NOWS)("is still analysed, %s", (_label, now) => {
    expect(() => answers(garbled, now)).not.toThrow();
  });

  it("gives an unreadable date no day count, never NaN", () => {
    const groups = groupVillages(garbled.users);
    const pledges = buildPledgeRows(garbled, NOW, groups);
    const bills = buildBillRows(garbled, groups, NOW);
    const counts = [...pledges.flatMap((p) => [p.daysOpen, p.daysToRedeem]), ...bills.map((b) => b.daysOpen)];
    expect(counts.some((n) => n !== null && Number.isNaN(n))).toBe(false);
    expect(pledges.find((p) => p.id === 1)!.daysOpen).toBeNull(); // pledge 1 has no readable open date
    expect(pledges.find((p) => p.id === 2)!.daysOpen).not.toBeNull(); // pledge 2 still does
    expect(bills.find((b) => b.id === 1)!.daysOpen).toBeNull(); // bill 1 has no readable date
  });

  it("keeps the baki of a bill it cannot age in a Date unreadable bucket, so the buckets add up", () => {
    const open = (id: number, date: string, baki: number): LendenRow => ({
      id, userId: 1, date, amount: 1000, discount: null, jama: null, baki, status: 0,
    });
    const lenden = [open(1, BAD, 700), open(2, "2026-09-20", 100), open(3, "2025-01-01", 200), open(4, "2026-02-30", 50)];
    const aging = baakiAging({ ...garbled, lenden }, NOW);
    expect(aging.map((b) => b.label)).toEqual([
      "0–30 days", "31–90 days", "91–180 days", "181–365 days", "> 1 year", UNREADABLE_AGING,
    ]);
    expect(aging.map((b) => b.amount)).toEqual([100, 0, 0, 0, 200, 750]); // 2026-02-30 is not a day either
    expect(aging.reduce((total, b) => total + b.amount, 0)).toBe(1050);
    expect(aging.reduce((total, b) => total + b.count, 0)).toBe(4);
  });

  it("adds the Date unreadable bucket only when a bill needs it", () => {
    expect(baakiAging(reference, NOW).map((b) => b.label)).not.toContain(UNREADABLE_AGING);
    expect(baakiAging(garbled, NOW).map((b) => b.label)).toContain(UNREADABLE_AGING);
  });

  it("does not count unreadable baki as older than six months in the overview", () => {
    const data: AnalyticsData = {
      ...reference,
      lenden: [{ id: 1, userId: 1, date: BAD, amount: 1000, discount: null, jama: null, baki: 1000, status: 0 }],
      jama: [], rehan: [], rehanTx: [], soldItems: [], oldItems: [],
    };
    const view = buildOverview(data, monthPeriod(NOW), null, null, NOW);
    expect(view.insights.some((i) => i.text.includes("over 6 months old"))).toBe(false);
  });

  it("gives a pledge with an unreadable open date no NaN year, month or weekday", () => {
    const rows = buildPledgeRows(garbled, NOW, groupVillages(garbled.users));
    const bad = rows.find((r) => r.id === 1)!;
    expect([bad.year, bad.month, bad.weekday]).toEqual(["Unknown", "", -1]);
    const text = JSON.stringify([filterOptions(rows, groupVillages(garbled.users)), cohorts(rows), monthlyBook(rows, NOW), loggingGap(rows)]);
    expect(text).not.toContain("NaN");
    expect(filterOptions(rows, groupVillages(garbled.users)).years).toContain("Unknown");
    expect(weekdays(rows).reduce((n, w) => n + w.count, 0)).toBe(rows.length - 4); // pledges 1, 4, 7, 10 are unreadable
  });

  it("builds the all-time period from the dates it can read", () => {
    const readable = allPeriod(["2024-05-01", "2026-03-31"]);
    expect(allPeriod(["2024-05-01", BAD, "2026-03-31"])).toEqual(readable);
    expect(allPeriod([BAD]).start).toEqual(allPeriod([]).start);
  });

  it("does not let an unreadable date pose as a customer's latest or first activity", () => {
    const data: AnalyticsData = {
      ...garbled,
      users: [{ id: 1, name: "A" }],
      lenden: [
        { id: 1, userId: 1, date: BAD, amount: 10, discount: null, jama: null, baki: 0, status: 1 },
        { id: 2, userId: 1, date: "2026-04-01", amount: 10, discount: null, jama: null, baki: 0, status: 1 },
      ],
      rehan: [],
    };
    const view = buildCustomersView(data, fyPeriod(2026), NOW);
    expect(view.customers[0].daysSinceLastVisit).toBe(184);
    expect(view.newInPeriod).toBe(1);
    expect(countNewCustomers(data, fyPeriod(2026))).toBe(1);
  });
});

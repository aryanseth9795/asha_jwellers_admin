import { sum } from "../periods";
import { formatCompactRupees, formatInr, formatPct } from "../format";
import { OTHER_VILLAGES, UNKNOWN_VILLAGE } from "../villages";
import { PledgeRow } from "./pledges";
import { BillRow, billingSummary } from "./billing";
import { loggingGap, monthLabelLong, pledgeStats } from "./pledgeBook";
import { itemStats } from "./itemsView";

export type FindingTag = "Risk" | "Watch" | "Upside" | "Data";

export interface Finding {
  tag: FindingTag;
  title: string;
  detail: string;
}

const inrC = (n: number) => `₹${formatCompactRupees(n)}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const isNamed = (v: string) => v !== OTHER_VILLAGES && v !== UNKNOWN_VILLAGE;

/** Spec §12.6. `pledges` carry the report filters; `bills` follow the village filter only. */
export const keyFindings = (pledges: PledgeRow[], bills: BillRow[], names: Map<number, string>): Finding[] => {
  const out: Finding[] = [];
  const s = pledgeStats(pledges);
  const open = pledges.filter((p) => p.open);

  if (s.openBook > 0 && s.openYearPlusShare >= 0.25) {
    const y1 = open.filter((p) => (p.daysOpen ?? 0) >= 365);
    const y2 = open.filter((p) => (p.daysOpen ?? 0) >= 730);
    const verb = (n: number) => (n === 1 ? "is" : "are");
    out.push({
      tag: "Risk",
      title: `${formatPct(s.openYearPlusShare)} of open principal is a year old or more`,
      detail:
        `${plural(y1.length, "pledge")} worth ${inrC(sum(y1.map((p) => p.principal)))} ${verb(y1.length)} past 12 months and ` +
        `${plural(y2.length, "pledge")} worth ${inrC(sum(y2.map((p) => p.principal)))} ${verb(y2.length)} past 24 months.` +
        (s.medianDaysToRedeem !== null ? ` Redeemed pledges took a median of ${Math.round(s.medianDaysToRedeem)} days.` : ""),
    });
  }

  const b = billingSummary(bills);
  if (b.pending > 0) {
    const offFile = bills.filter((x) => !x.onFile && x.pending > 0);
    const offAmount = sum(offFile.map((x) => x.pending));
    const oldest = bills.reduce((m, x) => Math.max(m, x.daysOpen ?? 0), 0);
    const parts: string[] = [];
    if (offAmount > 0) {
      parts.push(
        `${formatPct(offAmount / b.pending)} of it (${inrC(offAmount)}) sits on ${plural(offFile.length, "bill")} whose customer is not in the customer file.`,
      );
    }
    parts.push(`The oldest unpaid bill is ${oldest} days old.`);
    out.push({ tag: "Risk", title: `${inrC(b.pending)} of ${inrC(b.net)} billed is unpaid`, detail: parts.join(" ") });
  }

  const openByVillage = new Map<string, number>();
  for (const p of open) openByVillage.set(p.village, (openByVillage.get(p.village) ?? 0) + p.principal);
  const named = [...openByVillage].filter(([v]) => isNamed(v)).sort((x, y) => y[1] - x[1]);
  if (s.openBook > 0 && named.length >= 3) {
    const [first, second] = named;
    const topShare = (first[1] + second[1]) / s.openBook;
    if (topShare >= 0.4) {
      out.push({
        tag: "Watch",
        title: `${first[0]} and ${second[0]} hold ${formatPct(topShare)} of the open book`,
        detail: `${first[0]} ${inrC(first[1])} and ${second[0]} ${inrC(second[1])} out of ${inrC(s.openBook)}.`,
      });
    }
  }

  const items = itemStats(pledges)
    .filter((i) => i.openPrincipal > 0)
    .sort((x, y) => y.openPrincipal - x.openPrincipal);
  if (items.length >= 2) {
    const top = items[0];
    out.push({
      tag: "Watch",
      title: `${top.item} is the largest open exposure at ${inrC(top.openPrincipal)}`,
      detail:
        `${formatPct(top.openShare)} of the open book. ${formatPct(top.redeemedPct)} of ${top.item} pledges have been redeemed, ` +
        `against ${formatPct(s.redeemedPct)} for everything in this view. Average ticket ${inrC(top.avgTicket)}.`,
    });
  }

  const villageRates = [...new Set(pledges.map((p) => p.village))]
    .filter(isNamed)
    .map((village) => {
      const vs = pledgeStats(pledges.filter((p) => p.village === village));
      return { village, pledges: vs.pledges, redeemed: vs.redeemed, rate: vs.redeemedPct, open: vs.openBook };
    })
    .filter((v) => v.pledges >= 10)
    .sort((x, y) => x.rate - y.rate);
  if (villageRates.length >= 2 && villageRates[0].rate < villageRates[villageRates.length - 1].rate) {
    const worst = villageRates[0];
    const best = villageRates[villageRates.length - 1];
    out.push({
      tag: "Watch",
      title: `${worst.village} has redeemed only ${formatPct(worst.rate)} of its pledges`,
      detail:
        `${worst.redeemed} of ${worst.pledges} pledges, with ${inrC(worst.open)} still open. The best village, ${best.village}, ` +
        `is at ${formatPct(best.rate)}. Everything in this view is at ${formatPct(s.redeemedPct)}.`,
    });
  }

  const openByCustomer = new Map<number, number>();
  for (const p of open) openByCustomer.set(p.userId, (openByCustomer.get(p.userId) ?? 0) + p.principal);
  const ranked = [...openByCustomer].filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
  if (ranked.length > 10 && s.openBook > 0) {
    const big = ranked.filter(([, v]) => v >= 50000).length;
    const [largestId, largest] = ranked[0];
    out.push({
      tag: "Watch",
      title: `The ten largest customers hold ${formatPct(sum(ranked.slice(0, 10).map(([, v]) => v)) / s.openBook)} of open principal`,
      detail:
        `${plural(big, "customer")} ${big === 1 ? "has" : "have"} ₹50,000 or more open. ` +
        `The largest is ${names.get(largestId) ?? `Customer #${largestId}`} at ${formatInr(largest)}.`,
    });
  }

  if (pledges.length) {
    const photoShare = pledges.filter((p) => p.photo).length / pledges.length;
    if (photoShare < 0.5) {
      const noPhoto = open.filter((p) => !p.photo);
      out.push({
        tag: "Watch",
        title: `Only ${formatPct(photoShare)} of pledges have a photo`,
        detail: `${inrC(sum(noPhoto.map((p) => p.principal)))} of the open book (${plural(noPhoto.length, "pledge")}) has no photo on record.`,
      });
    }
  }

  const perCustomer = new Map<number, { count: number; principal: number }>();
  for (const p of pledges) {
    const c = perCustomer.get(p.userId) ?? { count: 0, principal: 0 };
    c.count++;
    c.principal += p.principal;
    perCustomer.set(p.userId, c);
  }
  const repeat = [...perCustomer.values()].filter((c) => c.count > 1);
  if (repeat.length && s.principal > 0) {
    const seven = repeat.filter((c) => c.count >= 7).length;
    out.push({
      tag: "Upside",
      title: `${formatPct(repeat.length / perCustomer.size)} of customers have pledged more than once`,
      detail:
        `${repeat.length} of ${perCustomer.size} customers account for ${formatPct(sum(repeat.map((c) => c.principal)) / s.principal)} of principal. ` +
        `${plural(seven, "customer")} ${seven === 1 ? "has" : "have"} seven or more pledges.`,
    });
  }

  const billed = new Set(bills.filter((x) => x.onFile).map((x) => x.userId));
  const pledging = new Set(pledges.filter((p) => p.onFile).map((p) => p.userId));
  if (billed.size && pledging.size) {
    const both = [...billed].filter((u) => pledging.has(u)).length;
    if (both / billed.size < 0.5) {
      out.push({
        tag: "Upside",
        title: "Billing and pledging serve different customers",
        detail: `Only ${both} of ${billed.size} billed customers also ${both === 1 ? "pledges" : "pledge"}. Pledge customers are a ready audience for jewellery sales.`,
      });
    }
  }

  const gap = loggingGap(pledges);
  if (gap) {
    out.push({
      tag: "Data",
      title: `No new pledge was logged for ${gap.months} months`,
      detail: `${monthLabelLong(gap.from)} to ${monthLabelLong(gap.to)} has no new pledge. Confirm before treating it as a quiet period.`,
    });
  }

  return out;
};

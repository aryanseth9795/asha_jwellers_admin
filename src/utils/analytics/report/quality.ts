import { AnalyticsData } from "../types";
import { dayNumber, sum } from "../periods";
import { formatInr } from "../format";
import { MIN_VILLAGE_CUSTOMERS, groupVillages, villageName } from "../villages";
import { buildPledgeRows } from "./pledges";
import { buildBillRows } from "./billing";
import { OTHER_ITEM, UNSPECIFIED_ITEM } from "./items";
import { loggingGap, monthLabelLong } from "./pledgeBook";

export type CheckTag = "Fix" | "Check" | "Note" | "Good";

export interface QualityCheck {
  tag: CheckTag;
  title: string;
  detail: string;
  badge: string;
}

export interface Coverage {
  label: string;
  share: number; // 0..1
}

export interface QualityReport {
  checks: QualityCheck[];
  coverage: Coverage[];
}

const TAG_ORDER: CheckTag[] = ["Fix", "Check", "Note", "Good"];
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const idList = (ids: number[]) => (ids.length === 1 ? `ID ${ids[0]}` : `IDs ${ids.join(", ")}`);
const pct1 = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;
const share = (n: number, of: number) => (of ? n / of : 0);
const hasPhone = (mobile: string | null | undefined) => (mobile ?? "").trim() !== "";

/** Spec §12.7: always the whole ledger, never filtered. */
export const dataQuality = (data: AnalyticsData, now: Date = new Date()): QualityReport => {
  const groups = groupVillages(data.users);
  const pledges = buildPledgeRows(data, now, groups);
  const bills = buildBillRows(data, groups, now);
  const checks: QualityCheck[] = [];

  const missingPledges = pledges.filter((p) => !p.onFile);
  const missingBills = bills.filter((b) => !b.onFile);
  const missingIds = [...new Set([...missingPledges, ...missingBills].map((x) => x.userId))].sort((a, b) => a - b);
  if (missingIds.length) {
    const one = missingIds.length === 1;
    checks.push({
      tag: "Fix",
      title: "Customer records are missing",
      badge: idList(missingIds),
      detail:
        `${plural(missingIds.length, "customer ID")} used by pledges or bills ${one ? "is" : "are"} not in the customer file. ` +
        `${one ? "It covers" : "They cover"} ${plural(missingPledges.length, "pledge")} ` +
        `(${formatInr(sum(missingPledges.map((p) => p.principal)))}) and ${plural(missingBills.length, "bill")} ` +
        `with ${formatInr(sum(missingBills.map((b) => b.pending)))} still due. Restore the customer before chasing the dues.`,
    });
  } else {
    checks.push({
      tag: "Good",
      title: "Customer records are complete",
      badge: "0 missing",
      detail: "Every pledge and bill points to a customer on file.",
    });
  }

  const unreconciled = bills.filter((b) => b.received !== b.collected);
  if (unreconciled.length) {
    checks.push({
      tag: "Fix",
      title: "Bill balances do not reconcile",
      badge: `${unreconciled.length} of ${bills.length}`,
      detail:
        `${unreconciled.length} of ${bills.length} bills have a received (jama) amount that is blank or different from net minus balance. ` +
        `Jama adds up to ${formatInr(sum(bills.map((b) => b.received)))}; the balance fields imply ` +
        `${formatInr(sum(bills.map((b) => b.collected)))} collected. Choose one field as the source of truth.`,
    });
  } else if (bills.length) {
    checks.push({
      tag: "Good",
      title: "Bill balances reconcile",
      badge: `${bills.length} of ${bills.length}`,
      detail: "Every bill's received amount matches net minus balance.",
    });
  }

  const byNameVillage = new Map<string, number[]>();
  for (const u of data.users) {
    const key = `${u.name.trim().toLowerCase()}|${villageName(u.address).toLowerCase()}`;
    const ids = byNameVillage.get(key) ?? [];
    ids.push(u.id);
    byNameVillage.set(key, ids);
  }
  const duplicates = [...byNameVillage.values()].filter((ids) => ids.length > 1);
  if (duplicates.length) {
    const example = data.users.find((u) => u.id === duplicates[0][0])!;
    checks.push({
      tag: "Check",
      title: "Possible duplicate customers",
      badge: plural(duplicates.length, "pair"),
      detail:
        `${plural(duplicates.length, "name and village combination")} ${duplicates.length === 1 ? "appears" : "appear"} ` +
        `on more than one customer ID, for example ${example.name} (IDs ${duplicates[0].join(" and ")}, ` +
        `${villageName(example.address) || "no village"}).`,
    });
  }

  const gap = loggingGap(pledges);
  if (gap) {
    const from = monthLabelLong(gap.from);
    const to = monthLabelLong(gap.to);
    checks.push({
      tag: "Check",
      title: `No new pledges logged for ${gap.months} months`,
      badge: `${from} – ${to}`,
      detail: `${from} to ${to} has no new pledge. Confirm whether pledging paused or entries were skipped.`,
    });
  }

  if (pledges.length) {
    const withPhoto = pledges.filter((p) => p.photo).length;
    const photoShare = withPhoto / pledges.length;
    if (photoShare < 0.5) {
      const openNoPhoto = sum(pledges.filter((p) => p.open && !p.photo).map((p) => p.principal));
      checks.push({
        tag: "Check",
        title: "Few pledges have a photo",
        badge: pct1(photoShare),
        detail:
          `${withPhoto} of ${pledges.length} pledges and ${bills.filter((b) => b.photo).length} of ${bills.length} bills have a photo. ` +
          `${formatInr(openNoPhoto)} of the open book has none.`,
      });
    } else {
      checks.push({
        tag: "Good",
        title: "Most pledges have a photo",
        badge: pct1(photoShare),
        detail: `${withPhoto} of ${pledges.length} pledges have a photo.`,
      });
    }
  }

  if (data.users.length) {
    const phones = data.users.filter((u) => hasPhone(u.mobileNumber)).length;
    if (phones / data.users.length < 0.5) {
      checks.push({
        tag: "Check",
        title: "Phone numbers are mostly missing",
        badge: `${phones} of ${data.users.length}`,
        detail: `${phones} of ${data.users.length} customers have a mobile number, so reminders and collection calls cannot start from this data.`,
      });
    } else {
      checks.push({
        tag: "Good",
        title: "Most customers have a phone number",
        badge: `${phones} of ${data.users.length}`,
        detail: `${phones} of ${data.users.length} customers have a mobile number.`,
      });
    }
  }

  const noAmount = pledges.filter((p) => p.principal <= 0);
  if (noAmount.length === 1) {
    const p = noAmount[0];
    checks.push({
      tag: "Check",
      title: "1 pledge has no amount",
      badge: `ID ${p.id}`,
      detail: `ID ${p.id} (${p.name || "no item name"}) is counted as ₹0, which slightly understates principal.`,
    });
  } else if (noAmount.length > 1) {
    checks.push({
      tag: "Check",
      title: `${noAmount.length} pledges have no amount`,
      badge: `${noAmount.length} pledges`,
      detail: `${idList(noAmount.map((p) => p.id))} are counted as ₹0, which understates principal.`,
    });
  }

  if (pledges.length) {
    const types = new Set(pledges.map((p) => p.item)).size;
    const other = pledges.filter((p) => p.item === OTHER_ITEM).length;
    const unspecified = pledges.filter((p) => p.item === UNSPECIFIED_ITEM).length;
    checks.push({
      tag: "Note",
      title: "Item names are free text",
      badge: plural(types, "item type"),
      detail:
        `${plural(pledges.length, "pledge name")} ${pledges.length === 1 ? "was" : "were"} grouped into ${plural(types, "item type")} by keyword. ` +
        `${other} fell to Other and ${unspecified} ${unspecified === 1 ? "has" : "have"} no item name. Add a keyword to group new spellings.`,
    });
  }

  if (data.users.length) {
    const villages = new Set(data.users.map((u) => villageName(u.address).toLowerCase()).filter(Boolean)).size;
    const noVillage = data.users.filter((u) => villageName(u.address) === "").length;
    checks.push({
      tag: "Note",
      title: "Village names are grouped",
      badge: plural(villages, "village"),
      detail:
        `${plural(villages, "village")} after cleaning spelling and punctuation. Villages with fewer than ` +
        `${MIN_VILLAGE_CUSTOMERS} customers are grouped as Other villages.` +
        (noVillage ? ` ${plural(noVillage, "customer")} ${noVillage === 1 ? "has" : "have"} no village.` : ""),
    });
  }

  const closedNoDate = data.rehan.filter((r) => r.status === 1 && !r.closedDate).length;
  // A close is early only when it is dated on an earlier day: closing the day you opened is fine.
  const closedBeforeOpen = data.rehan.filter(
    (r) => r.closedDate && dayNumber(r.closedDate) < dayNumber(r.openDate),
  ).length;
  const openWithDate = data.rehan.filter((r) => (r.status ?? 0) === 0 && r.closedDate).length;
  const exceptions = closedNoDate + closedBeforeOpen + openWithDate;
  if (exceptions) {
    checks.push({
      tag: "Check",
      title: "Dates or statuses need a look",
      badge: plural(exceptions, "exception"),
      detail: `${closedNoDate} redeemed without a close date, ${closedBeforeOpen} closed before opening, ${openWithDate} open with a close date.`,
    });
  } else {
    checks.push({
      tag: "Good",
      title: "Dates and statuses are consistent",
      badge: "0 exceptions",
      detail: "No pledge closes before it opens, every redeemed pledge has a close date and every open one has none.",
    });
  }

  const coverage: Coverage[] = [
    { label: "Pledges linked to a customer on file", share: share(pledges.filter((p) => p.onFile).length, pledges.length) },
    { label: "Pledges with an amount", share: share(pledges.filter((p) => p.principal > 0).length, pledges.length) },
    { label: "Pledges with an item name", share: share(pledges.filter((p) => p.item !== UNSPECIFIED_ITEM).length, pledges.length) },
    { label: "Pledges with a photo", share: share(pledges.filter((p) => p.photo).length, pledges.length) },
    { label: "Customers with a village", share: share(data.users.filter((u) => villageName(u.address) !== "").length, data.users.length) },
    { label: "Customers with a phone number", share: share(data.users.filter((u) => hasPhone(u.mobileNumber)).length, data.users.length) },
    { label: "Bills with a bill number", share: share(bills.filter((b) => b.billNo != null).length, bills.length) },
    { label: "Bills where received matches balance", share: share(bills.filter((b) => b.received === b.collected).length, bills.length) },
    { label: "Bills whose customer is on file", share: share(bills.filter((b) => b.onFile).length, bills.length) },
  ];

  return { checks: TAG_ORDER.flatMap((tag) => checks.filter((c) => c.tag === tag)), coverage };
};

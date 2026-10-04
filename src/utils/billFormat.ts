// Formatting helpers for the printed bill. Pure — safe to unit test.

import { JewelleryMetal, Purity } from "../types/entry";
import { toLocalDate } from "./dates";

/**
 * 3.5 -> { main: "3.500 ग्राम", sub: "(3 ग्राम 500 मिली)" }
 * Whole gram values get an empty sub-line.
 */
export function formatWeight(grams: number): { main: string; sub: string } {
  const safe = Number.isFinite(grams) ? Math.abs(grams) : 0;
  // Round to milligrams first so 0.1 + 0.2 does not leak float drift.
  const totalMilli = Math.round(safe * 1000);
  const whole = Math.floor(totalMilli / 1000);
  const milli = totalMilli % 1000;

  const main = `${(totalMilli / 1000).toFixed(3)} ग्राम`;
  const sub = milli === 0 ? "" : `(${whole} ग्राम ${milli} मिली)`;

  return { main, sub };
}

/** Indian digit grouping: 169650 -> "1,69,650/-" */
export function formatRupees(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const digits = Math.abs(Math.round(safe)).toString();
  if (digits.length <= 3) return `${digits}/-`;

  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");

  return `${grouped},${last3}/-`;
}

/** Stored date (a plain "2026-08-27", or an older ISO timestamp) -> "27/08/2026"; "" when it is not a date. */
export function formatBillDate(stored: string): string {
  const d = toLocalDate(stored);
  if (d === null) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** "gold", "22KT" -> "Gold / 22KT"; missing parts are left out. */
export function formatMetalPurity(
  metal: JewelleryMetal | null | undefined,
  purity: Purity | null | undefined,
): string {
  const metalLabel =
    metal === "gold" ? "Gold" : metal === "silver" ? "Silver" : "";
  return [metalLabel, purity ?? ""].filter(Boolean).join(" / ");
}

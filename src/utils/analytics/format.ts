import { formatRupees } from "../billFormat";

const trim = (value: number, decimals: number): string =>
  String(parseFloat(value.toFixed(decimals)));

/** 182500 -> "1.8L", 45000 -> "45K", 12000000 -> "1.2Cr". For chart axes. */
export const formatCompactRupees = (value: number): string => {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e7) return `${sign}${trim(abs / 1e7, 1)}Cr`;
  if (abs >= 1e5) return `${sign}${trim(abs / 1e5, 1)}L`;
  if (abs >= 1e3) return `${sign}${trim(abs / 1e3, 1)}K`;
  return `${sign}${Math.round(abs)}`;
};

export const formatGrams = (grams: number): string =>
  grams >= 1000 ? `${trim(grams / 1000, 2)} kg` : `${trim(grams, 3)} g`;

// Weights are entered to the milligram; rounding after each sum keeps float
// noise like 0.30000000000000004 out of the UI.
export const roundGrams = (grams: number): number => Math.round(grams * 1000) / 1000;


/** 182500 -> "₹1,82,500"; for sentences and tiles. */
export const formatInr = (value: number): string =>
  `${value < 0 ? "-" : ""}₹${formatRupees(Math.abs(value)).replace(/\/-$/, "")}`;

export const formatPct = (ratio: number): string => `${Math.round(ratio * 100)}%`;

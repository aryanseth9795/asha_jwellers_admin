/**
 * Item categories for rehan records and bill items (spec §11). Pure — no react-native import — so Jest can load it.
 * The base list is the analytics item types plus "Other"; custom categories typed by the admin are added after it.
 */
import { ITEM_TYPES } from "./analytics/report/items";
import { villageKey } from "./villageNames";

export const OTHER_CATEGORY = "Other";

export const BASE_CATEGORIES: string[] = [...ITEM_TYPES, OTHER_CATEGORY];

const collapse = (s: string): string => s.replace(/\s+/g, " ").trim();

/** Case, punctuation and spacing do not make a new category. */
export const categoryKey = villageKey;

/** The base list, then the custom stored categories, most used first (ties alphabetical). */
export const categoryOptions = (stored: (string | null)[]): string[] => {
  const baseKeys = new Set(BASE_CATEGORIES.map(categoryKey));
  // key -> (spelling -> count); Map keeps first-seen order so ties go to the earliest spelling.
  const groups = new Map<string, Map<string, number>>();
  for (const raw of stored) {
    if (raw == null) continue;
    const key = categoryKey(raw);
    if (!key || baseKeys.has(key)) continue;
    const spelling = collapse(raw);
    let spellings = groups.get(key);
    if (!spellings) {
      spellings = new Map();
      groups.set(key, spellings);
    }
    spellings.set(spelling, (spellings.get(spelling) ?? 0) + 1);
  }

  const custom: { name: string; count: number }[] = [];
  for (const spellings of groups.values()) {
    let name = "";
    let best = 0;
    let total = 0;
    for (const [spelling, n] of spellings) {
      total += n;
      if (n > best) {
        best = n;
        name = spelling;
      }
    }
    custom.push({ name, count: total });
  }
  custom.sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return [...BASE_CATEGORIES, ...custom.map((c) => c.name)];
};

/**
 * The category to store: "Other" when empty, the canonical name on a case-insensitive match against `options`
 * (the base list by default), otherwise the trimmed input with its first letter capitalised.
 */
export const resolveCategory = (input: string, options: string[] = BASE_CATEGORIES): string => {
  const key = categoryKey(input);
  if (!key) return OTHER_CATEGORY;
  const match = options.find((o) => categoryKey(o) === key) ?? BASE_CATEGORIES.find((o) => categoryKey(o) === key);
  if (match) return match;
  const tidy = collapse(input);
  return tidy.charAt(0).toUpperCase() + tidy.slice(1);
};

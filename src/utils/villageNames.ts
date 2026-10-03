/**
 * Village names for the customer address field. Pure — no react-native import — so Jest can load it.
 * Only punctuation, case and spacing variants are merged; real spelling differences stay separate villages.
 */
export interface Village {
  name: string;
  count: number;
}

const collapse = (s: string): string => s.replace(/\s+/g, " ").trim();

/** Lower-case, punctuation removed (letters, combining marks and digits kept), spaces collapsed, trimmed. */
export const villageKey = (s: string): string =>
  collapse(s.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ""));

export const canonicalVillages = (addresses: (string | null)[]): Village[] => {
  // key -> (tidied spelling -> count); Map keeps first-seen order so ties go to the earliest spelling.
  const groups = new Map<string, Map<string, number>>();
  for (const raw of addresses) {
    if (raw == null) continue;
    const key = villageKey(raw);
    if (!key) continue;
    const spelling = collapse(raw);
    let spellings = groups.get(key);
    if (!spellings) {
      spellings = new Map();
      groups.set(key, spellings);
    }
    spellings.set(spelling, (spellings.get(spelling) ?? 0) + 1);
  }

  const villages: Village[] = [];
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
    villages.push({ name, count: total });
  }
  return villages.sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
};

/** The canonical name when the input matches an existing village, otherwise the tidied input, first letter capital. */
export const resolveVillage = (input: string, villages: { name: string }[]): string => {
  const key = villageKey(input);
  if (key) {
    const match = villages.find((v) => villageKey(v.name) === key);
    if (match) return match.name;
  }
  const tidy = collapse(input);
  return tidy.charAt(0).toUpperCase() + tidy.slice(1);
};

/** The address to store on Save: null when blank or punctuation-only, otherwise the resolved village name. */
export const normaliseVillageForSave = (input: string, villages: { name: string }[]): string | null =>
  villageKey(input) ? resolveVillage(input, villages) : null;

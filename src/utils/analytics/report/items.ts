// Pledge item types by keyword (spec §12.4). Item names are typed freely, so the
// first recognised word decides the type; words that match nothing are skipped.

export const OTHER_ITEM = "Other";
export const UNSPECIFIED_ITEM = "Unspecified";

const KEYWORDS: Record<string, string[]> = {
  Payal: ["payal", "paayal"],
  Locket: ["locket", "loket"],
  Bunda: ["bunda"],
  Anguthi: ["anguthi", "angoothi", "angothi", "ring"],
  Chain: ["chain"],
  Kardhan: ["kardhan", "kardhani", "krdhn", "krdhan"],
  Chhagal: ["chhagal", "chagal"],
  Jhala: ["jhala"],
  Tika: ["tika", "tikka"],
  Kil: ["kil", "keel"],
  Jhumka: ["jhumka", "jhumki"],
  "Nathiya / Nathuni": ["nathiya", "nthiya", "nathuni", "nath"],
  Toda: ["toda"],
  Tops: ["tops", "top"],
  Bali: ["bali"],
  Mangalsutra: ["mangalsutra"],
  "Hath mehndi": ["hath", "mehndi"],
  Sikdi: ["sikdi"],
  Haar: ["haar", "har"],
  Kundal: ["kundal"],
  Kada: ["kada", "bracelet"],
  Guchha: ["guchha", "chabhi"],
  Jantar: ["jantar"],
  "Bal choti": ["bal", "baal", "choti"],
  Latkan: ["latkan"],
  Chudi: ["chudi", "choodi"],
  Peti: ["peti"],
  Hasuli: ["hasuli", "hansuli"],
};

const TYPE_OF_WORD = new Map<string, string>();
for (const [type, words] of Object.entries(KEYWORDS)) {
  for (const word of words) TYPE_OF_WORD.set(word, type);
}

// Digits, spaces and ASCII punctuation: a name made only of these names no item.
const NOT_A_NAME = /[0-9\s.,;:!?'"()[\]{}/\\|_*#@&+=~`^-]/g;

/** Distinct item types named, in the order they appear. */
export const itemTypesIn = (name: string | null | undefined): string[] => {
  const types: string[] = [];
  for (const word of (name ?? "").toLowerCase().split(/[^a-z]+/)) {
    const type = TYPE_OF_WORD.get(word);
    if (type && !types.includes(type)) types.push(type);
  }
  return types;
};

export const itemTypeOf = (name: string | null | undefined): string => {
  if ((name ?? "").replace(NOT_A_NAME, "") === "") return UNSPECIFIED_ITEM;
  return itemTypesIn(name)[0] ?? OTHER_ITEM;
};

export const isBundle = (name: string | null | undefined): boolean => itemTypesIn(name).length >= 2;

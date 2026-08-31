// Number -> Hindi words, for the "राशि शब्दों में" line on the bill.
// Hindi 1-99 are irregular, so the table below is exhaustive by design.

const ONES_TO_99 = [
  "शून्य", "एक", "दो", "तीन", "चार", "पांच", "छह", "सात", "आठ", "नौ",
  "दस", "ग्यारह", "बारह", "तेरह", "चौदह", "पंद्रह", "सोलह", "सत्रह", "अठारह", "उन्नीस",
  "बीस", "इक्कीस", "बाईस", "तेईस", "चौबीस", "पच्चीस", "छब्बीस", "सत्ताईस", "अट्ठाईस", "उनतीस",
  "तीस", "इकतीस", "बत्तीस", "तैंतीस", "चौंतीस", "पैंतीस", "छत्तीस", "सैंतीस", "अड़तीस", "उनतालीस",
  "चालीस", "इकतालीस", "बयालीस", "तैंतालीस", "चवालीस", "पैंतालीस", "छियालीस", "सैंतालीस", "अड़तालीस", "उनचास",
  "पचास", "इक्यावन", "बावन", "तिरपन", "चौवन", "पचपन", "छप्पन", "सत्तावन", "अट्ठावन", "उनसठ",
  "साठ", "इकसठ", "बासठ", "तिरसठ", "चौंसठ", "पैंसठ", "छियासठ", "सड़सठ", "अड़सठ", "उनहत्तर",
  "सत्तर", "इकहत्तर", "बहत्तर", "तिहत्तर", "चौहत्तर", "पचहत्तर", "छिहत्तर", "सतहत्तर", "अठहत्तर", "उन्यासी",
  "अस्सी", "इक्यासी", "बयासी", "तिरासी", "चौरासी", "पचासी", "छियासी", "सत्तासी", "अट्ठासी", "नवासी",
  "नब्बे", "इक्यानवे", "बानवे", "तिरानवे", "चौरानवे", "पचानवे", "छियानवे", "सत्तानवे", "अट्ठानवे", "निन्यानवे",
];

const CRORE = 10000000;
const LAKH = 100000;
const THOUSAND = 1000;
const HUNDRED = 100;

/** 50750 -> "पचास हजार सात सौ पचास" */
export function toHindiWords(value: number): string {
  let n = Math.abs(Math.round(value));
  if (n === 0) return ONES_TO_99[0];

  const parts: string[] = [];

  const crore = Math.floor(n / CRORE);
  n %= CRORE;
  const lakh = Math.floor(n / LAKH);
  n %= LAKH;
  const thousand = Math.floor(n / THOUSAND);
  n %= THOUSAND;
  const hundred = Math.floor(n / HUNDRED);
  n %= HUNDRED;

  // Recurse for crore so values above 99 crore still read correctly.
  if (crore > 0) parts.push(`${toHindiWords(crore)} करोड़`);
  if (lakh > 0) parts.push(`${ONES_TO_99[lakh]} लाख`);
  if (thousand > 0) parts.push(`${ONES_TO_99[thousand]} हजार`);
  if (hundred > 0) parts.push(`${ONES_TO_99[hundred]} सौ`);
  if (n > 0) parts.push(ONES_TO_99[n]);

  return parts.join(" ");
}

/** 50750 -> "पचास हजार सात सौ पचास रुपये मात्र" */
export function toHindiRupeesWords(value: number): string {
  return `${toHindiWords(value)} रुपये मात्र`;
}

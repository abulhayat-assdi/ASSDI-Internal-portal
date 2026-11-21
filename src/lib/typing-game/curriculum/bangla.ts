/**
 * Bangla letters and how to type them on the two layouts students use.
 * Content is the same for both; only the on-screen hint differs.
 *
 * Bijoy: fixed key positions (the Bijoy/"Bijoy Ekushey" layout). Pre-base
 * vowel signs (ি ে ৈ) are typed BEFORE the consonant, as Bijoy expects.
 * Avro Phonetic: roman spelling; the IME turns it into Bangla.
 */

export const BN_VOWELS = ["অ", "আ", "ই", "ঈ", "উ", "ঊ", "ঋ", "এ", "ঐ", "ও", "ঔ"];
export const BN_CONSONANT_GROUPS: string[][] = [
  ["ক", "খ", "গ", "ঘ", "ঙ"],
  ["চ", "ছ", "জ", "ঝ", "ঞ"],
  ["ট", "ঠ", "ড", "ঢ", "ণ"],
  ["ত", "থ", "দ", "ধ", "ন"],
  ["প", "ফ", "ব", "ভ", "ম"],
  ["য", "র", "ল", "শ", "ষ", "স", "হ"],
  ["ড়", "ঢ়", "য়"],
];
export const BN_CONSONANTS = BN_CONSONANT_GROUPS.flat();
export const BN_SIGNS = ["ং", "ঃ", "ঁ", "ৎ"];
/** Dependent vowel signs (kar). */
export const BN_KARS = ["া", "ি", "ী", "ু", "ূ", "ৃ", "ে", "ৈ", "ো", "ৌ"];
export const BN_HASANTA = "্";
export const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
export const BN_PUNCT = ["।", ",", "?", "!", "-", ":", ";", "'", '"', "(", ")", "৳", "%", "/"];
/** Zero-width joiners Bangla keyboards emit inside some conjuncts. */
export const BN_JOINERS = ["‌", "‍"];

const PRE_BASE = new Set(["ি", "ে", "ৈ"]);

/** Bijoy: character → key presses (Shift shown as uppercase). */
export const BIJOY_KEYS: Record<string, string> = {
  // consonants
  "ক": "j", "খ": "J", "গ": "o", "ঘ": "O", "ঙ": "q",
  "চ": "y", "ছ": "Y", "জ": "u", "ঝ": "U", "ঞ": "I",
  "ট": "t", "ঠ": "T", "ড": "e", "ঢ": "E", "ণ": "B",
  "ত": "k", "থ": "K", "দ": "l", "ধ": "L", "ন": "b",
  "প": "r", "ফ": "R", "ব": "h", "ভ": "H", "ম": "m",
  "য": "w", "র": "v", "ল": "V", "শ": "M", "ষ": "N", "স": "n", "হ": "i",
  "ড়": "p", "ঢ়": "P", "য়": "W",
  "ং": "Q", "ঃ": "\\", "ঁ": "|", "ৎ": "&",
  // vowel signs
  "া": "f", "ি": "d", "ী": "D", "ু": "s", "ূ": "S", "ৃ": "a", "ে": "c", "ৈ": "C", "ো": "c…f", "ৌ": "c…X",
  // hasanta (link) and independent vowels (g + sign)
  "্": "g",
  "অ": "F", "আ": "gf", "ই": "gd", "ঈ": "gD", "উ": "gs", "ঊ": "gS", "ঋ": "ga", "এ": "gc", "ঐ": "gC", "ও": "gx", "ঔ": "gX",
  // digits & punctuation
  "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
  "।": "G", "৳": "$",
};

/** Avro Phonetic: character → roman spelling. */
export const AVRO_KEYS: Record<string, string> = {
  "ক": "k", "খ": "kh", "গ": "g", "ঘ": "gh", "ঙ": "Ng",
  "চ": "c", "ছ": "ch", "জ": "j", "ঝ": "jh", "ঞ": "NG",
  "ট": "T", "ঠ": "Th", "ড": "D", "ঢ": "Dh", "ণ": "N",
  "ত": "t", "থ": "th", "দ": "d", "ধ": "dh", "ন": "n",
  "প": "p", "ফ": "ph", "ব": "b", "ভ": "bh", "ম": "m",
  "য": "z", "র": "r", "ল": "l", "শ": "sh", "ষ": "Sh", "স": "s", "হ": "h",
  "ড়": "R", "ঢ়": "Rh", "য়": "y",
  "ং": "ng", "ঃ": ":", "ঁ": "^", "ৎ": "t``",
  "া": "a", "ি": "i", "ী": "I", "ু": "u", "ূ": "U", "ৃ": "rri", "ে": "e", "ৈ": "OI", "ো": "O", "ৌ": "OU",
  "্": "(যুক্তাক্ষরে পরপর লিখুন)",
  "অ": "o", "আ": "a", "ই": "i", "ঈ": "I", "উ": "u", "ঊ": "U", "ঋ": "rri", "এ": "e", "ঐ": "OI", "ও": "O", "ঔ": "OU",
  "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
  "।": ".", "৳": "$",
};

export type BanglaLayout = "bijoy" | "avro";

/** Splits text into user-perceived characters (grapheme clusters). */
export function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter("bn", { granularity: "grapheme" });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

/**
 * How to type one grapheme on a layout, e.g. "কি" → Bijoy "d j", Avro "k i".
 * Unknown characters fall back to themselves.
 */
/** Splits a cluster into map units: two-code-point letters (ড় ঢ় য়) stay whole. */
function units(cluster: string, map: Record<string, string>): string[] {
  const cps = Array.from(cluster.normalize("NFC")).filter((c) => !BN_JOINERS.includes(c));
  const out: string[] = [];
  for (let i = 0; i < cps.length; i++) {
    const pair = cps[i] + (cps[i + 1] ?? "");
    if (cps[i + 1] && map[pair] !== undefined) {
      out.push(pair);
      i++;
    } else out.push(cps[i]);
  }
  return out;
}

/**
 * How to type one grapheme on a layout, e.g. "কি" → Bijoy "d j", Avro "k i".
 * Unknown characters fall back to themselves.
 */
export function typingHint(cluster: string, layout: BanglaLayout): string {
  const map = layout === "bijoy" ? BIJOY_KEYS : AVRO_KEYS;
  const chars = units(cluster, map);
  const parts: string[] = [];
  if (layout === "bijoy") {
    // Pre-base signs go first on Bijoy; ো/ৌ wrap the consonant (c … f / c … X).
    for (const c of chars) if (PRE_BASE.has(c)) parts.push(map[c] ?? c);
    for (const c of chars) {
      if (PRE_BASE.has(c)) continue;
      if (c === "ো" || c === "ৌ") {
        parts.unshift("c");
        parts.push(c === "ো" ? "f" : "X");
      } else parts.push(map[c] ?? c);
    }
  } else {
    for (const c of chars) if (c !== BN_HASANTA) parts.push(map[c] ?? c);
  }
  return parts.join(" ");
}

/** Code points of a list of letters (ড় → ড + ়), for "allowed character" sets. */
export function codepoints(letters: readonly string[]): string[] {
  const out = new Set<string>();
  for (const l of letters) for (const c of l.normalize("NFC")) out.add(c);
  return Array.from(out);
}

/** True when every character of `text` is in `allowed` (spaces always allowed). */
export function usesOnly(text: string, allowed: ReadonlySet<string>): boolean {
  for (const c of text.normalize("NFC")) {
    if (c === " " || BN_JOINERS.includes(c)) continue;
    if (!allowed.has(c)) return false;
  }
  return true;
}

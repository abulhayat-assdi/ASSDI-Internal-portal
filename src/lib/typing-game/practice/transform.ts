/**
 * Practice text difficulty. One article can be practised at four levels by
 * reshaping its case, punctuation and numbers — the words stay the same.
 * Pure functions, no I/O, so the server (text API) and tests share them.
 */
import { cleanExamText } from "@/lib/typing-exam/examText";

export type PracticeLanguage = "en" | "bn";
export type PracticeDifficulty = "beginner" | "intermediate" | "pro" | "expert";

/**
 * lower    — all small letters
 * sentence — small letters, capital after . ? ! and at the start
 * title    — Capitalize Each Word
 * mixed    — the article's own case, with some words in Title or UPPER case
 * original — the article exactly as written
 */
export type CaseMode = "lower" | "sentence" | "title" | "mixed" | "original";

/**
 * none     — no punctuation at all
 * basic    — . , and the Bangla dari ।
 * standard — basic + ? ! ; : ' " -
 * full     — every symbol the article has (brackets, / & % …)
 */
export type PunctuationMode = "none" | "basic" | "standard" | "full";

export interface TransformOptions {
  case: CaseMode;
  punctuation: PunctuationMode;
  numbers: boolean;
  /** Bangla only: drop words that contain a conjunct (hasanta ্). */
  noConjuncts?: boolean;
}

export const DIFFICULTIES: PracticeDifficulty[] = ["beginner", "intermediate", "pro", "expert"];

export const DIFFICULTY_PRESETS: Record<PracticeLanguage, Record<PracticeDifficulty, TransformOptions>> = {
  en: {
    beginner: { case: "lower", punctuation: "none", numbers: false },
    intermediate: { case: "sentence", punctuation: "basic", numbers: false },
    pro: { case: "title", punctuation: "standard", numbers: true },
    expert: { case: "mixed", punctuation: "full", numbers: true },
  },
  bn: {
    beginner: { case: "original", punctuation: "none", numbers: false, noConjuncts: true },
    intermediate: { case: "original", punctuation: "basic", numbers: false },
    pro: { case: "original", punctuation: "standard", numbers: true },
    expert: { case: "original", punctuation: "full", numbers: true },
  },
};

const BASIC_PUNCT = new Set([".", ",", "।"]);
const STANDARD_PUNCT = new Set([...BASIC_PUNCT, "?", "!", ";", ":", "'", '"', "-"]);
/** Joiners between words: when they are not allowed they become a space, not nothing. */
const JOINERS = new Set(["-", "/", "–", "—"]);
const ZERO_WIDTH_JOINERS = new Set(["‌", "‍"]);
const HASANTA = "্";

const LETTER_OR_MARK = /[\p{L}\p{M}]/u;
const DIGIT = /\p{N}/u;

function allowedPunctuation(ch: string, mode: PunctuationMode): boolean {
  if (mode === "full") return true;
  if (mode === "none") return false;
  return (mode === "basic" ? BASIC_PUNCT : STANDARD_PUNCT).has(ch);
}

function filterChars(text: string, opts: TransformOptions): string {
  let out = "";
  for (const ch of text) {
    if (/\s/u.test(ch) || LETTER_OR_MARK.test(ch) || ZERO_WIDTH_JOINERS.has(ch)) {
      out += ch;
    } else if (DIGIT.test(ch)) {
      out += opts.numbers ? ch : " ";
    } else if (allowedPunctuation(ch, opts.punctuation)) {
      out += ch;
    } else {
      out += JOINERS.has(ch) ? " " : "";
    }
  }
  return out;
}

/** A word left with no letter or digit (e.g. a lone "-" or ",") is dropped. */
function hasContent(word: string): boolean {
  for (const ch of word) if (LETTER_OR_MARK.test(ch) || DIGIT.test(ch)) return true;
  return false;
}

function capitalize(word: string): string {
  const chars = Array.from(word);
  const i = chars.findIndex((c) => LETTER_OR_MARK.test(c));
  if (i < 0) return word;
  chars[i] = chars[i].toUpperCase();
  return chars.join("");
}

/** Small deterministic PRNG so the same seed always gives the same text. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function applyCase(words: string[], mode: CaseMode, rand: () => number): string[] {
  switch (mode) {
    case "original":
      return words;
    case "lower":
      return words.map((w) => w.toLowerCase());
    case "title":
      return words.map((w) => capitalize(w.toLowerCase()));
    case "sentence": {
      let startOfSentence = true;
      return words.map((w) => {
        const lower = w.toLowerCase();
        const out = startOfSentence ? capitalize(lower) : lower;
        startOfSentence = /[.?!।]$/.test(w);
        return out;
      });
    }
    case "mixed":
      return words.map((w) => {
        const r = rand();
        if (r < 0.15) return w.toUpperCase();
        if (r < 0.4) return capitalize(w.toLowerCase());
        return w;
      });
  }
}

/** Reshape one article's text to the requested difficulty. */
export function transformText(raw: string, opts: TransformOptions, seed = 1): string {
  const rand = seededRandom(seed);
  let words = filterChars(cleanExamText(raw), opts)
    .split(/\s+/)
    .filter((w) => w.length > 0 && hasContent(w));
  if (opts.noConjuncts) words = words.filter((w) => !w.includes(HASANTA));
  words = applyCase(words, opts.case, rand);
  return words.join(" ");
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** First `n` words of the text (all of it when shorter). */
export function takeWords(text: string, n: number): string {
  return text.split(/\s+/).filter(Boolean).slice(0, Math.max(0, n)).join(" ");
}

export function isDifficulty(v: unknown): v is PracticeDifficulty {
  return typeof v === "string" && (DIFFICULTIES as string[]).includes(v);
}

export function isLanguage(v: unknown): v is PracticeLanguage {
  return v === "en" || v === "bn";
}

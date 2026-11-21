/**
 * Turns a lesson definition into its screens. Deterministic per lesson id,
 * so every student sees the same drills and a reload never changes them.
 * Pure: the word bank is passed in (see word-bank.ts for the real one).
 *
 * Every character a screen asks for is one the student has learned
 * (lesson.allowedKeys). Words come from the bank, filtered to learned
 * letters; capitals, punctuation, numbers and symbols are then added
 * only when learned, with the lesson's new keys appearing most often.
 */
import { fingerFor, keyDisplayName, keyFor, FINGERS } from "./keyboard";
import type { LessonDef, LessonScreen, LessonWithScreens } from "./types";
import { seededRandom } from "@/lib/typing-game/practice/transform";

const isLower = (c: string) => /^[a-z]$/.test(c);
const isUpper = (c: string) => /^[A-Z]$/.test(c);
const isDigit = (c: string) => /^[0-9]$/.test(c);
const isSymbol = (c: string) => c !== " " && !isLower(c) && !isUpper(c) && !isDigit(c);

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 1;
}

type Rand = () => number;
const pick = <T,>(arr: readonly T[], rand: Rand): T => arr[Math.floor(rand() * arr.length)];
const between = (lo: number, hi: number, rand: Rand) => lo + Math.floor(rand() * (hi - lo + 1));

/** `count` groups of `minLen..maxLen` characters, each holding one `must` char when given. */
export function letterGroups(
  chars: string[],
  count: number,
  minLen: number,
  maxLen: number,
  rand: Rand,
  must: string[] = [],
): string {
  const groups: string[] = [];
  for (let g = 0; g < count; g++) {
    const len = between(minLen, maxLen, rand);
    const letters = Array.from({ length: len }, () => pick(chars, rand));
    if (must.length > 0 && !letters.some((c) => must.includes(c))) {
      letters[between(0, len - 1, rand)] = pick(must, rand);
    }
    groups.push(letters.join(""));
  }
  return groups.join(" ");
}

/** Words typeable with only the allowed letters; ones using a new key come first. */
export function eligibleWords(bank: readonly string[], allowed: string[], prefer: string[]): string[] {
  const ok = bank.filter((w) => Array.from(w).every((c) => allowed.includes(c)));
  if (prefer.length === 0) return ok;
  const withNew = ok.filter((w) => prefer.some((c) => w.includes(c)));
  const rest = ok.filter((w) => !prefer.some((c) => w.includes(c)));
  return [...withNew, ...rest];
}

function sampleWords(words: string[], n: number, rand: Rand): string[] {
  // Favour the front of the list (frequent words / words with new keys).
  const pool = words.slice(0, Math.max(n * 3, 40));
  return Array.from({ length: n }, () => pick(pool, rand));
}

// ---------------------------------------------------------------------------
// Decoration: capitals, punctuation, numbers and symbols on top of words.
// ---------------------------------------------------------------------------

interface Ctx {
  allowed: Set<string>;
  /** New keys of this lesson — used more often. */
  focus: Set<string>;
  rand: Rand;
}

const can = (ctx: Ctx, s: string) => Array.from(s).every((c) => ctx.allowed.has(c));

function capitalizeIfAllowed(ctx: Ctx, w: string): string {
  const up = w[0]?.toUpperCase();
  return up && ctx.allowed.has(up) ? up + w.slice(1) : w;
}

function number(ctx: Ctx, minDigits = 1, maxDigits = 3): string | null {
  const digits = Array.from(ctx.allowed).filter(isDigit);
  if (digits.length === 0) return null;
  const focusDigits = digits.filter((d) => ctx.focus.has(d));
  const len = between(minDigits, maxDigits, ctx.rand);
  return Array.from({ length: len }, () => pick(focusDigits.length && ctx.rand() < 0.6 ? focusDigits : digits, ctx.rand)).join("");
}

/** Short real-looking tokens that use a symbol the way text does. */
const SYMBOL_PATTERNS: Record<string, (ctx: Ctx, w: string) => string | null> = {
  "?": (_c, w) => `${w}?`,
  "!": (_c, w) => `${w}!`,
  ":": (_c, w) => `${w}:`,
  '"': (_c, w) => `"${w}"`,
  "-": (c, w) => `${w}-${pick(["based", "free", "time", "level", "term", "known"], c.rand)}`,
  "/": (c, w) => `${w}/${pick(["or", "and", "day", "week"], c.rand)}`,
  "@": (_c, w) => `@${w}`,
  "#": (_c, w) => `#${w}`,
  $: (c) => {
    const n = number(c, 2, 4);
    return n ? `$${n}` : null;
  },
  "%": (c) => {
    const n = number(c, 1, 2);
    return n ? `${n}%` : null;
  },
  "&": () => "&",
  "*": (c) => {
    const a = number(c, 1, 2);
    const b = number(c, 1, 2);
    return a && b ? `${a}*${b}` : null;
  },
  "(": (_c, w) => `(${w})`,
  ")": (_c, w) => `(${w})`,
  _: (c, w) => `${w}_${pick(["name", "id", "file", "list"], c.rand)}`,
  "+": (c) => {
    const a = number(c, 1, 2);
    const b = number(c, 1, 2);
    return a && b ? `${a}+${b}` : null;
  },
  "=": (c, w) => {
    const n = number(c, 1, 3);
    return n ? `${w}=${n}` : null;
  },
  "^": (c) => {
    const a = number(c, 1, 1);
    const b = number(c, 1, 1);
    return a && b ? `${a}^${b}` : null;
  },
  "[": (_c, w) => `[${w}]`,
  "]": (_c, w) => `[${w}]`,
  "{": (_c, w) => `{${w}}`,
  "}": (_c, w) => `{${w}}`,
  "\\": (c, w) => `${w}\\${pick(["files", "docs", "data"], c.rand)}`,
  "|": () => "|",
  "<": (c) => {
    const a = number(c, 1, 2);
    return a ? `<${a}` : null;
  },
  ">": (c) => {
    const a = number(c, 1, 2);
    return a ? `>${a}` : null;
  },
  "~": (_c, w) => `~${w}`,
  "`": (_c, w) => `\`${w}\``,
};

function symbolToken(ctx: Ctx, symbol: string, word: string): string | null {
  const make = SYMBOL_PATTERNS[symbol];
  if (!make) return null;
  const t = make(ctx, word);
  return t && can(ctx, t) ? t : null;
}

/** Words → a line of text using every learned kind of character. */
function decorate(words: string[], ctx: Ctx, opts: { sentences: boolean }): string {
  const { rand } = ctx;
  const enders = [".", "?", "!"].filter((c) => ctx.allowed.has(c));
  const inline = Array.from(ctx.allowed).filter((c) => isSymbol(c) && !enders.includes(c) && c !== "," && c !== ";" && c !== "'");
  const focusInline = inline.filter((c) => ctx.focus.has(c));
  const hasDigits = Array.from(ctx.allowed).some(isDigit);
  const focusDigits = Array.from(ctx.focus).some(isDigit);
  const out: string[] = [];
  let sinceStop = 0;
  let startOfSentence = true;

  words.forEach((w, i) => {
    let word = w;
    const last = i === words.length - 1;
    // Numbers, now and then (much more often while they are the lesson's focus).
    if (hasDigits && rand() < (focusDigits ? 0.35 : 0.08)) {
      const n = number(ctx);
      if (n) word = n;
    }
    // Symbols in their natural pattern.
    const symChance = focusInline.length ? 0.35 : 0.06;
    if (inline.length && rand() < symChance) {
      const sym = pick(focusInline.length && rand() < 0.75 ? focusInline : inline, rand);
      const t = symbolToken(ctx, sym, word);
      if (t) word = t;
    }
    if (opts.sentences && startOfSentence) word = capitalizeIfAllowed(ctx, word);
    else if (rand() < 0.08) word = capitalizeIfAllowed(ctx, word);
    startOfSentence = false;
    sinceStop++;

    if (opts.sentences && enders.length && (last || (sinceStop >= 6 && rand() < 0.3))) {
      const focusEnders = enders.filter((e) => ctx.focus.has(e));
      word += pick(focusEnders.length && rand() < 0.7 ? focusEnders : enders, rand);
      sinceStop = 0;
      startOfSentence = true;
    } else if (!last && ctx.allowed.has(",") && sinceStop >= 3 && rand() < 0.12) {
      word += ",";
    } else if (!last && ctx.allowed.has(";") && sinceStop >= 4 && rand() < 0.05) {
      word += ";";
      sinceStop = 0;
    }
    out.push(word);
  });
  return out.join(" ");
}

// ---------------------------------------------------------------------------

function introTitle(key: string): string {
  if (key === " ") return "দুই হাতের বুড়ো আঙুল দিয়ে Space চাপুন";
  const hit = keyFor(key);
  const finger = fingerFor(key);
  if (!hit || !finger) return `${keyDisplayName(key)} চাপুন`;
  if (hit.shifted) {
    const shiftFinger = finger.hand === "left" ? FINGERS["r-pinky"] : FINGERS["l-pinky"];
    const shiftSide = finger.hand === "left" ? "ডান" : "বাম";
    return `${shiftFinger.bn} দিয়ে ${shiftSide} Shift চেপে ধরে ${finger.bn} দিয়ে ${keyDisplayName(key)} চাপুন`;
  }
  return `${finger.bn} দিয়ে ${keyDisplayName(key)} চাপুন`;
}

const APOSTROPHE_WORDS = ["don't", "it's", "can't", "we're", "i'm", "you're", "isn't", "that's", "let's", "won't"];

export function buildScreens(lesson: LessonDef, bank: readonly string[]): LessonScreen[] {
  const rand = seededRandom(hashSeed(lesson.id));
  const allowedLetters = lesson.allowedKeys.filter(isLower);
  const newLower = lesson.newKeys.filter(isLower);
  const newUpper = lesson.newKeys.filter(isUpper);
  const newDigits = lesson.newKeys.filter(isDigit);
  const newSymbols = lesson.newKeys.filter(isSymbol);
  const focus = new Set(lesson.kind === "keys" ? lesson.newKeys : []);
  const ctx: Ctx = { allowed: new Set([...lesson.allowedKeys, " "]), focus, rand };
  const words = eligibleWords(bank, allowedLetters, newUpper.length ? newUpper.map((c) => c.toLowerCase()) : newLower);
  const extraWords = ctx.allowed.has("'")
    ? APOSTROPHE_WORDS.filter((w) => Array.from(w).every((c) => c === "'" || allowedLetters.includes(c)))
    : [];
  const hasWords = words.length >= 6;
  const screens: LessonScreen[] = [];

  const wordList = (n: number): string[] => {
    const list = sampleWords(words, n, rand);
    if (extraWords.length > 0) for (let i = 0; i < 2; i++) list[between(0, n - 1, rand)] = pick(extraWords, rand);
    // In a Shift lesson, words starting with a new capital get capitalised.
    if (newUpper.length) {
      return list.map((w) => (newUpper.includes(w[0].toUpperCase()) && rand() < 0.7 ? w[0].toUpperCase() + w.slice(1) : w));
    }
    return list;
  };
  const wordsScreen = (n: number, title: string): LessonScreen => {
    if (hasWords) return { type: "word_drill", title, text: decorate(wordList(n), ctx, { sentences: false }) };
    // Too few real words with these keys yet: practise letter groups instead.
    return { type: "letter_drill", title: "অক্ষর মিলিয়ে টাইপ করুন", text: letterGroups(allowedLetters, n, 2, 4, rand, newLower) };
  };
  const lineScreen = (n: number, title: string): LessonScreen => {
    if (hasWords) return { type: "sentence", title, text: decorate(wordList(n), ctx, { sentences: true }) };
    return { type: "sentence", title, text: letterGroups(allowedLetters, n, 2, 5, rand, newLower) };
  };

  if (lesson.kind === "keys") {
    // Lowercase letters: find each key, then drill it alone.
    for (const key of lesson.newKeys.filter((k) => isLower(k) || k === " ")) {
      screens.push({ type: "key_intro", title: introTitle(key), text: key });
      if (isLower(key)) {
        screens.push({ type: "letter_drill", title: `${keyDisplayName(key)} অনুশীলন`, text: letterGroups([key], 8, 1, 3, rand) });
      }
    }
    // Capitals: find two (one per hand where possible), then pair drills like "Jj Kk".
    if (newUpper.length) {
      for (const key of newUpper.slice(0, 2)) screens.push({ type: "key_intro", title: introTitle(key), text: key });
      const pairs = Array.from({ length: 10 }, () => {
        const c = pick(newUpper, rand);
        return rand() < 0.5 ? `${c}${c.toLowerCase()}` : `${c}${pick(allowedLetters, rand)}${pick(allowedLetters, rand)}`;
      });
      screens.push({ type: "letter_drill", title: "Shift ধরে বড় হাতের অক্ষর", text: pairs.join(" ") });
    }
    // Digits: find each, then digit groups.
    if (newDigits.length) {
      for (const key of newDigits) screens.push({ type: "key_intro", title: introTitle(key), text: key });
      screens.push({ type: "letter_drill", title: "সংখ্যা অনুশীলন", text: letterGroups(newDigits, 12, 1, 4, rand) });
    }
    // Symbols: find each, then tokens that use them the way real text does.
    if (newSymbols.length) {
      for (const key of newSymbols) screens.push({ type: "key_intro", title: introTitle(key), text: key });
      const tokens: string[] = [];
      for (let i = 0; tokens.length < 12 && i < 60; i++) {
        const t = symbolToken(ctx, newSymbols[i % newSymbols.length], hasWords ? pick(words.slice(0, 60), rand) : pick(allowedLetters, rand));
        if (t) tokens.push(t);
      }
      if (tokens.length) {
        screens.push({ type: "letter_drill", title: `${newSymbols.map(keyDisplayName).join(" ")} অনুশীলন`, text: tokens.join(" ") });
      }
    }
    if (newLower.length > 1) {
      screens.push({ type: "letter_drill", title: "নতুন কী মিলিয়ে", text: letterGroups(newLower, 10, 2, 4, rand) });
    }
    if (newLower.length && allowedLetters.length > newLower.length) {
      screens.push({ type: "letter_drill", title: "শেখা সব কী মিলিয়ে", text: letterGroups(allowedLetters, 12, 2, 5, rand, newLower) });
    }
    screens.push(wordsScreen(12, "শব্দ টাইপ করুন"));
    screens.push(lineScreen(20, "পুরো লাইন টাইপ করুন"));
  } else if (lesson.kind === "review") {
    screens.push({ type: "letter_drill", title: "সব কী মিলিয়ে", text: letterGroups(allowedLetters, 14, 2, 5, rand) });
    screens.push(wordsScreen(14, "শব্দ অনুশীলন"));
    screens.push(wordsScreen(14, "আরও শব্দ"));
    screens.push(lineScreen(24, "লাইন অনুশীলন"));
    screens.push(lineScreen(28, "লম্বা লাইন"));
  } else if (lesson.kind === "wrapup") {
    screens.push(wordsScreen(16, "শব্দ অনুশীলন"));
    screens.push(lineScreen(30, "অনুচ্ছেদ ১"));
    screens.push(lineScreen(36, "অনুচ্ছেদ ২"));
    screens.push(lineScreen(40, "অনুচ্ছেদ ৩"));
  } else {
    screens.push({
      type: "timed",
      title: "১ মিনিটে যতটা পারেন সঠিকভাবে টাইপ করুন",
      text: lineScreen(160, "").text,
      seconds: 60,
    });
  }
  return screens;
}

export function withScreens(lesson: LessonDef, bank: readonly string[]): LessonWithScreens {
  return { ...lesson, screens: buildScreens(lesson, bank) };
}

/** Characters a lesson asks the student to type (for server-side plausibility checks). */
export function lessonCharCount(screens: LessonScreen[]): number {
  return screens.filter((s) => s.type !== "timed").reduce((n, s) => n + Array.from(s.text).length, 0);
}

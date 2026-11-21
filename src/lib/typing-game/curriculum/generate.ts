/**
 * Turns a lesson definition into its screens. Deterministic per lesson id,
 * so every student sees the same drills and a reload never changes them.
 * Pure: the word bank is passed in (see word-bank.ts for the real one).
 */
import { fingerFor, keyDisplayName } from "./keyboard";
import type { LessonDef, LessonScreen, LessonWithScreens } from "./types";
import { seededRandom } from "@/lib/typing-game/practice/transform";

const LETTER = /^[a-z]$/;

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

/** Joins words, adding the punctuation the student has learned. */
function sentence(words: string[], allowed: string[], rand: Rand): string {
  const period = allowed.includes(".");
  const comma = allowed.includes(",");
  const semi = allowed.includes(";");
  const out: string[] = [];
  let sinceStop = 0;
  words.forEach((w, i) => {
    let word = w;
    sinceStop++;
    const last = i === words.length - 1;
    if (period && (last || (sinceStop >= 6 && rand() < 0.35))) {
      word += ".";
      sinceStop = 0;
    } else if (!last && comma && sinceStop >= 3 && rand() < 0.15) {
      word += ",";
    } else if (!last && semi && sinceStop >= 4 && rand() < 0.08) {
      word += ";";
      sinceStop = 0;
    }
    out.push(word);
  });
  return out.join(" ");
}

function introTitle(key: string): string {
  const finger = fingerFor(key);
  if (key === " ") return "দুই হাতের বুড়ো আঙুল দিয়ে Space চাপুন";
  return `${finger ? finger.bn : ""} দিয়ে ${keyDisplayName(key)} চাপুন`;
}

const APOSTROPHE_WORDS = ["don't", "it's", "can't", "we're", "i'm", "you're", "isn't", "that's", "let's", "won't"];

export function buildScreens(lesson: LessonDef, bank: readonly string[]): LessonScreen[] {
  const rand = seededRandom(hashSeed(lesson.id));
  const allowedLetters = lesson.allowedKeys.filter((c) => LETTER.test(c));
  const newLetters = lesson.newKeys.filter((c) => LETTER.test(c));
  const newSymbols = lesson.newKeys.filter((c) => !LETTER.test(c) && c !== " ");
  const words = eligibleWords(bank, allowedLetters, newLetters);
  const extraWords = lesson.allowedKeys.includes("'")
    ? APOSTROPHE_WORDS.filter((w) => Array.from(w).every((c) => c === "'" || allowedLetters.includes(c)))
    : [];
  const screens: LessonScreen[] = [];

  const wordsOrGroups = (n: number, title: string): LessonScreen => {
    if (words.length >= 6) {
      const list = sampleWords(words, n, rand);
      if (extraWords.length > 0) for (let i = 0; i < 2; i++) list[between(0, n - 1, rand)] = pick(extraWords, rand);
      return { type: "word_drill", title, text: list.join(" ") };
    }
    // Too few real words with these keys yet: practise letter groups instead.
    return { type: "letter_drill", title: "অক্ষর মিলিয়ে টাইপ করুন", text: letterGroups(allowedLetters, n, 2, 4, rand, newLetters) };
  };
  const flowing = (n: number, title: string): LessonScreen => {
    if (words.length >= 6) {
      const list = sampleWords(words, n, rand);
      if (extraWords.length > 0) for (let i = 0; i < 3; i++) list[between(0, n - 1, rand)] = pick(extraWords, rand);
      return { type: "sentence", title, text: sentence(list, lesson.allowedKeys, rand) };
    }
    return { type: "sentence", title, text: letterGroups(allowedLetters, n, 2, 5, rand, newLetters) };
  };

  if (lesson.kind === "keys") {
    for (const key of lesson.newKeys) {
      screens.push({ type: "key_intro", title: introTitle(key), text: key });
      if (LETTER.test(key)) {
        screens.push({ type: "letter_drill", title: `${keyDisplayName(key)} অনুশীলন`, text: letterGroups([key], 8, 1, 3, rand) });
      }
    }
    if (newLetters.length > 1) {
      screens.push({ type: "letter_drill", title: "নতুন কী মিলিয়ে", text: letterGroups(newLetters, 10, 2, 4, rand) });
    }
    if (newSymbols.length > 0) {
      // Symbols ride on the end of letter groups, the way they appear in text.
      const groups = letterGroups(allowedLetters, 10, 2, 4, rand).split(" ");
      screens.push({
        type: "letter_drill",
        title: `${newSymbols.map(keyDisplayName).join(" ")} অনুশীলন`,
        text: groups.map((g) => g + pick(newSymbols, rand)).join(" "),
      });
    }
    if (allowedLetters.length > newLetters.length) {
      screens.push({
        type: "letter_drill",
        title: "শেখা সব কী মিলিয়ে",
        text: letterGroups(allowedLetters, 12, 2, 5, rand, newLetters.length ? newLetters : allowedLetters),
      });
    }
    screens.push(wordsOrGroups(12, "শব্দ টাইপ করুন"));
    screens.push(flowing(20, "পুরো লাইন টাইপ করুন"));
  } else if (lesson.kind === "review") {
    screens.push({ type: "letter_drill", title: "সব কী মিলিয়ে", text: letterGroups(allowedLetters, 14, 2, 5, rand) });
    screens.push(wordsOrGroups(14, "শব্দ অনুশীলন"));
    screens.push(wordsOrGroups(14, "আরও শব্দ"));
    screens.push(flowing(24, "লাইন অনুশীলন"));
    screens.push(flowing(28, "লম্বা লাইন"));
  } else if (lesson.kind === "wrapup") {
    screens.push(wordsOrGroups(16, "শব্দ অনুশীলন"));
    screens.push(flowing(30, "অনুচ্ছেদ ১"));
    screens.push(flowing(36, "অনুচ্ছেদ ২"));
    screens.push(flowing(40, "অনুচ্ছেদ ৩"));
  } else {
    screens.push({
      type: "timed",
      title: "১ মিনিটে যতটা পারেন সঠিকভাবে টাইপ করুন",
      text: flowing(160, "").text,
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

/**
 * Screens for Bangla lessons. Deterministic per lesson id. Every screen
 * uses only letters learned so far (by code point, so ড় = ড + ় works).
 * Units of practice are graphemes ("কি", "ক্ষ"), not keys.
 */
import { seededRandom } from "@/lib/typing-game/practice/transform";
import { BN_CONSONANTS, BN_HASANTA, BN_KARS, codepoints, graphemes, usesOnly } from "./bangla";
import { BN_PROFESSIONAL_TEXTS } from "./bn-professional-texts";
import { excerpts, hashSeed, type ArticleSource } from "./generate";
import type { LessonDef, LessonScreen } from "./types";

type Rand = () => number;
const pick = <T,>(a: readonly T[], r: Rand): T => a[Math.floor(r() * a.length)];
const between = (lo: number, hi: number, r: Rand) => lo + Math.floor(r() * (hi - lo + 1));
function shuffle<T>(items: readonly T[], r: Rand): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const KAR_SET = new Set(BN_KARS);
const CONSONANT_SET = new Set(BN_CONSONANTS);
const DIGITS = /^[০-৯]$/;
const isSymbol = (k: string) => k.length === 1 && !/[ঀ-৿]/.test(k) && k !== " " ? true : k === "।" || k === "৳";

/** Common conjuncts used in the Conjuncts level. */
const CONJUNCTS = ["ক্ষ", "ক্ত", "ঙ্গ", "ন্ত", "স্ত", "ত্র", "প্র", "ম্ম", "ন্দ", "স্থ", "চ্ছ", "ন্ন", "ল্প", "ক্র", "গ্র", "ব্দ", "দ্ধ", "ষ্ট"];

/** Groups of `count` items, each 1–3 graphemes, separated by spaces. */
function groups(items: string[], count: number, maxLen: number, r: Rand): string {
  return Array.from({ length: count }, () => Array.from({ length: between(1, maxLen, r) }, () => pick(items, r)).join("")).join(" ");
}

export function buildBanglaScreens(lesson: LessonDef, bank: readonly string[], articles: ArticleSource = {}): LessonScreen[] {
  const rand = seededRandom(hashSeed(lesson.id));
  const allowed = new Set(codepoints(lesson.allowedKeys));
  allowed.add(" ");
  const has = (c: string) => allowed.has(c);
  const consonants = BN_CONSONANTS.filter((c) => usesOnly(c, allowed));
  const kars = BN_KARS.filter(has);
  const newKeys = lesson.newKeys.filter((k) => k !== " ");
  const newKars = newKeys.filter((k) => KAR_SET.has(k));
  const newLetters = newKeys.filter((k) => !KAR_SET.has(k) && k !== BN_HASANTA && !DIGITS.test(k) && !isSymbol(k));
  const newDigits = newKeys.filter((k) => DIGITS.test(k));
  const newSymbols = newKeys.filter((k) => isSymbol(k));
  const prefer = [...newLetters, ...newKars, ...(newKeys.includes(BN_HASANTA) ? [BN_HASANTA] : [])];

  const words = bank.filter((w) => usesOnly(w, allowed));
  const focusWords = prefer.length ? words.filter((w) => prefer.some((p) => w.includes(p))) : words;
  const pool = (focusWords.length >= 8 ? focusWords : words).slice(0, 200);
  const hasWords = pool.length >= 6;
  const syllables = consonants.flatMap((c) => [c, ...kars.map((k) => c + k)]);
  const learnedUnits = [...lesson.allowedKeys.filter((k) => k !== " " && !KAR_SET.has(k) && k !== BN_HASANTA && !isSymbol(k)), ...syllables];
  const dari = has("।");
  const screens: LessonScreen[] = [];

  const wordLine = (n: number): string => Array.from({ length: n }, () => pick(pool, rand)).join(" ");
  const sentenceLine = (n: number): string => {
    if (!hasWords) return groups(learnedUnits, n, 2, rand);
    const out: string[] = [];
    let since = 0;
    for (let i = 0; i < n; i++) {
      let w = pick(pool, rand);
      since++;
      if (dari && (i === n - 1 || (since >= 6 && rand() < 0.3))) {
        w += "।";
        since = 0;
      } else if (has(",") && since >= 3 && rand() < 0.12) w += ",";
      out.push(w);
    }
    return out.join(" ");
  };
  const realPool = (n: number): string[] =>
    shuffle(
      Object.values(articles)
        .flatMap((texts) => texts.flatMap((t) => excerpts(t, n)))
        .filter((t) => usesOnly(t, allowed) && t.split(" ").length <= n * 2),
      rand,
    );

  if (lesson.kind === "keys") {
    for (const k of newLetters) {
      screens.push({ type: "key_intro", title: `"${k}" লিখুন`, text: k });
      screens.push({ type: "letter_drill", title: `${k} অনুশীলন`, text: groups([k], 8, 3, rand) });
    }
    for (const k of newKars) {
      const base = consonants.includes("ক") ? "ক" : consonants[0];
      screens.push({ type: "key_intro", title: `"${base}${k}" লিখুন — ${k} কার`, text: base + k });
      screens.push({
        type: "letter_drill",
        title: `${k} কার অনুশীলন`,
        text: Array.from({ length: 12 }, () => pick(consonants, rand) + k).join(" "),
      });
    }
    if (newKeys.includes(BN_HASANTA)) {
      const clusters = CONJUNCTS.filter((c) => usesOnly(c, allowed));
      for (const c of clusters.slice(0, 3)) screens.push({ type: "key_intro", title: `"${c}" লিখুন — যুক্তাক্ষর`, text: c });
      screens.push({ type: "letter_drill", title: "যুক্তাক্ষর অনুশীলন", text: Array.from({ length: 12 }, () => pick(clusters, rand)).join(" ") });
    }
    for (const k of newDigits) screens.push({ type: "key_intro", title: `"${k}" লিখুন`, text: k });
    if (newDigits.length) screens.push({ type: "letter_drill", title: "সংখ্যা অনুশীলন", text: groups(newDigits, 12, 4, rand) });
    if (newSymbols.length) {
      for (const k of newSymbols) screens.push({ type: "key_intro", title: `"${k}" লিখুন`, text: k });
      const tokens = Array.from({ length: 12 }, (_, i) => {
        const s = newSymbols[i % newSymbols.length];
        const w = hasWords ? pick(pool, rand) : pick(consonants, rand);
        if (s === "(" || s === ")") return `(${w})`;
        if (s === "৳") return `৳${pick(["১০০", "২৫০", "৫০০", "১২০০"], rand)}`;
        if (s === "%") return `${pick(["১০", "২৫", "৫০"], rand)}%`;
        if (s === "-") return `${w}-${pick(pool.length ? pool : consonants, rand)}`;
        return w + s;
      }).filter((t) => usesOnly(t, allowed));
      screens.push({ type: "letter_drill", title: `${newSymbols.join(" ")} অনুশীলন`, text: tokens.join(" ") });
    }
    if (newLetters.length > 1) screens.push({ type: "letter_drill", title: "নতুন অক্ষর মিলিয়ে", text: groups(newLetters, 10, 3, rand) });
    screens.push(hasWords ? { type: "word_drill", title: "শব্দ টাইপ করুন", text: wordLine(12) } : { type: "letter_drill", title: "শেখা অক্ষর মিলিয়ে", text: groups(learnedUnits, 12, 3, rand) });
    screens.push({ type: "sentence", title: "পুরো লাইন", text: sentenceLine(18) });
  } else if (lesson.kind === "accuracy") {
    const clusters = CONJUNCTS.filter((c) => usesOnly(c, allowed));
    const conjWords = words.filter((w) => w.includes(BN_HASANTA)).slice(0, 200);
    screens.push({ type: "letter_drill", title: "যুক্তাক্ষর", text: Array.from({ length: 14 }, () => pick(clusters, rand)).join(" ") });
    screens.push({ type: "word_drill", title: "যুক্তাক্ষরের শব্দ", text: Array.from({ length: 12 }, () => pick(conjWords.length ? conjWords : pool, rand)).join(" ") });
    screens.push({ type: "word_drill", title: "আরও শব্দ", text: Array.from({ length: 12 }, () => pick(conjWords.length ? conjWords : pool, rand)).join(" ") });
    screens.push({ type: "sentence", title: "লাইনে যুক্তাক্ষর", text: sentenceLine(20) });
  } else if (lesson.kind === "review") {
    screens.push({ type: "letter_drill", title: "সব অক্ষর মিলিয়ে", text: groups(learnedUnits, 14, 3, rand) });
    screens.push(hasWords ? { type: "word_drill", title: "শব্দ অনুশীলন", text: wordLine(14) } : { type: "letter_drill", title: "আরও অনুশীলন", text: groups(learnedUnits, 14, 3, rand) });
    screens.push({ type: "sentence", title: "লাইন অনুশীলন", text: sentenceLine(22) });
    screens.push({ type: "sentence", title: "লম্বা লাইন", text: sentenceLine(26) });
  } else if (lesson.kind === "words") {
    const common = words.slice(0, lesson.pool ?? 300);
    for (let i = 1; i <= 4; i++) screens.push({ type: "word_drill", title: `শব্দ ${i}/4`, text: Array.from({ length: 14 }, () => pick(common, rand)).join(" ") });
  } else if (lesson.kind === "sentences") {
    const real = realPool(18);
    for (let i = 0; i < 4; i++) screens.push({ type: "sentence", title: `বাক্য ${i + 1}/4`, text: real[i] ?? sentenceLine(24) });
  } else if (lesson.kind === "sprint") {
    const short = realPool(8).filter((t) => t.split(" ").length <= 14);
    [short[0] ?? sentenceLine(10), short[1] ?? sentenceLine(12)].forEach((text, li) => {
      for (let r = 1; r <= 3; r++) screens.push({ type: "sentence", title: `লাইন ${li + 1} — বার ${r}/3: আগেরবারের চেয়ে একটু দ্রুত`, text });
    });
  } else if (lesson.kind === "endurance" || lesson.kind === "assessment") {
    const seconds = lesson.seconds ?? 60;
    const need = Math.ceil((seconds / 60) * 120);
    let text: string;
    if (lesson.topic === "mixed") {
      text = shuffle([...Object.values(BN_PROFESSIONAL_TEXTS).flat(), ...realPool(40)].filter((t) => usesOnly(t, allowed)), rand).join(" ");
    } else {
      const real = realPool(40);
      text = real.length >= 3 ? real.join(" ").split(" ").slice(0, need).join(" ") : sentenceLine(need);
    }
    screens.push({ type: "timed", title: `${Math.round(seconds / 60)} মিনিটে যতটা পারেন সঠিকভাবে লিখুন`, text, seconds });
  } else if (lesson.kind === "professional") {
    const topic = lesson.topic ?? "";
    const texts = topic.startsWith("articles:") ? realPool(45) : (BN_PROFESSIONAL_TEXTS[topic] ?? []).filter((t) => usesOnly(t, allowed));
    texts.slice(0, 3).forEach((text, i) => screens.push({ type: "sentence", title: `${lesson.title} ${i + 1}/3`, text }));
  }
  return screens.filter((s) => s.text.trim().length > 0);
}

/** Every word in a Bangla passage list, most frequent first (the drill word bank). */
export function buildBanglaWordBank(texts: readonly string[]): string[] {
  const freq = new Map<string, number>();
  for (const t of texts) {
    for (const raw of t.normalize("NFC").split(/[\s।,?!;:"'()\-–—.]+/)) {
      const w = raw.trim();
      if (!w || !/^[ঀ-৿‌‍]+$/.test(w) || graphemes(w).length > 8) continue;
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }
  return Array.from(freq).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([w]) => w);
}

/** True for characters the Bangla track treats as letters (for tests). */
export function isBanglaConsonant(c: string): boolean {
  return CONSONANT_SET.has(c);
}

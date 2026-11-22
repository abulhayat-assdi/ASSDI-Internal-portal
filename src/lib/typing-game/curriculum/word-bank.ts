/**
 * English word bank for lesson drills, built once from the typing-exam
 * article bank and sorted by how often each word appears there (so drills
 * favour everyday words). Server side only — the bank is large.
 */
import { ALL_PASSAGES } from "@/lib/typing-exam/content";
import { cleanExamText } from "@/lib/typing-exam/examText";
import { buildBanglaScreens, buildBanglaWordBank } from "./bn-generate";
import { buildScreens } from "./generate";
import type { LessonDef, LessonScreen } from "./types";

let cache: string[] | null = null;

export function englishWordBank(): string[] {
  if (cache) return cache;
  const freq = new Map<string, number>();
  for (const p of ALL_PASSAGES) {
    if (p.language !== "en") continue;
    for (const raw of p.text.toLowerCase().split(/[^a-z]+/)) {
      if (raw.length < 2 || raw.length > 9) continue;
      freq.set(raw, (freq.get(raw) ?? 0) + 1);
    }
  }
  cache = Array.from(freq).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([w]) => w);
  return cache;
}

let articleCache: Record<string, string[]> | null = null;

/** English article texts grouped by category (cleaned to keyboard characters). */
export function englishArticles(): Record<string, string[]> {
  if (articleCache) return articleCache;
  const out: Record<string, string[]> = {};
  for (const p of ALL_PASSAGES) {
    if (p.language !== "en") continue;
    (out[p.category] ??= []).push(cleanExamText(p.text));
  }
  articleCache = out;
  return out;
}

let bnBankCache: string[] | null = null;
let bnArticleCache: Record<string, string[]> | null = null;

/** Bangla article texts grouped by category (NFC, keyboard-clean). */
export function banglaArticles(): Record<string, string[]> {
  if (bnArticleCache) return bnArticleCache;
  const out: Record<string, string[]> = {};
  for (const p of ALL_PASSAGES) {
    if (p.language !== "bn") continue;
    (out[p.category] ??= []).push(cleanExamText(p.text));
  }
  bnArticleCache = out;
  return out;
}

/** Bangla word bank (most frequent first) from the Bangla articles. */
export function banglaWordBank(): string[] {
  if (bnBankCache) return bnBankCache;
  bnBankCache = buildBanglaWordBank(Object.values(banglaArticles()).flat());
  return bnBankCache;
}

/** Screens for any lesson, picking the right generator and sources. Server only. */
export function lessonScreens(lesson: LessonDef): LessonScreen[] {
  return lesson.mode === "bn"
    ? buildBanglaScreens(lesson, banglaWordBank(), banglaArticles())
    : buildScreens(lesson, englishWordBank(), englishArticles());
}

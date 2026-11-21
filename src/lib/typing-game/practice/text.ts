/**
 * Builds practice text from the typing-exam article bank. Server side only
 * (the bank is large; the client asks the practice text API for one run).
 */
import { ALL_PASSAGES, type ExamPassage } from "@/lib/typing-exam/content";
import {
  DIFFICULTY_PRESETS,
  seededRandom,
  takeWords,
  transformText,
  wordCount,
  type PracticeDifficulty,
  type PracticeLanguage,
  type TransformOptions,
} from "./transform";

/** Longest text a single run may ask for — keeps the typing field light. */
export const MAX_PRACTICE_WORDS = 2500;
export const MIN_PRACTICE_WORDS = 5;

/** Words to prepare for a timed run: enough for a very fast typist (160 WPM). */
export function wordsForDuration(seconds: number): number {
  return clampWords(Math.ceil((seconds / 60) * 160) + 20);
}

export function clampWords(n: number): number {
  if (!Number.isFinite(n)) return MIN_PRACTICE_WORDS;
  return Math.min(MAX_PRACTICE_WORDS, Math.max(MIN_PRACTICE_WORDS, Math.round(n)));
}

export interface PracticeCategory {
  value: string;
  label: string;
  count: number;
}

/** Categories that have at least one article in the language. */
export function practiceCategories(language: PracticeLanguage): PracticeCategory[] {
  const counts = new Map<string, number>();
  for (const p of ALL_PASSAGES) {
    if (p.language === language) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  }
  return Array.from(counts, ([value, count]) => ({ value, label: value, count })).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}

export interface PracticeTextRequest {
  language: PracticeLanguage;
  difficulty: PracticeDifficulty;
  /** Overrides on top of the difficulty preset (custom toggles). */
  overrides?: Partial<TransformOptions>;
  category?: string | null;
  /** Use exactly this article (article mode). */
  articleId?: string | null;
  words: number;
  seed: number;
}

export interface PracticeText {
  text: string;
  /** Article titles the text came from, for the "source" line. */
  sources: string[];
  options: TransformOptions;
}

function pool(language: PracticeLanguage, category?: string | null): ExamPassage[] {
  const inLang = ALL_PASSAGES.filter((p) => p.language === language);
  if (!category) return inLang;
  const scoped = inLang.filter((p) => p.category === category);
  return scoped.length > 0 ? scoped : inLang;
}

function shuffled<T>(items: T[], rand: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Joins reshaped articles until there are enough words. In article mode the
 * one chosen article is used as-is (no padding), so its length decides the run.
 */
export function buildPracticeText(req: PracticeTextRequest): PracticeText {
  const options: TransformOptions = { ...DIFFICULTY_PRESETS[req.language][req.difficulty], ...req.overrides };
  const target = clampWords(req.words);

  if (req.articleId) {
    const article = ALL_PASSAGES.find((p) => p.id === req.articleId && p.language === req.language);
    if (article) {
      return {
        text: takeWords(transformText(article.text, options, req.seed), MAX_PRACTICE_WORDS),
        sources: [article.title],
        options,
      };
    }
  }

  const rand = seededRandom(req.seed);
  const articles = shuffled(pool(req.language, req.category), rand);
  const parts: string[] = [];
  const sources: string[] = [];
  let total = 0;
  // Cycle the shuffled list if one category is shorter than the target.
  for (let i = 0; total < target && articles.length > 0 && i < articles.length * 4; i++) {
    const article = articles[i % articles.length];
    const piece = transformText(article.text, options, req.seed + i);
    const n = wordCount(piece);
    if (n === 0) continue;
    parts.push(piece);
    if (!sources.includes(article.title)) sources.push(article.title);
    total += n;
  }
  return { text: takeWords(parts.join(" "), target), sources, options };
}

/** Article list for the article picker (id + title + size), per language. */
export function practiceArticles(language: PracticeLanguage, category?: string | null) {
  return pool(language, category).map((p) => ({
    id: p.id,
    title: p.title,
    category: p.category,
    words: p.wordCount,
  }));
}

/**
 * Practice settings and personal bests, remembered per browser.
 * Every storage access is guarded: private windows and blocked storage
 * simply fall back to defaults.
 */
import type {
  CaseMode,
  PracticeDifficulty,
  PracticeLanguage,
  PunctuationMode,
} from "@/lib/typing-game/practice/transform";

export type PracticeMode = "time" | "words" | "article";

export interface PracticeConfig {
  language: PracticeLanguage;
  mode: PracticeMode;
  seconds: number;
  words: number;
  difficulty: PracticeDifficulty;
  /** Custom toggles; null means "use the difficulty preset". */
  custom: { case: CaseMode; punctuation: PunctuationMode; numbers: boolean } | null;
  category: string | null;
  articleId: string | null;
}

export const DEFAULT_CONFIG: PracticeConfig = {
  language: "en",
  mode: "time",
  seconds: 60,
  words: 25,
  difficulty: "beginner",
  custom: null,
  category: null,
  articleId: null,
};

const CONFIG_KEY = "tap.practice.config.v1";
const BESTS_KEY = "tap.practice.bests.v1";

export function loadConfig(): PracticeConfig {
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<PracticeConfig>;
    const merged = { ...DEFAULT_CONFIG, ...parsed };
    if (!Number.isInteger(merged.seconds) || merged.seconds < 5 || merged.seconds > 3600) merged.seconds = 60;
    if (!Number.isInteger(merged.words) || merged.words < 5) merged.words = 25;
    return merged;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(c: PracticeConfig): void {
  try {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
  } catch {
    /* storage unavailable — settings just won't persist */
  }
}

export interface PersonalBest {
  wpm: number;
  accuracy: number;
  at: number;
}

/** One best per language × mode × length × difficulty. */
export function bestKey(c: PracticeConfig): string {
  const length = c.mode === "time" ? `${c.seconds}s` : c.mode === "words" ? `${c.words}w` : "article";
  const level = c.custom ? "custom" : c.difficulty;
  return `${c.language}|${c.mode}|${length}|${level}`;
}

export function loadBests(): Record<string, PersonalBest> {
  try {
    const raw = window.localStorage.getItem(BESTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, PersonalBest>) : {};
  } catch {
    return {};
  }
}

/** Saves when it beats the stored WPM. Returns true for a new best. */
export function saveBest(key: string, wpm: number, accuracy: number): boolean {
  try {
    const all = loadBests();
    const prev = all[key];
    if (prev && prev.wpm >= wpm) return false;
    all[key] = { wpm, accuracy, at: Date.now() };
    window.localStorage.setItem(BESTS_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

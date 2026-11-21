/**
 * Lesson progress rules: unlock order, stars, XP and the result checks the
 * server applies before saving. Pure functions shared by pages, API routes
 * and tests.
 */
import type { LessonDef, LevelDef } from "./types";
import { scoreAttempt } from "@/lib/typing-exam/scoring";
import { isPassageComplete, passageWords } from "@/lib/typing-exam/words";

export type LessonStatus = "completed" | "skipped";

export interface LessonProgressRow {
  lessonId: string;
  status: LessonStatus;
  stars: number;
  bestWpm: number;
  bestAccuracy: number;
  bestTimeMs: number | null;
  attempts: number;
}

export type LessonState = "completed" | "skipped" | "available" | "locked";

export function levelLessons(level: LevelDef): LessonDef[] {
  return level.units.flatMap((u) => u.lessons);
}

/** Lessons of several levels in teaching order (levels sorted by number). */
export function trackLessons(levels: LevelDef[]): LessonDef[] {
  return levels
    .slice()
    .sort((a, b) => a.number - b.number)
    .flatMap(levelLessons);
}

/**
 * A lesson is open when every earlier lesson in its track (all earlier
 * levels too) is completed or skipped. The very first lesson is always open.
 */
export function lessonStates(levels: LevelDef[], progress: Map<string, LessonProgressRow>): Map<string, LessonState> {
  const out = new Map<string, LessonState>();
  let open = true;
  for (const lesson of trackLessons(levels)) {
    const row = progress.get(lesson.id);
    if (row) out.set(lesson.id, row.status);
    else out.set(lesson.id, open ? "available" : "locked");
    if (!row) open = false;
  }
  return out;
}

/**
 * Earlier lessons that are not done yet — what a skip to `lessonId` marks
 * as skipped. Returns null when one of them may never be skipped.
 */
export function lessonsToSkip(
  levels: LevelDef[],
  lessonId: string,
  progress: Map<string, LessonProgressRow>,
  unskippable: ReadonlySet<string> = new Set(),
): string[] | null {
  const ids: string[] = [];
  for (const lesson of trackLessons(levels)) {
    if (lesson.id === lessonId) return ids;
    if (!progress.has(lesson.id)) {
      if (unskippable.has(lesson.id)) return null;
      ids.push(lesson.id);
    }
  }
  return [];
}

/** Accuracy → stars: 97%+ = 3, 92%+ = 2, 85%+ = 1, else 0. */
export function starsFor(accuracy: number): number {
  if (accuracy >= 97) return 3;
  if (accuracy >= 92) return 2;
  if (accuracy >= 85) return 1;
  return 0;
}

export function levelPercent(level: LevelDef, progress: Map<string, LessonProgressRow>): number {
  const all = levelLessons(level);
  if (all.length === 0) return 0;
  const done = all.filter((l) => progress.get(l.id)?.status === "completed").length;
  return Math.round((done / all.length) * 100);
}

/** What the browser reports for a finished lesson. */
export interface LessonResultInput {
  /** Characters typed correctly (= the lesson text for untimed screens). */
  correctChars: number;
  /** Every key press, mistakes included. */
  keystrokes: number;
  /** Wrong key presses. */
  errors: number;
  /** Active typing time across all screens. */
  elapsedMs: number;
}

export interface LessonResult {
  wpm: number;
  accuracy: number;
  stars: number;
  elapsedMs: number;
}

/** Faster than this per character is not a human typing (≈ 600 WPM). */
const MIN_MS_PER_CHAR = 20;

/**
 * Validates a reported result and derives the numbers to store. `expectedChars`
 * is the untimed text length the server knows the lesson has; a timed lesson
 * passes 0 and its `minElapsedMs` instead.
 */
export function evaluateLessonResult(
  input: LessonResultInput,
  expectedChars: number,
  minElapsedMs = 0,
): LessonResult | { error: string } {
  const { correctChars, keystrokes, errors, elapsedMs } = input;
  const ints = [correctChars, keystrokes, errors, elapsedMs];
  if (!ints.every((n) => Number.isInteger(n) && n >= 0)) return { error: "BAD_NUMBERS" };
  if (correctChars < expectedChars) return { error: "INCOMPLETE" };
  if (keystrokes !== correctChars + errors) return { error: "INCONSISTENT" };
  if (elapsedMs < Math.max(minElapsedMs, correctChars * MIN_MS_PER_CHAR)) return { error: "TOO_FAST" };
  if (elapsedMs > 6 * 60 * 60 * 1000) return { error: "TOO_SLOW" };
  const minutes = Math.max(elapsedMs, 1000) / 60000;
  const wpm = Math.round((correctChars / 5 / minutes) * 100) / 100;
  const accuracy = keystrokes > 0 ? Math.round((correctChars / keystrokes) * 10000) / 100 : 0;
  return { wpm, accuracy, stars: starsFor(accuracy), elapsedMs };
}

// ---------------------------------------------------------------------------
// Text-based lessons (Bangla): the browser sends what was typed per screen,
// the server scores it against the screens it built itself.
// ---------------------------------------------------------------------------

export interface ScreenSnapshot {
  typedText: string;
  keystrokesTotal: number;
  keystrokesCorrect: number;
  elapsedMs: number;
}

/** Faster than this is not hand typing (pasted or scripted text). */
export const MAX_LESSON_WPM = 250;
const TIMED_SLACK_MS = 1500;

export function evaluateScreenSnapshots(
  screens: { type: string; text: string; seconds?: number }[],
  snaps: unknown,
): LessonResult | { error: string } {
  if (!Array.isArray(snaps) || snaps.length !== screens.length) return { error: "BAD_NUMBERS" };
  let correct = 0;
  let typed = 0;
  let ksTotal = 0;
  let ksCorrect = 0;
  let elapsed = 0;
  for (let i = 0; i < screens.length; i++) {
    const s = screens[i];
    const raw = snaps[i] as Partial<ScreenSnapshot> | null;
    if (!raw || typeof raw.typedText !== "string") return { error: "BAD_NUMBERS" };
    const nums = [raw.keystrokesTotal, raw.keystrokesCorrect, raw.elapsedMs].map(Number);
    if (!nums.every((n) => Number.isFinite(n) && n >= 0)) return { error: "BAD_NUMBERS" };
    const [kt, kc, ms] = nums;
    const text = s.text.normalize("NFC");
    const typedText = raw.typedText.normalize("NFC").slice(0, text.length * 2 + 50);
    if (s.type === "timed") {
      if (ms < (s.seconds ?? 60) * 1000 - TIMED_SLACK_MS) return { error: "TOO_FAST" };
    } else if (!isPassageComplete(passageWords(text), typedText)) {
      return { error: "INCOMPLETE" };
    }
    const sc = scoreAttempt({ originalText: text, typedText, elapsedMs: ms, keystrokes: { total: kt, correct: kc } });
    correct += sc.correctChars;
    typed += sc.totalChars;
    ksTotal += kt;
    ksCorrect += Math.min(kc, kt);
    elapsed += Math.max(ms, 0);
  }
  const minutes = Math.max(elapsed, 1000) / 60000;
  const wpm = Math.round((correct / 5 / minutes) * 100) / 100;
  if (wpm > MAX_LESSON_WPM) return { error: "TOO_FAST" };
  const accuracy =
    ksTotal >= typed && ksTotal > 0
      ? Math.round((ksCorrect / ksTotal) * 10000) / 100
      : typed > 0
        ? Math.round((correct / typed) * 10000) / 100
        : 0;
  return { wpm, accuracy, stars: starsFor(accuracy), elapsedMs: Math.round(elapsed) };
}

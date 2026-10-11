// Scoring engine for the Typing Test Exam feature. Deliberately independent
// from src/lib/typing-game — this is a separate assessment system.
//
// The rules (Monkeytype-style, the de-facto standard for timed tests):
//
//  - correctChars: the FINAL typed text is judged word by word (words.ts):
//    each typed word against its own passage word, character by character,
//    plus the spaces that close words of the right length. A wrong, missing
//    or extra character only ever costs its own word — no cascade.
//  - WPM (net): correctChars / 5 / minutes. Only correct characters count,
//    so mistakes left in the text lower the speed.
//  - Raw WPM: every typed character / 5 / minutes, mistakes included.
//  - Accuracy: correct keystrokes / all keystrokes. A mistake you typed and
//    later fixed with backspace still counts against accuracy, exactly as in
//    Monkeytype. When no keystroke counts are available (or they are
//    inconsistent with the final text — see keystrokesAreConsistent), it
//    falls back to correctChars / typedChars of the final text.
//  - minutes: the time actually spent. For a time-limited test that ran out,
//    that is the full duration; see resolveScoringTimeMs in session.ts.
//
// Both strings are NFC-normalized first so a Bangla passage and a Bangla
// keyboard that emit the same visible text in different code-point orders
// can never be scored as wrong.

import { countCorrectChars } from "./words";

export interface KeystrokeCounts {
  /** Every character insertion, including ones later deleted with backspace. */
  total: number;
  /** Insertions whose character matched the passage at that index. */
  correct: number;
}

export interface ScoreInput {
  originalText: string;
  typedText: string;
  /** Time spent typing. Prefer elapsedMs; elapsedSeconds kept for older callers. */
  elapsedMs?: number;
  elapsedSeconds?: number;
  keystrokes?: KeystrokeCounts | null;
}

export interface ScoreResult {
  correctChars: number;
  totalChars: number;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  accuracySource: "keystrokes" | "final_text";
}

/** Speed is never computed over less than one second (avoids absurd spikes). */
export const MIN_SCORING_MS = 1000;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function normalizeText(s: string): string {
  return s.normalize("NFC");
}

/**
 * Keystroke counters can only be trusted when they could physically have
 * produced the final text:
 *  - every final character came from at least one insertion
 *    (total >= typed, correct >= correctChars),
 *  - the extra correct insertions (correct - correctChars) all sit among the
 *    deleted ones (total - typed),
 *  - correct never exceeds total.
 * Anything else (tampered or buggy client) falls back to final-text accuracy.
 */
export function keystrokesAreConsistent(k: KeystrokeCounts, typedLength: number, correctChars: number): boolean {
  if (!Number.isInteger(k.total) || !Number.isInteger(k.correct)) return false;
  if (k.total < 0 || k.correct < 0) return false;
  if (k.correct > k.total) return false;
  if (k.total < typedLength || k.correct < correctChars) return false;
  if (k.correct - correctChars > k.total - typedLength) return false;
  return true;
}

export function scoreAttempt({ originalText, typedText, elapsedMs, elapsedSeconds, keystrokes }: ScoreInput): ScoreResult {
  const original = normalizeText(originalText);
  const typed = normalizeText(typedText);

  const totalChars = typed.length;
  const correctChars = countCorrectChars(original, typed);

  const rawMs = elapsedMs ?? (elapsedSeconds ?? 0) * 1000;
  const ms = Math.max(Number.isFinite(rawMs) ? rawMs : 0, MIN_SCORING_MS);
  const minutes = ms / 60000;

  const wpm = round2(correctChars / 5 / minutes);
  const rawWpm = round2(totalChars / 5 / minutes);

  let accuracy: number;
  let accuracySource: ScoreResult["accuracySource"];
  if (keystrokes && keystrokes.total > 0 && keystrokesAreConsistent(keystrokes, totalChars, correctChars)) {
    accuracy = round2((keystrokes.correct / keystrokes.total) * 100);
    accuracySource = "keystrokes";
  } else {
    accuracy = totalChars > 0 ? round2((correctChars / totalChars) * 100) : 0;
    accuracySource = "final_text";
  }

  return { correctChars, totalChars, wpm, rawWpm, accuracy, accuracySource };
}

export type ExamResultTier = "PASS" | "AVERAGE" | "FAIL";

export interface GradeThresholds {
  passWpm: number;
  passAccuracy: number;
  failWpm: number;
  failAccuracy: number;
}

/**
 * Three-tier grading: PASS when both metrics clear the pass bar, FAIL when
 * either metric drops below the fail bar, AVERAGE for everything in between.
 */
export function gradeAttempt(wpm: number, accuracy: number, t: GradeThresholds): ExamResultTier {
  if (wpm >= t.passWpm && accuracy >= t.passAccuracy) return "PASS";
  if (wpm < t.failWpm || accuracy < t.failAccuracy) return "FAIL";
  return "AVERAGE";
}

/** Admin-form guard: pass bar must sit at/above the fail bar on both axes. */
export function validateThresholds(t: GradeThresholds): string | null {
  if (t.passWpm < t.failWpm) return "Pass WPM অবশ্যই Fail WPM এর চেয়ে বেশি বা সমান হতে হবে";
  if (t.passAccuracy < t.failAccuracy) return "Pass Accuracy অবশ্যই Fail Accuracy এর চেয়ে বেশি বা সমান হতে হবে";
  return null;
}

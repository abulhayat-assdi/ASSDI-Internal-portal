// Scoring engine for the Typing Test Exam feature. Deliberately independent
// from src/lib/typing-game — this is a separate assessment system.

export interface ScoreInput {
  originalText: string;
  typedText: string;
  elapsedSeconds: number;
}

export interface ScoreResult {
  correctChars: number;
  totalChars: number;
  wpm: number;
  accuracy: number;
}

/** Char-by-char comparison against the original passage, up to what was typed. */
export function scoreAttempt({ originalText, typedText, elapsedSeconds }: ScoreInput): ScoreResult {
  const totalChars = typedText.length;
  let correctChars = 0;
  for (let i = 0; i < totalChars; i++) {
    if (typedText[i] === originalText[i]) correctChars++;
  }

  const minutes = Math.max(elapsedSeconds, 1) / 60;
  const wpm = Math.round((correctChars / 5 / minutes) * 100) / 100;
  const accuracy = totalChars > 0 ? Math.round((correctChars / totalChars) * 10000) / 100 : 0;

  return { correctChars, totalChars, wpm, accuracy };
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

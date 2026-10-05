// Client-side state machine for one typing-exam run. Pure TypeScript — no
// React, no timers, no globals. The UI feeds it input values and timestamps;
// it owns the typed text, the keystroke counters and the deadline, so there
// is exactly one source of truth and nothing can go stale inside a closure.
//
// Why this exists: the previous runner read `typedText` from a React closure
// captured when the timer effect started (i.e. ""), so a time-up submission
// sent an empty string and every taker scored 0 WPM / 0%. Here, submission
// always reads engine.snapshot(), which is the live state.

import type { KeystrokeCounts } from "./scoring";

export type FinishReason = "TIME_UP" | "COMPLETED" | "ABANDONED";

export interface EngineSnapshot {
  typedText: string;
  keystrokes: KeystrokeCounts;
  /** ms from start to now — or to the finish moment once finished. Never above the duration. */
  elapsedMs: number;
  finishReason: FinishReason | null;
}

export class TypingExamEngine {
  readonly text: string;
  readonly durationMs: number;

  private typed = "";
  private keystrokesTotal = 0;
  private keystrokesCorrect = 0;
  private startedAt: number | null = null;
  private finishedAt: number | null = null;
  private reason: FinishReason | null = null;
  /** Bumped on every accepted change; lets the UI skip redundant autosaves. */
  private rev = 0;

  constructor(text: string, durationMs: number) {
    this.text = text.normalize("NFC");
    this.durationMs = Math.max(0, durationMs);
  }

  get started(): boolean {
    return this.startedAt !== null;
  }

  get finished(): boolean {
    return this.reason !== null;
  }

  get finishReason(): FinishReason | null {
    return this.reason;
  }

  get typedText(): string {
    return this.typed;
  }

  get revision(): number {
    return this.rev;
  }

  start(now: number): void {
    if (this.startedAt !== null) return;
    this.startedAt = now;
  }

  remainingMs(now: number): number {
    if (this.startedAt === null) return this.durationMs;
    const at = this.finished ? (this.finishedAt as number) : now;
    return Math.max(0, this.durationMs - (at - this.startedAt));
  }

  /**
   * Checks the deadline. Returns true exactly when this call ends the run
   * by time-up (so the caller submits once).
   */
  tick(now: number): boolean {
    if (this.startedAt === null || this.finished) return false;
    if (now - this.startedAt >= this.durationMs) {
      this.finish("TIME_UP", this.startedAt + this.durationMs);
      return true;
    }
    return false;
  }

  /**
   * Applies the input element's new value. Returns the value the input
   * should display (clamped to the passage length; unchanged after finish).
   *
   * Keystrokes are derived from the diff against the previous value: the
   * characters after the common prefix are new insertions, each judged
   * against the passage at its own index. Deletions are not keystrokes.
   */
  input(value: string, now: number): string {
    if (this.startedAt === null || this.finished) return this.typed;
    // Input that arrives after the deadline (a late timer tick) must not count.
    if (this.tick(now)) return this.typed;

    // NFC so a Bangla keyboard that emits e.g. "ে" + "া" lines up with a
    // passage storing the precomposed "ো" (the passage is NFC — see examText.ts).
    const normalized = value.normalize("NFC");
    const next = normalized.length > this.text.length ? normalized.slice(0, this.text.length) : normalized;
    const prev = this.typed;
    if (next === prev) return prev;

    let p = 0;
    while (p < prev.length && p < next.length && prev[p] === next[p]) p++;
    for (let i = p; i < next.length; i++) {
      this.keystrokesTotal++;
      if (next[i] === this.text[i]) this.keystrokesCorrect++;
    }

    this.typed = next;
    this.rev++;

    // Like Monkeytype's quote/words modes: typing the last character of the
    // passage ends the run, and the time spent is the time taken.
    if (this.text.length > 0 && next.length >= this.text.length) {
      this.finish("COMPLETED", now);
    }
    return next;
  }

  snapshot(now: number): EngineSnapshot {
    const start = this.startedAt;
    const end = this.finished ? (this.finishedAt as number) : now;
    const elapsedMs = start === null ? 0 : clamp(end - start, 0, this.durationMs);
    return {
      typedText: this.typed,
      keystrokes: { total: this.keystrokesTotal, correct: this.keystrokesCorrect },
      elapsedMs,
      finishReason: this.reason,
    };
  }

  private finish(reason: FinishReason, at: number): void {
    if (this.reason !== null) return;
    this.reason = reason;
    this.finishedAt = at;
    this.rev++;
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

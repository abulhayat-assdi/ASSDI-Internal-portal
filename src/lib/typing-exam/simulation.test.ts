import { describe, it, expect } from "vitest";
import { TypingExamEngine } from "./engine";
import { keystrokesAreConsistent, scoreAttempt } from "./scoring";
import { gradeSnapshot } from "./session";
import { countCorrectChars } from "./words";

const PASSAGE =
  "Technology has changed the way people learn, work, and communicate with each other. Students who practice typing every day improve steadily.";
const THRESHOLDS = { passWpm: 30, passAccuracy: 90, failWpm: 15, failAccuracy: 70 };

// Small deterministic PRNG so a failure is reproducible.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** A fallible typist: slips (wrong/skipped/extra char), sometimes backspaces, sometimes types a double space. */
function simulate(seed: number, mode: "clean" | "fixes" | "no-fixes", durationMs = 60_000) {
  const rand = rng(seed);
  const e = new TypingExamEngine(PASSAGE, durationMs);
  const T0 = 1_000_000;
  e.start(T0);
  let t = T0 + 700;
  let i = 0;
  let guard = 0;
  while (!e.finished && guard++ < 5000) {
    t += 60 + Math.floor(rand() * 120);
    if (e.tick(t)) break;
    const slip = mode !== "clean" && rand() < 0.08;
    const target = PASSAGE[i] ?? "";
    if (!slip) {
      e.input(e.typedText + target, t);
      i++;
    } else {
      const kind = Math.floor(rand() * 3);
      if (kind === 0) {
        // wrong char
        e.input(e.typedText + (target === "x" ? "y" : "x"), t);
        i++;
        if (mode === "fixes") {
          t += 80;
          e.input(e.typedText.slice(0, -1), t);
          i--;
        }
      } else if (kind === 1) {
        // skipped char: jump ahead one
        e.input(e.typedText + (PASSAGE[i + 1] ?? ""), t);
        i += 2;
      } else {
        // double space attempt / extra char
        e.input(e.typedText + (rand() < 0.5 ? "  " : "q"), t);
        i = Math.min(PASSAGE.length, e.typedText.length);
      }
    }
    // Re-sync "i" only used to pick the next target; typed text is authoritative
    // for scoring, so a drifting i is fine (that IS a sloppy typist).
    i = Math.min(i, PASSAGE.length - 1);
  }
  return { e, t };
}

describe("typing exam — randomized end-to-end consistency", () => {
  for (const mode of ["clean", "fixes", "no-fixes"] as const) {
    it(`${mode}: keystroke accuracy is always trusted, bounded and agrees client↔server`, () => {
      let sawMistakes = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const { e, t } = simulate(seed, mode);
        const snap = e.snapshot(t);
        const client = scoreAttempt({
          originalText: PASSAGE,
          typedText: snap.typedText,
          elapsedMs: snap.elapsedMs,
          keystrokes: snap.keystrokes,
        });

        // The counters must always be physically possible for the final text,
        // otherwise accuracy silently falls back to final-text accuracy.
        expect(
          keystrokesAreConsistent(snap.keystrokes, snap.typedText.length, client.correctChars),
          `seed ${seed}`
        ).toBe(true);
        expect(client.accuracySource).toBe("keystrokes");
        expect(client.accuracy).toBeGreaterThanOrEqual(0);
        expect(client.accuracy).toBeLessThanOrEqual(100);
        expect(client.correctChars).toBeLessThanOrEqual(client.totalChars);
        expect(client.correctChars).toBe(countCorrectChars(PASSAGE, snap.typedText));
        expect(snap.keystrokes.correct).toBeLessThanOrEqual(snap.keystrokes.total);

        // Server regrade from the wire snapshot gives the same WPM/accuracy.
        const graded = gradeSnapshot({
          examText: PASSAGE,
          durationMs: 60_000,
          thresholds: THRESHOLDS,
          snapshot: {
            typedText: snap.typedText,
            keystrokesTotal: snap.keystrokes.total,
            keystrokesCorrect: snap.keystrokes.correct,
            elapsedMs: Math.round(snap.elapsedMs),
            finishReason: snap.finishReason,
          },
          serverElapsedMs: 60_000 + 5_000,
          fallbackReason: "ABANDONED",
        });
        expect(graded.score.accuracy).toBe(client.accuracy);
        expect(graded.score.correctChars).toBe(client.correctChars);
        if (client.accuracy < 100) sawMistakes++;
      }
      // The simulation must really contain mistakes, or the checks above prove nothing.
      if (mode === "clean") expect(sawMistakes).toBe(0);
      else expect(sawMistakes).toBeGreaterThan(100);
    });
  }

  it("a flawless run scores 100% accuracy and wpm = chars/5/minute", () => {
    const { e, t } = simulate(7, "clean");
    expect(e.finishReason).toBe("COMPLETED");
    const snap = e.snapshot(t);
    expect(snap.typedText).toBe(PASSAGE);
    const r = scoreAttempt({ originalText: PASSAGE, typedText: snap.typedText, elapsedMs: snap.elapsedMs, keystrokes: snap.keystrokes });
    expect(r.accuracy).toBe(100);
    expect(r.wpm).toBeCloseTo(PASSAGE.length / 5 / (snap.elapsedMs / 60000), 1);
  });

  it("a fixed mistake lowers accuracy by exactly one keystroke, not the speed of later words", () => {
    const e = new TypingExamEngine("the cat sat", 60_000);
    e.start(0);
    e.input("t", 0);
    e.input("tx", 100); // wrong
    e.input("t", 200); // backspace
    for (const v of ["th", "the", "the ", "the c", "the ca", "the cat", "the cat ", "the cat s", "the cat sa", "the cat sat"]) {
      e.input(v, 300);
    }
    const snap = e.snapshot(1000);
    expect(snap.keystrokes).toEqual({ total: 12, correct: 11 });
    const r = scoreAttempt({ originalText: "the cat sat", typedText: snap.typedText, elapsedMs: 1000, keystrokes: snap.keystrokes });
    expect(r.correctChars).toBe(11);
    expect(r.accuracy).toBe(Math.round((11 / 12) * 10000) / 100);
  });
});

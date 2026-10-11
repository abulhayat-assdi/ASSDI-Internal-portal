import { describe, it, expect } from "vitest";
import { IDLE_START_MS, TypingExamEngine } from "./engine";
import { scoreAttempt } from "./scoring";

const TEXT = "the quick brown fox jumps over the lazy dog";
const T0 = 1_000_000;

/** Types `s` one character at a time, `gapMs` apart, starting at `at`. Returns the time after. */
function typeChars(e: TypingExamEngine, s: string, at: number, gapMs: number): number {
  let t = at;
  for (const ch of s) {
    e.input(e.typedText + ch, t);
    t += gapMs;
  }
  return t;
}

describe("TypingExamEngine — regression: time-up snapshot carries what was typed", () => {
  it("stopping halfway then letting time run out keeps the typed text (was submitted as \"\")", () => {
    const e = new TypingExamEngine(TEXT, 60_000);
    e.start(T0);
    typeChars(e, "the quick", T0 + 500, 300);
    // Taker stops typing; nothing happens until the deadline (the clock
    // started at the first keystroke, T0 + 500).
    expect(e.tick(T0 + 30_000)).toBe(false);
    expect(e.tick(T0 + 60_500)).toBe(true);
    const snap = e.snapshot(T0 + 61_000);
    expect(snap.typedText).toBe("the quick");
    expect(snap.finishReason).toBe("TIME_UP");
    expect(snap.elapsedMs).toBe(60_000);
    expect(snap.keystrokes).toEqual({ total: 9, correct: 9 });
  });

  it("slow typing across the whole duration is fully captured", () => {
    const e = new TypingExamEngine(TEXT, 60_000);
    e.start(T0);
    // One char every 2.5s → 24 chars in 60s.
    typeChars(e, TEXT.slice(0, 24), T0 + 100, 2500);
    e.tick(T0 + 60_000);
    expect(e.snapshot(T0 + 61_000).typedText).toBe(TEXT.slice(0, 24));
  });

  it("tick reports time-up exactly once", () => {
    const e = new TypingExamEngine(TEXT, 10_000);
    e.start(T0);
    e.input("t", T0);
    expect(e.tick(T0 + 10_000)).toBe(true);
    expect(e.tick(T0 + 11_000)).toBe(false);
    expect(e.finishReason).toBe("TIME_UP");
  });
});

describe("TypingExamEngine — keystrokes (Monkeytype accuracy)", () => {
  it("a mistake fixed with backspace still counts as a wrong keystroke", () => {
    const e = new TypingExamEngine("abc", 60_000);
    e.start(T0);
    e.input("a", T0 + 100);
    e.input("ax", T0 + 200); // wrong
    e.input("a", T0 + 300); // backspace — not a keystroke
    e.input("ab", T0 + 400);
    expect(e.typedText).toBe("ab");
    expect(e.snapshot(T0 + 500).keystrokes).toEqual({ total: 3, correct: 2 });
  });

  it("a multi-character change counts each inserted character against its own index", () => {
    const e = new TypingExamEngine("hello world", 60_000);
    e.start(T0);
    e.input("hello", T0 + 100);
    // e.g. autocorrect/IME replacing the word in one event
    e.input("help", T0 + 200);
    // common prefix "hel": inserted "p" at index 3 (expected "l") → wrong
    expect(e.snapshot(T0 + 300).keystrokes).toEqual({ total: 6, correct: 5 });
  });

  it("refuses a runaway word instead of accepting unlimited characters", () => {
    const e = new TypingExamEngine("abc", 60_000);
    e.start(T0);
    expect(e.input("ab", T0 + 100)).toBe("ab");
    expect(e.input("abxxxxxxxxxxxxxxxxxxxx", T0 + 200)).toBe("ab");
    expect(e.snapshot(T0 + 200).keystrokes.total).toBe(2);
  });

  it("a dropped letter only costs its own word (no cascade)", () => {
    const e = new TypingExamEngine("the quick brown fox", 60_000);
    e.start(T0);
    // "quick" typed as "quik" — one letter missing, typed on without fixing.
    typeChars(e, "the quik brown fox", T0, 100);
    expect(e.finishReason).toBe("COMPLETED");
    const snap = e.snapshot(T0 + 5_000);
    const r = scoreAttempt({ originalText: "the quick brown fox", typedText: snap.typedText, elapsedMs: 5_000, keystrokes: snap.keystrokes });
    // "the " ok, "quik" 3 of 5, space after "quik" is the wrong length, "brown " ok, "fox" ok.
    expect(r.correctChars).toBe(4 + 3 + 6 + 3);
    expect(snap.keystrokes.correct).toBe(r.correctChars);
  });

  it("an extra space on an empty word is ignored and does not shift later words", () => {
    const e = new TypingExamEngine("ab cd", 60_000);
    e.start(T0);
    e.input("ab", T0);
    e.input("ab ", T0 + 10);
    expect(e.input("ab  ", T0 + 20)).toBe("ab ");
    expect(e.input("ab c", T0 + 30)).toBe("ab c");
    expect(e.input("ab cd", T0 + 40)).toBe("ab cd");
    expect(e.finishReason).toBe("COMPLETED");
  });

  it("refuses typing past the last word", () => {
    const e = new TypingExamEngine("ab cd", 60_000);
    e.start(T0);
    e.input("ab c", T0);
    expect(e.input("ab c ", T0 + 10)).toBe("ab c");
  });
});

describe("TypingExamEngine — run lifecycle", () => {
  it("ignores input before start and after finish", () => {
    const e = new TypingExamEngine(TEXT, 5_000);
    expect(e.input("t", T0)).toBe("");
    e.start(T0);
    e.input("t", T0 + 100);
    e.tick(T0 + 5_100);
    expect(e.input("th", T0 + 5_200)).toBe("t");
    expect(e.snapshot(T0 + 6_000).keystrokes.total).toBe(1);
  });

  it("input arriving after the deadline (late timer tick) is rejected and ends the run", () => {
    const e = new TypingExamEngine(TEXT, 5_000);
    e.start(T0);
    e.input("t", T0 + 1_000);
    expect(e.input("th", T0 + 6_050)).toBe("t");
    expect(e.finishReason).toBe("TIME_UP");
    expect(e.snapshot(T0 + 6_000)).toMatchObject({ typedText: "t", elapsedMs: 5_000 });
  });

  it("typing the last character completes the run with the time actually taken", () => {
    const e = new TypingExamEngine("abc", 60_000);
    e.start(T0);
    e.input("a", T0 + 1_000);
    e.input("ab", T0 + 2_000);
    e.input("abc", T0 + 3_000);
    expect(e.finishReason).toBe("COMPLETED");
    const snap = e.snapshot(T0 + 50_000);
    // The clock started at the first keystroke (T0 + 1_000).
    expect(snap.elapsedMs).toBe(2_000);
  });

  it("remainingMs freezes once finished", () => {
    const e = new TypingExamEngine("ab", 60_000);
    e.start(T0);
    e.input("a", T0);
    e.input("ab", T0 + 10_000);
    expect(e.remainingMs(T0 + 40_000)).toBe(50_000);
  });

  it("the clock does not run before the first keystroke", () => {
    const e = new TypingExamEngine(TEXT, 60_000);
    e.start(T0);
    expect(e.snapshot(T0 + 10_000)).toMatchObject({ elapsedMs: 0, typedText: "" });
    expect(e.remainingMs(T0 + 10_000)).toBe(60_000);
    expect(e.tick(T0 + 10_000)).toBe(false);
    e.input("t", T0 + 10_000);
    expect(e.remainingMs(T0 + 15_000)).toBe(55_000);
  });

  it("starts the clock by itself after the idle limit so a run cannot sit open forever", () => {
    const e = new TypingExamEngine(TEXT, 60_000);
    e.start(T0);
    expect(e.tick(T0 + IDLE_START_MS - 1)).toBe(false);
    expect(e.remainingMs(T0 + IDLE_START_MS - 1)).toBe(60_000);
    expect(e.tick(T0 + IDLE_START_MS + 60_000)).toBe(true);
    expect(e.snapshot(T0 + IDLE_START_MS + 61_000)).toMatchObject({ elapsedMs: 60_000, finishReason: "TIME_UP" });
  });

  it("revision changes only on accepted changes", () => {
    const e = new TypingExamEngine(TEXT, 60_000);
    e.start(T0);
    const r0 = e.revision;
    e.input("", T0 + 10);
    expect(e.revision).toBe(r0);
    e.input("t", T0 + 20);
    expect(e.revision).toBe(r0 + 1);
  });
});

describe("TypingExamEngine — Unicode", () => {
  it("normalizes typed Bangla to NFC so decomposed vowel signs line up with the passage", () => {
    const composed = "ক" + "ো"; // কো, precomposed vowel sign
    const e = new TypingExamEngine(composed + " খ", 60_000);
    e.start(T0);
    e.input("ক", T0 + 100);
    e.input("ক" + "ে", T0 + 200); // ে
    const v = e.input("ক" + "ে" + "া", T0 + 300); // + া  → ো
    expect(v).toBe(composed);
    expect(e.typedText.length).toBe(composed.length);
  });
});

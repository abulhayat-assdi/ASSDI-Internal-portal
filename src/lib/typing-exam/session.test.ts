import { describe, it, expect } from "vitest";
import { acceptsClientData, clampSnapshotToServer, gradeSnapshot, parseClientSnapshot, resolveScoringTimeMs, type ClientSnapshot } from "./session";

const TEXT = "a".repeat(500);
const thresholds = { passWpm: 30, passAccuracy: 90, failWpm: 15, failAccuracy: 70 };

function snap(over: Partial<ClientSnapshot>): ClientSnapshot {
  return {
    typedText: "",
    keystrokesTotal: 0,
    keystrokesCorrect: 0,
    elapsedMs: 0,
    finishReason: null,
    ...over,
  };
}

describe("parseClientSnapshot", () => {
  it("parses a v2 body", () => {
    const s = parseClientSnapshot(
      { typedText: "aaa", keystrokesTotal: 4, keystrokesCorrect: 3, elapsedMs: 5000, finishReason: "TIME_UP" }, "x".repeat(100));
    expect(s).toEqual({ typedText: "aaa", keystrokesTotal: 4, keystrokesCorrect: 3, elapsedMs: 5000, finishReason: "TIME_UP" });
  });

  it("maps the legacy { typedText, elapsedSeconds } body to a TIME_UP", () => {
    const s = parseClientSnapshot({ typedText: "aa", elapsedSeconds: 60 }, "x".repeat(100));
    expect(s).toMatchObject({ typedText: "aa", elapsedMs: 60_000, finishReason: "TIME_UP", keystrokesTotal: 0 });
  });

  it("clamps over-long text and sanitizes counters", () => {
    const s = parseClientSnapshot({ typedText: "abcdef", elapsedMs: 1, keystrokesTotal: -5, keystrokesCorrect: 2.7, finishReason: "HACK" }, "x".repeat(3));
    expect(s).toMatchObject({ typedText: "abc", keystrokesTotal: 0, keystrokesCorrect: 2, finishReason: null });
  });

  it("rejects bodies without text or time", () => {
    expect(parseClientSnapshot(null, "x".repeat(10))).toBeNull();
    expect(parseClientSnapshot({ elapsedMs: 1 }, "x".repeat(10))).toBeNull();
    expect(parseClientSnapshot({ typedText: "a" }, "x".repeat(10))).toBeNull();
    expect(parseClientSnapshot({ typedText: "a", elapsedMs: Number.NaN }, "x".repeat(10))).toBeNull();
  });
});

describe("resolveScoringTimeMs (standard timed-test rules)", () => {
  const s = { elapsedMs: 40_000 };
  it("TIME_UP uses the full duration, even if the taker stopped early", () => {
    expect(resolveScoringTimeMs("TIME_UP", s, 60_000, 65_000)).toBe(60_000);
  });
  it("COMPLETED uses the time taken", () => {
    expect(resolveScoringTimeMs("COMPLETED", s, 60_000, 65_000)).toBe(40_000);
  });
  it("ABANDONED uses the full duration — closing the tab is the same as stopping", () => {
    expect(resolveScoringTimeMs("ABANDONED", s, 60_000, 65_000)).toBe(60_000);
    // even when the old run is finalized early (page reloaded at 15 s)
    expect(resolveScoringTimeMs("ABANDONED", s, 60_000, 15_000)).toBe(60_000);
  });
  it("never exceeds what the server clock allows", () => {
    expect(resolveScoringTimeMs("TIME_UP", s, 60_000, 20_000)).toBe(20_000);
    expect(resolveScoringTimeMs("COMPLETED", s, 60_000, 20_000)).toBe(20_000);
  });
});

describe("clampSnapshotToServer", () => {
  it("bounds client clocks by duration and server-elapsed time", () => {
    expect(clampSnapshotToServer(snap({ elapsedMs: 90_000 }), 60_000, 70_000).elapsedMs).toBe(60_000);
    expect(clampSnapshotToServer(snap({ elapsedMs: 50_000 }), 60_000, 20_000).elapsedMs).toBe(20_000);
  });
});

describe("gradeSnapshot — the reported scenarios", () => {
  it("stopped halfway, time ran out: speed counts what they typed over the full minute", () => {
    // 100 correct chars, then nothing until time-up at 60s.
    const g = gradeSnapshot({
      examText: TEXT,
      durationMs: 60_000,
      thresholds,
      snapshot: snap({ typedText: "a".repeat(100), keystrokesTotal: 100, keystrokesCorrect: 100, elapsedMs: 60_000, finishReason: "TIME_UP" }),
      serverElapsedMs: 66_000,
      fallbackReason: "ABANDONED",
    });
    expect(g.score.wpm).toBe(20); // 100 / 5 / 1 min
    expect(g.score.accuracy).toBe(100);
    expect(g.reason).toBe("TIME_UP");
    expect(g.durationTakenSeconds).toBe(60);
    expect(g.result).toBe("AVERAGE");
  });

  it("slow typist: 60 chars in 60 s = 12 WPM, never 0", () => {
    const g = gradeSnapshot({
      examText: TEXT,
      durationMs: 60_000,
      thresholds,
      snapshot: snap({ typedText: "a".repeat(60), keystrokesTotal: 60, keystrokesCorrect: 60, elapsedMs: 60_000, finishReason: "TIME_UP" }),
      serverElapsedMs: 64_000,
      fallbackReason: "ABANDONED",
    });
    expect(g.score.wpm).toBe(12);
    expect(g.result).toBe("FAIL");
  });

  it("closed the tab: graded from autosave over the full duration (no burst-and-leave exploit)", () => {
    const g = gradeSnapshot({
      examText: TEXT,
      durationMs: 60_000,
      thresholds,
      snapshot: snap({ typedText: "a".repeat(50), keystrokesTotal: 50, keystrokesCorrect: 50, elapsedMs: 33_000 }),
      serverElapsedMs: 200_000,
      fallbackReason: "ABANDONED",
    });
    expect(g.reason).toBe("ABANDONED");
    expect(g.timeMs).toBe(60_000);
    expect(g.score.wpm).toBe(10); // 50 / 5 / 1 min — same as typing 50 chars and waiting
  });

  it("typed nothing at all: 0 / 0 (the only case a 0 is correct)", () => {
    const g = gradeSnapshot({
      examText: TEXT,
      durationMs: 60_000,
      thresholds,
      snapshot: snap({ elapsedMs: 60_000, finishReason: "TIME_UP" }),
      serverElapsedMs: 65_000,
      fallbackReason: "ABANDONED",
    });
    expect(g.score.wpm).toBe(0);
    expect(g.score.accuracy).toBe(0);
  });

  it("uses keystroke accuracy: corrected mistakes still cost accuracy", () => {
    const g = gradeSnapshot({
      examText: TEXT,
      durationMs: 60_000,
      thresholds,
      // 100 correct chars in the final text; 10 wrong keystrokes were deleted along the way.
      snapshot: snap({ typedText: "a".repeat(100), keystrokesTotal: 110, keystrokesCorrect: 100, elapsedMs: 60_000, finishReason: "TIME_UP" }),
      serverElapsedMs: 65_000,
      fallbackReason: "ABANDONED",
    });
    expect(g.score.accuracy).toBe(90.91);
    expect(g.score.accuracySource).toBe("keystrokes");
  });

  it("a COMPLETED claim without the full passage is not trusted", () => {
    const g = gradeSnapshot({
      examText: TEXT,
      durationMs: 60_000,
      thresholds,
      snapshot: snap({ typedText: "a".repeat(10), keystrokesTotal: 10, keystrokesCorrect: 10, elapsedMs: 2_000, finishReason: "COMPLETED" }),
      serverElapsedMs: 65_000,
      fallbackReason: "TIME_UP",
    });
    expect(g.reason).toBe("TIME_UP");
    expect(g.timeMs).toBe(60_000);
  });

  it("a short server clock caps a tampered elapsed time", () => {
    const g = gradeSnapshot({
      examText: TEXT,
      durationMs: 60_000,
      thresholds,
      snapshot: snap({ typedText: TEXT, keystrokesTotal: 500, keystrokesCorrect: 500, elapsedMs: 1, finishReason: "COMPLETED" }),
      serverElapsedMs: 30_000,
      fallbackReason: "TIME_UP",
    });
    // Claimed 1 ms; scoring never goes below 1 s, so WPM is bounded.
    expect(g.score.wpm).toBe(6000);
    expect(g.timeMs).toBe(1);
  });
});

describe("acceptsClientData (late-data cutoff)", () => {
  it("accepts typing up to duration + 60 s after the session opened", () => {
    expect(acceptsClientData(60_000, 60_000)).toBe(true);
    expect(acceptsClientData(60_000, 120_000)).toBe(true);
  });
  it("refuses anything later — a frozen page cannot buy extra typing time", () => {
    expect(acceptsClientData(60_000, 120_001)).toBe(false);
  });
});

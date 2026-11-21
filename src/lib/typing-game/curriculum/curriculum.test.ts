import { describe, expect, it } from "vitest";
import { EN_FOUNDATION, BANGLA_GATE_LESSON_ID } from "./en-foundation";
import { buildScreens, eligibleWords, hashSeed, lessonCharCount, letterGroups } from "./generate";
import { englishWordBank } from "./word-bank";
import { fingerFor, keyFor, KEYBOARD_ROWS } from "./keyboard";
import { findLesson, nextLesson } from "./index";
import {
  evaluateLessonResult,
  lessonStates,
  lessonsToSkip,
  levelLessons,
  levelPercent,
  starsFor,
  type LessonProgressRow,
} from "./progress";
import { seededRandom } from "@/lib/typing-game/practice/transform";

const bank = englishWordBank();
const lessons = levelLessons(EN_FOUNDATION);
const row = (lessonId: string, status: "completed" | "skipped" = "completed"): LessonProgressRow => ({
  lessonId,
  status,
  stars: 3,
  bestWpm: 20,
  bestAccuracy: 98,
  bestTimeMs: 1000,
  attempts: 1,
});

describe("keyboard map", () => {
  it("every letter has a key and a finger", () => {
    for (const c of "abcdefghijklmnopqrstuvwxyz;,.'") expect(fingerFor(c)).not.toBeNull();
    expect(fingerFor("f")?.id).toBe("l-index");
    expect(fingerFor("j")?.id).toBe("r-index");
    expect(fingerFor(" ")?.id).toBe("thumb");
  });
  it("shifted characters resolve to their key", () => {
    expect(keyFor("A")).toMatchObject({ shifted: true, cap: { key: "a" } });
    expect(keyFor("?")?.cap.key).toBe("/");
  });
  it("rows are roughly the same width", () => {
    const widths = KEYBOARD_ROWS.slice(0, 4).map((r) => r.reduce((n, k) => n + k.width, 0));
    for (const w of widths) expect(w).toBeCloseTo(15, 0);
  });
});

describe("Foundation level", () => {
  it("has 16 lessons with permanent ids", () => {
    expect(lessons).toHaveLength(16);
    expect(lessons[0].id).toBe("en-1-01");
    expect(lessons[15].id).toBe(BANGLA_GATE_LESSON_ID);
    expect(lessons[15].kind).toBe("assessment");
  });

  it("teaches every letter exactly once", () => {
    const taught = lessons.flatMap((l) => l.newKeys).filter((c) => /[a-z]/.test(c));
    expect(taught.sort().join("")).toBe("abcdefghijklmnopqrstuvwxyz");
  });

  it("every screen only uses keys learned so far", () => {
    for (const lesson of lessons) {
      const allowed = new Set([...lesson.allowedKeys, " "]);
      for (const s of buildScreens(lesson, bank)) {
        for (const ch of s.text) expect(allowed.has(ch), `${lesson.id} uses "${ch}"`).toBe(true);
      }
    }
  });

  it("screens are deterministic per lesson", () => {
    expect(buildScreens(lessons[3], bank)).toEqual(buildScreens(lessons[3], bank));
  });

  it("key lessons start by introducing each new key", () => {
    const s = buildScreens(lessons[1], bank);
    expect(s[0]).toMatchObject({ type: "key_intro", text: "u" });
    expect(s.filter((x) => x.type === "key_intro").map((x) => x.text)).toEqual(["u", "r", "k"]);
  });

  it("the assessment is one 60 s timed screen", () => {
    const s = buildScreens(lessons[15], bank);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ type: "timed", seconds: 60 });
    expect(lessonCharCount(s)).toBe(0);
  });

  it("lookups", () => {
    expect(findLesson("en-1-05")?.lesson.title).toBe("Review 1");
    expect(nextLesson("en-1-05")?.id).toBe("en-1-06");
    expect(nextLesson("en-1-16")).toBeNull();
    expect(findLesson("nope")).toBeNull();
  });
});

describe("generators", () => {
  it("letterGroups includes a required char in every group", () => {
    const g = letterGroups(["a", "s", "d"], 20, 2, 4, seededRandom(3), ["d"]).split(" ");
    expect(g).toHaveLength(20);
    for (const x of g) expect(x).toContain("d");
  });
  it("eligibleWords puts words with new keys first", () => {
    const w = eligibleWords(["fur", "jug", "rug"], ["f", "u", "r", "j", "g"], ["j"]);
    expect(w[0]).toBe("jug");
  });
  it("hashSeed is stable and non-zero", () => {
    expect(hashSeed("en-1-01")).toBe(hashSeed("en-1-01"));
    expect(hashSeed("")).toBeGreaterThan(0);
  });
});

describe("progress rules", () => {
  it("opens lessons in order", () => {
    const st = lessonStates(EN_FOUNDATION, new Map([["en-1-01", row("en-1-01")]]));
    expect(st.get("en-1-01")).toBe("completed");
    expect(st.get("en-1-02")).toBe("available");
    expect(st.get("en-1-03")).toBe("locked");
  });
  it("skipped lessons also open the next one", () => {
    const st = lessonStates(EN_FOUNDATION, new Map([["en-1-01", row("en-1-01", "skipped")]]));
    expect(st.get("en-1-02")).toBe("available");
  });
  it("skipping to a lesson marks the unfinished ones before it", () => {
    const p = new Map([["en-1-02", row("en-1-02")]]);
    expect(lessonsToSkip(EN_FOUNDATION, "en-1-04", p)).toEqual(["en-1-01", "en-1-03"]);
    expect(lessonsToSkip(EN_FOUNDATION, "en-1-01", p)).toEqual([]);
  });
  it("level percent counts only completed lessons", () => {
    const p = new Map([
      ["en-1-01", row("en-1-01")],
      ["en-1-02", row("en-1-02", "skipped")],
    ]);
    expect(levelPercent(EN_FOUNDATION, p)).toBe(6);
  });
  it("stars from accuracy", () => {
    expect([100, 97, 96.9, 92, 85, 84.9].map(starsFor)).toEqual([3, 3, 2, 2, 1, 0]);
  });
});

describe("evaluateLessonResult", () => {
  it("computes wpm/accuracy/stars", () => {
    const r = evaluateLessonResult({ correctChars: 300, keystrokes: 310, errors: 10, elapsedMs: 60000 }, 300);
    expect(r).toEqual({ wpm: 60, accuracy: 96.77, stars: 2, elapsedMs: 60000 });
  });
  it("rejects unfinished, inconsistent and impossible runs", () => {
    expect(evaluateLessonResult({ correctChars: 10, keystrokes: 10, errors: 0, elapsedMs: 9000 }, 300)).toEqual({ error: "INCOMPLETE" });
    expect(evaluateLessonResult({ correctChars: 300, keystrokes: 305, errors: 10, elapsedMs: 60000 }, 300)).toEqual({ error: "INCONSISTENT" });
    expect(evaluateLessonResult({ correctChars: 300, keystrokes: 300, errors: 0, elapsedMs: 1000 }, 300)).toEqual({ error: "TOO_FAST" });
    expect(evaluateLessonResult({ correctChars: -1, keystrokes: 0, errors: 0, elapsedMs: 0 }, 0)).toEqual({ error: "BAD_NUMBERS" });
  });
  it("a timed lesson needs its full duration", () => {
    expect(evaluateLessonResult({ correctChars: 100, keystrokes: 100, errors: 0, elapsedMs: 30000 }, 0, 59000)).toEqual({ error: "TOO_FAST" });
    expect("error" in evaluateLessonResult({ correctChars: 100, keystrokes: 100, errors: 0, elapsedMs: 60000 }, 0, 59000)).toBe(false);
  });
});

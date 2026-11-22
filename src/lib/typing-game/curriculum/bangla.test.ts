import { describe, expect, it } from "vitest";
import { BANGLA_LEVELS, BN_LETTERS } from "./bn-levels";
import { buildBanglaScreens } from "./bn-generate";
import { banglaArticles, banglaWordBank } from "./word-bank";
import { codepoints, graphemes, typingHint, usesOnly } from "./bangla";
import { levelLessons } from "./progress";

const bank = banglaWordBank();
const articles = banglaArticles();
const all = BANGLA_LEVELS.flatMap(levelLessons);

describe("Bangla helpers", () => {
  it("graphemes keep conjuncts and kars together", () => {
    expect(graphemes("কি ক্ষমা")).toEqual(["কি", " ", "ক্ষ", "মা"]);
  });
  it("Bijoy hints put pre-base kars first and wrap ো", () => {
    expect(typingHint("ক", "bijoy")).toBe("j");
    expect(typingHint("কি", "bijoy")).toBe("d j");
    expect(typingHint("কো", "bijoy")).toBe("c j f");
    expect(typingHint("ক্ষ", "bijoy")).toBe("j g N");
    expect(typingHint("ড়", "bijoy")).toBe("p");
  });
  it("Avro hints spell phonetically", () => {
    expect(typingHint("খা", "avro")).toBe("kh a");
    expect(typingHint("য়", "avro")).toBe("y");
  });
  it("usesOnly works on code points (ড় = ড + ়)", () => {
    const set = new Set(codepoints(["ড়", "আ"]));
    expect(usesOnly("ড়আ", set)).toBe(true);
    expect(usesOnly("ড", set)).toBe(true);
    expect(usesOnly("ক", set)).toBe(false);
  });
});

describe("Bangla curriculum", () => {
  it("has six levels with permanent ids", () => {
    expect(BANGLA_LEVELS.map((l) => l.id)).toEqual(["bn-1", "bn-2", "bn-3", "bn-4", "bn-5", "bn-6"]);
    expect(levelLessons(BN_LETTERS)[0].id).toBe("bn-1-01");
  });
  it("every lesson has screens, all made of learned characters only", () => {
    for (const lesson of all) {
      const screens = buildBanglaScreens(lesson, bank, articles);
      expect(screens.length, lesson.id).toBeGreaterThan(0);
      const allowed = new Set([...codepoints(lesson.allowedKeys), " "]);
      for (const s of screens) expect(usesOnly(s.text, allowed), `${lesson.id}: ${s.text.slice(0, 40)}`).toBe(true);
    }
  });
  it("is deterministic", () => {
    expect(buildBanglaScreens(all[5], bank, articles)).toEqual(buildBanglaScreens(all[5], bank, articles));
  });
  it("level 2 kar lessons drill syllables with the kar", () => {
    const l = levelLessons(BANGLA_LEVELS[1])[0];
    const drill = buildBanglaScreens(l, bank, articles).find((s) => s.title.includes("া কার"));
    expect(drill?.text).toMatch(/া/);
  });
});

import { evaluateScreenSnapshots } from "./progress";

describe("evaluateScreenSnapshots", () => {
  const screens = [
    { type: "letter_drill", text: "কক খক" },
    { type: "timed", text: "আমি বাংলায় লিখি", seconds: 60 },
  ];
  it("scores completed screens", () => {
    const r = evaluateScreenSnapshots(screens, [
      { typedText: "কক খক", keystrokesTotal: 6, keystrokesCorrect: 5, elapsedMs: 4000 },
      { typedText: "আমি বাংলা", keystrokesTotal: 9, keystrokesCorrect: 9, elapsedMs: 60000 },
    ]);
    expect("error" in r).toBe(false);
    if (!("error" in r)) {
      expect(r.elapsedMs).toBe(64000);
      expect(r.accuracy).toBeCloseTo((14 / 15) * 100, 1);
    }
  });
  it("refuses an unfinished drill, a short timed run and a wrong shape", () => {
    expect(evaluateScreenSnapshots(screens, [
      { typedText: "কক", keystrokesTotal: 2, keystrokesCorrect: 2, elapsedMs: 3000 },
      { typedText: "", keystrokesTotal: 0, keystrokesCorrect: 0, elapsedMs: 60000 },
    ])).toEqual({ error: "INCOMPLETE" });
    expect(evaluateScreenSnapshots(screens, [
      { typedText: "কক খক", keystrokesTotal: 5, keystrokesCorrect: 5, elapsedMs: 3000 },
      { typedText: "", keystrokesTotal: 0, keystrokesCorrect: 0, elapsedMs: 20000 },
    ])).toEqual({ error: "TOO_FAST" });
    expect(evaluateScreenSnapshots(screens, [])).toEqual({ error: "BAD_NUMBERS" });
  });
  it("refuses pasted text (impossible speed)", () => {
    const long = { type: "sentence", text: "আমি ".repeat(200).trim() };
    expect(evaluateScreenSnapshots([long], [{ typedText: long.text, keystrokesTotal: 800, keystrokesCorrect: 800, elapsedMs: 2000 }])).toEqual({ error: "TOO_FAST" });
  });
});

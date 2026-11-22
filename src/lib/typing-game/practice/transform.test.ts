import { describe, expect, it } from "vitest";
import { DIFFICULTY_PRESETS, takeWords, transformText, wordCount } from "./transform";
import { buildPracticeText, clampWords, MAX_PRACTICE_WORDS, wordsForDuration } from "./text";

const EN = 'Hello World! AI-driven tools (like ChatGPT) save 30% of time; "really" fast.';

describe("transformText — English presets", () => {
  it("beginner: lower case, no punctuation, no numbers", () => {
    expect(transformText(EN, DIFFICULTY_PRESETS.en.beginner)).toBe(
      "hello world ai driven tools like chatgpt save of time really fast",
    );
  });

  it("intermediate: sentence case with only . and ,", () => {
    const out = transformText("first one. second one, third! fourth", DIFFICULTY_PRESETS.en.intermediate);
    expect(out).toBe("First one. Second one, third fourth");
  });

  it("pro: Capitalize Each Word, standard punctuation, numbers kept", () => {
    expect(transformText(EN, DIFFICULTY_PRESETS.en.pro)).toBe(
      'Hello World! Ai-driven Tools Like Chatgpt Save 30 Of Time; "Really" Fast.',
    );
  });

  it("expert: keeps brackets and symbols", () => {
    const out = transformText(EN, DIFFICULTY_PRESETS.en.expert, 7);
    expect(out).toContain("(");
    expect(out).toContain("30%");
    expect(out.toLowerCase()).toBe(EN.toLowerCase());
  });

  it("expert mixed case is deterministic per seed", () => {
    expect(transformText(EN, DIFFICULTY_PRESETS.en.expert, 3)).toBe(
      transformText(EN, DIFFICULTY_PRESETS.en.expert, 3),
    );
  });

  it("joiners become spaces instead of gluing words", () => {
    expect(transformText("left/right well-known", DIFFICULTY_PRESETS.en.beginner)).toBe("left right well known");
  });

  it("drops tokens left with no letters", () => {
    expect(transformText("a - b , c", DIFFICULTY_PRESETS.en.beginner)).toBe("a b c");
  });
});

describe("transformText — Bangla presets", () => {
  const BN = "আমি বাংলায় কথা বলি। স্বপ্ন দেখি, ২০২৬ সালে!";

  it("beginner: no conjunct words, no punctuation, no numbers", () => {
    // বাংলায় has no hasanta; স্বপ্ন does.
    expect(transformText(BN, DIFFICULTY_PRESETS.bn.beginner)).toBe("আমি বাংলায় কথা বলি দেখি সালে");
  });

  it("intermediate keeps । and , but not ! or digits", () => {
    expect(transformText(BN, DIFFICULTY_PRESETS.bn.intermediate)).toBe("আমি বাংলায় কথা বলি। স্বপ্ন দেখি, সালে");
  });

  it("expert keeps the text as written", () => {
    expect(transformText(BN, DIFFICULTY_PRESETS.bn.expert)).toBe(BN);
  });

  it("keeps zero-width joiners Bangla keyboards type", () => {
    const withZwnj = "র‍্য";
    expect(transformText(withZwnj, DIFFICULTY_PRESETS.bn.expert)).toBe(withZwnj);
  });
});

describe("helpers", () => {
  it("wordCount / takeWords", () => {
    expect(wordCount("  a b   c ")).toBe(3);
    expect(takeWords("a b c d", 2)).toBe("a b");
  });

  it("clamps requested words", () => {
    expect(clampWords(0)).toBe(5);
    expect(clampWords(1e9)).toBe(MAX_PRACTICE_WORDS);
    expect(clampWords(Number.NaN)).toBe(5);
    expect(wordsForDuration(60)).toBe(180);
  });
});

describe("buildPracticeText", () => {
  it("returns exactly the requested number of words from the bank", () => {
    const r = buildPracticeText({ language: "en", difficulty: "beginner", words: 120, seed: 11 });
    expect(wordCount(r.text)).toBe(120);
    expect(r.text).toBe(r.text.toLowerCase());
    expect(r.sources.length).toBeGreaterThan(0);
  });

  it("Bangla text stays Bangla", () => {
    const r = buildPracticeText({ language: "bn", difficulty: "pro", words: 50, seed: 5 });
    expect(wordCount(r.text)).toBe(50);
    expect(/[ঀ-৿]/.test(r.text)).toBe(true);
  });

  it("is reproducible for the same seed", () => {
    const a = buildPracticeText({ language: "en", difficulty: "pro", words: 60, seed: 42 });
    const b = buildPracticeText({ language: "en", difficulty: "pro", words: 60, seed: 42 });
    expect(a.text).toBe(b.text);
  });

  it("custom overrides win over the preset", () => {
    const r = buildPracticeText({
      language: "en",
      difficulty: "beginner",
      overrides: { case: "title" },
      words: 30,
      seed: 9,
    });
    for (const w of r.text.split(" ")) expect(w[0]).toBe(w[0].toUpperCase());
  });
});

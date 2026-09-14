import { describe, it, expect } from "vitest";
import { scoreAttempt, gradeAttempt, validateThresholds } from "./scoring";

describe("scoreAttempt", () => {
  it("exact match: 100% accuracy and correctChars === totalChars === originalText.length", () => {
    const originalText = "the quick brown fox jumps over the lazy dog";
    const typedText = originalText;
    const result = scoreAttempt({ originalText, typedText, elapsedSeconds: 30 });

    expect(result.accuracy).toBe(100);
    expect(result.correctChars).toBe(originalText.length);
    expect(result.totalChars).toBe(originalText.length);
  });

  it("no-cascade proof: a single wrong char at a middle index affects only that index's correctness", () => {
    const originalText = "the quick brown fox jumps over the lazy dog";
    const k = 10; // middle index, not start or end
    expect(originalText[k]).not.toBe("Z");
    const typedText = originalText.slice(0, k) + "Z" + originalText.slice(k + 1);

    const result = scoreAttempt({ originalText, typedText, elapsedSeconds: 30 });

    // Re-derive expected per-index correctness independently, inline.
    const expectedCorrectness: boolean[] = [];
    for (let i = 0; i < typedText.length; i++) {
      expectedCorrectness.push(typedText[i] === originalText[i]);
    }

    // Every index except k should be correct; k should be wrong.
    for (let i = 0; i < expectedCorrectness.length; i++) {
      if (i === k) {
        expect(expectedCorrectness[i]).toBe(false);
      } else {
        expect(expectedCorrectness[i]).toBe(true);
      }
    }

    const expectedCorrectChars = expectedCorrectness.filter(Boolean).length;
    expect(result.totalChars).toBe(typedText.length);
    expect(result.correctChars).toBe(expectedCorrectChars);
    expect(result.correctChars).toBe(result.totalChars - 1);
  });

  it("different keystroke histories that converge on the same final string score identically", () => {
    const originalText = "hello world";
    const finalTypedText = "hello world";

    // Path A: user typed it correctly on the first try (final string only, since
    // scoreAttempt has no visibility into keystroke history).
    const pathAFinal = finalTypedText;

    // Path B: user typed "hexxo world" then backspaced/corrected to "hello world" —
    // scoreAttempt only ever receives the FINAL string, so this history is invisible
    // to it and it should score identically to Path A.
    const pathBFinal = finalTypedText;

    const resultA = scoreAttempt({ originalText, typedText: pathAFinal, elapsedSeconds: 20 });
    const resultB = scoreAttempt({ originalText, typedText: pathBFinal, elapsedSeconds: 20 });

    expect(resultA).toEqual(resultB);
    expect(resultA.accuracy).toBe(100);
    expect(resultA.correctChars).toBe(originalText.length);
  });

  it("empty submission: accuracy is 0 (not NaN/Infinity), totalChars and correctChars are 0", () => {
    const originalText = "the quick brown fox";
    const result = scoreAttempt({ originalText, typedText: "", elapsedSeconds: 30 });

    expect(result.totalChars).toBe(0);
    expect(result.correctChars).toBe(0);
    expect(result.accuracy).toBe(0);
    expect(Number.isNaN(result.accuracy)).toBe(false);
    expect(Number.isFinite(result.accuracy)).toBe(true);
  });

  it("over-length typedText (raw behavior): extra chars beyond originalText.length compare against undefined and count as wrong, inflating totalChars", () => {
    // scoreAttempt is a pure function with no clamping of its own — clamping
    // typedText to originalText.length is the caller's job (done server-side in
    // the attempt API routes before calling scoreAttempt). This test documents
    // scoreAttempt's actual raw behavior when handed an over-length string.
    const originalText = "hello"; // length 5
    const typedText = "helloXYZ"; // length 8, 3 chars beyond originalText

    const result = scoreAttempt({ originalText, typedText, elapsedSeconds: 30 });

    // totalChars reflects the full (over-length) typed string.
    expect(result.totalChars).toBe(8);
    // Only the first 5 chars can match; the 3 extra chars compare against
    // undefined (originalText[5..7]) and never count as correct.
    expect(result.correctChars).toBe(5);
    // Accuracy is deflated by the extra, uncountable-as-correct characters.
    expect(result.accuracy).toBe(Math.round((5 / 8) * 10000) / 100);
  });

  it("whitespace and punctuation mismatches score the same as any other wrong character (no special-casing)", () => {
    const originalText = "hi there, world!";
    expect(originalText[8]).toBe(","); // punctuation char at index 8
    expect(originalText[9]).toBe(" "); // whitespace char at index 9

    const typedWithWrongPunctuation = "hi there. world!"; // comma -> period at index 8
    const typedWithWrongSpace = "hi there,_world!"; // space -> underscore at index 9
    const typedWithWrongLetter = "hi there, xorld!"; // letter 'w' -> 'x' at index 11

    const resultPunct = scoreAttempt({ originalText, typedText: typedWithWrongPunctuation, elapsedSeconds: 30 });
    const resultSpace = scoreAttempt({ originalText, typedText: typedWithWrongSpace, elapsedSeconds: 30 });
    const resultLetter = scoreAttempt({ originalText, typedText: typedWithWrongLetter, elapsedSeconds: 30 });

    // Each introduces exactly one wrong character among originalText.length chars,
    // and all three should score identically regardless of what kind of
    // character was wrong.
    expect(resultPunct.correctChars).toBe(originalText.length - 1);
    expect(resultSpace.correctChars).toBe(originalText.length - 1);
    expect(resultLetter.correctChars).toBe(originalText.length - 1);
    expect(resultPunct.accuracy).toBe(resultSpace.accuracy);
    expect(resultSpace.accuracy).toBe(resultLetter.accuracy);
  });

  it("WPM formula sanity: 250 correct chars in 60 seconds is exactly 50 WPM", () => {
    const originalText = "a".repeat(250);
    const typedText = "a".repeat(250);
    const elapsedSeconds = 60;

    const result = scoreAttempt({ originalText, typedText, elapsedSeconds });

    const minutes = Math.max(elapsedSeconds, 1) / 60;
    const expectedWpm = Math.round((result.correctChars / 5 / minutes) * 100) / 100;

    expect(result.wpm).toBe(expectedWpm);
    expect(result.wpm).toBe(50);
  });

  it("WPM formula sanity: 30 correct chars in 30 seconds is exactly 12 WPM", () => {
    const originalText = "a".repeat(30);
    const typedText = "a".repeat(30);
    const elapsedSeconds = 30;

    const result = scoreAttempt({ originalText, typedText, elapsedSeconds });

    const minutes = Math.max(elapsedSeconds, 1) / 60;
    const expectedWpm = Math.round((result.correctChars / 5 / minutes) * 100) / 100;

    expect(result.wpm).toBe(expectedWpm);
    expect(result.wpm).toBe(12);
  });
});

describe("gradeAttempt", () => {
  const thresholds = { passWpm: 40, passAccuracy: 95, failWpm: 20, failAccuracy: 80 };

  it("PASS when both wpm and accuracy are exactly at the pass threshold", () => {
    expect(gradeAttempt(40, 95, thresholds)).toBe("PASS");
  });

  it("PASS when both wpm and accuracy clear the pass threshold", () => {
    expect(gradeAttempt(50, 98, thresholds)).toBe("PASS");
  });

  it("AVERAGE (not FAIL) when wpm is exactly at the fail threshold, due to strict < in the FAIL check", () => {
    // failWpm = 20; wpm === 20 does not satisfy `wpm < failWpm`, so it falls
    // through to AVERAGE rather than FAIL. This locks down the asymmetry
    // between the PASS check (>=) and the FAIL check (<).
    expect(gradeAttempt(20, 90, thresholds)).toBe("AVERAGE");
  });

  it("AVERAGE (not FAIL) when accuracy is exactly at the fail threshold, due to strict < in the FAIL check", () => {
    expect(gradeAttempt(30, 80, thresholds)).toBe("AVERAGE");
  });

  it("FAIL when wpm is clearly below the fail threshold", () => {
    expect(gradeAttempt(10, 90, thresholds)).toBe("FAIL");
  });

  it("FAIL when accuracy is clearly below the fail threshold", () => {
    expect(gradeAttempt(50, 70, thresholds)).toBe("FAIL");
  });

  it("not PASS when wpm clears the pass bar but accuracy does not (falls to AVERAGE here)", () => {
    const result = gradeAttempt(50, 90, thresholds); // accuracy 90 < passAccuracy 95, >= failAccuracy 80
    expect(result).not.toBe("PASS");
    expect(result).toBe("AVERAGE");
  });

  it("not PASS when accuracy clears the pass bar but wpm does not (falls to AVERAGE here)", () => {
    const result = gradeAttempt(30, 98, thresholds); // wpm 30 < passWpm 40, >= failWpm 20
    expect(result).not.toBe("PASS");
    expect(result).toBe("AVERAGE");
  });
});

describe("validateThresholds", () => {
  it("returns null for valid thresholds (pass bar at/above fail bar on both axes)", () => {
    const result = validateThresholds({ passWpm: 40, passAccuracy: 95, failWpm: 20, failAccuracy: 80 });
    expect(result).toBeNull();
  });

  it("returns null when pass equals fail on both axes (boundary is allowed)", () => {
    const result = validateThresholds({ passWpm: 30, passAccuracy: 90, failWpm: 30, failAccuracy: 90 });
    expect(result).toBeNull();
  });

  it("returns an error string when passWpm < failWpm", () => {
    const result = validateThresholds({ passWpm: 10, passAccuracy: 95, failWpm: 20, failAccuracy: 80 });
    expect(typeof result).toBe("string");
    expect(result).not.toBeNull();
  });

  it("returns an error string when passAccuracy < failAccuracy", () => {
    const result = validateThresholds({ passWpm: 40, passAccuracy: 50, failWpm: 20, failAccuracy: 80 });
    expect(typeof result).toBe("string");
    expect(result).not.toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { wrapIntoLines, currentLineIndex, classifyLineChars, type WrappedLine } from "./lineWrap";

function reconstruct(lines: WrappedLine[]): string {
  return lines.map((l) => l.text).join("");
}

describe("wrapIntoLines", () => {
  it("reconstructs a short passage exactly", () => {
    const text = "The quick brown fox jumps over the lazy dog.";
    const lines = wrapIntoLines(text, 12);
    expect(reconstruct(lines)).toBe(text);
  });

  it("reconstructs a long passage exactly", () => {
    const text = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ") + " end of passage.";
    const lines = wrapIntoLines(text, 30);
    expect(reconstruct(lines)).toBe(text);
  });

  it("reconstructs punctuation-heavy text exactly", () => {
    const text = "Hello, world! Isn't it a nice day? Yes—absolutely; (really).";
    const lines = wrapIntoLines(text, 15);
    expect(reconstruct(lines)).toBe(text);
  });

  it("handles empty string input without crashing", () => {
    const lines = wrapIntoLines("", 20);
    expect(lines).toEqual([{ text: "", startIndex: 0, endIndex: 0 }]);
    expect(reconstruct(lines)).toBe("");
  });

  it("never splits a word, even mid-passage", () => {
    const text = "supercalifragilisticexpialidocious is a long word indeed";
    const lines = wrapIntoLines(text, 10);
    for (const word of text.split(/\s+/)) {
      if (!word) continue;
      // Every occurrence of the word must appear whole within a single line's text.
      const foundWhole = lines.some((l) => l.text.includes(word));
      expect(foundWhole).toBe(true);
    }
    expect(reconstruct(lines)).toBe(text);
  });

  it("gives a single overlong word its own line without crashing", () => {
    const longWord = "a".repeat(50);
    const text = `short ${longWord} tail`;
    const lines = wrapIntoLines(text, 10);
    expect(reconstruct(lines)).toBe(text);
    const overlongLine = lines.find((l) => l.text.includes(longWord));
    expect(overlongLine).toBeTruthy();
    expect(overlongLine!.text.trim()).toBe(longWord);
  });

  it("keeps multiple consecutive spaces intact and in place", () => {
    const text = "one    four spaces here";
    const lines = wrapIntoLines(text, 8);
    expect(reconstruct(lines)).toBe(text);
  });

  it("handles text with no trailing newline", () => {
    const text = "no trailing newline here";
    const lines = wrapIntoLines(text, 9);
    expect(reconstruct(lines)).toBe(text);
    expect(lines[lines.length - 1].text.endsWith("\n")).toBe(false);
  });

  it("produces correct startIndex/endIndex at line boundaries", () => {
    const text = "aaa bbb ccc ddd";
    const lines = wrapIntoLines(text, 7);
    // startIndex of a line must equal endIndex of the previous line.
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i].startIndex).toBe(lines[i - 1].endIndex);
    }
    // First line starts at 0, last line ends at text.length.
    expect(lines[0].startIndex).toBe(0);
    expect(lines[lines.length - 1].endIndex).toBe(text.length);
    // Every line's slice must match its text.
    for (const line of lines) {
      expect(text.slice(line.startIndex, line.endIndex)).toBe(line.text);
    }
  });

  it("defends against a non-positive charsPerLine instead of crashing", () => {
    const text = "some text";
    expect(() => wrapIntoLines(text, 0)).not.toThrow();
    expect(() => wrapIntoLines(text, -5)).not.toThrow();
    expect(reconstruct(wrapIntoLines(text, 0))).toBe(text);
  });
});

describe("currentLineIndex", () => {
  const text = "aaa bbb ccc ddd";
  // wrapIntoLines packs greedily and only pulls a token onto the current
  // line if it fits, so a boundary-straddling whitespace token starts the
  // NEXT line rather than staying attached to the one before it:
  // -> [{"aaa bbb", 0, 7}, {" ccc ", 7, 12}, {"ddd", 12, 15}]
  const lines = wrapIntoLines(text, 7);

  it("picks the line containing typedText.length", () => {
    expect(currentLineIndex(lines, 0)).toBe(0);
    expect(currentLineIndex(lines, 5)).toBe(0);
    expect(currentLineIndex(lines, 11)).toBe(1);
  });

  it("crosses into the next line right at the boundary (the boundary index belongs to the line that starts there)", () => {
    expect(currentLineIndex(lines, lines[0].endIndex)).toBe(1);
    expect(currentLineIndex(lines, lines[1].endIndex)).toBe(2);
  });

  it("clamps to the last line once fully typed", () => {
    expect(currentLineIndex(lines, text.length)).toBe(lines.length - 1);
  });

  it("never throws on an empty lines array", () => {
    expect(currentLineIndex([], 0)).toBe(0);
  });
});

describe("classifyLineChars", () => {
  const examText = "abcdef ghij";
  // wrapIntoLines(examText, 6) -> [{"abcdef", 0, 6}, {" ghij", 6, 11}]
  const lines = wrapIntoLines(examText, 6);

  it("marks correct/incorrect chars exactly at absolute index, not line-relative", () => {
    // Typed "abXdef" (X wrong at absolute index 2), exactly filling line 0.
    const typedText = "abXdef";
    const states = classifyLineChars(lines[0], examText, typedText);
    expect(states).toEqual(["correct", "correct", "incorrect", "correct", "correct", "correct"]);
  });

  it("places the caret at the first untyped absolute index", () => {
    const typedText = "abc";
    const states = classifyLineChars(lines[0], examText, typedText);
    expect(states[3]).toBe("caret");
    expect(states.slice(0, 3)).toEqual(["correct", "correct", "correct"]);
    expect(states.slice(4).every((s) => s === "pending")).toBe(true);
  });

  it("shows the caret on the second line once the first line is fully typed", () => {
    const typedText = lines[0].text; // "abcdef" — exactly finishes line 0
    const statesLine0 = classifyLineChars(lines[0], examText, typedText);
    const statesLine1 = classifyLineChars(lines[1], examText, typedText);
    expect(statesLine0.includes("caret")).toBe(false);
    expect(statesLine1[0]).toBe("caret");
  });

  it("marks a wrong character using the SAME absolute index across line boundaries, with zero cascade onto line 0", () => {
    // 'X' typed in place of the space at absolute index 6 (line 1's first
    // char) must not affect line 0's (already-correct) classification at
    // all — this is the no-cascade property TypingField must preserve.
    const typedText = "abcdefX";
    const statesLine0 = classifyLineChars(lines[0], examText, typedText);
    const statesLine1 = classifyLineChars(lines[1], examText, typedText);
    expect(statesLine0.every((s) => s === "correct")).toBe(true);
    expect(statesLine1[0]).toBe("incorrect");
    expect(statesLine1[1]).toBe("caret");
  });

  it("marks everything pending (except a leading caret) on an empty typedText", () => {
    const states = classifyLineChars(lines[0], examText, "");
    expect(states[0]).toBe("caret");
    expect(states.slice(1).every((s) => s === "pending")).toBe(true);
  });
});

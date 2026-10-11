import { describe, it, expect } from "vitest";
import { wrapIntoLines, currentLineIndex, caretIndex, renderLineChars, type WrappedLine } from "./lineWrap";

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

describe("renderLineChars / caretIndex (word-aligned)", () => {
  const examText = "abcdef ghij";
  const lines = wrapIntoLines(examText, 6);
  const states = (line: WrappedLine, typed: string) => renderLineChars(line, examText, typed).map((c) => c.state);

  it("marks correct/incorrect chars within their own word", () => {
    expect(states(lines[0], "abXdef")).toEqual(["correct", "correct", "incorrect", "correct", "correct", "correct"]);
  });

  it("places the caret at the next untyped character of the current word", () => {
    const st = states(lines[0], "abc");
    expect(st.slice(0, 3)).toEqual(["correct", "correct", "correct"]);
    expect(st[3]).toBe("caret");
    expect(st.slice(4).every((x) => x === "pending")).toBe(true);
    expect(caretIndex(examText, "abc")).toBe(3);
  });

  it("puts the caret on the closing space once the word is full length, then in the next word", () => {
    expect(states(lines[0], "abcdef").every((x) => x === "correct")).toBe(true);
    expect(states(lines[1], "abcdef")[0]).toBe("caret");
    expect(caretIndex(examText, "abcdef")).toBe(6);
    expect(states(lines[1], "abcdef ")[0]).toBe("correct");
    expect(states(lines[1], "abcdef ")[1]).toBe("caret");
    expect(caretIndex(examText, "abcdef ")).toBe(7);
  });

  it("a mistake in one word does not touch the next word (no cascade)", () => {
    // "abcdf" typed for "abcdef" (e dropped), space, then "ghij" typed right.
    const st = states(lines[1], "abcdf ghij");
    expect(st.slice(1).every((x) => x === "correct")).toBe(true);
    // The short word's missing characters show as missed, not as a shift.
    expect(states(lines[0], "abcdf ghij")).toEqual(["correct", "correct", "correct", "correct", "incorrect", "missed"]);
  });

  it("shows characters typed past the end of a word as extras before the space", () => {
    // The closing space starts line 1, so the extras are drawn there, before it.
    const chars = renderLineChars(lines[1], examText, "abcdefXY");
    expect(chars.map((c) => c.ch).join("")).toBe("XY ghij");
    expect(chars.slice(0, 2).every((c) => c.extra && c.state === "incorrect")).toBe(true);
  });

  it("marks everything pending (except a leading caret) on an empty typedText", () => {
    const st = states(lines[0], "");
    expect(st[0]).toBe("caret");
    expect(st.slice(1).every((x) => x === "pending")).toBe(true);
  });
});

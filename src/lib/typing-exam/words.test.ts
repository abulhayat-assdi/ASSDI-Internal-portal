import { describe, it, expect } from "vitest";
import { caretIndex, classifyWord, countCorrectChars, isPassageComplete, passageWords, sanitizeTyped } from "./words";

describe("sanitizeTyped", () => {
  it("drops leading and doubled spaces", () => {
    expect(sanitizeTyped("  ab  cd ")).toBe("ab cd ");
  });
});

describe("caretIndex", () => {
  const text = "abcdef ghij";
  it("points at the next character of the current word", () => {
    expect(caretIndex(text, "")).toBe(0);
    expect(caretIndex(text, "abc")).toBe(3);
    expect(caretIndex(text, "abcdef")).toBe(6);
    expect(caretIndex(text, "abcdef g")).toBe(8);
  });
  it("is not shifted by a short or long word", () => {
    expect(caretIndex(text, "abcd ")).toBe(7); // short word, space → next word start
    expect(caretIndex(text, "abcdefXY")).toBe(6); // extras do not move it past the word
  });
});

describe("classifyWord", () => {
  it("marks untyped, correct, wrong and extra letters", () => {
    expect(classifyWord("cat", "cx").map((l) => l.state)).toEqual(["correct", "wrong", "untyped"]);
    expect(classifyWord("cat", "catzz").map((l) => l.state)).toEqual(["correct", "correct", "correct", "extra", "extra"]);
    expect(classifyWord("cat", undefined).every((l) => l.state === "untyped")).toBe(true);
  });
});

describe("passage helpers", () => {
  it("counts correct chars per word and detects completion", () => {
    expect(countCorrectChars("the cat", "the cxt")).toBe(4 + 2);
    expect(isPassageComplete(passageWords("the cat"), "the cat")).toBe(true);
    expect(isPassageComplete(passageWords("the cat"), "the ca")).toBe(false);
  });
});

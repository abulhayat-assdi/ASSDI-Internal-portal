// Pure line-wrapping + index-mapping logic for the Monkeytype-style typing
// UI (TypingField.tsx). No React, no DOM — safe to unit test in isolation.
//
// CORRECTNESS CONTRACT (load-bearing): scoring.ts's scoreAttempt() does a
// plain index-based comparison of `typedText[i]` against `originalText[i]`
// on the FINAL submitted string. TypingField only changes how the passage
// is *rendered* (wrapped into lines, current line highlighted); it must
// never change what index a character lives at. Every function here works
// in the SAME absolute index space as `examText` — a line's `startIndex`/
// `endIndex` are offsets into the original, unwrapped `examText`, and
// `wrapIntoLines(examText, n).map(l => l.text).join("")` must reconstruct
// `examText` EXACTLY (every character, in order, no drops/dupes). That
// invariant is what keeps caret-position math aligned with the same index
// space scoreAttempt() uses.

import { cursorOf, passageWords } from "./words";

export interface WrappedLine {
  text: string;
  startIndex: number;
  endIndex: number; // exclusive
}

/**
 * Word-wraps `examText` into lines of at most `charsPerLine` characters,
 * breaking only at whitespace boundaries — a single word longer than
 * `charsPerLine` gets its own (overflowing) line rather than being split.
 *
 * Tokenizes into alternating whitespace/non-whitespace runs and greedily
 * packs tokens onto each line, so every character of `examText` (words,
 * spaces, newlines, everything) ends up in exactly one line's `text` at
 * its correct absolute offset.
 */
export function wrapIntoLines(examText: string, charsPerLine: number): WrappedLine[] {
  if (examText.length === 0) {
    return [{ text: "", startIndex: 0, endIndex: 0 }];
  }

  const perLine = Math.max(1, Math.floor(charsPerLine) || 1);

  const tokenRe = /\s+|\S+/g;
  const tokens: { text: string; start: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(examText)) !== null) {
    tokens.push({ text: match[0], start: match.index });
  }

  const lines: WrappedLine[] = [];
  let lineStart = 0;
  let lineLength = 0;

  for (const token of tokens) {
    const lineIsEmpty = lineLength === 0;
    if (!lineIsEmpty && lineLength + token.text.length > perLine) {
      const endIndex = token.start;
      lines.push({ text: examText.slice(lineStart, endIndex), startIndex: lineStart, endIndex });
      lineStart = endIndex;
      lineLength = 0;
    }
    lineLength += token.text.length;
  }

  lines.push({ text: examText.slice(lineStart, examText.length), startIndex: lineStart, endIndex: examText.length });

  return lines;
}

/**
 * The passage index the caret points at: the next character to type in the
 * word being typed (or the space closing it once the word is full length).
 * Typed text is judged word by word (words.ts), so this is NOT simply
 * `typedText.length` — a short or long word shifts the two apart.
 */
export function caretIndex(examText: string, typedText: string): number {
  const { wordIndex, pos } = cursorOf(typedText);
  const words = passageWords(examText);
  if (wordIndex >= words.length) return examText.length;
  let start = 0;
  for (let w = 0; w < wordIndex; w++) start += words[w].length + 1;
  return Math.min(start + Math.min(pos, words[wordIndex].length), examText.length);
}

/**
 * Which line holds `index` (see caretIndex), as an index into `lines`. The
 * line whose `[startIndex, endIndex)` range contains it wins; at the very
 * end of the passage there is no such line, so this clamps to the last one.
 */
export function currentLineIndex(lines: WrappedLine[], index: number): number {
  if (lines.length === 0) return 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (index >= line.startIndex && index < line.endIndex) return i;
  }
  return lines.length - 1;
}

export type CharState = "correct" | "incorrect" | "missed" | "caret" | "pending";

export interface RenderedChar {
  ch: string;
  state: CharState;
  /** True for a character typed past the end of its word (not in the passage). */
  extra?: boolean;
}

/**
 * Per-character render state for one line, judged word by word exactly as
 * scoring does (words.ts): passage character `p` of word `w` is compared
 * with typed word `w`'s character `p`. Characters typed past the end of a
 * word are shown after it (state "incorrect", `extra`), and characters a
 * finished word is missing are "missed".
 */
export function renderLineChars(line: WrappedLine, examText: string, typedText: string): RenderedChar[] {
  const words = passageWords(examText);
  const typedWords = typedText.split(" ");
  const { wordIndex: curWord, pos: curPos } = cursorOf(typedText);
  const out: RenderedChar[] = [];

  // Start of the word containing line.startIndex.
  let wi = 0;
  let wordStart = 0;
  while (wi < words.length && wordStart + words[wi].length + 1 <= line.startIndex) {
    wordStart += words[wi].length + 1;
    wi++;
  }

  for (let a = line.startIndex; a < line.endIndex; a++) {
    while (wi < words.length && a > wordStart + words[wi].length) {
      wordStart += words[wi].length + 1;
      wi++;
    }
    const target = words[wi] ?? "";
    const p = a - wordStart;
    const typed = typedWords[wi];
    const isCurrent = wi === curWord;
    const ch = examText[a];

    if (p < target.length) {
      let state: CharState;
      if (typed === undefined || wi > curWord) state = "pending";
      else if (p < typed.length) state = typed[p] === ch ? "correct" : "incorrect";
      else if (isCurrent) state = p === curPos ? "caret" : "pending";
      else state = "missed"; // word was left before this character was typed
      out.push({ ch, state });
      continue;
    }

    // p === target.length: the space closing the word. Extras typed past
    // the end of the word are shown first, then the space.
    if (typed !== undefined && typed.length > target.length) {
      for (let k = target.length; k < typed.length; k++) {
        out.push({ ch: typed[k], state: "incorrect", extra: true });
      }
    }
    let state: CharState = "pending";
    if (typed !== undefined && wi < curWord) state = typed.length === target.length ? "correct" : "missed";
    else if (isCurrent && curPos >= target.length) state = "caret";
    out.push({ ch, state });
  }
  return out;
}

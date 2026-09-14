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
 * Which line the caret (i.e. `typedText.length`) currently sits in, as an
 * index into `lines`. The line whose `[startIndex, endIndex)` range
 * contains `typedTextLength` "wins"; once everything has been typed
 * (`typedTextLength === examText.length`) there's no such line, so this
 * clamps to the last line.
 */
export function currentLineIndex(lines: WrappedLine[], typedTextLength: number): number {
  if (lines.length === 0) return 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (typedTextLength >= line.startIndex && typedTextLength < line.endIndex) return i;
  }
  return lines.length - 1;
}

export type CharState = "correct" | "incorrect" | "caret" | "pending";

/**
 * Per-character render state for one line, character-index-exact against
 * the SAME absolute `examText` index space `wrapIntoLines` uses: character
 * `j` within `line.text` is `examText`/`typedText` index `line.startIndex + j`.
 * Deliberately does NOT compare against a line-relative substring of
 * `typedText` — that would silently break correctness across line
 * boundaries whenever `charsPerLine` changes (e.g. on window resize).
 */
export function classifyLineChars(line: WrappedLine, examText: string, typedText: string): CharState[] {
  const states: CharState[] = new Array(line.text.length);
  for (let j = 0; j < line.text.length; j++) {
    const absIndex = line.startIndex + j;
    if (absIndex < typedText.length) {
      states[j] = typedText[absIndex] === examText[absIndex] ? "correct" : "incorrect";
    } else if (absIndex === typedText.length) {
      states[j] = "caret";
    } else {
      states[j] = "pending";
    }
  }
  return states;
}

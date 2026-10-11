// Word-aligned typing model shared by the engine, the scorer and the view.
//
// Why: judging the typed text against the passage by absolute character
// index makes ONE dropped, doubled or extra character shift everything
// after it, so every following character is scored wrong — a single slip
// near the start of a line could wipe out most of a result. Monkeytype and
// every other mainstream test judge each word against its own target word
// instead, so a mistake only ever costs that word.
//
// The passage is cleaned (examText.ts): words are separated by exactly one
// space. The typed text is the same kind of string — words separated by one
// space — and word i of the typed text is judged against word i of the
// passage, character by character.

/** Most characters a taker may type past the end of a word before input is refused. */
export const MAX_EXTRA_CHARS = 10;

export function passageWords(passage: string): string[] {
  return passage.length === 0 ? [] : passage.split(" ");
}

/**
 * Makes typed text well-formed: no leading space, no double spaces. A space
 * on an empty word is ignored, exactly as Monkeytype does, so a stray extra
 * space cannot push every following word onto the wrong target.
 */
export function sanitizeTyped(value: string): string {
  return value.replace(/^ +/, "").replace(/ {2,}/g, " ");
}

/** Where the caret sits: which word it is in and how many characters into it. */
export function cursorOf(typed: string): { wordIndex: number; pos: number } {
  const lastSpace = typed.lastIndexOf(" ");
  let wordIndex = 0;
  for (let i = 0; i < typed.length; i++) if (typed[i] === " ") wordIndex++;
  return { wordIndex, pos: typed.length - (lastSpace + 1) };
}

/** Whether the character `ch` at index `i` of `typed` is what the passage asks for there. */
export function isCharCorrect(words: string[], typed: string, i: number): boolean {
  const before = typed.slice(0, i);
  const { wordIndex, pos } = cursorOf(before);
  const target = words[wordIndex];
  if (target === undefined) return false;
  const ch = typed[i];
  // A space is right when it closes the word at exactly the target length.
  if (ch === " ") return pos === target.length;
  return pos < target.length && target[pos] === ch;
}

/**
 * True when `next` can still be accepted: it has no more words than the
 * passage and its current word is not absurdly longer than its target.
 */
export function isTypeable(words: string[], next: string): boolean {
  const { wordIndex, pos } = cursorOf(next);
  if (wordIndex >= words.length) return false;
  return pos <= words[wordIndex].length + MAX_EXTRA_CHARS;
}

/** The run is complete once the last word has been typed to its full length. */
export function isPassageComplete(words: string[], typed: string): boolean {
  if (words.length === 0) return false;
  const { wordIndex, pos } = cursorOf(typed);
  return wordIndex === words.length - 1 && pos >= words[words.length - 1].length;
}

/**
 * Characters that count as correct: letters that match their own word's
 * target at the same position, plus the space closing a word typed at the
 * right length. Typed text is judged per word, so mistakes do not cascade.
 */
export function countCorrectChars(passage: string, typed: string): number {
  const words = passageWords(passage);
  const typedWords = typed.split(" ");
  let correct = 0;
  for (let w = 0; w < typedWords.length; w++) {
    const t = typedWords[w];
    const target = words[w];
    if (target === undefined) break;
    const n = Math.min(t.length, target.length);
    for (let j = 0; j < n; j++) if (t[j] === target[j]) correct++;
    // The space after a word exists only when a further word follows it.
    if (w < typedWords.length - 1 && t.length === target.length) correct++;
  }
  return correct;
}

/** Longest typedText the server keeps for a passage (passage plus per-word extras). */
export function maxTypedLength(passage: string): number {
  return passage.length + MAX_EXTRA_CHARS * Math.max(1, passageWords(passage).length);
}

/**
 * The passage index the caret points at: the next character to type in the
 * word being typed (the closing space once the word is full length). Typed
 * text is judged word by word, so this is NOT `typedText.length` — a short
 * or long word shifts the two apart. Used for the "% done" figure.
 */
export function caretIndex(passage: string, typed: string): number {
  const { wordIndex, pos } = cursorOf(typed);
  const words = passageWords(passage);
  if (wordIndex >= words.length) return passage.length;
  let start = 0;
  for (let w = 0; w < wordIndex; w++) start += words[w].length + 1;
  return Math.min(start + Math.min(pos, words[wordIndex].length), passage.length);
}

export type LetterState = "untyped" | "correct" | "wrong" | "extra";

/**
 * Per-letter state of one passage word given what was typed for it:
 * letters not yet reached are "untyped", matching ones "correct", others
 * "wrong", and anything typed past the end of the word is appended as
 * "extra" letters.
 */
export function classifyWord(target: string, typed: string | undefined): { ch: string; state: LetterState }[] {
  const out: { ch: string; state: LetterState }[] = [];
  const t = typed ?? "";
  for (let j = 0; j < target.length; j++) {
    const state: LetterState = j >= t.length ? "untyped" : t[j] === target[j] ? "correct" : "wrong";
    out.push({ ch: target[j], state });
  }
  for (let j = target.length; j < t.length; j++) out.push({ ch: t[j], state: "extra" });
  return out;
}

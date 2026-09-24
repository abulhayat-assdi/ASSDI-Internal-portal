/**
 * Unit segmentation — turning one prompt string into the chunks a mechanic
 * spawns, catches, or counts.
 *
 * Derived from the expected TEXT alone, deliberately, rather than from the
 * prompt set that produced it. buildPrompt() joins letters/numbers/symbols
 * with "" and words/sentences with " ", so the original item boundaries are
 * not recoverable from the text for the "" kinds — but they do not need to
 * be: every item in those sets is a single character, so "one code point per
 * unit" reproduces them exactly. For spaced prompts, word tokens are both
 * recoverable and the right gameplay granularity (a falling *sentence* would
 * be unplayable).
 *
 * The practical payoff: the route handler re-derives units from the
 * `expected_text` column it already stores, with no prompt seed, no catalog
 * lookup, and no new persistence.
 */
import type { MechanicUnit } from "./types";

/**
 * Split expected text into units. Spaced text yields word tokens (the spaces
 * between them belong to no unit); unspaced text yields one unit per code
 * point. Runs of consecutive spaces collapse into one gap.
 */
export function segmentUnits(expectedText: string): MechanicUnit[] {
  const chars = Array.from(expectedText);
  const units: MechanicUnit[] = [];

  if (!chars.includes(" ")) {
    for (let i = 0; i < chars.length; i++) {
      units.push({ index: units.length, text: chars[i] as string, start: i, end: i + 1 });
    }
    return units;
  }

  let cursor = 0;
  while (cursor < chars.length) {
    if (chars[cursor] === " ") {
      cursor += 1;
      continue;
    }
    const start = cursor;
    while (cursor < chars.length && chars[cursor] !== " ") cursor += 1;
    units.push({
      index: units.length,
      text: chars.slice(start, cursor).join(""),
      start,
      end: cursor,
    });
  }
  return units;
}

/**
 * The unit containing a given expected-text position, or null when the
 * position is a gap between units.
 */
export function unitAt(units: MechanicUnit[], position: number): MechanicUnit | null {
  for (const u of units) {
    if (position >= u.start && position < u.end) return u;
  }
  return null;
}

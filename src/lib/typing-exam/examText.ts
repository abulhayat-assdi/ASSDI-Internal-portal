// Makes an exam passage typeable on a standard keyboard in the single-line
// typing field. Applied when a passage is saved AND again wherever it is
// served or graded (it is idempotent), so passages stored before this
// existed are covered too.
//
// Why: the field is an <input>, which cannot hold a newline. A bank passage
// with a paragraph break ("\n\n", in 160 of 172 bank passages) forces
// the taker to type ONE space where the passage expects TWO characters, and
// from there every following character is off by one and scored wrong.
// Pasted custom text has the same problem with curly quotes, dashes, tabs
// and non-breaking spaces, which look typeable but are not.

const REPLACEMENTS: [RegExp, string][] = [
  [/[\u2018\u2019\u201A\u201B\u2032\u02BC]/g, "'"],
  [/[\u201C\u201D\u201E\u201F\u2033]/g, '"'],
  [/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-"],
  [/\u2026/g, "..."],
  // Invisible characters with no key. ZWJ/ZWNJ (U+200D/U+200C) are kept on
  // purpose: Bangla keyboards type them and they change the rendered glyph.
  [/[\u200B\u2060\uFEFF\u00AD]/g, ""],
];

/** Allowed exam length, in seconds. */
export const MIN_DURATION_SECONDS = 10;
export const MAX_DURATION_SECONDS = 3600;

/** Whole seconds within the allowed range, or null when the value is not acceptable. */
export function parseDurationSeconds(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < MIN_DURATION_SECONDS || n > MAX_DURATION_SECONDS) return null;
  return n;
}

export function cleanExamText(raw: string): string {
  let s = raw.normalize("NFC");
  for (const [re, to] of REPLACEMENTS) s = s.replace(re, to);
  // Every whitespace run (newlines, tabs, NBSP, wide spaces) becomes one space.
  return s.replace(/\s+/g, " ").trim();
}

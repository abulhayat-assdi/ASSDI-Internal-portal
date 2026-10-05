import { describe, it, expect } from "vitest";
import { cleanExamText, parseDurationSeconds } from "./examText";
import { ALL_PASSAGES, pickBankPassage } from "./content";

describe("cleanExamText", () => {
  it("turns paragraph breaks into a single space (they cannot be typed in the field)", () => {
    expect(cleanExamText("First paragraph.\n\nSecond one.")).toBe("First paragraph. Second one.");
  });

  it("collapses tabs, \u00A0 and repeated spaces, and trims the edges", () => {
    expect(cleanExamText("  a \t b \u00A0 c    d  ")).toBe("a b c d");
  });

  it("replaces typographic characters a keyboard cannot type", () => {
    expect(cleanExamText("\u2018it \u2019s \u201Cquote\u201D \u2014 wait \u2013 ok \u2026")).toBe(`'it 's "quote" - wait - ok ...`);
  });

  it("drops invisible characters but keeps Bangla \u200D/ZWNJ", () => {
    expect(cleanExamText("a\u200Bb")).toBe("ab");
    expect(cleanExamText("র\u200D্য")).toBe("র\u200D্য");
  });

  it("is idempotent", () => {
    const once = cleanExamText("A  “b”\n\nc");
    expect(cleanExamText(once)).toBe(once);
  });

  it("every bank passage comes out typeable", () => {
    for (const p of ALL_PASSAGES) {
      const t = cleanExamText(p.text);
      expect(t).not.toMatch(/[\n\r\t]/);
      expect(t).not.toMatch(/  /);
      expect(t).toBe(t.trim());
    }
  });

  it("pickBankPassage returns cleaned text", () => {
    for (let i = 0; i < 50; i++) {
      const t = pickBankPassage("en");
      expect(t).toBe(cleanExamText(t));
    }
  });
});

describe("parseDurationSeconds", () => {
  it("accepts whole seconds from 10 to 3600", () => {
    expect(parseDurationSeconds(60)).toBe(60);
    expect(parseDurationSeconds("120")).toBe(120);
    expect(parseDurationSeconds(10)).toBe(10);
    expect(parseDurationSeconds(3600)).toBe(3600);
  });
  it("rejects fractions, out-of-range and junk", () => {
    for (const v of [30.5, 9, 0, -5, 3601, "abc", null, undefined, Number.NaN]) expect(parseDurationSeconds(v)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  decodeTimeline,
  digestOf,
  digestsMatch,
  encodeTimeline,
  resolveParams,
  runMechanic,
  segmentUnits,
  validateTimeline,
  type MechanicRunInput,
  type RealMechanic,
} from "./index";

/** Build a run input, typing `typed` at a steady `msPerChar`. */
function input(
  mechanic: RealMechanic,
  expectedText: string,
  typedText: string,
  msPerChar: number,
  overrides: Partial<MechanicRunInput> = {},
): MechanicRunInput {
  const expected = Array.from(expectedText);
  const typed = Array.from(typedText);
  const units = segmentUnits(expectedText);
  return {
    mechanic,
    expected,
    typed,
    timeline: typed.map((_, i) => (i + 1) * msPerChar),
    units,
    params: resolveParams(mechanic, {}, "intermediate", units.length),
    caseSensitive: true,
    ...overrides,
  };
}

describe("segmentUnits", () => {
  it("splits spaced text into word units with correct offsets", () => {
    const units = segmentUnits("cat dog sun");
    expect(units.map((u) => u.text)).toEqual(["cat", "dog", "sun"]);
    expect(units[1]).toMatchObject({ start: 4, end: 7 });
  });

  it("treats unspaced text as one unit per character", () => {
    const units = segmentUnits("asdf");
    expect(units).toHaveLength(4);
    expect(units[2]).toMatchObject({ text: "d", start: 2, end: 3 });
  });

  it("collapses repeated spaces into a single gap", () => {
    expect(segmentUnits("a  b").map((u) => u.text)).toEqual(["a", "b"]);
  });
});

describe("timeline", () => {
  it("round-trips through delta encoding", () => {
    const abs = [10, 25, 90, 400];
    expect(decodeTimeline(encodeTimeline(abs))).toEqual(abs);
  });

  it("rejects a length mismatch", () => {
    expect(validateTimeline([1, 2], 3, 1000).reason).toBe("TIMELINE_LENGTH_MISMATCH");
  });

  it("rejects a non-monotonic timeline", () => {
    expect(validateTimeline([10, 5], 2, 1000).reason).toBe("TIMELINE_NOT_MONOTONIC");
  });

  it("rejects a timeline running past the claimed elapsed time", () => {
    expect(validateTimeline([1000, 90_000], 2, 1000).reason).toBe(
      "TIMELINE_IMPLAUSIBLE_GAP",
    );
    expect(validateTimeline([1000, 20_000], 2, 1000).reason).toBe(
      "TIMELINE_EXCEEDS_ELAPSED",
    );
  });

  it("accepts a coherent timeline within tolerance", () => {
    expect(validateTimeline([100, 200, 300], 3, 300).ok).toBe(true);
  });
});

describe("falling-catch", () => {
  it("clears every unit when typed within the fall window", () => {
    const out = runMechanic(input("falling-catch", "cat dog sun", "cat dog sun", 60));
    expect(out.endReason).toBe("completed");
    expect(out.units.missed).toBe(0);
    expect(out.cleared).toBe(true);
  });

  it("loses a life for a unit finished after its deadline", () => {
    // 900ms/char: unit 0 ("cat") completes at 2700ms, past fallMs (2600).
    const out = runMechanic(input("falling-catch", "cat dog sun", "cat dog sun", 900));
    expect(out.units.missed).toBeGreaterThan(0);
  });

  it("ends the run when lives run out", () => {
    const out = runMechanic(input("falling-catch", "aa bb cc dd ee", "xx yy zz ww vv", 50));
    expect(out.endReason).toBe("out-of-lives");
    expect(out.lives.lost).toBe(out.lives.max);
    // Stops at the third wrong unit rather than reading the whole buffer.
    expect(out.endedAtChar).toBeLessThan(14);
  });
});

describe("defense-shield", () => {
  it("survives a clean run", () => {
    const out = runMechanic(input("defense-shield", "cat dog", "cat dog", 60));
    expect(out.cleared).toBe(true);
    expect(out.detail.shieldLeft).toBe(3);
  });

  it("breaks after shieldHits errors and reports where", () => {
    const out = runMechanic(input("defense-shield", "abcdefgh", "xbxdxfgh", 60));
    expect(out.endReason).toBe("shield-broken");
    expect(out.endedAtChar).toBe(5); // third error is at index 4
    expect(out.cleared).toBe(false);
  });
});

describe("escape-run", () => {
  it("escapes when typing faster than the pursuer", () => {
    const out = runMechanic(input("escape-run", "the quick brown fox", "the quick brown fox", 60));
    expect(out.endReason).toBe("completed");
    expect(out.detail.lead).toBeGreaterThan(0);
  });

  it("is caught when typing too slowly", () => {
    const out = runMechanic(input("escape-run", "the quick brown fox", "the quick brown fox", 1200));
    expect(out.endReason).toBe("caught");
    expect(out.endedAtChar).toBeLessThan(19);
  });
});

describe("race-checkpoints", () => {
  it("passes gates when fast enough", () => {
    const out = runMechanic(input("race-checkpoints", "a b c d e f g h", "a b c d e f g h", 40));
    expect(out.endReason).toBe("completed");
    expect(out.detail.checkpointsPassed).toBeGreaterThan(0);
  });

  it("fails the first gate missed", () => {
    const out = runMechanic(input("race-checkpoints", "a b c d e f g h", "a b c d e f g h", 4000));
    expect(out.endReason).toBe("checkpoint-missed");
  });
});

describe("boss-phased", () => {
  it("defeats the boss when every unit lands", () => {
    const out = runMechanic(input("boss-phased", "one two six ten", "one two six ten", 60));
    expect(out.cleared).toBe(true);
    expect(out.detail.bossHpLeft).toBe(0);
  });

  it("leaves HP when units are wrong", () => {
    const out = runMechanic(input("boss-phased", "one two six ten", "one xxx six ten", 60));
    expect(out.endReason).toBe("boss-survived");
    expect(out.detail.bossHpLeft).toBe(1);
    expect(out.cleared).toBe(false);
  });
});

describe("sequence-build", () => {
  it("tracks the longest unbroken chain", () => {
    const out = runMechanic(input("sequence-build", "aa bb cc dd", "aa bb cc dd", 60));
    expect(out.detail.longestChain).toBe(4);
    expect(out.cleared).toBe(true);
  });

  it("breaks the chain on a wrong unit", () => {
    const out = runMechanic(input("sequence-build", "aa bb cc dd", "aa xx cc dd", 60));
    expect(out.detail.breaks).toBe(1);
    expect(out.detail.longestChain).toBe(2);
    expect(out.cleared).toBe(false);
  });
});

describe("survival-waves / endless / collection / target-press", () => {
  it("survival-waves counts waves cleared", () => {
    const out = runMechanic(input("survival-waves", "a b c d e f", "a b c d e f", 50));
    expect(out.endReason).toBe("completed");
    expect(out.detail.wavesCleared).toBeGreaterThanOrEqual(1);
  });

  it("endless treats surviving the prompt as a clear", () => {
    const out = runMechanic(input("endless", "a b c d", "a b c d", 50));
    expect(out.cleared).toBe(true);
    expect(out.detail.distance).toBe(4);
  });

  it("collection drops wrong items without a time gate", () => {
    const out = runMechanic(input("collection", "a b c d", "a x c d", 5000));
    expect(out.units.missed).toBe(1);
    expect(out.units.cleared).toBe(3);
  });

  it("target-press misses a target pressed too slowly", () => {
    const fast = runMechanic(input("target-press", "asdf", "asdf", 100));
    expect(fast.units.missed).toBe(0);
    const slow = runMechanic(input("target-press", "asdf", "asdf", 4000));
    expect(slow.units.missed).toBeGreaterThan(0);
  });
});

describe("digest", () => {
  it("matches for identical replays and differs when the run diverges", () => {
    const a = runMechanic(input("defense-shield", "abcdefgh", "abcdefgh", 60));
    const b = runMechanic(input("defense-shield", "abcdefgh", "abcdefgh", 60));
    expect(digestsMatch(digestOf(a), digestOf(b))).toBe(true);

    const c = runMechanic(input("defense-shield", "abcdefgh", "xbxdxfgh", 60));
    expect(digestsMatch(digestOf(a), digestOf(c))).toBe(false);
  });

  it("ignores partial buffers rather than calling them complete", () => {
    const out = runMechanic(input("falling-catch", "cat dog sun", "cat", 60));
    expect(out.endReason).toBe("incomplete");
    expect(out.cleared).toBe(false);
  });
});

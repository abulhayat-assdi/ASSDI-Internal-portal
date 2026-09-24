/**
 * Keystroke timeline: the one new piece of evidence real mechanics need.
 *
 * Why it is required: "did you catch the word before it fell?" and "did the
 * pursuer reach you?" are questions about WHEN characters were typed. The
 * existing evidence (typed text + total elapsed) cannot answer them, so a
 * mechanic verdict built on it alone would be unverifiable — exactly the
 * client-trust hole the pipeline otherwise avoids.
 *
 * Wire format is deltas, not absolutes: consecutive keystrokes are tens of
 * milliseconds apart, so deltas stay small integers and a 600-character
 * prompt costs a few hundred bytes.
 *
 * What validation can and cannot prove: it proves the timeline is internally
 * coherent and consistent with the elapsed time the rest of the pipeline
 * already checks. It cannot prove the timestamps were not fabricated by a
 * scripted client — no client-side measurement can. That is why a fabricated
 * timeline buys nothing: WPM and accuracy still come from the typed text, and
 * the mechanic digest derived from a forged timeline is checked against the
 * same limits as everything else.
 */

/** Largest plausible gap between two keystrokes, ms. Longer = paused/idle. */
const MAX_GAP_MS = 60_000;

export interface TimelineVerdict {
  ok: boolean;
  reason?:
    | "TIMELINE_LENGTH_MISMATCH"
    | "TIMELINE_NOT_NUMERIC"
    | "TIMELINE_NOT_MONOTONIC"
    | "TIMELINE_EXCEEDS_ELAPSED"
    | "TIMELINE_IMPLAUSIBLE_GAP";
}

/** Absolute ms offsets -> deltas for transport. */
export function encodeTimeline(timeline: number[]): number[] {
  const out: number[] = [];
  let prev = 0;
  for (const t of timeline) {
    out.push(Math.max(0, Math.round(t - prev)));
    prev = t;
  }
  return out;
}

/** Deltas from the wire -> absolute ms offsets. */
export function decodeTimeline(deltas: readonly number[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const d of deltas) {
    acc += d;
    out.push(acc);
  }
  return out;
}

/**
 * Check a decoded timeline against the buffer it describes and the elapsed
 * time the submission claims. `toleranceMs` absorbs the gap between the last
 * keystroke and the submit call.
 */
export function validateTimeline(
  timeline: readonly number[],
  typedLength: number,
  elapsedMs: number,
  toleranceMs = 5_000,
): TimelineVerdict {
  if (timeline.length !== typedLength) {
    return { ok: false, reason: "TIMELINE_LENGTH_MISMATCH" };
  }
  let prev = 0;
  for (const t of timeline) {
    if (!Number.isFinite(t)) return { ok: false, reason: "TIMELINE_NOT_NUMERIC" };
    if (t < prev) return { ok: false, reason: "TIMELINE_NOT_MONOTONIC" };
    if (t - prev > MAX_GAP_MS) return { ok: false, reason: "TIMELINE_IMPLAUSIBLE_GAP" };
    prev = t;
  }
  if (Number.isFinite(elapsedMs) && prev > elapsedMs + toleranceMs) {
    return { ok: false, reason: "TIMELINE_EXCEEDS_ELAPSED" };
  }
  return { ok: true };
}

/** Parse an untrusted wire value into deltas, or null when unusable. */
export function parseTimelineDeltas(value: unknown, maxLength: number): number[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length > maxLength) return null;
  const out: number[] = [];
  for (const v of value) {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
    out.push(Math.round(v));
  }
  return out;
}

/**
 * Pluggable ad-provider abstraction for "watch an ad to unlock".
 *
 * Today only the `mock` provider exists: the client shows a timed sponsor
 * modal (see components/typing-game/ad-unlock-button.tsx) and, once the
 * required watch time elapses, POSTs a watch-proof to
 * /api/typing-game/games/[gameId]/ad-unlock. The server re-validates the
 * proof with validateWatchProof() below — never trusts the client blindly.
 *
 * Adding a real network (e.g. AdSense rewarded ads) means:
 *   1. add a new provider id to AdProviderId,
 *   2. implement its client-side show() in ad-unlock-button.tsx,
 *   3. extend validateWatchProof() with that provider's server-side check
 *      (e.g. verify the network's reward callback / token).
 * The write path (fn_ad_unlock_game RPC + route) stays untouched.
 */

/** Providers the client knows how to render. `mock` = timed sponsor modal. */
export type AdProviderId = "mock" | "adsense";

/** Proof the client watched long enough. Posted as `{ proof }`. */
export interface AdWatchProof {
  provider: AdProviderId;
  /** milliseconds the client claims it displayed the ad */
  watchMs: number;
  /** epoch ms when the watch finished, for freshness checks */
  completedAt: number;
}

/** Minimum watch time before the server accepts a proof (mock + default). */
export const AD_MIN_WATCH_MS = 5000;

/** How old a proof may be before the server rejects it as stale. */
export const AD_PROOF_MAX_AGE_MS = 10 * 60 * 1000;

/** Which provider the client should render. Env-overridable, mock default. */
export function getAdProvider(): AdProviderId {
  const raw =
    typeof process !== "undefined"
      ? (process.env.NEXT_PUBLIC_AD_PROVIDER ?? "").trim().toLowerCase()
      : "";
  return raw === "adsense" ? "adsense" : "mock";
}

/** Build a mock proof after a completed timed watch. */
export function makeMockProof(watchMs: number): AdWatchProof {
  return { provider: "mock", watchMs, completedAt: Date.now() };
}

/**
 * Server-side proof check. Returns null when the proof is acceptable,
 * otherwise a short machine-readable reason code for the route to forward.
 */
export function validateWatchProof(
  proof: unknown,
  now: number = Date.now(),
): string | null {
  if (!proof || typeof proof !== "object") return "MISSING_PROOF";
  const p = proof as Partial<AdWatchProof>;
  if (p.provider !== "mock" && p.provider !== "adsense") return "BAD_PROVIDER";
  if (typeof p.watchMs !== "number" || !(p.watchMs >= AD_MIN_WATCH_MS)) {
    return "WATCH_TOO_SHORT";
  }
  if (typeof p.completedAt !== "number" || !Number.isFinite(p.completedAt)) {
    return "BAD_TIMESTAMP";
  }
  if (p.completedAt > now + 60 * 1000) return "BAD_TIMESTAMP";
  if (now - p.completedAt > AD_PROOF_MAX_AGE_MS) return "STALE_PROOF";
  // NOTE: `adsense` currently validates the same fields as `mock`. When a
  // real AdSense rewarded slot is wired up, verify its reward token here.
  return null;
}

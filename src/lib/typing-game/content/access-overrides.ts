/**
 * Curated exceptions to the normal unlock rules — layered on top of
 * evaluateUnlock() and the sequential world-gate in server/games.ts,
 * never by editing individual games' stored `unlockRule`.
 *
 * ALWAYS_FREE_GAME_SLUGS: playable from the very first visit, regardless of
 * world-lock or stat gates — a small "free preview" hook.
 *
 * AD_UNLOCKABLE_GAME_SLUGS: otherwise-locked games a student can unlock
 * early via the mock "watch an ad" action (POST /api/typing-game/games/
 * [slug]/ad-unlock) instead of waiting to meet the normal requirement.
 * Kept intentionally small and easy to retune — just edit these arrays.
 */
export const ALWAYS_FREE_GAME_SLUGS: string[] = ["letter-rain"];

export const AD_UNLOCKABLE_GAME_SLUGS: string[] = ["word-ninja", "minute-dash", "sentence-run"];

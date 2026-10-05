/**
 * Deterministic, seeded shuffling for quiz question/option order.
 *
 * A student's shuffled order must stay identical across page refreshes
 * within the same attempt, without persisting the order itself. Seeding the
 * shuffle off a stable string (the attempt id, or `${attemptId}:${questionId}`
 * for per-question option order) gives that for free — the same seed always
 * produces the same permutation, so it can be recomputed on every request.
 */

function hashSeed(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h;
}

/** mulberry32 PRNG — small, fast, good enough distribution for shuffling. */
function mulberry32(seed: number): () => number {
    let state = seed;
    return function next() {
        state |= 0;
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Fisher-Yates shuffle seeded so the same seed string always yields the same order. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
    const rand = mulberry32(hashSeed(seed));
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

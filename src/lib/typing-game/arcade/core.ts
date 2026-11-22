/**
 * Arcade game core. Every game is a deterministic simulation that advances
 * in fixed ticks; the browser plays it live and records which keys were
 * applied on which tick, and the server replays the same log on the same
 * simulation to compute the score itself. Nothing here may touch the DOM,
 * the clock or Math.random, and no float function whose result could differ
 * between engines (sin/cos/pow) is used in game logic — only + - * / and
 * comparisons, which are exact IEEE operations everywhere.
 */

/** One simulation step, in milliseconds. */
export const TICK_MS = 16;
export const TICKS_PER_SECOND = 1000 / TICK_MS;
/** Logical world size every game uses; the renderer scales it to the canvas. */
export const WORLD_W = 1000;
export const WORLD_H = 600;

/** Words and sentences the server picked for this run (by difficulty tier). */
export interface ArcadeContent {
  /** 0: 3–4 letters · 1: 5–6 · 2: 7–9 · 3: capitals / punctuation / numbers */
  words: string[][];
  /** 0: short lower-case · 1: medium sentences · 2: long, punctuation and numbers */
  sentences: string[][];
}

/** Something the renderer may want to show or play (never read by the server). */
export interface SimEvent {
  type: "hit" | "miss" | "kill" | "lose" | "level" | "combo" | "bonus" | "win" | "over";
  x?: number;
  y?: number;
  text?: string;
}

export interface ArcadeResult {
  score: number;
  level: number;
  correct: number;
  wrong: number;
  wpm: number;
  accuracy: number;
  durationMs: number;
  won: boolean;
  maxCombo: number;
  stats: Record<string, number>;
}

/** A small, fast, seedable PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Shared bookkeeping: counters, combo, lives, events, result. */
export abstract class BaseSim {
  t = 0;
  over = false;
  won = false;
  score = 0;
  correct = 0;
  wrong = 0;
  combo = 0;
  maxCombo = 0;
  level = 1;
  lives: number;
  maxLives: number;
  events: SimEvent[] = [];
  protected rng: () => number;

  constructor(
    protected content: ArcadeContent,
    seed: number,
    lives: number,
  ) {
    this.rng = mulberry32(seed);
    this.lives = lives;
    this.maxLives = lives;
  }

  /** Apply one typed character (already a single printable character). */
  abstract key(k: string): void;
  /** Advance the game by one tick. */
  abstract tick(): void;
  /** Extra numbers for the result screen. */
  protected stats(): Record<string, number> {
    return {};
  }

  protected emit(e: SimEvent): void {
    // The server never drains events; keep the buffer bounded.
    if (this.events.length < 200) this.events.push(e);
  }

  protected good(x?: number, y?: number): void {
    this.correct++;
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    if (this.combo > 0 && this.combo % 25 === 0) this.emit({ type: "combo", x, y, text: `${this.combo}` });
    else this.emit({ type: "hit", x, y });
  }

  protected bad(x?: number, y?: number): void {
    this.wrong++;
    this.combo = 0;
    this.emit({ type: "miss", x, y });
  }

  protected loseLife(x?: number, y?: number): void {
    this.lives--;
    this.combo = 0;
    this.emit({ type: "lose", x, y });
    if (this.lives <= 0) this.end(false);
  }

  protected end(won: boolean): void {
    if (this.over) return;
    this.over = true;
    this.won = won;
    this.emit({ type: won ? "win" : "over" });
  }

  /** Random integer in [min, max]. */
  protected int(min: number, max: number): number {
    return min + Math.floor(this.rng() * (max - min + 1));
  }

  protected pick<T>(list: T[]): T {
    return list[Math.floor(this.rng() * list.length)];
  }

  /** A word from a tier, avoiding first letters already on screen when possible. */
  protected word(tier: number, avoidFirst?: Set<string>): string {
    const pool = this.content.words[Math.max(0, Math.min(this.content.words.length - 1, tier))];
    let w = this.pick(pool);
    if (avoidFirst) {
      for (let i = 0; i < 12 && avoidFirst.has(w[0]); i++) w = this.pick(pool);
    }
    return w;
  }

  protected sentence(tier: number): string {
    const pool = this.content.sentences[Math.max(0, Math.min(this.content.sentences.length - 1, tier))];
    return this.pick(pool);
  }

  result(): ArcadeResult {
    const ms = this.t * TICK_MS;
    const minutes = Math.max(ms, 1000) / 60000;
    const total = this.correct + this.wrong;
    return {
      score: Math.max(0, Math.round(this.score)),
      level: this.level,
      correct: this.correct,
      wrong: this.wrong,
      wpm: round1(this.correct / 5 / minutes),
      accuracy: total ? round1((100 * this.correct) / total) : 0,
      durationMs: ms,
      won: this.won,
      maxCombo: this.maxCombo,
      stats: this.stats(),
    };
  }
}

/**
 * Lock-on typing over several on-screen targets (meteors, bubbles): the
 * first letter picks the most urgent target starting with it; the rest of
 * the word must follow. Returns what happened so the game can score it.
 */
export interface LockTarget {
  id: number;
  word: string;
  typed: number;
  x: number;
  y: number;
}

export function lockOnKey<T extends LockTarget>(
  targets: T[],
  lockedId: number | null,
  k: string,
  urgency: (t: T) => number,
): { locked: number | null; hit: T | null; done: T | null } {
  const cur = lockedId === null ? undefined : targets.find((t) => t.id === lockedId);
  if (!cur) {
    let best: T | undefined;
    for (const t of targets) {
      if (t.word[0] === k && (!best || urgency(t) > urgency(best))) best = t;
    }
    if (!best) return { locked: null, hit: null, done: null };
    best.typed = 1;
    if (best.typed >= best.word.length) return { locked: null, hit: best, done: best };
    return { locked: best.id, hit: best, done: null };
  }
  if (cur.word[cur.typed] !== k) return { locked: cur.id, hit: null, done: null };
  cur.typed++;
  if (cur.typed >= cur.word.length) return { locked: null, hit: cur, done: cur };
  return { locked: cur.id, hit: cur, done: null };
}

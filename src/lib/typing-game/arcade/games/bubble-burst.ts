/**
 * Bubble Burst — bubbles float up carrying letters, then words. Pop them
 * before they reach the top; 5 escapes end the game. Pop quickly in a row
 * for a chain bonus. Gold bubbles score triple; a red bomb bubble pops
 * everything on screen.
 */
import { BaseSim, lockOnKey, WORLD_H, WORLD_W, type ArcadeContent, type LockTarget } from "../core";

export type BubbleKind = "normal" | "gold" | "bomb";
export interface Bubble extends LockTarget {
  vy: number;
  r: number;
  kind: BubbleKind;
}

export const TOP_Y = 40;
const LETTERS = "abcdefghijklmnopqrstuvwxyz";

export class BubbleBurstSim extends BaseSim {
  bubbles: Bubble[] = [];
  locked: number | null = null;
  pops = 0;
  chain = 0;
  bestChain = 0;
  private lastPop = -1000;
  private spawnIn = 40;
  private nextId = 1;

  constructor(content: ArcadeContent, seed: number) {
    super(content, seed, 5);
  }

  private text(used: Set<string>): string {
    const lv = this.level;
    if (lv <= 2) {
      let ch = LETTERS[this.int(0, 25)];
      for (let i = 0; i < 10 && used.has(ch); i++) ch = LETTERS[this.int(0, 25)];
      return ch;
    }
    const tier = lv <= 4 ? 0 : lv <= 6 ? (this.rng() < 0.5 ? 0 : 1) : lv <= 8 ? 1 : this.rng() < 0.5 ? 2 : 3;
    return this.word(tier, used);
  }

  private spawn(): void {
    const used = new Set(this.bubbles.map((b) => b.word[0]));
    const word = this.text(used);
    const roll = this.rng();
    const kind: BubbleKind = roll < 0.05 && this.level >= 2 ? "bomb" : roll < 0.15 ? "gold" : "normal";
    const vy = 0.55 + this.level * 0.09 + this.rng() * 0.2;
    this.bubbles.push({ id: this.nextId++, word, typed: 0, x: this.int(70, WORLD_W - 70), y: WORLD_H + 10, vy, r: 30 + word.length * 5, kind });
  }

  private pop(b: Bubble): void {
    this.bubbles = this.bubbles.filter((x) => x.id !== b.id);
    this.pops++;
    this.chain = this.t - this.lastPop <= 75 ? this.chain + 1 : 1;
    this.lastPop = this.t;
    if (this.chain > this.bestChain) this.bestChain = this.chain;
    const base = b.word.length * 20 + 10;
    this.score += (b.kind === "gold" ? base * 3 : base) + (this.chain - 1) * 15;
    this.emit({ type: b.kind === "gold" ? "bonus" : "kill", x: b.x, y: b.y, text: this.chain > 2 ? `Chain x${this.chain}` : b.word });
    if (this.pops % 15 === 0) {
      this.level++;
      this.emit({ type: "level", text: `Level ${this.level}` });
    }
  }

  key(k: string): void {
    if (this.over) return;
    const r = lockOnKey(this.bubbles, this.locked, k, (b) => -b.y);
    this.locked = r.locked;
    if (!r.hit) {
      this.bad();
      return;
    }
    this.good(r.hit.x, r.hit.y);
    if (r.done) {
      const b = r.done;
      if (b.kind === "bomb") {
        const all = [...this.bubbles];
        this.pop(b);
        for (const o of all) if (o.id !== b.id) this.pop(o);
        this.locked = null;
        this.emit({ type: "bonus", x: b.x, y: b.y, text: "BOOM!" });
      } else {
        this.pop(b);
      }
    }
  }

  tick(): void {
    if (this.over) return;
    this.t++;
    if (--this.spawnIn <= 0) {
      this.spawn();
      this.spawnIn = Math.max(22, 95 - this.level * 8) + this.int(0, 25);
    }
    for (const b of this.bubbles) b.y -= b.vy;
    const escaped = this.bubbles.filter((b) => b.y <= TOP_Y);
    if (escaped.length) {
      this.bubbles = this.bubbles.filter((b) => b.y > TOP_Y);
      for (const b of escaped) {
        if (this.locked === b.id) this.locked = null;
        if (b.kind === "bomb") continue; // a missed bomb is no loss
        this.loseLife(b.x, TOP_Y);
        if (this.over) return;
      }
    }
  }

  protected stats(): Record<string, number> {
    return { bubbles: this.pops, bestChain: this.bestChain };
  }
}

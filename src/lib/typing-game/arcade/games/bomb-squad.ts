/**
 * Bomb Squad — defuse bombs by typing their code exactly before the fuse
 * burns down. Codes grow longer and add capitals, numbers and symbols as you
 * go; every wrong key burns extra fuse. An exploded bomb costs a life (3).
 */
import { BaseSim, TICKS_PER_SECOND, type ArcadeContent } from "../core";

const DIGITS = "0123456789";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const SYMBOLS = "!@#$%&*-+=?";
const PENALTY = 40;
const GAP = 45;

export class BombSquadSim extends BaseSim {
  code = "";
  pos = 0;
  fuse = 0;
  fuseMax = 1;
  gap = GAP;
  defused = 0;
  exploded = 0;
  /** Tick of the last explosion / defuse (renderer flashes). */
  lastBoom = -1000;
  lastDefuse = -1000;

  constructor(content: ArcadeContent, seed: number) {
    super(content, seed, 3);
    this.arm();
  }

  private arm(): void {
    const lv = this.level;
    const len = Math.min(12, 4 + Math.floor((lv - 1) / 2));
    let set = DIGITS;
    if (lv >= 3) set += LOWER;
    if (lv >= 5) set += UPPER;
    if (lv >= 7) set += SYMBOLS;
    let code = "";
    for (let i = 0; i < len; i++) {
      // Group long codes for readability: XXXX-XXXX style dashes are part of the code.
      if (len >= 8 && i > 0 && i % 4 === 0) code += "-";
      code += set[this.int(0, set.length - 1)];
    }
    this.code = code;
    this.pos = 0;
    // ~0.9 s a character at first, down to ~0.21 s (about 55 wpm) from level 16.
    const perChar = Math.max(13, 58 - lv * 3);
    this.fuseMax = code.length * perChar + Math.round(TICKS_PER_SECOND);
    this.fuse = this.fuseMax;
  }

  key(k: string): void {
    if (this.over || this.gap > 0) return;
    if (this.code[this.pos] === k) {
      this.pos++;
      this.good();
      this.score += 10;
      if (this.pos >= this.code.length) {
        this.defused++;
        this.lastDefuse = this.t;
        this.score += this.code.length * 20 + Math.floor((this.fuse / this.fuseMax) * 200);
        this.emit({ type: "kill", text: "Defused!" });
        if (this.defused % 3 === 0) {
          this.level++;
          this.emit({ type: "level", text: `Level ${this.level}` });
        }
        this.gap = GAP;
      }
    } else {
      this.bad();
      this.fuse -= PENALTY;
    }
  }

  tick(): void {
    if (this.over) return;
    if (this.gap > 0) {
      this.t++;
      if (--this.gap === 0) this.arm();
      return;
    }
    this.t++;
    this.fuse--;
    if (this.fuse <= 0) {
      this.exploded++;
      this.lastBoom = this.t;
      this.loseLife();
      if (this.over) return;
      this.gap = GAP;
    }
  }

  protected stats(): Record<string, number> {
    return { defused: this.defused, exploded: this.exploded };
  }
}

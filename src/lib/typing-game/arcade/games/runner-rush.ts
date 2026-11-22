/**
 * Runner Rush — an endless run that keeps speeding up. Every obstacle
 * carries a word: type it before the runner reaches the obstacle to jump
 * it. Words are typed in order (the nearest obstacle first). Crashing costs
 * a heart (3 hearts).
 */
import { BaseSim, type ArcadeContent } from "../core";

export interface Obstacle {
  id: number;
  x: number;
  word: string;
  typed: number;
  cleared: boolean;
  crashed: boolean;
  kind: number;
}

export const RUNNER_X = 170;

export class RunnerRushSim extends BaseSim {
  obstacles: Obstacle[] = [];
  speed = 2.4;
  distance = 0;
  jumped = 0;
  /** Tick when the runner last jumped (renderer animates the arc). */
  lastJump = -1000;
  lastCrash = -1000;
  private nextId = 1;
  private nextAt = 900;

  constructor(content: ArcadeContent, seed: number) {
    super(content, seed, 3);
  }

  get multiplier(): number {
    return 1 + Math.min(4, Math.floor(this.combo / 20));
  }

  /** The obstacle the student is typing now. */
  get active(): Obstacle | undefined {
    return this.obstacles.find((o) => !o.cleared && !o.crashed);
  }

  private tier(): number {
    const lv = this.level;
    if (lv <= 2) return 0;
    if (lv <= 4) return this.rng() < 0.5 ? 0 : 1;
    if (lv <= 6) return this.rng() < 0.5 ? 1 : 2;
    return this.rng() < 0.4 ? 2 : 3;
  }

  private spawn(x: number): void {
    this.obstacles.push({ id: this.nextId++, x, word: this.word(this.tier()), typed: 0, cleared: false, crashed: false, kind: this.int(0, 2) });
  }

  key(k: string): void {
    if (this.over) return;
    const o = this.active;
    if (!o) return;
    if (o.word[o.typed] !== k) {
      this.bad(o.x, 420);
      return;
    }
    o.typed++;
    this.good(o.x, 420);
    this.score += 10 * this.multiplier;
    if (o.typed >= o.word.length) {
      o.cleared = true;
      this.jumped++;
      this.score += o.word.length * 12 * this.multiplier;
      this.emit({ type: "kill", x: o.x, y: 420, text: o.word });
      if (this.jumped % 8 === 0) {
        this.level++;
        this.emit({ type: "level", text: `Speed ${this.level}` });
      }
    }
  }

  tick(): void {
    if (this.over) return;
    this.t++;
    this.speed = 2.4 + (this.level - 1) * 0.35 + this.t * 0.00004;
    this.distance += this.speed;
    this.score += this.speed * 0.02;
    for (const o of this.obstacles) o.x -= this.speed;
    // Keep the road filled ahead.
    const last = this.obstacles[this.obstacles.length - 1];
    if (!last || last.x < this.nextAt) {
      const gap = this.int(300, 470) + Math.min(260, this.level * 22);
      this.spawn((last ? last.x : 600) + gap);
    }
    for (const o of this.obstacles) {
      if (o.x <= RUNNER_X + 30 && !o.cleared && !o.crashed) {
        o.crashed = true;
        this.lastCrash = this.t;
        this.loseLife(o.x, 470);
        if (this.over) return;
      } else if (o.cleared && o.x <= RUNNER_X + 90 && o.x > RUNNER_X + 90 - this.speed) {
        this.lastJump = this.t;
      }
    }
    this.obstacles = this.obstacles.filter((o) => o.x > -80);
  }

  protected stats(): Record<string, number> {
    return { distance: Math.round(this.distance / 10), jumps: this.jumped };
  }
}

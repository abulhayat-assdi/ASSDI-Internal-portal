/**
 * Lava Climb — each word you finish stacks a block under your climber
 * while the lava keeps rising, faster the higher you go. A wrong key
 * cracks the block you are building (the word starts over). One life: if
 * the lava reaches you, the climb is over.
 */
import { BaseSim, type ArcadeContent } from "../core";

export const LEVEL_HEIGHT = 400;

export interface Block {
  word: string;
  h: number;
}

export class LavaClimbSim extends BaseSim {
  height = 0;
  lava = -150;
  queue: string[] = [];
  typed = 0;
  blocks: Block[] = [];
  started = false;
  cracks = 0;

  constructor(content: ArcadeContent, seed: number) {
    super(content, seed, 1);
    while (this.queue.length < 4) this.queue.push(this.nextWord());
  }

  private nextWord(): string {
    const lv = this.level;
    const tier = lv <= 2 ? 0 : lv <= 4 ? (this.rng() < 0.5 ? 0 : 1) : lv <= 7 ? (this.rng() < 0.5 ? 1 : 2) : this.rng() < 0.5 ? 2 : 3;
    return this.word(tier);
  }

  get current(): string {
    return this.queue[0];
  }

  get lavaSpeed(): number {
    // Faster with every level and slowly faster over time.
    return 0.1 + (this.level - 1) * 0.05 + this.t * 0.000005;
  }

  key(k: string): void {
    if (this.over) return;
    this.started = true;
    const w = this.current;
    if (w[this.typed] === k) {
      this.typed++;
      this.good();
      this.score += 2;
      if (this.typed >= w.length) {
        const h = w.length * 6 + 8;
        this.height += h;
        this.blocks.push({ word: w, h });
        if (this.blocks.length > 40) this.blocks.shift();
        this.score += w.length * 8;
        this.typed = 0;
        this.queue.shift();
        this.queue.push(this.nextWord());
        const lv = 1 + Math.floor(this.height / LEVEL_HEIGHT);
        if (lv > this.level) {
          this.level = lv;
          this.emit({ type: "level", text: `Level ${lv}` });
        }
        this.emit({ type: "kill", text: w });
      }
    } else {
      this.bad();
      if (this.typed > 0) {
        this.typed = 0;
        this.cracks++;
      }
    }
  }

  tick(): void {
    if (this.over) return;
    if (!this.started) return;
    this.t++;
    this.lava += this.lavaSpeed;
    // The lava never lags far behind — the pressure stays on.
    if (this.height - this.lava > 300) this.lava = this.height - 300;
    if (this.lava >= this.height) {
      this.lava = this.height;
      this.score = Math.floor(this.score);
      this.end(false);
    }
  }

  protected stats(): Record<string, number> {
    return { height: Math.round(this.height / 10), blocks: this.correct ? this.blocks.length : 0 };
  }
}

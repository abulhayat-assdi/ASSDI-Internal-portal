/**
 * Combo Blitz — 60 seconds against the clock. Every correct key scores the
 * current multiplier, which climbs x1 → x8 as the streak grows; any mistake
 * drops it back to x1 (and the key must be typed again). Every 50-key streak
 * adds 2 bonus seconds.
 */
import { BaseSim, TICKS_PER_SECOND, type ArcadeContent } from "../core";

export const BLITZ_SECONDS = 60;

export class ComboBlitzSim extends BaseSim {
  text = "";
  pos = 0;
  timeLeft = BLITZ_SECONDS * TICKS_PER_SECOND;
  started = false;
  bestMultiplier = 1;
  bonusSeconds = 0;

  constructor(content: ArcadeContent, seed: number) {
    super(content, seed, 1);
    this.fill();
  }

  get multiplier(): number {
    return Math.min(8, 1 + Math.floor(this.combo / 10));
  }

  private fill(): void {
    while (this.text.length - this.pos < 160) {
      const typed = this.correct;
      const tier = typed < 80 ? 0 : typed < 200 ? (this.rng() < 0.5 ? 0 : 1) : typed < 350 ? (this.rng() < 0.5 ? 1 : 2) : this.rng() < 0.5 ? 2 : 3;
      this.text += (this.text ? " " : "") + this.word(tier);
    }
  }

  key(k: string): void {
    if (this.over) return;
    this.started = true;
    if (this.text[this.pos] === k) {
      this.pos++;
      this.good();
      const m = this.multiplier;
      if (m > this.bestMultiplier) this.bestMultiplier = m;
      this.level = Math.max(this.level, m);
      this.score += m;
      if (this.combo % 10 === 0 && m > 1) this.emit({ type: "level", text: `x${m}` });
      if (this.combo % 50 === 0) {
        this.timeLeft += 2 * TICKS_PER_SECOND;
        this.bonusSeconds += 2;
        this.emit({ type: "bonus", x: 560, y: 80, text: "+2s" });
      }
      this.fill();
    } else {
      this.bad();
    }
  }

  tick(): void {
    if (this.over) return;
    // The clock starts with the first key press.
    if (!this.started) return;
    this.t++;
    if (--this.timeLeft <= 0) this.end(true);
  }

  protected stats(): Record<string, number> {
    return { bestMultiplier: this.bestMultiplier, bonusSeconds: this.bonusSeconds };
  }
}

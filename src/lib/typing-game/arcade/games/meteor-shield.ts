/**
 * Meteor Shield — words fall on the city in waves. Type a word to blast its
 * meteor; the first letter locks onto the lowest meteor starting with it.
 * Each wave brings more, faster meteors with longer words. A meteor that
 * reaches the ground destroys a shield (3 shields).
 */
import { BaseSim, lockOnKey, WORLD_H, WORLD_W, type ArcadeContent, type LockTarget } from "../core";

export interface Meteor extends LockTarget {
  vy: number;
  size: number;
}

export const GROUND_Y = WORLD_H - 70;

export class MeteorShieldSim extends BaseSim {
  meteors: Meteor[] = [];
  locked: number | null = null;
  wave = 1;
  toSpawn = 0;
  spawnIn = 90;
  waveBreak = 0;
  kills = 0;
  private nextId = 1;

  constructor(content: ArcadeContent, seed: number) {
    super(content, seed, 3);
    this.startWave();
  }

  private startWave(): void {
    this.toSpawn = 6 + this.wave * 2;
    this.level = this.wave;
  }

  private tier(): number {
    const w = this.wave;
    if (w <= 2) return 0;
    if (w <= 4) return this.rng() < 0.5 ? 0 : 1;
    if (w <= 6) return this.rng() < 0.4 ? 1 : 2;
    return this.rng() < 0.5 ? 2 : 3;
  }

  get multiplier(): number {
    return 1 + Math.min(4, Math.floor(this.combo / 20));
  }

  private spawn(): void {
    const used = new Set(this.meteors.map((m) => m.word[0]));
    const word = this.word(this.tier(), used);
    const speed = 0.42 + this.wave * 0.075 + this.rng() * 0.12;
    this.meteors.push({ id: this.nextId++, word, typed: 0, x: this.int(80, WORLD_W - 80), y: -30, vy: speed, size: 18 + word.length * 2 });
  }

  key(k: string): void {
    if (this.over) return;
    const r = lockOnKey(this.meteors, this.locked, k, (m) => m.y);
    this.locked = r.locked;
    if (!r.hit) {
      const m = this.meteors.find((x) => x.id === this.locked);
      this.bad(m?.x, m?.y);
      return;
    }
    this.good(r.hit.x, r.hit.y);
    this.score += 10 * this.multiplier;
    if (r.done) {
      const m = r.done;
      this.meteors = this.meteors.filter((x) => x.id !== m.id);
      this.kills++;
      this.score += m.word.length * 15 * this.multiplier;
      this.emit({ type: "kill", x: m.x, y: m.y, text: m.word });
    }
  }

  tick(): void {
    if (this.over) return;
    this.t++;
    if (this.waveBreak > 0) {
      this.waveBreak--;
      if (this.waveBreak === 0) this.startWave();
      return;
    }
    if (this.toSpawn > 0 && --this.spawnIn <= 0) {
      this.spawn();
      this.toSpawn--;
      this.spawnIn = Math.max(28, 130 - this.wave * 11) + this.int(0, 30);
    }
    for (const m of this.meteors) m.y += m.vy;
    const hit = this.meteors.filter((m) => m.y >= GROUND_Y);
    if (hit.length) {
      this.meteors = this.meteors.filter((m) => m.y < GROUND_Y);
      for (const m of hit) {
        if (this.locked === m.id) this.locked = null;
        this.loseLife(m.x, GROUND_Y);
        if (this.over) return;
      }
    }
    if (this.toSpawn === 0 && this.meteors.length === 0) {
      this.score += 100 * this.wave;
      this.emit({ type: "level", text: `Wave ${this.wave + 1}` });
      this.wave++;
      this.waveBreak = 110;
      this.spawnIn = 20;
    }
  }

  protected stats(): Record<string, number> {
    return { wave: this.wave, meteors: this.kills };
  }
}

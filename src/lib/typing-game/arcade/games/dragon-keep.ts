/**
 * Dragon Keep — a boss fight in three phases. The dragon casts spells
 * (sentences); type the spell before its cast bar fills to block it and
 * strike back. A wrong key speeds the cast up. Each phase casts longer,
 * faster spells. Three hearts; bring the dragon's 1000 HP to zero to win.
 */
import { BaseSim, TICKS_PER_SECOND, type ArcadeContent } from "../core";

export const DRAGON_HP = 1000;
const GAP = 70;
const MISS_PENALTY = 18;

export class DragonKeepSim extends BaseSim {
  hp = DRAGON_HP;
  phase = 1;
  spell = "";
  pos = 0;
  cast = 0;
  castMax = 1;
  gap = 90;
  blocked = 0;
  hitsTaken = 0;
  lastStrike = -1000;
  lastBurn = -1000;

  constructor(content: ArcadeContent, seed: number) {
    super(content, seed, 3);
  }

  private newSpell(): void {
    this.spell = this.sentence(this.phase - 1);
    this.pos = 0;
    // Ticks per character the student gets: ~25, ~33, ~42 wpm.
    const perChar = this.phase === 1 ? 30 : this.phase === 2 ? 23 : 18;
    this.castMax = this.spell.length * perChar + Math.round(TICKS_PER_SECOND);
    this.cast = 0;
  }

  key(k: string): void {
    if (this.over || this.gap > 0) return;
    if (this.spell[this.pos] === k) {
      this.pos++;
      this.good();
      this.score += 5;
      if (this.pos >= this.spell.length) this.strike();
    } else {
      this.bad();
      this.cast += MISS_PENALTY;
    }
  }

  private strike(): void {
    const speedBonus = 1 + (this.castMax - this.cast) / this.castMax / 2;
    const dmg = Math.round(this.spell.length * 2.3 * speedBonus);
    this.hp = Math.max(0, this.hp - dmg);
    this.blocked++;
    this.lastStrike = this.t;
    this.score += dmg * 3;
    this.emit({ type: "kill", text: `-${dmg}` });
    if (this.hp === 0) {
      this.score += 2500 + this.lives * 600 + Math.max(0, 3000 - Math.floor(this.t / TICKS_PER_SECOND) * 10);
      this.end(true);
      return;
    }
    const phase = this.hp <= DRAGON_HP / 3 ? 3 : this.hp <= (DRAGON_HP * 2) / 3 ? 2 : 1;
    if (phase !== this.phase) {
      this.phase = phase;
      this.level = phase;
      this.emit({ type: "level", text: `Phase ${phase}` });
    }
    this.spell = "";
    this.gap = GAP;
  }

  tick(): void {
    if (this.over) return;
    this.t++;
    if (this.gap > 0) {
      if (--this.gap === 0) this.newSpell();
      return;
    }
    this.cast++;
    if (this.cast >= this.castMax) {
      this.hitsTaken++;
      this.lastBurn = this.t;
      this.spell = "";
      this.loseLife();
      if (this.over) return;
      this.gap = GAP;
    }
  }

  protected stats(): Record<string, number> {
    return { dragonHp: this.hp, blocked: this.blocked };
  }
}

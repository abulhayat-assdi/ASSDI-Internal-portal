/**
 * Turbo Racer — race three bot cars across a passage. Your car moves as
 * you type; a wrong key makes it skid (keys are ignored for a moment).
 * Finish in the top three to reach the next, faster race; finish last and
 * the run is over. Win all 8 races for the championship.
 */
import { BaseSim, TICKS_PER_SECOND, type ArcadeContent } from "../core";

export const RACES = 8;
const COUNTDOWN = Math.round(3 * TICKS_PER_SECOND);
const SKID_TICKS = 24;
const BREAK = Math.round(2.5 * TICKS_PER_SECOND);
const PLACE_POINTS = [600, 350, 150];

export interface Bot {
  name: string;
  wpm: number;
  pos: number;
  finishedAt: number | null;
}

export class TurboRacerSim extends BaseSim {
  race = 1;
  text = "";
  pos = 0;
  bots: Bot[] = [];
  /** Ticks left of the 3-2-1 countdown (0 = racing). */
  countdown = COUNTDOWN;
  skid = 0;
  /** Ticks left of the pause after a race (shows the podium). */
  breakLeft = 0;
  lastPlace = 0;
  places: number[] = [];
  raceTicks = 0;

  constructor(content: ArcadeContent, seed: number) {
    super(content, seed, 1);
    this.setupRace();
  }

  private setupRace(): void {
    const tier = this.race <= 2 ? 0 : this.race <= 5 ? 1 : 2;
    const parts = [this.sentence(tier), this.sentence(tier)];
    if (this.race >= 4) parts.push(this.sentence(tier));
    this.text = parts.join(" ");
    this.pos = 0;
    this.skid = 0;
    this.countdown = COUNTDOWN;
    this.raceTicks = 0;
    const base = 16 + (this.race - 1) * 6;
    this.bots = ["Blaze", "Comet", "Viper"].map((name, i) => ({
      name,
      wpm: base + i * 7 + this.int(-2, 2),
      pos: 0,
      finishedAt: null,
    }));
    this.level = this.race;
  }

  get progress(): number {
    return this.text.length ? this.pos / this.text.length : 0;
  }

  key(k: string): void {
    if (this.over || this.countdown > 0 || this.breakLeft > 0 || this.skid > 0) return;
    if (this.text[this.pos] === k) {
      this.pos++;
      this.good();
      this.score += 3;
      if (this.pos >= this.text.length) this.finish();
    } else {
      this.bad();
      this.skid = SKID_TICKS;
    }
  }

  private finish(): void {
    const ahead = this.bots.filter((b) => b.finishedAt !== null).length;
    const place = ahead + 1;
    this.lastPlace = place;
    this.places.push(place);
    if (place > 3) {
      this.emit({ type: "over", text: "4th place" });
      this.end(false);
      return;
    }
    this.score += PLACE_POINTS[place - 1] + this.race * 50;
    this.emit({ type: place === 1 ? "bonus" : "level", text: `${place === 1 ? "1st" : place === 2 ? "2nd" : "3rd"} place!` });
    if (this.race >= RACES) {
      this.score += 2000;
      this.end(true);
      return;
    }
    this.breakLeft = BREAK;
  }

  tick(): void {
    if (this.over) return;
    this.t++;
    if (this.breakLeft > 0) {
      if (--this.breakLeft === 0) {
        this.race++;
        this.setupRace();
      }
      return;
    }
    if (this.countdown > 0) {
      this.countdown--;
      return;
    }
    this.raceTicks++;
    if (this.skid > 0) this.skid--;
    const len = this.text.length;
    for (const b of this.bots) {
      if (b.finishedAt !== null) continue;
      b.pos += (b.wpm * 5) / 60 / TICKS_PER_SECOND;
      if (b.pos >= len) {
        b.pos = len;
        b.finishedAt = this.t;
      }
    }
    if (this.bots.every((b) => b.finishedAt !== null)) {
      this.lastPlace = 4;
      this.places.push(4);
      this.end(false);
    }
  }

  protected stats(): Record<string, number> {
    return { races: this.places.filter((p) => p <= 3).length, wins: this.places.filter((p) => p === 1).length };
  }
}

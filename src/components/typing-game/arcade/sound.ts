/**
 * Tiny synthesized sound effects (Web Audio, no files). Muted state is
 * remembered per browser.
 */
import type { SimEvent } from "@/lib/typing-game/arcade/core";

const KEY = "tap-arcade-muted";

export function readMuted(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function writeMuted(m: boolean): void {
  try {
    window.localStorage.setItem(KEY, m ? "1" : "0");
  } catch {
    /* storage blocked — the toggle still works for this page */
  }
}

type Tone = { f: number; to?: number; d: number; type?: OscillatorType; v?: number; delay?: number };

const SOUNDS: Partial<Record<SimEvent["type"] | "start" | "tick", Tone[]>> = {
  hit: [{ f: 880, d: 0.03, type: "square", v: 0.025 }],
  miss: [{ f: 140, to: 90, d: 0.12, type: "sawtooth", v: 0.05 }],
  kill: [
    { f: 520, to: 1040, d: 0.1, type: "triangle", v: 0.08 },
    { f: 180, to: 60, d: 0.18, type: "sawtooth", v: 0.04 },
  ],
  bonus: [
    { f: 660, d: 0.08, type: "triangle", v: 0.08 },
    { f: 990, d: 0.12, type: "triangle", v: 0.08, delay: 0.08 },
  ],
  combo: [
    { f: 700, d: 0.07, type: "square", v: 0.05 },
    { f: 1050, d: 0.09, type: "square", v: 0.05, delay: 0.06 },
  ],
  level: [
    { f: 523, d: 0.1, type: "triangle", v: 0.08 },
    { f: 659, d: 0.1, type: "triangle", v: 0.08, delay: 0.1 },
    { f: 784, d: 0.16, type: "triangle", v: 0.08, delay: 0.2 },
  ],
  lose: [{ f: 220, to: 55, d: 0.4, type: "sawtooth", v: 0.09 }],
  over: [
    { f: 392, to: 300, d: 0.25, type: "triangle", v: 0.08 },
    { f: 300, to: 200, d: 0.4, type: "triangle", v: 0.08, delay: 0.25 },
  ],
  win: [
    { f: 523, d: 0.12, type: "triangle", v: 0.09 },
    { f: 659, d: 0.12, type: "triangle", v: 0.09, delay: 0.12 },
    { f: 784, d: 0.12, type: "triangle", v: 0.09, delay: 0.24 },
    { f: 1047, d: 0.3, type: "triangle", v: 0.09, delay: 0.36 },
  ],
  start: [{ f: 440, to: 880, d: 0.15, type: "triangle", v: 0.07 }],
  tick: [{ f: 660, d: 0.06, type: "square", v: 0.04 }],
};

export class Sfx {
  muted = false;
  private ctx: AudioContext | null = null;

  private ensure(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  play(type: keyof typeof SOUNDS): void {
    const ctx = this.ensure();
    const tones = SOUNDS[type];
    if (!ctx || !tones) return;
    const now = ctx.currentTime;
    for (const t of tones) {
      const start = now + (t.delay ?? 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = t.type ?? "sine";
      osc.frequency.setValueAtTime(t.f, start);
      if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, start + t.d);
      gain.gain.setValueAtTime(t.v ?? 0.06, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + t.d);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + t.d + 0.02);
    }
  }

  close(): void {
    void this.ctx?.close();
    this.ctx = null;
  }
}

/** Renderers: Turbo Racer, Combo Blitz, Bomb Squad, Dragon Keep. World space 1000 × 600. */
import { TICKS_PER_SECOND, WORLD_H, WORLD_W } from "@/lib/typing-game/arcade/core";
import type { TurboRacerSim } from "@/lib/typing-game/arcade/games/turbo-racer";
import { RACES } from "@/lib/typing-game/arcade/games/turbo-racer";
import type { ComboBlitzSim } from "@/lib/typing-game/arcade/games/combo-blitz";
import type { BombSquadSim } from "@/lib/typing-game/arcade/games/bomb-squad";
import { DRAGON_HP, type DragonKeepSim } from "@/lib/typing-game/arcade/games/dragon-keep";
import { deco, drawPassage, MONO, NEXT, roundRect, TYPED } from "./draw-utils";

function car(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, label: string, you: boolean, skid: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  if (skid) ctx.rotate(Math.sin(Date.now() / 30) * 0.08);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  roundRect(ctx, -38, -12, 80, 30, 10);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, -42, -18, 84, 30, 10);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  roundRect(ctx, 8, -14, 22, 22, 5);
  ctx.fill();
  ctx.fillStyle = "#111827";
  for (const wx of [-26, 24]) {
    ctx.beginPath();
    ctx.arc(wx, 13, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = `800 ${you ? 14 : 12}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = you ? "#fde047" : "#fff";
  ctx.fillText(label, -20, -3);
  ctx.restore();
}

export function drawRacer(ctx: CanvasRenderingContext2D, s: TurboRacerSim): void {
  ctx.fillStyle = "#14532d";
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  const top = 70;
  const lane = 70;
  const startX = 90;
  const endX = 900;
  ctx.fillStyle = "#374151";
  ctx.fillRect(0, top - 10, WORLD_W, lane * 4 + 20);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.setLineDash([24, 18]);
  ctx.lineWidth = 3;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, top + i * lane);
    ctx.lineTo(WORLD_W, top + i * lane);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Finish line.
  for (let r = 0; r < 14; r++) {
    for (let c = 0; c < 2; c++) {
      ctx.fillStyle = (r + c) % 2 ? "#fff" : "#111";
      ctx.fillRect(endX + 40 + c * 10, top - 10 + r * 21, 10, 21);
    }
  }
  const len = Math.max(1, s.text.length);
  const colors = ["#3b82f6", "#a855f7", "#f59e0b"];
  s.bots.forEach((b, i) => car(ctx, startX + (b.pos / len) * (endX - startX), top + lane * (i + 1) + lane / 2, colors[i], b.name, false, false));
  car(ctx, startX + (s.pos / len) * (endX - startX), top + lane / 2, "#ef4444", "YOU", true, s.skid > 0);
  // Race info.
  ctx.font = "800 22px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText(`Race ${s.race}/${RACES}`, 20, 32);
  ctx.textAlign = "right";
  ctx.font = "600 16px system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText(`Bots: ${s.bots.map((b) => `${b.wpm}`).join(" / ")} wpm`, WORLD_W - 20, 32);
  drawPassage(ctx, s.text, s.pos, { x: 30, y: 395, w: WORLD_W - 60, h: 180 }, { size: 28, lines: 3 });
  if (s.countdown > 0) {
    const n = Math.ceil(s.countdown / TICKS_PER_SECOND);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, WORLD_W, 390);
    ctx.font = "900 120px system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fde047";
    ctx.fillText(String(n), WORLD_W / 2, 210);
  } else if (s.breakLeft > 0) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, WORLD_W, 390);
    ctx.font = "900 64px system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fde047";
    const p = s.lastPlace;
    ctx.fillText(p === 1 ? "🏆 1st place!" : p === 2 ? "🥈 2nd place" : "🥉 3rd place", WORLD_W / 2, 180);
    ctx.font = "700 26px system-ui";
    ctx.fillStyle = "#fff";
    ctx.fillText(`Next: Race ${s.race + 1} — faster bots`, WORLD_W / 2, 250);
  }
}

export function drawBlitz(ctx: CanvasRenderingContext2D, s: ComboBlitzSim, now: number): void {
  const m = s.multiplier;
  const g = ctx.createLinearGradient(0, 0, WORLD_W, WORLD_H);
  g.addColorStop(0, "#1e0b33");
  g.addColorStop(1, m >= 6 ? "#831843" : m >= 3 ? "#581c87" : "#1e1b4b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // Pulsing rings.
  for (let i = 0; i < 4; i++) {
    const r = ((now / 8 + i * 120) % 480) + 20;
    ctx.strokeStyle = `rgba(244,114,182,${0.25 - r / 2200})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(WORLD_W / 2, 200, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Multiplier with progress ring to the next level.
  const toNext = m >= 8 ? 1 : (s.combo % 10) / 10;
  ctx.lineWidth = 12;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.arc(WORLD_W / 2, 190, 95, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#f472b6";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(WORLD_W / 2, 190, 95, -Math.PI / 2, -Math.PI / 2 + toNext * Math.PI * 2);
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.font = "900 92px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText(`x${m}`, WORLD_W / 2, 192);
  ctx.font = "700 18px system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText(`${s.combo} combo`, WORLD_W / 2, 310);
  // Timer bar.
  const secs = s.timeLeft / TICKS_PER_SECOND;
  const frac = Math.min(1, secs / 60);
  roundRect(ctx, 100, 30, 800, 18, 9);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fill();
  roundRect(ctx, 100, 30, Math.max(18, 800 * frac), 18, 9);
  ctx.fillStyle = secs < 10 ? "#ef4444" : "#22d3ee";
  ctx.fill();
  ctx.font = "800 22px system-ui";
  ctx.fillStyle = "#fff";
  ctx.fillText(s.started ? `${Math.ceil(secs)}s` : "Type to start!", WORLD_W / 2, 75);
  // Scrolling line of text with the caret fixed in the middle.
  ctx.font = `700 40px ${MONO}`;
  const cw = ctx.measureText("M").width;
  const cx = WORLD_W / 2;
  const y = 440;
  roundRect(ctx, 40, y - 50, WORLD_W - 80, 100, 20);
  ctx.fillStyle = "rgba(15,23,42,0.85)";
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(50, y - 50, WORLD_W - 100, 100);
  ctx.clip();
  ctx.textAlign = "left";
  const from = Math.max(0, s.pos - 14);
  for (let i = from; i < Math.min(s.text.length, s.pos + 30); i++) {
    const x = cx + (i - s.pos) * cw - cw / 2;
    if (i === s.pos) {
      ctx.fillStyle = "rgba(253,224,71,0.25)";
      ctx.fillRect(x - 2, y - 28, cw + 4, 56);
      ctx.fillStyle = NEXT;
      ctx.fillRect(x, y + 26, cw, 4);
    }
    ctx.fillStyle = i < s.pos ? "rgba(74,222,128,0.5)" : i === s.pos ? "#fff" : "#e2e8f0";
    ctx.fillText(s.text[i], x, y);
  }
  ctx.restore();
}

export function drawBomb(ctx: CanvasRenderingContext2D, s: BombSquadSim, now: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  g.addColorStop(0, "#18181b");
  g.addColorStop(1, "#3f3f46");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // Hazard stripes.
  for (let x = -40; x < WORLD_W; x += 40) {
    ctx.fillStyle = "#eab308";
    ctx.beginPath();
    ctx.moveTo(x, WORLD_H - 30);
    ctx.lineTo(x + 20, WORLD_H - 30);
    ctx.lineTo(x + 40, WORLD_H);
    ctx.lineTo(x + 20, WORLD_H);
    ctx.fill();
  }
  const frac = Math.max(0, s.fuse / s.fuseMax);
  const boom = s.t - s.lastBoom < 40;
  const defused = s.t - s.lastDefuse < 40;
  // Bomb body.
  const bx = WORLD_W / 2;
  const by = 220;
  if (!boom) {
    const rg = ctx.createRadialGradient(bx - 30, by - 30, 10, bx, by, 110);
    rg.addColorStop(0, "#52525b");
    rg.addColorStop(1, "#09090b");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(bx, by, 105, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#27272a";
    ctx.fillRect(bx - 22, by - 130, 44, 30);
    // Fuse burns down (shorter = less time).
    const fuseLen = 40 + 160 * frac;
    ctx.strokeStyle = "#a8a29e";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(bx, by - 128);
    ctx.quadraticCurveTo(bx + fuseLen * 0.4, by - 128 - fuseLen * 0.5, bx + fuseLen * 0.7, by - 128 - fuseLen * 0.3);
    ctx.stroke();
    if (s.gap === 0) {
      const sx = bx + fuseLen * 0.7;
      const sy = by - 128 - fuseLen * 0.3;
      for (let i = 0; i < 8; i++) {
        const a = deco(i + Math.floor(now / 50)) * Math.PI * 2;
        ctx.strokeStyle = i % 2 ? "#fde047" : "#f97316";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(a) * 14, sy + Math.sin(a) * 14);
        ctx.stroke();
      }
    }
    // Digital timer on the bomb.
    roundRect(ctx, bx - 70, by - 22, 140, 44, 8);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.font = `800 30px ${MONO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = frac < 0.25 ? "#ef4444" : "#22c55e";
    ctx.fillText((s.fuse / TICKS_PER_SECOND).toFixed(1), bx, by + 2);
  } else {
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = ["#fde047", "#f97316", "#ef4444"][i];
      ctx.beginPath();
      ctx.arc(bx, by, 150 - i * 40 + (s.t - s.lastBoom) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = "900 70px system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.fillText("BOOM!", bx, by);
  }
  if (defused) {
    ctx.font = "900 46px system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = "#4ade80";
    ctx.fillText("DEFUSED ✓", bx, by - 160 + 20);
  }
  // Code panel.
  if (s.gap === 0 || defused) {
    ctx.font = `800 52px ${MONO}`;
    const cw = ctx.measureText("M").width;
    const w = cw * s.code.length + 60;
    roundRect(ctx, bx - w / 2, 380, w, 100, 18);
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = frac < 0.25 ? "#ef4444" : "#eab308";
    ctx.stroke();
    const sx = bx - (cw * s.code.length) / 2;
    ctx.textAlign = "left";
    for (let i = 0; i < s.code.length; i++) {
      ctx.fillStyle = i < s.pos ? TYPED : i === s.pos ? "#fff" : "#a1a1aa";
      ctx.fillText(s.code[i], sx + i * cw, 432);
    }
    if (s.pos < s.code.length) {
      ctx.fillStyle = NEXT;
      ctx.fillRect(sx + s.pos * cw, 464, cw, 5);
    }
  }
  // Fuse bar.
  roundRect(ctx, 150, 505, 700, 14, 7);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fill();
  roundRect(ctx, 150, 505, Math.max(14, 700 * frac), 14, 7);
  ctx.fillStyle = frac < 0.25 ? "#ef4444" : frac < 0.5 ? "#f59e0b" : "#22c55e";
  ctx.fill();
}

export function drawDragon(ctx: CanvasRenderingContext2D, s: DragonKeepSim, now: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  const ph = s.phase;
  g.addColorStop(0, ph === 3 ? "#450a0a" : ph === 2 ? "#1e1b4b" : "#0f172a");
  g.addColorStop(1, ph === 3 ? "#7f1d1d" : "#334155");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // Castle wall.
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(0, 300, WORLD_W, 60);
  for (let x = 0; x < WORLD_W; x += 50) ctx.fillRect(x, 280, 28, 20);
  // Wizard (left): robe, hat, glowing staff.
  ctx.fillStyle = "#1d4ed8";
  ctx.beginPath();
  ctx.moveTo(122, 292);
  ctx.lineTo(178, 292);
  ctx.lineTo(160, 228);
  ctx.lineTo(140, 228);
  ctx.fill();
  ctx.fillStyle = "#fcd9b6";
  ctx.beginPath();
  ctx.arc(150, 214, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1e3a8a";
  ctx.beginPath();
  ctx.moveTo(128, 206);
  ctx.lineTo(172, 206);
  ctx.lineTo(156, 158);
  ctx.fill();
  ctx.fillStyle = "#fde047";
  ctx.fillRect(140, 190, 4, 4);
  ctx.fillRect(152, 178, 4, 4);
  ctx.strokeStyle = "#92400e";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(182, 292);
  ctx.lineTo(196, 196);
  ctx.stroke();
  const glow = ctx.createRadialGradient(197, 190, 2, 197, 190, 22);
  glow.addColorStop(0, "rgba(253,224,71,1)");
  glow.addColorStop(1, "rgba(253,224,71,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(197, 190, 22, 0, Math.PI * 2);
  ctx.fill();
  // Hearts above the wizard.
  for (let i = 0; i < s.maxLives; i++) {
    ctx.fillStyle = i < s.lives ? "#f43f5e" : "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.arc(122 + i * 28, 140, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  // Dragon (right), bobbing, wings flapping.
  const dy = Math.sin(now / 400) * 10;
  const flap = Math.sin(now / 180) * 18;
  const dx = 760;
  const body = ph === 3 ? "#b91c1c" : ph === 2 ? "#7c3aed" : "#15803d";
  const dark = ph === 3 ? "#7f1d1d" : ph === 2 ? "#4c1d95" : "#14532d";
  const belly = ph === 3 ? "#fca5a5" : ph === 2 ? "#ddd6fe" : "#bbf7d0";
  // Tail.
  ctx.strokeStyle = body;
  ctx.lineWidth = 22;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(dx + 60, 230 + dy);
  ctx.quadraticCurveTo(dx + 170, 260 + dy, dx + 190, 180 + dy);
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(dx + 178, 186 + dy);
  ctx.lineTo(dx + 214, 160 + dy);
  ctx.lineTo(dx + 200, 196 + dy);
  ctx.fill();
  // Wings.
  ctx.fillStyle = dark;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dx + side * 10, 180 + dy);
    ctx.lineTo(dx + side * 40, 60 + dy - flap);
    ctx.lineTo(dx + side * 150, 120 + dy - flap * 0.5);
    ctx.lineTo(dx + side * 110, 150 + dy);
    ctx.lineTo(dx + side * 70, 140 + dy);
    ctx.lineTo(dx + side * 40, 175 + dy);
    ctx.fill();
  }
  // Body and belly.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(dx, 215 + dy, 88, 58, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.ellipse(dx - 20, 232 + dy, 46, 32, 0, 0, Math.PI * 2);
  ctx.fill();
  // Back spikes.
  ctx.fillStyle = dark;
  for (let i = 0; i < 5; i++) {
    const sx = dx - 50 + i * 26;
    ctx.beginPath();
    ctx.moveTo(sx, 166 + dy);
    ctx.lineTo(sx + 10, 146 + dy);
    ctx.lineTo(sx + 20, 166 + dy);
    ctx.fill();
  }
  // Neck and head.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(dx - 60, 190 + dy);
  ctx.quadraticCurveTo(dx - 100, 150 + dy, dx - 110, 170 + dy);
  ctx.lineTo(dx - 70, 230 + dy);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(dx - 125, 165 + dy, 48, 30, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(dx - 110, 140 + dy);
  ctx.lineTo(dx - 92, 108 + dy);
  ctx.lineTo(dx - 96, 145 + dy);
  ctx.moveTo(dx - 130, 138 + dy);
  ctx.lineTo(dx - 120, 104 + dy);
  ctx.lineTo(dx - 116, 140 + dy);
  ctx.fill();
  ctx.fillStyle = ph === 3 ? "#fde047" : "#fef08a";
  ctx.beginPath();
  ctx.ellipse(dx - 132, 156 + dy, 8, 5, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.ellipse(dx - 130, 156 + dy, 2.5, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (s.spell) {
    // Mouth glows while a spell is being cast.
    const cf = Math.min(1, s.cast / s.castMax);
    const mg = ctx.createRadialGradient(dx - 170, 178 + dy, 2, dx - 170, 178 + dy, 16 + cf * 26);
    mg.addColorStop(0, "rgba(253,224,71,0.95)");
    mg.addColorStop(1, "rgba(249,115,22,0)");
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(dx - 170, 178 + dy, 16 + cf * 26, 0, Math.PI * 2);
    ctx.fill();
  }
  // Boss HP.
  const hpFrac = s.hp / DRAGON_HP;
  roundRect(ctx, 560, 22, 400, 26, 13);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fill();
  roundRect(ctx, 560, 22, Math.max(26, 400 * hpFrac), 26, 13);
  ctx.fillStyle = hpFrac < 0.34 ? "#ef4444" : hpFrac < 0.67 ? "#a855f7" : "#22c55e";
  ctx.fill();
  ctx.font = "800 16px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText(`DRAGON ${s.hp} / ${DRAGON_HP}  ·  Phase ${ph}`, 760, 36);
  // Strike / burn effects.
  if (s.t - s.lastStrike < 25) {
    ctx.strokeStyle = "#fde047";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(195, 195);
    for (let i = 1; i <= 6; i++) ctx.lineTo(195 + i * 85, 195 - (i % 2 ? 30 : -10));
    ctx.stroke();
  }
  if (s.t - s.lastBurn < 35) {
    const fg = ctx.createLinearGradient(dx - 150, 0, 150, 0);
    fg.addColorStop(0, "rgba(253,224,71,0.9)");
    fg.addColorStop(1, "rgba(239,68,68,0.6)");
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(dx - 150, 170 + dy);
    ctx.lineTo(150, 180);
    ctx.lineTo(150, 270);
    ctx.fill();
  }
  // Spell + cast bar.
  if (s.spell) {
    ctx.font = "700 16px system-ui";
    ctx.textAlign = "left";
    ctx.fillStyle = "#fca5a5";
    ctx.fillText("🔥 Dragon is casting — type the spell to block it!", 40, 392);
    drawPassage(ctx, s.spell, s.pos, { x: 30, y: 410, w: WORLD_W - 60, h: 130 }, { size: 28, lines: 2 });
    const cf = Math.min(1, s.cast / s.castMax);
    roundRect(ctx, 30, 552, WORLD_W - 60, 18, 9);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fill();
    roundRect(ctx, 30, 552, Math.max(18, (WORLD_W - 60) * cf), 18, 9);
    ctx.fillStyle = cf > 0.75 ? "#ef4444" : "#f97316";
    ctx.fill();
  } else if (!s.over) {
    ctx.font = "800 28px system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText("The dragon is gathering power…", WORLD_W / 2, 470);
  }
}

/** Renderers: Meteor Shield, Bubble Burst, Runner Rush, Lava Climb. World space 1000 × 600. */
import { WORLD_H, WORLD_W } from "@/lib/typing-game/arcade/core";
import { GROUND_Y, type MeteorShieldSim } from "@/lib/typing-game/arcade/games/meteor-shield";
import { TOP_Y, type BubbleBurstSim } from "@/lib/typing-game/arcade/games/bubble-burst";
import { RUNNER_X, type RunnerRushSim } from "@/lib/typing-game/arcade/games/runner-rush";
import { LEVEL_HEIGHT, type LavaClimbSim } from "@/lib/typing-game/arcade/games/lava-climb";
import { deco, drawWordPill, MONO, NEXT, roundRect, TYPED } from "./draw-utils";

export function drawMeteor(ctx: CanvasRenderingContext2D, s: MeteorShieldSim, now: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  g.addColorStop(0, "#060818");
  g.addColorStop(0.6, "#1e1150");
  g.addColorStop(1, "#4c1d95");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  for (let i = 0; i < 90; i++) {
    const tw = 0.5 + 0.5 * Math.sin(now / 500 + i);
    ctx.fillStyle = `rgba(255,255,255,${0.25 + tw * 0.6})`;
    ctx.fillRect(deco(i) * WORLD_W, deco(i + 300) * GROUND_Y * 0.85, 2, 2);
  }
  // City skyline.
  for (let i = 0; i < 26; i++) {
    const w = 30 + deco(i + 50) * 30;
    const h = 30 + deco(i + 80) * 70;
    const x = i * 40 - 10;
    ctx.fillStyle = "#170b3b";
    ctx.fillRect(x, GROUND_Y - h, w, h + 5);
    ctx.fillStyle = "rgba(253,224,71,0.55)";
    for (let wy = GROUND_Y - h + 8; wy < GROUND_Y - 6; wy += 14) {
      for (let wx = x + 6; wx < x + w - 6; wx += 10) if (deco(wx * 7 + wy) > 0.55) ctx.fillRect(wx, wy, 4, 6);
    }
  }
  // Shield dome (one band per life).
  for (let i = 0; i < s.maxLives; i++) {
    const alive = i < s.lives;
    ctx.beginPath();
    ctx.ellipse(WORLD_W / 2, GROUND_Y + 10, WORLD_W * 0.56 - i * 14, 70 - i * 6, 0, Math.PI, 0);
    ctx.strokeStyle = alive ? `rgba(56,189,248,${0.55 - i * 0.12})` : "rgba(255,255,255,0.04)";
    ctx.lineWidth = alive ? 3 : 1;
    ctx.stroke();
  }
  ctx.fillStyle = "#0b0620";
  ctx.fillRect(0, GROUND_Y + 5, WORLD_W, WORLD_H);
  // Cannon.
  const cx = WORLD_W / 2;
  const cy = GROUND_Y - 6;
  const target = s.meteors.find((m) => m.id === s.locked);
  if (target) {
    ctx.strokeStyle = "rgba(253,224,71,0.8)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.arc(cx, cy + 6, 22, Math.PI, 0);
  ctx.fill();
  // Meteors.
  for (const m of s.meteors) {
    const tail = ctx.createLinearGradient(m.x, m.y - 80, m.x, m.y);
    tail.addColorStop(0, "rgba(251,146,60,0)");
    tail.addColorStop(1, "rgba(251,146,60,0.75)");
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.moveTo(m.x - m.size * 0.7, m.y);
    ctx.lineTo(m.x + m.size * 0.7, m.y);
    ctx.lineTo(m.x, m.y - 90);
    ctx.fill();
    const rg = ctx.createRadialGradient(m.x - 5, m.y - 5, 2, m.x, m.y, m.size);
    rg.addColorStop(0, "#fef3c7");
    rg.addColorStop(0.4, "#f97316");
    rg.addColorStop(1, "#7c2d12");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
    ctx.fill();
    drawWordPill(ctx, m.word, m.typed, m.x, m.y + m.size + 22, { active: m.id === s.locked });
  }
}

export function drawBubbles(ctx: CanvasRenderingContext2D, s: BubbleBurstSim, now: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  g.addColorStop(0, "#082f49");
  g.addColorStop(0.5, "#0e7490");
  g.addColorStop(1, "#155e75");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // Light rays and drifting specks.
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let i = 0; i < 5; i++) {
    const x = 120 + i * 200 + Math.sin(now / 2000 + i) * 30;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 60, 0);
    ctx.lineTo(x - 40, WORLD_H);
    ctx.lineTo(x - 100, WORLD_H);
    ctx.fill();
  }
  for (let i = 0; i < 40; i++) {
    const y = WORLD_H - ((now / 30 + deco(i) * 2000) % (WORLD_H + 40));
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(deco(i + 9) * WORLD_W, y, 2 + deco(i + 4) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Danger line.
  ctx.strokeStyle = "rgba(244,63,94,0.7)";
  ctx.setLineDash([12, 8]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, TOP_Y);
  ctx.lineTo(WORLD_W, TOP_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const b of s.bubbles) {
    const x = b.x + Math.sin(now / 400 + b.id) * 6;
    const rg = ctx.createRadialGradient(x - b.r * 0.35, b.y - b.r * 0.35, 2, x, b.y, b.r);
    if (b.kind === "gold") {
      rg.addColorStop(0, "rgba(254,240,138,0.95)");
      rg.addColorStop(1, "rgba(202,138,4,0.75)");
    } else if (b.kind === "bomb") {
      rg.addColorStop(0, "rgba(254,202,202,0.95)");
      rg.addColorStop(1, "rgba(185,28,28,0.85)");
    } else {
      rg.addColorStop(0, "rgba(255,255,255,0.55)");
      rg.addColorStop(1, "rgba(34,211,238,0.25)");
    }
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = b.id === s.locked ? NEXT : "rgba(255,255,255,0.6)";
    ctx.lineWidth = b.id === s.locked ? 4 : 2;
    ctx.stroke();
    ctx.font = `800 ${b.word.length === 1 ? 30 : 20}px ${MONO}`;
    const cw = ctx.measureText("M").width;
    const sx = x - (cw * b.word.length) / 2;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (let i = 0; i < b.word.length; i++) {
      ctx.fillStyle = i < b.typed ? TYPED : "#0f172a";
      ctx.fillText(b.word[i], sx + i * cw, b.y + 1);
    }
    if (b.kind === "bomb") {
      ctx.font = "700 12px system-ui";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.fillText("BOMB", x, b.y - b.r + 12);
    }
  }
}

export function drawRunner(ctx: CanvasRenderingContext2D, s: RunnerRushSim, now: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  g.addColorStop(0, "#fb923c");
  g.addColorStop(0.55, "#fdba74");
  g.addColorStop(1, "#fef3c7");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.fillStyle = "rgba(254,243,199,0.9)";
  ctx.beginPath();
  ctx.arc(780, 150, 60, 0, Math.PI * 2);
  ctx.fill();
  const ground = 470;
  // Parallax hills.
  const layers: [number, string, number][] = [
    [0.15, "#c2410c", 130],
    [0.35, "#9a3412", 80],
  ];
  for (const [k, color, amp] of layers) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, ground);
    for (let x = 0; x <= WORLD_W; x += 20) {
      const wx = x + s.distance * k;
      ctx.lineTo(x, ground - amp * 0.5 - Math.sin(wx / 140) * amp * 0.3 - Math.sin(wx / 53) * amp * 0.12);
    }
    ctx.lineTo(WORLD_W, ground);
    ctx.fill();
  }
  ctx.fillStyle = "#422006";
  ctx.fillRect(0, ground, WORLD_W, WORLD_H - ground);
  ctx.fillStyle = "#713f12";
  for (let x = -(s.distance % 60); x < WORLD_W; x += 60) ctx.fillRect(x, ground + 8, 30, 6);
  // Obstacles.
  const active = s.active;
  for (const o of s.obstacles) {
    if (o.crashed) continue;
    const colors = ["#78350f", "#57534e", "#166534"];
    ctx.fillStyle = colors[o.kind];
    if (o.kind === 0) {
      ctx.fillRect(o.x - 26, ground - 52, 52, 52);
      ctx.strokeStyle = "#a16207";
      ctx.lineWidth = 3;
      ctx.strokeRect(o.x - 26, ground - 52, 52, 52);
    } else if (o.kind === 1) {
      ctx.beginPath();
      ctx.ellipse(o.x, ground - 22, 34, 26, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(o.x - 34, ground - 22, 68, 22);
    } else {
      ctx.fillRect(o.x - 9, ground - 70, 18, 70);
      ctx.fillRect(o.x - 30, ground - 50, 21, 10);
      ctx.fillRect(o.x - 30, ground - 66, 10, 20);
      ctx.fillRect(o.x + 9, ground - 40, 20, 10);
      ctx.fillRect(o.x + 19, ground - 56, 10, 20);
    }
    if (!o.cleared && o.x < WORLD_W + 60) drawWordPill(ctx, o.word, o.typed, o.x, ground - 110, { active: o === active, size: 24 });
    if (o.cleared) {
      ctx.font = "700 18px system-ui";
      ctx.textAlign = "center";
      ctx.fillStyle = "#15803d";
      ctx.fillText("✓", o.x, ground - 110);
    }
  }
  // Runner (jump arc after a cleared obstacle).
  const since = s.t - s.lastJump;
  const jumpT = since >= 0 && since < 40 ? since / 40 : -1;
  const jy = jumpT >= 0 ? -Math.sin(jumpT * Math.PI) * 110 : 0;
  const hurt = s.t - s.lastCrash < 30;
  const x = RUNNER_X;
  const y = ground + jy;
  const step = Math.sin(s.distance / 14);
  ctx.strokeStyle = hurt ? "#ef4444" : "#1e293b";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y - 40);
  ctx.lineTo(x + (jumpT >= 0 ? 12 : step * 14), y);
  ctx.moveTo(x, y - 40);
  ctx.lineTo(x - (jumpT >= 0 ? 10 : step * 14), y);
  ctx.moveTo(x, y - 40);
  ctx.lineTo(x + 4, y - 78);
  ctx.moveTo(x + 2, y - 70);
  ctx.lineTo(x + 18 - step * 10, y - 52);
  ctx.moveTo(x + 2, y - 70);
  ctx.lineTo(x - 14 + step * 10, y - 54);
  ctx.stroke();
  ctx.fillStyle = hurt ? "#ef4444" : "#1e293b";
  ctx.beginPath();
  ctx.arc(x + 6, y - 92, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f97316";
  ctx.fillRect(x - 6, y - 104, 26, 6);
  ctx.lineCap = "butt";
  // Speed lines.
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 2;
  for (let i = 0; i < Math.min(8, s.level + 1); i++) {
    const ly = 120 + deco(i) * 300;
    const lx = WORLD_W - ((now / 2 + deco(i + 20) * 1000) % (WORLD_W + 200));
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + 60, ly);
    ctx.stroke();
  }
}

export function drawLava(ctx: CanvasRenderingContext2D, s: LavaClimbSim, now: number): void {
  // Camera: the climber sits 40% from the top.
  const camTop = s.height + WORLD_H * 0.4;
  const toY = (h: number) => camTop - h;
  const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  const lv = Math.min(1, s.level / 12);
  g.addColorStop(0, `rgb(${30 + lv * 60},${20},${40 - lv * 20})`);
  g.addColorStop(1, `rgb(${120 + lv * 80},${40},${20})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // Rock walls with level marks.
  ctx.fillStyle = "#1c1917";
  ctx.fillRect(0, 0, 160, WORLD_H);
  ctx.fillRect(WORLD_W - 160, 0, 160, WORLD_H);
  ctx.font = "700 14px system-ui";
  ctx.textAlign = "left";
  for (let lvl = 1; lvl < 200; lvl++) {
    const y = toY(lvl * LEVEL_HEIGHT);
    if (y < -20) break;
    if (y > WORLD_H + 20) continue;
    ctx.fillStyle = "rgba(253,224,71,0.7)";
    ctx.fillRect(160, y, 40, 2);
    ctx.fillText(`Level ${lvl + 1}`, 20, y + 5);
  }
  // Tower blocks, newest on top.
  let top = s.height;
  for (let i = s.blocks.length - 1; i >= 0; i--) {
    const b = s.blocks[i];
    const y = toY(top);
    if (y > WORLD_H) break;
    const hue = (i * 37) % 360;
    ctx.fillStyle = `hsl(${hue},55%,48%)`;
    roundRect(ctx, 400, y, 200, b.h - 2, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `600 ${Math.min(16, b.h - 4)}px ${MONO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (b.h > 14) ctx.fillText(b.word, 500, y + b.h / 2);
    top -= b.h;
  }
  if (toY(top) < WORLD_H) {
    ctx.fillStyle = "#44403c";
    ctx.fillRect(380, toY(top), 240, WORLD_H);
  }
  // Climber.
  const cy = toY(s.height);
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(500, cy - 46, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(492, cy - 34, 16, 34);
  ctx.fillStyle = "#facc15";
  ctx.fillRect(486, cy - 60, 28, 6);
  // Lava.
  const ly = toY(s.lava);
  if (ly < WORLD_H) {
    const lg = ctx.createLinearGradient(0, ly, 0, WORLD_H);
    lg.addColorStop(0, "#fde047");
    lg.addColorStop(0.15, "#f97316");
    lg.addColorStop(1, "#7f1d1d");
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(0, WORLD_H);
    for (let x = 0; x <= WORLD_W; x += 20) ctx.lineTo(x, ly + Math.sin(x / 40 + now / 200) * 6);
    ctx.lineTo(WORLD_W, WORLD_H);
    ctx.fill();
  }
  // Word panel.
  roundRect(ctx, 230, 20, 540, 110, 18);
  ctx.fillStyle = "rgba(15,23,42,0.88)";
  ctx.fill();
  ctx.font = `800 40px ${MONO}`;
  const w = s.current;
  const cw = ctx.measureText("M").width;
  const sx = 500 - (cw * w.length) / 2;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (let i = 0; i < w.length; i++) {
    ctx.fillStyle = i < s.typed ? TYPED : "#fff";
    ctx.fillText(w[i], sx + i * cw, 62);
  }
  if (s.typed < w.length) {
    ctx.fillStyle = NEXT;
    ctx.fillRect(sx + s.typed * cw, 86, cw, 4);
  }
  ctx.font = `600 18px ${MONO}`;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(226,232,240,0.6)";
  ctx.fillText(s.queue.slice(1, 4).join("   "), 500, 110);
  // Distance to lava.
  const gap = Math.max(0, Math.round((s.height - s.lava) / 10));
  ctx.font = "800 18px system-ui";
  ctx.textAlign = "right";
  ctx.fillStyle = gap < 8 ? "#ef4444" : "#fde68a";
  ctx.fillText(`Lava ${gap} m below`, WORLD_W - 20, WORLD_H - 20);
}

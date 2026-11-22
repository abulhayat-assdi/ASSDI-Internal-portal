/** Visual-only effects (particles, floating text, screen shake, flash). Never part of the simulation. */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
  size: number;
}

export class Fx {
  particles: Particle[] = [];
  floaters: Floater[] = [];
  shake = 0;
  flash = 0;
  flashColor = "255,255,255";
  banner: { text: string; life: number } | null = null;

  burst(x: number, y: number, colors: string[], n = 18, speed = 5): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random());
      const max = 0.5 + Math.random() * 0.5;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: max, max, color: colors[i % colors.length], size: 2 + Math.random() * 4 });
    }
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  }

  float(x: number, y: number, text: string, color = "#fde047", size = 26): void {
    this.floaters.push({ x, y, text, life: 1, color, size });
  }

  showBanner(text: string): void {
    this.banner = { text, life: 1.6 };
  }

  hurt(): void {
    this.shake = 14;
    this.flash = 0.45;
    this.flashColor = "239,68,68";
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.vy += 0.15 * dt * 60;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floaters) {
      f.y -= 40 * dt;
      f.life -= dt * 0.9;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    this.shake = Math.max(0, this.shake - dt * 40);
    this.flash = Math.max(0, this.flash - dt * 1.5);
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }
  }

  /** Draws particles and floaters in world coordinates. */
  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.min(1, f.life * 1.5);
      ctx.font = `800 ${f.size}px system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  /** Screen-space overlays: flash and banner. */
  drawOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(${this.flashColor},${this.flash})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (this.banner) {
      const a = Math.min(1, this.banner.life * 2);
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, h / 2 - 50, w, 100);
      ctx.font = "900 54px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.fillText(this.banner.text, w / 2, h / 2 + 2);
      ctx.globalAlpha = 1;
    }
  }
}

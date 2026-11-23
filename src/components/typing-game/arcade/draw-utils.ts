/** Canvas helpers shared by the game renderers (world space is 1000 × 600). */

export const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
export const TYPED = "#4ade80";
export const NEXT = "#fde047";

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * A word on a pill, typed letters green. `active` = the word being typed
 * (bright border, next letter underlined).
 */
export function drawWordPill(
  ctx: CanvasRenderingContext2D,
  word: string,
  typed: number,
  cx: number,
  cy: number,
  opts: { size?: number; active?: boolean; bg?: string } = {},
): void {
  const size = opts.size ?? 22;
  ctx.font = `700 ${size}px ${MONO}`;
  const cw = ctx.measureText("M").width;
  const w = cw * word.length + 18;
  const h = size + 12;
  const x = cx - w / 2;
  const y = cy - h / 2;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = opts.bg ?? (opts.active ? "rgba(15,23,42,0.92)" : "rgba(15,23,42,0.72)");
  ctx.fill();
  if (opts.active) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = NEXT;
    ctx.stroke();
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (let i = 0; i < word.length; i++) {
    ctx.fillStyle = i < typed ? TYPED : "#f8fafc";
    ctx.fillText(word[i], x + 9 + i * cw, cy + 1);
  }
  if (opts.active && typed < word.length) {
    ctx.fillStyle = NEXT;
    ctx.fillRect(x + 9 + typed * cw, cy + size / 2 + 1, cw, 3);
  }
}

/** Wraps a passage into lines of whole words that fit `maxW`. Returns start offsets. */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): { start: number; text: string }[] {
  const lines: { start: number; text: string }[] = [];
  const cw = ctx.measureText("M").width;
  const perLine = Math.max(10, Math.floor(maxW / cw));
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + perLine);
    if (end < text.length) {
      const sp = text.lastIndexOf(" ", end);
      if (sp > start) end = sp + 1;
    }
    lines.push({ start, text: text.slice(start, end) });
    start = end;
  }
  return lines;
}

/**
 * A passage panel (sentence games): the line with the caret and the next
 * one(s); typed text green, the next character highlighted.
 */
export function drawPassage(
  ctx: CanvasRenderingContext2D,
  text: string,
  pos: number,
  box: { x: number; y: number; w: number; h: number },
  opts: { size?: number; lines?: number; dim?: boolean } = {},
): void {
  const size = opts.size ?? 26;
  roundRect(ctx, box.x, box.y, box.w, box.h, 16);
  ctx.fillStyle = "rgba(15,23,42,0.88)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.stroke();
  ctx.font = `600 ${size}px ${MONO}`;
  const cw = ctx.measureText("M").width;
  const lines = wrapLines(ctx, text, box.w - 40);
  let cur = lines.findIndex((l) => pos < l.start + l.text.length);
  if (cur < 0) cur = lines.length - 1;
  const show = opts.lines ?? 2;
  const lh = size * 1.55;
  const top = box.y + box.h / 2 - ((show - 1) * lh) / 2;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (let li = 0; li < show && cur + li < lines.length; li++) {
    const l = lines[cur + li];
    const y = top + li * lh;
    for (let i = 0; i < l.text.length; i++) {
      const at = l.start + i;
      const x = box.x + 20 + i * cw;
      if (at === pos) {
        ctx.fillStyle = "rgba(253,224,71,0.25)";
        ctx.fillRect(x - 1, y - size * 0.7, cw + 2, size * 1.4);
        ctx.fillStyle = NEXT;
        ctx.fillRect(x, y + size * 0.62, cw, 3);
      }
      ctx.fillStyle = at < pos ? TYPED : at === pos ? "#fff" : opts.dim ? "rgba(248,250,252,0.55)" : "#e2e8f0";
      ctx.fillText(l.text[i], x, y);
    }
  }
}

export function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, full: boolean): void {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
  ctx.fillStyle = full ? "#f43f5e" : "rgba(255,255,255,0.18)";
  ctx.fill();
}

/** Deterministic pseudo-random for decoration (stars etc.), stable per index. */
export function deco(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

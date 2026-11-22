"use client";

import { FINGERS, KEYBOARD_ROWS, keyFor, type FingerId } from "@/lib/typing-game/curriculum/keyboard";

const UNIT = 44; // px per key unit at full size (the SVG scales down)
const GAP = 4;
const ROW_H = 44;

export const KEYBOARD_VIEWBOX = { width: 15 * UNIT, height: KEYBOARD_ROWS.length * (ROW_H + GAP) };

/** Centre of each key in the keyboard SVG's coordinates (for overlays). */
export function keyCenters(): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  KEYBOARD_ROWS.forEach((row, r) => {
    const rowWidth = row.reduce((n, cap) => n + cap.width * UNIT, 0);
    let x = r === KEYBOARD_ROWS.length - 1 ? (KEYBOARD_VIEWBOX.width - rowWidth) / 2 : 0;
    for (const cap of row) {
      out.set(cap.key, { x: x + (cap.width * UNIT - GAP) / 2, y: r * (ROW_H + GAP) + ROW_H / 2 });
      x += cap.width * UNIT;
    }
  });
  return out;
}

interface Props {
  /** The character to type next ("" for none). */
  next: string;
  /** Flash this key red (the last wrong press). */
  wrong?: string | null;
  /** Colour every key by its finger zone. */
  showZones?: boolean;
  className?: string;
}

/**
 * QWERTY keyboard drawn as one SVG: finger-zone tints, F/J bumps, the next
 * key lit (with the matching Shift when needed).
 */
export function OnScreenKeyboard({ next, wrong, showZones = true, className }: Props) {
  const target = next ? keyFor(next) : null;
  const shiftKey = target?.shifted
    ? FINGERS[target.cap.finger].hand === "left"
      ? "ShiftRight"
      : "ShiftLeft"
    : null;
  const wrongCap = wrong ? keyFor(wrong)?.cap.key : null;

  const width = 15 * UNIT;
  const height = KEYBOARD_ROWS.length * (ROW_H + GAP);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className ?? "w-full"}
      role="img"
      aria-label={next ? `Keyboard, next key ${next === " " ? "Space" : next}` : "Keyboard"}
    >
      {KEYBOARD_ROWS.map((row, r) => {
        const rowWidth = row.reduce((n, cap) => n + cap.width * UNIT, 0);
        let x = r === KEYBOARD_ROWS.length - 1 ? (width - rowWidth) / 2 : 0;
        const y = r * (ROW_H + GAP);
        return row.map((cap) => {
          const w = cap.width * UNIT - GAP;
          const keyX = x;
          x += cap.width * UNIT;
          const isTarget = target?.cap.key === cap.key || shiftKey === cap.key;
          const isWrong = wrongCap === cap.key;
          const zone = FINGERS[cap.finger as FingerId].color;
          const fill = isWrong ? "#ef4444" : isTarget ? zone : showZones ? `${zone}33` : "var(--tap-surface-solid)";
          const ink = isTarget || isWrong ? "#fff" : "var(--tap-ink)";
          return (
            <g key={`${r}-${cap.key}`}>
              <rect
                x={keyX}
                y={y}
                width={w}
                height={ROW_H}
                rx={8}
                fill={fill}
                stroke={isTarget ? zone : "var(--tap-border-strong)"}
                strokeWidth={isTarget ? 3 : 1}
              >
                {isTarget ? (
                  <animate attributeName="opacity" values="1;0.7;1" dur="1.2s" repeatCount="indefinite" />
                ) : null}
              </rect>
              <text
                x={keyX + w / 2}
                y={y + ROW_H / 2 + 5}
                textAnchor="middle"
                fontSize={cap.label.length > 2 ? 11 : 15}
                fontWeight={600}
                fill={ink}
                style={{ fontFamily: "ui-monospace, monospace" }}
              >
                {cap.label}
              </text>
              {cap.bump ? (
                <rect x={keyX + w / 2 - 7} y={y + ROW_H - 9} width={14} height={3} rx={1.5} fill={ink} opacity={0.7} />
              ) : null}
            </g>
          );
        });
      })}
    </svg>
  );
}

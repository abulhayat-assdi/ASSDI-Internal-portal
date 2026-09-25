"use client";

import type { LucideIcon } from "lucide-react";
import type { MechanicOutcome } from "@/lib/typing-game/mechanics";

/**
 * Shared, purely presentational building blocks for the mechanic scenes.
 *
 * Nothing in this file decides anything about the game. Every value it draws
 * is handed in, and every value handed in came from a MechanicOutcome that
 * the server replays with the same rules. The helpers below only *read* an
 * outcome (its counters and its event log) and reshape it for pixels.
 */

export type UnitStatus = "pending" | "cleared" | "missed";

/** Per-unit verdicts, read straight off the outcome's event log. */
export function unitStatuses(outcome: MechanicOutcome): UnitStatus[] {
  const statuses: UnitStatus[] = Array.from(
    { length: Math.max(0, outcome.units.total) },
    () => "pending" as UnitStatus,
  );
  for (const event of outcome.events) {
    const index = event.unit;
    if (index === undefined || index < 0 || index >= statuses.length) continue;
    if (event.kind === "unit-cleared") statuses[index] = "cleared";
    else if (event.kind === "unit-missed" || event.kind === "chain-broken") {
      statuses[index] = "missed";
    }
  }
  return statuses;
}

/** The numbers every scene wants, derived only from the outcome. */
export interface SceneModel {
  total: number;
  cleared: number;
  missed: number;
  /** Units the rules have already judged — also the index of the live unit. */
  resolved: number;
  /** Run progress, 0-100. */
  pct: number;
  livesMax: number;
  livesLeft: number;
  /** A mechanic rule ended the run (not merely "not finished yet"). */
  failed: boolean;
  statuses: UnitStatus[];
}

export function sceneModel(outcome: MechanicOutcome): SceneModel {
  const total = Math.max(0, outcome.units.total);
  const cleared = outcome.units.cleared;
  const missed = outcome.units.missed;
  const resolved = Math.min(total, cleared + missed);
  return {
    total,
    cleared,
    missed,
    resolved,
    pct: total > 0 ? Math.min(100, (resolved / total) * 100) : 0,
    livesMax: Math.max(0, outcome.lives.max),
    livesLeft: Math.max(0, outcome.lives.max - outcome.lives.lost),
    failed:
      outcome.endReason !== "completed" && outcome.endReason !== "incomplete",
    statuses: unitStatuses(outcome),
  };
}

/** How many units in a row were cleared right before the live one. */
export function trailingChain(statuses: UnitStatus[], resolved: number): number {
  let chain = 0;
  for (let i = resolved - 1; i >= 0; i--) {
    if (statuses[i] !== "cleared") break;
    chain += 1;
  }
  return chain;
}

export function clampPct(value: number, max: number): number {
  if (!(max > 0)) return 0;
  const pct = (value / max) * 100;
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, pct));
}

/** The outer frame every scene shares: fixed height, never pushes the text. */
export function SceneShell({
  label,
  failed,
  danger,
  art,
  stats,
  note,
}: {
  label: string;
  failed: boolean;
  danger?: boolean;
  /** The decorative play area. Always aria-hidden — `stats` carries meaning. */
  art: React.ReactNode;
  stats: React.ReactNode;
  note?: string | null;
}) {
  const className = [
    "tap-scene",
    danger ? "tap-scene-danger" : "",
    failed ? "tap-scene-failed" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <section className={className} aria-label={label}>
      <div className="tap-scene-art" aria-hidden="true">
        {art}
      </div>
      <div className="tap-scene-stats">{stats}</div>
      {note ? <p className="tap-scene-note">{note}</p> : null}
    </section>
  );
}

/** A labelled number. Plain text, so it needs no ARIA of its own. */
export function SceneStat({
  label,
  value,
  tone = "plain",
  Icon,
}: {
  label: string;
  value: string;
  tone?: "plain" | "ok" | "bad";
  Icon?: LucideIcon;
}) {
  return (
    <span className={`tap-scene-stat tap-scene-stat-${tone}`}>
      {Icon ? <Icon size={14} aria-hidden="true" /> : null}
      <span className="tap-scene-stat-label">{label}</span>
      <span className="tap-scene-stat-value">{value}</span>
    </span>
  );
}

/** Lives / shield charges as icons, with one text equivalent for the set. */
export function ScenePips({
  label,
  left,
  max,
  Icon,
  tone = "life",
}: {
  label: string;
  left: number;
  max: number;
  Icon: LucideIcon;
  tone?: "life" | "shield";
}) {
  const safeMax = Math.max(0, Math.min(12, Math.round(max)));
  const safeLeft = Math.max(0, Math.min(safeMax, Math.round(left)));
  return (
    <span
      className={`tap-scene-pips tap-scene-pips-${tone}`}
      role="img"
      aria-label={`${label}: ${String(safeLeft)}/${String(safeMax)}`}
    >
      <span className="tap-scene-stat-label" aria-hidden="true">
        {label}
      </span>
      {Array.from({ length: safeMax }, (_, i) => (
        <Icon
          key={i}
          size={16}
          aria-hidden="true"
          className={
            i < safeLeft ? "tap-scene-pip tap-scene-pip-on" : "tap-scene-pip"
          }
        />
      ))}
    </span>
  );
}

/** A labelled bar. Real progressbar semantics, per the existing HUD. */
export function SceneBar({
  label,
  value,
  max,
  tone = "accent",
  size = "sm",
}: {
  label: string;
  value: number;
  max: number;
  tone?: "accent" | "danger" | "success";
  size?: "sm" | "lg";
}) {
  const pct = clampPct(value, max);
  return (
    <span className={`tap-scene-bar tap-scene-bar-${size}`}>
      <span className="tap-scene-stat-label">{label}</span>
      <span
        className="tap-scene-bar-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.round(max)}
        aria-valuenow={Math.round(value)}
      >
        <span
          className={`tap-scene-bar-fill tap-scene-bar-${tone}`}
          style={{ width: `${String(pct)}%` }}
        />
      </span>
      <span className="tap-scene-bar-value">
        {Math.round(value)}/{Math.round(max)}
      </span>
    </span>
  );
}

/** Short unit text for a token — long words would blow the layout up. */
export function tokenText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 9) return trimmed;
  return `${trimmed.slice(0, 8)}…`;
}

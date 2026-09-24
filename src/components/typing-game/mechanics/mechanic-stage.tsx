"use client";

import { Heart, Shield, Swords, Flag, Waves, Crosshair, Link2, Wind, Gauge } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MechanicOutcome, MechanicParams, MechanicUnit } from "@/lib/typing-game/mechanics";

/**
 * The mechanic HUD: what the player is actually playing against.
 *
 * Every number here comes from the live MechanicOutcome, which is produced by
 * the same pure rules the server replays on submit. Nothing is invented for
 * display, so the bar a player watches empty is the bar the server agrees
 * emptied.
 */
export interface MechanicStageStrings {
  lives: string;
  shield: string;
  waves: string;
  checkpoints: string;
  targets: string;
  chain: string;
  bossHp: string;
  distance: string;
  pursuer: string;
  caught: string;
  outOfLives: string;
  shieldBroken: string;
  checkpointMissed: string;
  bossSurvived: string;
}

function Pips({
  max,
  used,
  Icon,
  label,
}: {
  max: number;
  used: number;
  Icon: LucideIcon;
  label: string;
}) {
  const left = Math.max(0, max - used);
  return (
    <div className="tap-mech-meta">
      <span>{label}</span>
      <span className="tap-mech-dots" role="img" aria-label={`${String(left)}/${String(max)}`}>
        {Array.from({ length: max }, (_, i) => (
          <Icon
            key={i}
            size={15}
            aria-hidden="true"
            className={i < left ? "tap-mech-pip tap-mech-pip-on" : "tap-mech-pip"}
          />
        ))}
      </span>
    </div>
  );
}

function Meter({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: "danger" | "accent";
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="tap-mech-meter">
      <span className="tap-mech-meter-label">{label}</span>
      <span
        className="tap-mech-meter-track"
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={Math.round(max)}
        aria-label={label}
      >
        <span
          className={tone === "danger" ? "tap-mech-meter-fill tap-mech-meter-danger" : "tap-mech-meter-fill"}
          style={{ width: `${String(pct)}%` }}
        />
      </span>
      <span className="tap-mech-meter-value">
        {Math.round(value)}/{Math.round(max)}
      </span>
    </div>
  );
}

/** Short, plain explanation of why a run ended. */
export function mechanicEndMessage(
  outcome: MechanicOutcome,
  s: MechanicStageStrings,
): string | null {
  switch (outcome.endReason) {
    case "out-of-lives":
      return s.outOfLives;
    case "shield-broken":
      return s.shieldBroken;
    case "caught":
      return s.caught;
    case "checkpoint-missed":
      return s.checkpointMissed;
    case "boss-survived":
      return s.bossSurvived;
    default:
      return null;
  }
}

export function MechanicStage({
  outcome,
  params,
  units,
  strings: s,
}: {
  outcome: MechanicOutcome;
  params: MechanicParams;
  units: MechanicUnit[];
  strings: MechanicStageStrings;
}) {
  const d = outcome.detail;

  switch (outcome.mechanic) {
    case "defense-shield":
      return (
        <div className="tap-mech-stage">
          <Pips max={outcome.lives.max} used={outcome.lives.lost} Icon={Shield} label={s.shield} />
        </div>
      );

    case "boss-phased": {
      const max = d.bossHpMax ?? units.length;
      const left = d.bossHpLeft ?? max;
      return (
        <div className="tap-mech-stage">
          <Meter label={s.bossHp} value={left} max={max} tone="danger" />
          <div className="tap-mech-meta">
            <Swords size={15} aria-hidden="true" />
            <span>
              {Math.round(d.phasesCleared ?? 0)}/{Math.round(d.phases ?? params.phases)}
            </span>
          </div>
        </div>
      );
    }

    case "escape-run": {
      const lead = d.lead ?? 0;
      return (
        <div className="tap-mech-stage">
          <div className="tap-mech-meta">
            <Wind size={15} aria-hidden="true" />
            <span>{s.pursuer}</span>
          </div>
          <Meter
            label={s.distance}
            value={Math.max(0, lead)}
            max={Math.max(1, params.headStartChars)}
            tone={lead < params.headStartChars / 3 ? "danger" : "accent"}
          />
        </div>
      );
    }

    case "race-checkpoints": {
      const total = d.checkpointsTotal ?? 0;
      const passed = d.checkpointsPassed ?? 0;
      return (
        <div className="tap-mech-stage">
          <div className="tap-mech-meta">
            <Flag size={15} aria-hidden="true" />
            <span>{s.checkpoints}</span>
            <span className="tap-mech-dots" role="img" aria-label={`${String(passed)}/${String(total)}`}>
              {Array.from({ length: Math.max(total, 1) }, (_, i) => (
                <span key={i} className={i < passed ? "tap-mech-dot tap-mech-dot-filled" : "tap-mech-dot"} />
              ))}
            </span>
          </div>
        </div>
      );
    }

    case "survival-waves":
      return (
        <div className="tap-mech-stage">
          <Pips max={outcome.lives.max} used={outcome.lives.lost} Icon={Heart} label={s.lives} />
          <div className="tap-mech-meta">
            <Waves size={15} aria-hidden="true" />
            <span>
              {Math.round(d.wavesCleared ?? 0)}/{Math.round(d.wavesTotal ?? 0)}
            </span>
          </div>
        </div>
      );

    case "sequence-build":
      return (
        <div className="tap-mech-stage">
          <Pips max={outcome.lives.max} used={outcome.lives.lost} Icon={Link2} label={s.chain} />
          <div className="tap-mech-meta">
            <span>{Math.round(d.longestChain ?? 0)}</span>
          </div>
        </div>
      );

    case "endless":
      return (
        <div className="tap-mech-stage">
          <Pips max={outcome.lives.max} used={outcome.lives.lost} Icon={Heart} label={s.lives} />
          <div className="tap-mech-meta">
            <Gauge size={15} aria-hidden="true" />
            <span>{Math.round(d.distance ?? 0)}</span>
          </div>
        </div>
      );

    case "falling-catch":
    case "collection":
    case "target-press":
    default:
      return (
        <div className="tap-mech-stage">
          <Pips max={outcome.lives.max} used={outcome.lives.lost} Icon={Heart} label={s.lives} />
          <div className="tap-mech-meta">
            <Crosshair size={15} aria-hidden="true" />
            <span>
              {outcome.units.cleared}/{units.length}
            </span>
          </div>
        </div>
      );
  }
}

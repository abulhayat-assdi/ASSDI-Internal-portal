"use client";

import { useMemo } from "react";
import {
  Crosshair,
  Flag,
  Gauge,
  Heart,
  Link2,
  Package,
  Shield,
  Swords,
  Waves,
  Wind,
} from "lucide-react";
import type {
  MechanicOutcome,
  MechanicParams,
  MechanicUnit,
} from "@/lib/typing-game/mechanics";
import {
  SceneBar,
  ScenePips,
  SceneShell,
  SceneStat,
  clampPct,
  sceneModel,
  tokenText,
  trailingChain,
  type SceneModel,
  type UnitStatus,
} from "./scene-parts";

/**
 * The mechanic scene: what the player is actually playing against.
 *
 * Every number drawn here comes from the live MechanicOutcome, which the
 * server replays with the same rules on submit. Nothing is invented for
 * display and nothing here feeds scoring — so the bar a player watches empty
 * is the bar the server agrees emptied.
 *
 * The art layer is decorative and aria-hidden; the stats row carries the real
 * state as text and ARIA. Every scene is a fixed height, so it can never push
 * the typing text around mid-run.
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

/** Short, plain explanation of why a run ended. Null when it just finished. */
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

/** How many unit chips to draw. Beyond this they stop being legible. */
const MAX_TOKENS = 14;

/**
 * A window of unit chips centred on the live unit, so a 40-unit run still
 * shows where the player is instead of shrinking to invisibility.
 */
function tokenWindow(
  units: MechanicUnit[],
  statuses: UnitStatus[],
  live: number,
): Array<{ key: number; text: string; status: UnitStatus; live: boolean }> {
  const total = units.length;
  if (total === 0) return [];
  const half = Math.floor(MAX_TOKENS / 2);
  const start = Math.max(0, Math.min(live - half, total - MAX_TOKENS));
  const end = Math.min(total, start + MAX_TOKENS);
  const out: Array<{ key: number; text: string; status: UnitStatus; live: boolean }> = [];
  for (let i = start; i < end; i++) {
    out.push({
      key: i,
      text: tokenText(units[i]?.text ?? ""),
      status: statuses[i] ?? "pending",
      live: i === live,
    });
  }
  return out;
}

function TokenTrack({
  units,
  model,
  variant,
}: {
  units: MechanicUnit[];
  model: SceneModel;
  variant: "fall" | "collect" | "chain" | "wave";
}) {
  const tokens = useMemo(
    () => tokenWindow(units, model.statuses, model.resolved),
    [units, model.statuses, model.resolved],
  );
  return (
    <div className={`tap-scene-track tap-scene-track-${variant}`}>
      {tokens.map((t) => (
        <span
          key={t.key}
          className={[
            "tap-scene-token",
            `tap-scene-token-${t.status}`,
            t.live ? "tap-scene-token-live" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {t.text}
        </span>
      ))}
    </div>
  );
}

/** Two markers closing on each other along a shared track. */
function ChaseTrack({ runner, chaser }: { runner: number; chaser: number }) {
  return (
    <div className="tap-scene-chase">
      <span className="tap-scene-chase-line" />
      <span className="tap-scene-chase-chaser" style={{ left: `${String(chaser)}%` }}>
        <Wind size={16} aria-hidden="true" />
      </span>
      <span className="tap-scene-chase-runner" style={{ left: `${String(runner)}%` }}>
        <Gauge size={16} aria-hidden="true" />
      </span>
    </div>
  );
}

function GateTrack({ passed, total }: { passed: number; total: number }) {
  const gates = Math.max(1, Math.min(12, total));
  return (
    <div className="tap-scene-gates">
      {Array.from({ length: gates }, (_, i) => (
        <span
          key={i}
          className={i < passed ? "tap-scene-gate tap-scene-gate-on" : "tap-scene-gate"}
        >
          <Flag size={14} aria-hidden="true" />
        </span>
      ))}
    </div>
  );
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
  const model = useMemo(() => sceneModel(outcome), [outcome]);
  const d = outcome.detail;
  const note = mechanicEndMessage(outcome, s);

  const lifePips = (
    <ScenePips label={s.lives} left={model.livesLeft} max={model.livesMax} Icon={Heart} />
  );

  switch (outcome.mechanic) {
    case "defense-shield": {
      const max = d.shieldMax ?? model.livesMax;
      const left = d.shieldLeft ?? model.livesLeft;
      return (
        <SceneShell
          label={s.shield}
          failed={model.failed}
          danger={left <= 1}
          note={note}
          art={
            <div className="tap-scene-shield">
              <span
                className="tap-scene-shield-core"
                data-cracked={left < max ? "true" : "false"}
              >
                <Shield size={26} aria-hidden="true" />
              </span>
            </div>
          }
          stats={
            <>
              <ScenePips label={s.shield} left={left} max={max} Icon={Shield} tone="shield" />
              <SceneStat
                label={s.targets}
                value={`${String(model.cleared)}/${String(model.total)}`}
                Icon={Crosshair}
              />
            </>
          }
        />
      );
    }

    case "boss-phased": {
      const hpMax = d.bossHpMax ?? units.length;
      const hpLeft = d.bossHpLeft ?? hpMax;
      const phases = d.phases ?? params.phases;
      const phasesCleared = d.phasesCleared ?? 0;
      return (
        <SceneShell
          label={s.bossHp}
          failed={model.failed}
          danger={hpLeft > 0 && hpLeft / Math.max(1, hpMax) < 0.25}
          note={note}
          art={
            <div className="tap-scene-boss">
              <span
                className="tap-scene-boss-face"
                data-hurt={hpLeft < hpMax ? "true" : "false"}
              >
                <Swords size={26} aria-hidden="true" />
              </span>
            </div>
          }
          stats={
            <>
              <SceneBar label={s.bossHp} value={hpLeft} max={hpMax} tone="danger" size="lg" />
              <ScenePips
                label={s.waves}
                left={phasesCleared}
                max={phases}
                Icon={Swords}
                tone="shield"
              />
            </>
          }
        />
      );
    }

    case "escape-run": {
      const lead = d.lead ?? 0;
      const span = Math.max(1, params.headStartChars);
      const runnerPct = 20 + clampPct(Math.max(0, lead), span) * 0.75;
      const chaserPct = Math.max(0, runnerPct - 18);
      return (
        <SceneShell
          label={s.pursuer}
          failed={model.failed}
          danger={lead < span / 3}
          note={note}
          art={<ChaseTrack runner={runnerPct} chaser={chaserPct} />}
          stats={
            <>
              <SceneBar
                label={s.distance}
                value={Math.max(0, lead)}
                max={span}
                tone={lead < span / 3 ? "danger" : "success"}
              />
              <SceneStat
                label={s.pursuer}
                value={String(Math.round(d.chaser ?? 0))}
                Icon={Wind}
              />
            </>
          }
        />
      );
    }

    case "race-checkpoints": {
      const total = d.checkpointsTotal ?? 0;
      const passed = d.checkpointsPassed ?? 0;
      return (
        <SceneShell
          label={s.checkpoints}
          failed={model.failed}
          note={note}
          art={<GateTrack passed={passed} total={total} />}
          stats={
            <>
              <SceneStat
                label={s.checkpoints}
                value={`${String(passed)}/${String(total)}`}
                Icon={Flag}
                tone={model.failed ? "bad" : "ok"}
              />
              <SceneBar label={s.distance} value={model.resolved} max={model.total} />
            </>
          }
        />
      );
    }

    case "survival-waves": {
      const wavesCleared = d.wavesCleared ?? 0;
      const wavesTotal = d.wavesTotal ?? 0;
      return (
        <SceneShell
          label={s.waves}
          failed={model.failed}
          danger={model.livesLeft <= 1}
          note={note}
          art={<TokenTrack units={units} model={model} variant="wave" />}
          stats={
            <>
              {lifePips}
              <SceneStat
                label={s.waves}
                value={`${String(wavesCleared)}/${String(wavesTotal)}`}
                Icon={Waves}
              />
            </>
          }
        />
      );
    }

    case "sequence-build": {
      const chain = trailingChain(model.statuses, model.resolved);
      return (
        <SceneShell
          label={s.chain}
          failed={model.failed}
          danger={model.livesLeft <= 1}
          note={note}
          art={<TokenTrack units={units} model={model} variant="chain" />}
          stats={
            <>
              <SceneStat
                label={s.chain}
                value={String(chain)}
                Icon={Link2}
                tone={chain > 0 ? "ok" : "plain"}
              />
              <ScenePips
                label={s.lives}
                left={model.livesLeft}
                max={model.livesMax}
                Icon={Link2}
              />
            </>
          }
        />
      );
    }

    case "endless": {
      const distance = d.distance ?? model.cleared;
      return (
        <SceneShell
          label={s.distance}
          failed={model.failed}
          danger={model.livesLeft <= 1}
          note={note}
          art={
            <ChaseTrack
              runner={20 + clampPct(model.resolved, model.total) * 0.75}
              chaser={0}
            />
          }
          stats={
            <>
              {lifePips}
              <SceneStat label={s.distance} value={String(distance)} Icon={Gauge} />
            </>
          }
        />
      );
    }

    case "collection": {
      return (
        <SceneShell
          label={s.targets}
          failed={model.failed}
          danger={model.livesLeft <= 1}
          note={note}
          art={<TokenTrack units={units} model={model} variant="collect" />}
          stats={
            <>
              {lifePips}
              <SceneStat
                label={s.targets}
                value={`${String(d.collected ?? model.cleared)}/${String(model.total)}`}
                Icon={Package}
              />
            </>
          }
        />
      );
    }

    case "target-press": {
      const live = units[model.resolved];
      return (
        <SceneShell
          label={s.targets}
          failed={model.failed}
          danger={model.livesLeft <= 1}
          note={note}
          art={
            <div className="tap-scene-target">
              <span className="tap-scene-target-key">{live ? tokenText(live.text) : ""}</span>
            </div>
          }
          stats={
            <>
              {lifePips}
              <SceneStat
                label={s.targets}
                value={`${String(d.hits ?? model.cleared)}/${String(model.total)}`}
                Icon={Crosshair}
              />
            </>
          }
        />
      );
    }

    case "falling-catch":
    default: {
      return (
        <SceneShell
          label={s.targets}
          failed={model.failed}
          danger={model.livesLeft <= 1}
          note={note}
          art={<TokenTrack units={units} model={model} variant="fall" />}
          stats={
            <>
              {lifePips}
              <SceneStat
                label={s.targets}
                value={`${String(d.caught ?? model.cleared)}/${String(model.total)}`}
                Icon={Crosshair}
              />
            </>
          }
        />
      );
    }
  }
}

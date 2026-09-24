/**
 * The mechanic rule sets — one pure function, ten real games.
 *
 * `runMechanic` is deterministic: same inputs, same outcome, on any machine.
 * The browser calls it incrementally while the player types (feeding the
 * buffer it has so far) to drive the HUD; the route handler calls it once
 * with the final buffer to decide what actually happened. Because it is the
 * same code, a mechanic verdict cannot drift between the two.
 *
 * Every rule reads only from the verifiable set: which expected characters
 * were matched, and when. Nothing reads a client-reported count.
 */
import type {
  MechanicEvent,
  MechanicOutcome,
  MechanicRunInput,
  MechanicUnit,
  RealMechanic,
} from "./types";

interface UnitRun {
  unit: MechanicUnit;
  /** Every character of the unit was typed and matched. */
  correct: boolean;
  /** The unit was typed through to its end (correctly or not). */
  reached: boolean;
  /** ms at which the unit's last character was typed, or null. */
  completedAt: number | null;
  /** Index into `typed` of this unit's first mismatch, or -1. */
  firstErrorAt: number;
}

function sameChar(a: string, b: string, caseSensitive: boolean): boolean {
  return caseSensitive ? a === b : a.toLowerCase() === b.toLowerCase();
}

/** Per-unit facts every rule set builds on. Computed once. */
function analyseUnits(input: MechanicRunInput): UnitRun[] {
  const { expected, typed, timeline, units, caseSensitive } = input;
  return units.map((unit) => {
    const reached = typed.length >= unit.end;
    let correct = reached;
    let firstErrorAt = -1;
    for (let i = unit.start; i < unit.end && i < typed.length; i++) {
      if (!sameChar(typed[i] as string, expected[i] as string, caseSensitive)) {
        correct = false;
        if (firstErrorAt === -1) firstErrorAt = i;
      }
    }
    return {
      unit,
      correct,
      reached,
      completedAt: reached ? (timeline[unit.end - 1] ?? null) : null,
      firstErrorAt,
    };
  });
}

/** Indices into `typed` whose character does not match the prompt. */
function errorPositions(input: MechanicRunInput): number[] {
  const { expected, typed, caseSensitive } = input;
  const out: number[] = [];
  for (let i = 0; i < typed.length; i++) {
    const exp = expected[i];
    if (exp === undefined || !sameChar(typed[i] as string, exp, caseSensitive)) {
      out.push(i);
    }
  }
  return out;
}

function base(input: MechanicRunInput): MechanicOutcome {
  return {
    mechanic: input.mechanic,
    cleared: false,
    endReason: "incomplete",
    endedAtChar: input.typed.length,
    lives: { max: input.params.lives, lost: 0 },
    units: { total: input.units.length, cleared: 0, missed: 0 },
    detail: {},
    events: [],
  };
}

/** Did the player type all the way to the end of the prompt? */
function finishedPrompt(input: MechanicRunInput): boolean {
  return input.typed.length >= input.expected.length && input.expected.length > 0;
}

/**
 * Shared "lives" skeleton: walk units in order, ask the rule whether each one
 * was lost, and end the run when lives run out. Used by every mechanic whose
 * failure mode is attrition rather than a single hard gate.
 */
function runWithLives(
  input: MechanicRunInput,
  runs: UnitRun[],
  isLost: (run: UnitRun, index: number) => boolean,
  opts: { requireAllUnits: boolean },
): MechanicOutcome {
  const out = base(input);
  const events: MechanicEvent[] = [];
  let lost = 0;

  for (const [i, run] of runs.entries()) {
    if (!run.reached) break;
    const at = run.completedAt ?? 0;
    if (isLost(run, i)) {
      lost += 1;
      out.units.missed += 1;
      events.push({ at, kind: "unit-missed", unit: i });
      events.push({ at, kind: "life-lost", unit: i });
      if (lost >= input.params.lives) {
        out.lives.lost = lost;
        out.endReason = "out-of-lives";
        out.endedAtChar = run.unit.end;
        out.events = events;
        return out;
      }
    } else {
      out.units.cleared += 1;
      events.push({ at, kind: "unit-cleared", unit: i });
    }
  }

  out.lives.lost = lost;
  out.events = events;
  const complete = finishedPrompt(input);
  if (!complete) {
    out.endReason = "incomplete";
    out.cleared = false;
    return out;
  }
  out.endReason = "completed";
  out.cleared = opts.requireAllUnits ? out.units.missed === 0 : true;
  return out;
}

function runFallingCatch(input: MechanicRunInput, runs: UnitRun[]): MechanicOutcome {
  const { spawnIntervalMs, fallMs } = input.params;
  const out = runWithLives(
    input,
    runs,
    (run, i) => {
      if (!run.correct) return true;
      const deadline = i * spawnIntervalMs + fallMs;
      return (run.completedAt ?? Infinity) > deadline;
    },
    { requireAllUnits: false },
  );
  out.detail = { spawnIntervalMs, fallMs, caught: out.units.cleared };
  return out;
}

function runTargetPress(input: MechanicRunInput, runs: UnitRun[]): MechanicOutcome {
  // Reaction window measured from the previous target being cleared, so a
  // slow start never cascades into every later target being "late".
  const window = input.params.fallMs;
  let previousAt = 0;
  const out = runWithLives(
    input,
    runs,
    (run) => {
      const at = run.completedAt ?? Infinity;
      const late = at - previousAt > window;
      if (Number.isFinite(at)) previousAt = at;
      return !run.correct || late;
    },
    { requireAllUnits: false },
  );
  out.detail = { reactionWindowMs: window, hits: out.units.cleared };
  return out;
}

function runCollection(input: MechanicRunInput, runs: UnitRun[]): MechanicOutcome {
  const out = runWithLives(input, runs, (run) => !run.correct, {
    requireAllUnits: false,
  });
  out.detail = { collected: out.units.cleared, dropped: out.units.missed };
  return out;
}

function runSurvivalWaves(input: MechanicRunInput, runs: UnitRun[]): MechanicOutcome {
  const { waveSize } = input.params;
  const out = runWithLives(input, runs, (run) => !run.correct, {
    requireAllUnits: false,
  });
  const clearedThrough = out.units.cleared + out.units.missed;
  const wavesCleared = Math.floor(clearedThrough / waveSize);
  for (let w = 1; w <= wavesCleared; w++) {
    const boundary = runs[w * waveSize - 1];
    out.events.push({
      at: boundary?.completedAt ?? 0,
      kind: "wave-cleared",
      unit: w * waveSize - 1,
    });
  }
  out.detail = {
    waveSize,
    wavesCleared,
    wavesTotal: Math.ceil(input.units.length / waveSize),
  };
  return out;
}

function runEndless(input: MechanicRunInput, runs: UnitRun[]): MechanicOutcome {
  const out = runWithLives(input, runs, (run) => !run.correct, {
    requireAllUnits: false,
  });
  // Endless has no "finish": surviving the supplied prompt is a clear.
  if (out.endReason === "completed") out.cleared = true;
  out.detail = { distance: out.units.cleared, survived: out.units.cleared };
  return out;
}

function runSequenceBuild(input: MechanicRunInput, runs: UnitRun[]): MechanicOutcome {
  const out = base(input);
  const events: MechanicEvent[] = [];
  let chain = 0;
  let longest = 0;
  let breaks = 0;

  for (const [i, run] of runs.entries()) {
    if (!run.reached) break;
    const at = run.completedAt ?? 0;
    if (run.correct) {
      chain += 1;
      if (chain > longest) longest = chain;
      out.units.cleared += 1;
      events.push({ at, kind: "unit-cleared", unit: i });
    } else {
      chain = 0;
      breaks += 1;
      out.units.missed += 1;
      events.push({ at, kind: "chain-broken", unit: i });
      if (breaks >= input.params.lives) {
        out.lives.lost = breaks;
        out.endReason = "out-of-lives";
        out.endedAtChar = run.unit.end;
        out.events = events;
        out.detail = { longestChain: longest, breaks };
        return out;
      }
    }
  }

  out.lives.lost = breaks;
  out.events = events;
  out.detail = { longestChain: longest, breaks };
  if (!finishedPrompt(input)) return out;
  out.endReason = "completed";
  out.cleared = breaks === 0;
  return out;
}

function runDefenseShield(input: MechanicRunInput, runs: UnitRun[]): MechanicOutcome {
  const out = base(input);
  const { shieldHits } = input.params;
  const errors = errorPositions(input);
  const events: MechanicEvent[] = errors.slice(0, shieldHits).map((idx) => ({
    at: input.timeline[idx] ?? 0,
    kind: "shield-hit" as const,
  }));

  out.units.cleared = runs.filter((r) => r.correct).length;
  out.units.missed = runs.filter((r) => r.reached && !r.correct).length;
  out.lives = { max: shieldHits, lost: Math.min(errors.length, shieldHits) };
  out.events = events;

  if (errors.length >= shieldHits) {
    const breakIdx = errors[shieldHits - 1] as number;
    out.endReason = "shield-broken";
    out.endedAtChar = breakIdx + 1;
    out.detail = { shieldMax: shieldHits, shieldLeft: 0, hits: errors.length };
    return out;
  }
  out.detail = {
    shieldMax: shieldHits,
    shieldLeft: shieldHits - errors.length,
    hits: errors.length,
  };
  if (!finishedPrompt(input)) return out;
  out.endReason = "completed";
  out.cleared = true;
  return out;
}

function runRaceCheckpoints(input: MechanicRunInput, runs: UnitRun[]): MechanicOutcome {
  const out = base(input);
  const { unitsPerCheckpoint, checkpointMs } = input.params;
  const events: MechanicEvent[] = [];
  let passed = 0;

  for (let c = 1; c * unitsPerCheckpoint <= runs.length; c++) {
    const gateIdx = c * unitsPerCheckpoint - 1;
    const run = runs[gateIdx];
    if (!run || !run.reached) break;
    const at = run.completedAt ?? Infinity;
    const segment = runs.slice((c - 1) * unitsPerCheckpoint, gateIdx + 1);
    const segmentClean = segment.every((r) => r.correct);
    if (at > c * checkpointMs || !segmentClean) {
      out.endReason = "checkpoint-missed";
      out.endedAtChar = run.unit.end;
      out.units.cleared = runs.slice(0, gateIdx + 1).filter((r) => r.correct).length;
      out.units.missed = segment.filter((r) => r.reached && !r.correct).length || 1;
      out.events = events;
      out.detail = { checkpointsPassed: passed, checkpointMs, missedAt: c };
      return out;
    }
    passed += 1;
    events.push({ at, kind: "checkpoint", unit: gateIdx });
  }

  out.units.cleared = runs.filter((r) => r.correct).length;
  out.units.missed = runs.filter((r) => r.reached && !r.correct).length;
  out.events = events;
  out.detail = {
    checkpointsPassed: passed,
    checkpointMs,
    checkpointsTotal: Math.floor(runs.length / unitsPerCheckpoint),
  };
  if (!finishedPrompt(input)) return out;
  out.endReason = "completed";
  out.cleared = true;
  return out;
}

function runEscapeRun(input: MechanicRunInput, runs: UnitRun[]): MechanicOutcome {
  const out = base(input);
  const { chaserCharsPerSec, headStartChars } = input.params;
  const { expected, typed, timeline, caseSensitive } = input;
  let advanced = 0;

  for (let i = 0; i < typed.length; i++) {
    const exp = expected[i];
    if (exp !== undefined && sameChar(typed[i] as string, exp, caseSensitive)) {
      advanced += 1;
    }
    const t = (timeline[i] ?? 0) / 1000;
    const chaser = t * chaserCharsPerSec - headStartChars;
    if (chaser >= advanced) {
      out.endReason = "caught";
      out.endedAtChar = i + 1;
      out.units.cleared = runs.filter((r) => r.correct && r.unit.end <= i + 1).length;
      out.events = [{ at: timeline[i] ?? 0, kind: "ended" }];
      out.detail = { distance: advanced, chaser: Math.max(0, Math.round(chaser)), lead: 0 };
      return out;
    }
  }

  const lastT = (timeline[timeline.length - 1] ?? 0) / 1000;
  const chaser = Math.max(0, lastT * chaserCharsPerSec - headStartChars);
  out.units.cleared = runs.filter((r) => r.correct).length;
  out.units.missed = runs.filter((r) => r.reached && !r.correct).length;
  out.detail = {
    distance: advanced,
    chaser: Math.round(chaser),
    lead: Math.round(advanced - chaser),
  };
  if (!finishedPrompt(input)) return out;
  out.endReason = "completed";
  out.cleared = true;
  return out;
}

function runBossPhased(input: MechanicRunInput, runs: UnitRun[]): MechanicOutcome {
  const out = base(input);
  const phases = Math.max(1, Math.floor(input.params.phases));
  const totalHp = input.units.length;
  const perPhase = Math.max(1, Math.ceil(totalHp / phases));
  const events: MechanicEvent[] = [];
  let damage = 0;

  for (const [i, run] of runs.entries()) {
    if (!run.reached) break;
    const at = run.completedAt ?? 0;
    if (run.correct) {
      damage += 1;
      out.units.cleared += 1;
      if (damage % perPhase === 0 && damage < totalHp) {
        events.push({ at, kind: "phase-cleared", unit: i });
      }
    } else {
      out.units.missed += 1;
    }
  }

  const hpLeft = Math.max(0, totalHp - damage);
  out.events = events;
  out.detail = {
    bossHpMax: totalHp,
    bossHpLeft: hpLeft,
    phases,
    phasesCleared: Math.min(phases, Math.floor(damage / perPhase)),
  };
  out.lives = { max: phases, lost: 0 };

  if (hpLeft === 0) {
    out.endReason = "completed";
    out.cleared = true;
    return out;
  }
  if (!finishedPrompt(input)) return out;
  out.endReason = "boss-survived";
  out.cleared = false;
  return out;
}

const RULES: Record<
  RealMechanic,
  (input: MechanicRunInput, runs: UnitRun[]) => MechanicOutcome
> = {
  "falling-catch": runFallingCatch,
  "target-press": runTargetPress,
  collection: runCollection,
  "survival-waves": runSurvivalWaves,
  endless: runEndless,
  "sequence-build": runSequenceBuild,
  "defense-shield": runDefenseShield,
  "race-checkpoints": runRaceCheckpoints,
  "escape-run": runEscapeRun,
  "boss-phased": runBossPhased,
};

/** Replay a mechanic over a (possibly partial) typed buffer. */
export function runMechanic(input: MechanicRunInput): MechanicOutcome {
  const runs = analyseUnits(input);
  return RULES[input.mechanic](input, runs);
}

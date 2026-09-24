/**
 * @tap/mechanics — real gameplay rules for the ten mechanics that have them.
 *
 * One pure module, two callers: the browser plays it live, the route handler
 * replays it to verify. See run.ts for the rules and types.ts for the trust
 * contract.
 */
export {
  REAL_MECHANICS,
  digestOf,
  digestsMatch,
  isRealMechanic,
  isShellMechanic,
  type MechanicDigest,
  type MechanicEndReason,
  type MechanicEvent,
  type MechanicOutcome,
  type MechanicParams,
  type MechanicRunInput,
  type MechanicUnit,
  type RealMechanic,
} from "./types";
export { segmentUnits, unitAt } from "./units";
export {
  decodeTimeline,
  encodeTimeline,
  parseTimelineDeltas,
  validateTimeline,
  type TimelineVerdict,
} from "./timeline";
export { asDifficulty, resolveParams } from "./params";
export { runMechanic } from "./run";

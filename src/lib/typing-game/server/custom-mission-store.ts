/**
 * Custom teacher-authored mission persistence boundary. Replaces the
 * daily/weekly auto-mission system (mission-store.ts, left in place but
 * unused) with teacher-paste-a-passage missions: complete once / within a
 * time limit / N repetitions, optional min-accuracy/min-WPM gates, assigned
 * to specific batches, with a per-mission leaderboard whose ranking metric
 * the teacher picks. See supabase-migrations/typing-game/0042_custom_missions.sql.
 *
 * Self-contained: does not touch typing_game.games/game_attempts. Attempt
 * scoring numbers are computed by the caller (reusing the same pure
 * diff/metrics functions the catalog submit route uses) and passed in — this
 * store only persists what it's given and reports back what the RPCs return.
 * The store never mints XP/coins itself; that happens inside
 * fn_submit_custom_mission_attempt.
 */
import type { PostgrestClient } from "@supabase/postgrest-js";

export class ForbiddenError extends Error {
  constructor(message = "FORBIDDEN") {
    super(message);
    this.name = "ForbiddenError";
  }
}
export class ConflictError extends Error {
  constructor(message = "CONFLICT") {
    super(message);
    this.name = "ConflictError";
  }
}
export class NotFoundError extends Error {
  constructor(message = "NOT_FOUND") {
    super(message);
    this.name = "NotFoundError";
  }
}

export type CompletionMode = "once" | "timed" | "repetitions";
export type LeaderboardMetric =
  | "fastest_time"
  | "highest_accuracy"
  | "highest_wpm"
  | "most_repetitions";
export type CustomMissionStatus = "draft" | "active" | "archived";
export type CustomMissionAttemptStatus =
  | "started"
  | "validated"
  | "rejected"
  | "expired";

export interface CustomMissionDefinitionInput {
  title: string;
  description: string;
  passageText: string;
  completionMode: CompletionMode;
  timeLimitSeconds: number | null;
  repetitionsTarget: number | null;
  minAccuracy: number | null;
  minWpm: number | null;
  leaderboardMetric: LeaderboardMetric;
  rewardXp: number;
  rewardCoins: number;
  batchIds: string[];
}

export interface CustomMission {
  id: string;
  teacherId: string;
  title: string;
  description: string;
  passageText: string;
  completionMode: CompletionMode;
  timeLimitSeconds: number | null;
  repetitionsTarget: number | null;
  minAccuracy: number | null;
  minWpm: number | null;
  leaderboardMetric: LeaderboardMetric;
  rewardXp: number;
  rewardCoins: number;
  status: CustomMissionStatus;
  createdAt: string;
}

export interface CustomMissionAttempt {
  id: string;
  missionId: string;
  status: CustomMissionAttemptStatus;
  expectedText: string;
  expiresAt: string | null;
}

export interface SubmitCustomMissionInput {
  typedText: string;
  elapsedMs: number;
  corrections: number;
  errorStrokes: number;
  incorrectChars: number;
  accuracy: number;
  effectiveWpm: number;
  score: number;
}

export interface SubmitCustomMissionResult {
  status: CustomMissionAttemptStatus;
  qualifies: boolean;
  completed: boolean;
  newlyCompleted: boolean;
}

export interface CustomMissionRosterRow {
  userId: string;
  fullName: string;
  rollNumber: string | null;
  currentLevel: number;
  gamesPlayed: number;
  completed: boolean;
  completedAt: string | null;
  qualifyingAttempts: number;
  totalAttempts: number;
  bestElapsedMs: number | null;
  bestAccuracy: number | null;
  bestWpm: number | null;
}

export interface CustomMissionLeaderboardRow {
  rank: number;
  userId: string;
  fullName: string;
  rollNumber: string | null;
  metricValue: number | null;
  qualifyingAttempts: number;
}

export interface CustomMissionStore {
  // Teacher
  listMine(teacherUserId: string): Promise<CustomMission[]>;
  create(input: CustomMissionDefinitionInput): Promise<string>;
  /** Patch keys are camelCase (title, passageText, completionMode, ...),
   *  matching fn_update_custom_mission_draft's jsonb reads. */
  updateDraft(id: string, patch: Record<string, unknown>): Promise<void>;
  setBatches(id: string, batchIds: string[]): Promise<void>;
  setStatus(id: string, status: CustomMissionStatus): Promise<void>;
  getRoster(id: string): Promise<CustomMissionRosterRow[]>;
  // Shared
  getForManage(id: string): Promise<CustomMission | null>;
  getLeaderboard(id: string): Promise<CustomMissionLeaderboardRow[]>;
  // Student
  listAssigned(userId: string): Promise<CustomMission[]>;
  getAssigned(id: string): Promise<CustomMission | null>;
  startAttempt(missionId: string): Promise<CustomMissionAttempt>;
  getAttempt(attemptId: string): Promise<CustomMissionAttempt | null>;
  submitAttempt(
    attemptId: string,
    input: SubmitCustomMissionInput,
  ): Promise<SubmitCustomMissionResult>;
  getMyCompletion(
    missionId: string,
    userId: string,
  ): Promise<{ completedAt: string } | null>;
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function strOrNull(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return fallback;
}
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}
function bool(v: unknown): boolean {
  return v === true;
}

export function mapStoreError(e: unknown): Error {
  const message =
    isRecord(e) && typeof e.message === "string" ? e.message : String(e);
  if (/FORBIDDEN|row-level security|permission denied/i.test(message)) {
    return new ForbiddenError(message);
  }
  if (/NOT_FOUND/i.test(message)) return new NotFoundError(message);
  if (
    /already|ALREADY|NOT_DRAFT|duplicate|unique/i.test(message)
  ) {
    return new ConflictError(message);
  }
  return e instanceof Error ? e : new Error(message);
}

function toMission(r: Record<string, unknown>): CustomMission | null {
  const id = str(r.id);
  if (!id) return null;
  return {
    id,
    teacherId: str(r.teacher_id),
    title: str(r.title),
    description: str(r.description),
    passageText: str(r.passage_text),
    completionMode: str(r.completion_mode) as CompletionMode,
    timeLimitSeconds: numOrNull(r.time_limit_seconds),
    repetitionsTarget: numOrNull(r.repetitions_target),
    minAccuracy: numOrNull(r.min_accuracy),
    minWpm: numOrNull(r.min_wpm),
    leaderboardMetric: str(r.leaderboard_metric, "fastest_time") as LeaderboardMetric,
    rewardXp: num(r.reward_xp),
    rewardCoins: num(r.reward_coins),
    status: str(r.status, "draft") as CustomMissionStatus,
    createdAt: str(r.created_at),
  };
}

const MISSION_COLUMNS =
  "id, teacher_id, title, description, passage_text, completion_mode, time_limit_seconds, repetitions_target, min_accuracy, min_wpm, leaderboard_metric, reward_xp, reward_coins, status, created_at";

/** Production store: user-scoped client -> RPC fns + RLS-scoped reads. */
export function createSupabaseCustomMissionStore(
  client: PostgrestClient,
): CustomMissionStore {
  async function readAttempt(
    attemptId: string,
  ): Promise<CustomMissionAttempt | null> {
    const res = await client
      .from("custom_mission_attempts")
      .select("id, mission_id, status, expected_text, expires_at")
      .eq("id", attemptId)
      .maybeSingle();
    if (res.error || !isRecord(res.data)) return null;
    const d = res.data;
    const id = str(d.id);
    const missionId = str(d.mission_id);
    if (!id || !missionId) return null;
    return {
      id,
      missionId,
      status: str(d.status, "started") as CustomMissionAttemptStatus,
      expectedText: str(d.expected_text),
      expiresAt: strOrNull(d.expires_at),
    };
  }

  return {
    async listMine(teacherUserId: string): Promise<CustomMission[]> {
      const res = await client
        .from("custom_missions")
        .select(MISSION_COLUMNS)
        .eq("teacher_id", teacherUserId)
        .order("created_at", { ascending: false });
      if (res.error || !Array.isArray(res.data)) return [];
      return res.data
        .filter(isRecord)
        .map(toMission)
        .filter((m): m is CustomMission => m !== null);
    },

    async create(input: CustomMissionDefinitionInput): Promise<string> {
      const res = await client.rpc("fn_create_custom_mission", {
        p_def: {
          title: input.title,
          description: input.description,
          passageText: input.passageText,
          completionMode: input.completionMode,
          timeLimitSeconds: input.timeLimitSeconds,
          repetitionsTarget: input.repetitionsTarget,
          minAccuracy: input.minAccuracy,
          minWpm: input.minWpm,
          leaderboardMetric: input.leaderboardMetric,
          rewardXp: input.rewardXp,
          rewardCoins: input.rewardCoins,
          batchIds: input.batchIds,
        },
      });
      if (res.error || typeof res.data !== "string") {
        throw mapStoreError(res.error ?? new Error("CREATE_FAILED"));
      }
      return res.data;
    },

    async updateDraft(id: string, patch: Record<string, unknown>): Promise<void> {
      const res = await client.rpc("fn_update_custom_mission_draft", {
        p_id: id,
        p_patch: patch,
      });
      if (res.error) throw mapStoreError(res.error);
    },

    async setBatches(id: string, batchIds: string[]): Promise<void> {
      const res = await client.rpc("fn_set_custom_mission_batches", {
        p_id: id,
        p_batch_ids: batchIds,
      });
      if (res.error) throw mapStoreError(res.error);
    },

    async setStatus(id: string, status: CustomMissionStatus): Promise<void> {
      const res = await client.rpc("fn_set_custom_mission_status", {
        p_id: id,
        p_status: status,
      });
      if (res.error) throw mapStoreError(res.error);
    },

    async getForManage(id: string): Promise<CustomMission | null> {
      const res = await client
        .from("custom_missions")
        .select(MISSION_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (res.error || !isRecord(res.data)) return null;
      return toMission(res.data);
    },

    async getRoster(id: string): Promise<CustomMissionRosterRow[]> {
      const res = await client.rpc("fn_custom_mission_roster", { p_mission: id });
      if (res.error || !Array.isArray(res.data)) return [];
      return res.data.filter(isRecord).map((r) => ({
        userId: str(r.user_id),
        fullName: str(r.full_name),
        rollNumber: strOrNull(r.roll_number),
        currentLevel: num(r.current_level, 1),
        gamesPlayed: num(r.games_played),
        completed: bool(r.completed),
        completedAt: strOrNull(r.completed_at),
        qualifyingAttempts: num(r.qualifying_attempts),
        totalAttempts: num(r.total_attempts),
        bestElapsedMs: numOrNull(r.best_elapsed_ms),
        bestAccuracy: numOrNull(r.best_accuracy),
        bestWpm: numOrNull(r.best_wpm),
      }));
    },

    async getLeaderboard(id: string): Promise<CustomMissionLeaderboardRow[]> {
      const res = await client.rpc("fn_custom_mission_leaderboard", { p_mission: id });
      if (res.error || !Array.isArray(res.data)) return [];
      return res.data.filter(isRecord).map((r) => ({
        rank: num(r.rank, 0),
        userId: str(r.user_id),
        fullName: str(r.full_name),
        rollNumber: strOrNull(r.roll_number),
        metricValue: numOrNull(r.metric_value),
        qualifyingAttempts: num(r.qualifying_attempts),
      }));
    },

    async listAssigned(userId: string): Promise<CustomMission[]> {
      // RLS scopes this to missions visible to `userId` (active + their
      // batch is assigned) or missions they manage — both are fine to show
      // in "assigned to me"; the page filters by status if it only wants
      // active ones.
      void userId;
      const res = await client
        .from("custom_missions")
        .select(MISSION_COLUMNS)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (res.error || !Array.isArray(res.data)) return [];
      return res.data
        .filter(isRecord)
        .map(toMission)
        .filter((m): m is CustomMission => m !== null);
    },

    async getAssigned(id: string): Promise<CustomMission | null> {
      const res = await client
        .from("custom_missions")
        .select(MISSION_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (res.error || !isRecord(res.data)) return null;
      return toMission(res.data);
    },

    async startAttempt(missionId: string): Promise<CustomMissionAttempt> {
      const res = await client.rpc("fn_start_custom_mission_attempt", {
        p_mission: missionId,
      });
      if (res.error || typeof res.data !== "string") {
        throw mapStoreError(res.error ?? new Error("START_FAILED"));
      }
      const attempt = await readAttempt(res.data);
      if (!attempt) throw new NotFoundError("ATTEMPT_NOT_FOUND");
      return attempt;
    },

    getAttempt: readAttempt,

    async submitAttempt(
      attemptId: string,
      input: SubmitCustomMissionInput,
    ): Promise<SubmitCustomMissionResult> {
      const res = await client.rpc("fn_submit_custom_mission_attempt", {
        p_attempt: attemptId,
        p_typed_text: input.typedText,
        p_elapsed_ms: Math.round(input.elapsedMs),
        p_corrections: Math.round(input.corrections),
        p_error_strokes: Math.round(input.errorStrokes),
        p_incorrect_chars: Math.round(input.incorrectChars),
        p_accuracy: input.accuracy,
        p_effective_wpm: input.effectiveWpm,
        p_score: input.score,
      });
      if (res.error || !isRecord(res.data)) {
        throw mapStoreError(res.error ?? new Error("SUBMIT_FAILED"));
      }
      const d = res.data;
      return {
        status: str(d.status, "validated") as CustomMissionAttemptStatus,
        qualifies: bool(d.qualifies),
        completed: bool(d.completed),
        newlyCompleted: bool(d.newlyCompleted),
      };
    },

    async getMyCompletion(
      missionId: string,
      userId: string,
    ): Promise<{ completedAt: string } | null> {
      const res = await client
        .from("custom_mission_completions")
        .select("completed_at")
        .eq("mission_id", missionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (res.error || !isRecord(res.data)) return null;
      const completedAt = str(res.data.completed_at);
      return completedAt ? { completedAt } : null;
    },
  };
}

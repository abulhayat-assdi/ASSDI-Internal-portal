/**
 * Batch challenges (0053_batch_challenges.sql). Every read and write goes
 * through a SECURITY DEFINER function that checks the caller is a player;
 * the server's own clock times every run.
 */
import type { PostgrestClient } from "@supabase/postgrest-js";
import { rpcCode } from "./arcade-store";

export type ChallengeMode = "async" | "live";
export type ChallengeStatus = "pending" | "accepted" | "running" | "finished" | "declined" | "expired" | "cancelled";

export interface Batchmate {
  userId: string;
  name: string;
  roll: string;
  batch: string;
  level: number;
  bestWpm: number | null;
  activeToday: boolean;
  wins: number;
  openId: string | null;
}

export interface ChallengeSummary {
  id: string;
  mode: ChallengeMode;
  status: ChallengeStatus;
  createdAt: string;
  expiresInMs: number;
  incoming: boolean;
  opponentId: string;
  opponentName: string;
  winnerId: string | null;
  iPlayed: boolean;
  iStarted: boolean;
  theyPlayed: boolean;
  myWpm: number | null;
  theirWpm: number | null;
  myAccuracy: number | null;
  xp: number;
  coins: number;
}

export interface ChallengeOverview {
  enabled: boolean;
  challenges: ChallengeSummary[];
  record: { wins: number; losses: number; draws: number };
  standings: { userId: string; name: string; wins: number; played: number }[];
}

export interface ChallengePlayer {
  userId: string;
  name: string;
  level: number;
  present: boolean;
  started: boolean;
  progress: number | null;
  finished: boolean;
  completed: boolean | null;
  timeMs: number | null;
  wpm: number | null;
  accuracy: number | null;
  xp: number;
  coins: number;
}

export interface ChallengeState {
  id: string;
  mode: ChallengeMode;
  status: ChallengeStatus;
  me: string;
  createdBy: string;
  opponentId: string;
  winnerId: string | null;
  timeLimitS: number;
  textLength: number;
  text: string | null;
  expiresInMs: number;
  startsInMs: number | null;
  myElapsedMs: number | null;
  players: ChallengePlayer[];
}

async function call<T>(client: PostgrestClient, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const res = await client.rpc(fn, args);
  if (res.error) throw new Error(rpcCode(res.error.message));
  return res.data as T;
}

export function createChallengeStore(client: PostgrestClient) {
  return {
    overview: () => call<ChallengeOverview>(client, "fn_challenge_overview"),
    batchmates: () => call<Batchmate[]>(client, "fn_challenge_batchmates"),
    inboxCount: async () => {
      try {
        return Number(await call<number>(client, "fn_challenge_inbox_count")) || 0;
      } catch {
        return 0;
      }
    },
    create: (opponent: string, mode: ChallengeMode, text: string) =>
      call<string>(client, "fn_challenge_create", { p_opponent: opponent, p_mode: mode, p_text: text }),
    respond: (id: string, action: "accept" | "decline" | "cancel") =>
      call<string>(client, "fn_challenge_respond", { p_id: id, p_action: action }),
    state: (id: string, presence = false) => call<ChallengeState>(client, "fn_challenge_state", { p_id: id, p_presence: presence }),
    begin: (id: string) => call<ChallengeState>(client, "fn_challenge_begin", { p_id: id }),
    progress: (id: string, progress: number, errors: number) =>
      call<null>(client, "fn_challenge_progress", { p_id: id, p_progress: progress, p_errors: errors }),
    finish: (id: string, progress: number, errors: number) =>
      call<ChallengeState>(client, "fn_challenge_finish", { p_id: id, p_progress: progress, p_errors: errors }),
  };
}

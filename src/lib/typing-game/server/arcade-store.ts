/**
 * Arcade games: unlocks, runs and bests. Reads through RLS as the student;
 * writes only via fn_arcade_unlock / fn_arcade_start / fn_arcade_finish
 * (0051_arcade_games.sql).
 */
import type { PostgrestClient } from "@supabase/postgrest-js";
import type { ArcadeResult } from "@/lib/typing-game/arcade/core";

export interface ArcadeGameState {
  slug: string;
  price: number;
  unlocked: boolean;
  best: number | null;
  bestLevel: number | null;
  plays: number;
}

export interface ArcadeOverview {
  coins: number;
  games: Map<string, ArcadeGameState>;
}

export interface ArcadeSessionRow {
  id: string;
  slug: string;
  seed: number;
  status: "started" | "finished";
  startedAt: string;
}

export interface FinishOutcome {
  xp: number;
  coins: number;
  best: number;
  newBest: boolean;
}

/** Error code carried by a failed RPC (the RAISE text, e.g. NOT_ENOUGH_COINS). */
export function rpcCode(message: string): string {
  const m = /([A-Z][A-Z_]{3,})/.exec(message);
  return m ? m[1] : "SERVER_ERROR";
}

export function createArcadeStore(client: PostgrestClient) {
  return {
    async overview(userId: string): Promise<ArcadeOverview> {
      const [games, unlocks, runs, profile] = await Promise.all([
        client.from("arcade_games").select("slug, price").eq("is_active", true),
        client.from("arcade_unlocks").select("game_slug").eq("user_id", userId),
        client.from("arcade_sessions").select("game_slug, score, level").eq("user_id", userId).eq("status", "finished").limit(5000),
        client.from("profiles").select("coin_balance").eq("id", userId).maybeSingle(),
      ]);
      for (const r of [games, unlocks, runs, profile]) if (r.error) throw new Error(r.error.message);
      const open = new Set(((unlocks.data ?? []) as { game_slug: string }[]).map((u) => u.game_slug));
      const out = new Map<string, ArcadeGameState>();
      for (const g of (games.data ?? []) as { slug: string; price: number }[]) {
        out.set(g.slug, { slug: g.slug, price: Number(g.price), unlocked: Number(g.price) === 0 || open.has(g.slug), best: null, bestLevel: null, plays: 0 });
      }
      for (const r of (runs.data ?? []) as { game_slug: string; score: number; level: number }[]) {
        const g = out.get(r.game_slug);
        if (!g) continue;
        g.plays++;
        if (g.best === null || Number(r.score) > g.best) {
          g.best = Number(r.score);
          g.bestLevel = Number(r.level);
        }
      }
      const coins = Number((profile.data as { coin_balance?: number } | null)?.coin_balance ?? 0);
      return { coins, games: out };
    },

    async unlock(slug: string, method: "coins" | "ad"): Promise<{ balance: number; coinsSpent: number }> {
      const res = await client.rpc("fn_arcade_unlock", { p_slug: slug, p_method: method });
      if (res.error) throw new Error(rpcCode(res.error.message));
      const d = res.data as { balance: number; coins_spent: number };
      return { balance: Number(d.balance), coinsSpent: Number(d.coins_spent) };
    },

    async start(slug: string): Promise<{ id: string; seed: number }> {
      const res = await client.rpc("fn_arcade_start", { p_slug: slug });
      if (res.error) throw new Error(rpcCode(res.error.message));
      const d = res.data as { id: string; seed: number };
      return { id: String(d.id), seed: Number(d.seed) };
    },

    async get(id: string): Promise<ArcadeSessionRow | null> {
      const res = await client.from("arcade_sessions").select("id, game_slug, seed, status, started_at").eq("id", id).maybeSingle();
      if (res.error) throw new Error(res.error.message);
      const r = res.data as { id: string; game_slug: string; seed: number; status: "started" | "finished"; started_at: string } | null;
      return r ? { id: r.id, slug: r.game_slug, seed: Number(r.seed), status: r.status, startedAt: r.started_at } : null;
    },

    async finish(id: string, r: ArcadeResult): Promise<FinishOutcome> {
      const res = await client.rpc("fn_arcade_finish", {
        p_session: id,
        p_score: r.score,
        p_level: r.level,
        p_wpm: Math.min(300, r.wpm),
        p_accuracy: r.accuracy,
        p_correct: r.correct,
        p_wrong: r.wrong,
        p_duration_ms: r.durationMs,
        p_won: r.won,
        p_stats: { ...r.stats, maxCombo: r.maxCombo },
      });
      if (res.error) throw new Error(rpcCode(res.error.message));
      const d = res.data as { xp: number; coins: number; best: number; new_best: boolean };
      return { xp: Number(d.xp), coins: Number(d.coins), best: Number(d.best), newBest: Boolean(d.new_best) };
    },

    /** Top scores of a game (students see their own rows only through RLS). */
    async recent(userId: string, slug: string, limit = 5): Promise<{ score: number; level: number; at: string }[]> {
      const res = await client
        .from("arcade_sessions")
        .select("score, level, finished_at")
        .eq("user_id", userId)
        .eq("game_slug", slug)
        .eq("status", "finished")
        .order("score", { ascending: false })
        .limit(limit);
      if (res.error) throw new Error(res.error.message);
      return ((res.data ?? []) as { score: number; level: number; finished_at: string }[]).map((r) => ({
        score: Number(r.score),
        level: Number(r.level),
        at: r.finished_at,
      }));
    },
  };
}

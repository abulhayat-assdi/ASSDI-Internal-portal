/**
 * POST /api/games/[gameId]/attempts/start
 *
 * Binds user × game version × prompt snapshot and returns the runtime
 * payload (including the prompt text — visibility is inherent to play;
 * integrity comes from server-side scoring, never secrecy).
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildPrompt, type BuiltPrompt } from "@/lib/typing-game/content";
import { getSession, unauthorized, type Session } from "@/lib/typing-game/server/auth";
import { userDbClient } from "@/lib/typing-game/server/auth";
import {
  createSupabaseAttemptStore,
  type AttemptStore,
  type StoreGame,
} from "@/lib/typing-game/server/attempt-store";
import enErrors from "@/messages/typing-game/en/errors.json";

const DIFFICULTIES = ["beginner", "intermediate", "expert"] as const;

interface StartBody {
  difficulty?: unknown;
  seed?: unknown;
}

function isStartBody(v: unknown): v is StartBody {
  return typeof v === "object" && v !== null;
}

export interface StartDeps {
  session: Session | null;
  store: AttemptStore | null;
  prompt?: (game: StoreGame, seed: string) => BuiltPrompt;
  /**
   * Effective-unlock gate (rule verdict + sequential world gate + curated
   * free/ad-unlock exceptions, as computed by enrichGames). When provided
   * and resolving false, the start is rejected with 403 GAME_LOCKED so a
   * locked game can never be played via a direct API call that bypasses the
   * library/map UI. Omitted only in offline tests that seed no catalog.
   */
  isUnlocked?: (slug: string) => Promise<boolean>;
}

function fail(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: code, message }, { status });
}

function defaultPrompt(game: StoreGame, seed: string): BuiltPrompt {
  return buildPrompt(game.promptSetRef, game.promptUnits, seed);
}

async function handleStartAttempt(
  gameSlug: string,
  body: unknown,
  deps: StartDeps,
): Promise<Response> {
  if (!deps.session) return unauthorized(enErrors.unauthorizedDescription);
  if (!deps.store) {
    return fail("SERVICE_UNAVAILABLE", enErrors.storageUnavailable, 503);
  }
  const payload: StartBody = isStartBody(body) ? body : {};
  const difficulty =
    payload.difficulty === undefined ? "beginner" : payload.difficulty;
  if (
    typeof difficulty !== "string" ||
    !(DIFFICULTIES as readonly string[]).includes(difficulty)
  ) {
    return fail("INVALID_DIFFICULTY", enErrors.requiredField, 400);
  }
  const seed =
    typeof payload.seed === "string" && payload.seed.length > 0
      ? payload.seed
      : crypto.randomUUID();

  const game = await deps.store.getActiveGame(gameSlug);
  if (!game) {
    return fail("GAME_NOT_FOUND", enErrors.fileNotAvailable, 404);
  }
  if (deps.isUnlocked) {
    let unlocked = false;
    try {
      unlocked = await deps.isUnlocked(game.slug);
    } catch {
      return fail("SERVICE_UNAVAILABLE", enErrors.storageUnavailable, 503);
    }
    if (!unlocked) {
      return fail("GAME_LOCKED", enErrors.fileNotAvailable, 403);
    }
  }
  let prompt: BuiltPrompt;
  try {
    prompt = (deps.prompt ?? defaultPrompt)(game, seed);
  } catch {
    return fail("GAME_CONTENT_ERROR", enErrors.storageUnavailable, 500);
  }
  try {
    const attempt = await deps.store.startAttempt({
      game,
      userId: deps.session.userId,
      difficulty,
      seed,
      expectedText: prompt.text,
    });
    return NextResponse.json(
      {
        attemptId: attempt.id,
        gameSlug: game.slug,
        version: game.version,
        expectedText: prompt.text,
        difficulty: attempt.difficulty,
        expiresAt: attempt.expiresAt,
        timing: {
          kind: game.timingKind,
          limitSeconds: game.timingLimitSeconds,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "START_FAILED";
    if (message.includes("TOO_MANY_ACTIVE")) {
      return fail("TOO_MANY_ACTIVE", enErrors.storageUnavailable, 429);
    }
    return fail("START_FAILED", enErrors.storageUnavailable, 500);
  }
}

async function readBody(req: NextRequest): Promise<unknown> {
  try {
    return (await req.json()) as unknown;
  } catch {
    return {};
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ gameId: string }> },
): Promise<Response> {
  const session = await getSession();
  const client = await userDbClient();
  if (!session || !client) {
    return handleStartAttempt((await ctx.params).gameId, await readBody(req), {
      session,
      store: client ? createSupabaseAttemptStore(client) : null,
    });
  }
  const { createSupabaseStudentStore } = await import(
    "@/lib/typing-game/server/student-store"
  );
  const { enrichGames } = await import("@/lib/typing-game/server/games");
  const studentStore = createSupabaseStudentStore(client);
  const userId = session.userId;
  return handleStartAttempt((await ctx.params).gameId, await readBody(req), {
    session,
    store: createSupabaseAttemptStore(client),
    isUnlocked: async (slug: string) => {
      const games = await enrichGames(userId, studentStore);
      return games.some((g) => g.slug === slug && g.unlocked);
    },
  });
}

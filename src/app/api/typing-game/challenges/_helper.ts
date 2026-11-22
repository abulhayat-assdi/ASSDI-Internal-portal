import { NextResponse } from "next/server";
import { getSession, unauthorized, userDbClient, type Session } from "@/lib/typing-game/server/auth";
import { createChallengeStore } from "@/lib/typing-game/server/challenge-store";

export interface ChallengeCtx {
  session: Session;
  store: ReturnType<typeof createChallengeStore>;
}

export async function challengeContext(): Promise<ChallengeCtx | Response> {
  const session = await getSession();
  if (!session) return unauthorized();
  const client = await userDbClient();
  if (!client) return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
  return { session, store: createChallengeStore(client) };
}

const STATUS: Record<string, number> = {
  UNAUTHENTICATED: 401,
  NOT_BATCHMATE: 403,
  FEATURE_OFF: 403,
  NOT_FOUND: 404,
  ALREADY_OPEN: 409,
  TOO_MANY_OPEN: 409,
  CANNOT_CANCEL: 409,
  NOT_PENDING: 409,
  NOT_OPEN: 409,
  NOT_STARTED: 409,
  ALREADY_PLAYED: 409,
  TOO_FAST: 422,
  BAD_INPUT: 400,
};

export function challengeError(e: unknown, where: string): Response {
  const code = e instanceof Error ? e.message : "SERVER_ERROR";
  const status = STATUS[code];
  if (!status) console.error(`[typing-game/challenges/${where}]`, e);
  return NextResponse.json({ error: status ? code : "SERVER_ERROR" }, { status: status ?? 500 });
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return typeof b === "object" && b !== null && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

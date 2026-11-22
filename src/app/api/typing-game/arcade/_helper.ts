import { NextResponse } from "next/server";
import { getSession, unauthorized, userDbClient, type Session } from "@/lib/typing-game/server/auth";
import { createArcadeStore } from "@/lib/typing-game/server/arcade-store";
import type { PostgrestClient } from "@supabase/postgrest-js";

export interface ArcadeCtx {
  session: Session;
  client: PostgrestClient;
  store: ReturnType<typeof createArcadeStore>;
}

export async function arcadeContext(): Promise<ArcadeCtx | Response> {
  const session = await getSession();
  if (!session) return unauthorized();
  const client = await userDbClient();
  if (!client) return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
  return { session, client, store: createArcadeStore(client) };
}

const STATUS: Record<string, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  LOCKED: 403,
  NOT_FOUND: 404,
  NOT_ENOUGH_COINS: 409,
  TOO_LONG: 422,
  BAD_INPUT: 400,
};

export function arcadeError(e: unknown, where: string): Response {
  const code = e instanceof Error ? e.message : "SERVER_ERROR";
  const status = STATUS[code];
  if (!status) console.error(`[typing-game/arcade/${where}]`, e);
  return NextResponse.json({ error: status ? code : "SERVER_ERROR" }, { status: status ?? 500 });
}

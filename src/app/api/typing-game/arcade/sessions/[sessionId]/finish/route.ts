/**
 * POST /api/typing-game/arcade/sessions/:sessionId/finish  { log: [tick, key][], ticks }
 * Replays the run on the server from the session seed — the browser's own
 * score is never used — checks it against the server clock, saves it once
 * and pays XP and coins.
 */
import { NextResponse } from "next/server";
import { findArcadeGame } from "@/lib/typing-game/arcade/catalog";
import { buildArcadeContent } from "@/lib/typing-game/arcade/content.server";
import { TICK_MS } from "@/lib/typing-game/arcade/core";
import { replayRun, type KeyLog } from "@/lib/typing-game/arcade/registry";
import { createActivityStore } from "@/lib/typing-game/server/activity-store";
import { arcadeContext, arcadeError } from "../../../_helper";

/** Network and start-up slack when comparing game time with the server clock. */
const CLOCK_SLACK_MS = 4000;

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  const { sessionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const ctx = await arcadeContext();
  if (ctx instanceof Response) return ctx;

  let body: { log?: unknown; ticks?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });
  }

  try {
    const row = await ctx.store.get(sessionId);
    if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (row.status !== "started") return NextResponse.json({ error: "ALREADY_FINISHED" }, { status: 409 });
    const game = findArcadeGame(row.slug);
    if (!game) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const ticks = Number(body.ticks);
    const elapsed = Date.now() - Date.parse(row.startedAt);
    // The game cannot have run faster than real time.
    if (!Number.isInteger(ticks) || ticks * TICK_MS > elapsed + CLOCK_SLACK_MS) {
      return NextResponse.json({ error: "BAD_TICKS" }, { status: 422 });
    }
    const check = replayRun(game.slug, buildArcadeContent(row.seed), row.seed, body.log as KeyLog, ticks);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 422 });

    const result = check.result;
    const outcome = await ctx.store.finish(sessionId, result);
    if (result.durationMs > 0) await createActivityStore(ctx.client).addTime(result.durationMs);
    return NextResponse.json({ result, ...outcome });
  } catch (e) {
    return arcadeError(e, "finish");
  }
}

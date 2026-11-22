/**
 * POST /api/typing-game/arcade/:slug/start
 * Opens a run of an unlocked game and sends the browser its seed and the
 * words/sentences picked for it.
 */
import { NextResponse } from "next/server";
import { findArcadeGame } from "@/lib/typing-game/arcade/catalog";
import { buildArcadeContent } from "@/lib/typing-game/arcade/content.server";
import { arcadeContext, arcadeError } from "../../_helper";

export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await params;
  if (!findArcadeGame(slug)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const ctx = await arcadeContext();
  if (ctx instanceof Response) return ctx;
  try {
    const { id, seed } = await ctx.store.start(slug);
    return NextResponse.json({ sessionId: id, seed, content: buildArcadeContent(seed) });
  } catch (e) {
    return arcadeError(e, "start");
  }
}

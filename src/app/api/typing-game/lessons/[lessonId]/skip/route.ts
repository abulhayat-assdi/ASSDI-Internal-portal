/**
 * POST /api/typing-game/lessons/:lessonId/skip
 * Body: { mode: "unlock" | "skip" }
 *   unlock — open this lesson by marking the unfinished lessons before it as skipped
 *   skip   — the same, and mark this lesson skipped too (opens the next one)
 * Costs rewarded-ad views when ads are on; with ads off it happens directly.
 * The Final Assessment (Bangla gate) can be opened but never skipped.
 */
import { NextResponse } from "next/server";
import { lessonContext, lessonError } from "../../_helper";
import { lessonsToSkip } from "@/lib/typing-game/curriculum/progress";
import { UNSKIPPABLE, findLesson, levelsFor } from "@/lib/typing-game/curriculum";
import { payForAction } from "@/lib/typing-game/ads/gate";
import { userDbClient } from "@/lib/typing-game/server/auth";

export async function POST(req: Request, { params }: { params: Promise<{ lessonId: string }> }): Promise<Response> {
  const { lessonId } = await params;
  const ctx = await lessonContext(lessonId);
  if (ctx instanceof Response) return ctx;

  let mode: unknown;
  try {
    mode = ((await req.json()) as { mode?: unknown }).mode;
  } catch {
    mode = undefined;
  }
  if (mode !== "unlock" && mode !== "skip") return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });
  if (mode === "skip" && UNSKIPPABLE.has(ctx.lesson.id)) {
    return NextResponse.json({ error: "NOT_SKIPPABLE" }, { status: 409 });
  }

  try {
    const progress = await ctx.store.listProgress(ctx.session.userId);
    const ids = lessonsToSkip(levelsFor(ctx.level.mode), ctx.lesson.id, progress, UNSKIPPABLE);
    if (ids === null) {
      // An unpassed Final Assessment sits in between — it must be passed, not skipped.
      return NextResponse.json({ error: "GATE_NOT_PASSED" }, { status: 409 });
    }
    if (mode === "skip" && !progress.has(ctx.lesson.id)) ids.push(ctx.lesson.id);
    if (ids.length === 0) return NextResponse.json({ skipped: 0 });

    // Ads off → free. Ads on → the student must have watched the configured
    // number of rewarded ads for this lesson first (spent here, once).
    const client = await userDbClient();
    if (!client) return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
    const paid = await payForAction(client, ctx.session.userId, "lesson_skip", ctx.lesson.id);
    if (!paid.ok) return NextResponse.json({ error: "ADS_REQUIRED", views: paid.views }, { status: 402 });
    // Each row is stored under its own level.
    const byLevel = new Map<string, string[]>();
    for (const id of ids) {
      const levelId = findLesson(id)?.level.id ?? ctx.level.id;
      byLevel.set(levelId, [...(byLevel.get(levelId) ?? []), id]);
    }
    let skipped = 0;
    for (const [levelId, levelIds] of byLevel) skipped += await ctx.store.skip(levelIds, levelId);
    return NextResponse.json({ skipped });
  } catch (e) {
    return lessonError(e);
  }
}

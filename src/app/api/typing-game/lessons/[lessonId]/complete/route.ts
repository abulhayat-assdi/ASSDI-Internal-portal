/**
 * POST /api/typing-game/lessons/:lessonId/complete
 * English body: { correctChars, keystrokes, errors, elapsedMs } for the whole lesson
 *   (the player only advances on the right key, so the text is known).
 * Bangla body:  { screens: [{ typedText, keystrokesTotal, keystrokesCorrect, elapsedMs }] }
 *   (IMEs compose text, so the server scores what was typed per screen).
 * The server rebuilds the lesson's screens itself, checks the numbers are
 * possible, and saves the result (finishing = passing; no speed minimum).
 */
import { NextResponse } from "next/server";
import { lessonContext, lessonError } from "../../_helper";
import {
  evaluateLessonResult,
  evaluateScreenSnapshots,
  lessonStates,
  type LessonResultInput,
} from "@/lib/typing-game/curriculum/progress";
import { lessonCharCount } from "@/lib/typing-game/curriculum/generate";
import { lessonScreens } from "@/lib/typing-game/curriculum/word-bank";
import { BANGLA_GATE_LESSON_ID, levelsFor, nextLesson } from "@/lib/typing-game/curriculum";
import { isBanglaModeUnlocked } from "@/lib/typing-game/practice/modes";

/** Clock drift allowance for timed screens. */
const TIMED_SLACK_MS = 1500;

export async function POST(req: Request, { params }: { params: Promise<{ lessonId: string }> }): Promise<Response> {
  const { lessonId } = await params;
  const ctx = await lessonContext(lessonId);
  if (ctx instanceof Response) return ctx;

  let body: Partial<LessonResultInput> & { screens?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });
  }

  try {
    if (ctx.level.mode === "bn" && !(await isBanglaModeUnlocked())) {
      return NextResponse.json({ error: "BANGLA_LOCKED" }, { status: 403 });
    }
    const progress = await ctx.store.listProgress(ctx.session.userId);
    if (lessonStates(levelsFor(ctx.level.mode), progress).get(ctx.lesson.id) === "locked") {
      return NextResponse.json({ error: "LOCKED" }, { status: 409 });
    }
    const screens = lessonScreens(ctx.lesson);
    let result;
    if (ctx.level.mode === "bn") {
      result = evaluateScreenSnapshots(screens, body.screens);
    } else {
      const timedMs = screens.reduce((n, s) => n + (s.type === "timed" ? (s.seconds ?? 0) * 1000 : 0), 0);
      result = evaluateLessonResult(
        {
          correctChars: Number(body.correctChars),
          keystrokes: Number(body.keystrokes),
          errors: Number(body.errors),
          elapsedMs: Number(body.elapsedMs),
        },
        lessonCharCount(screens),
        timedMs > 0 ? timedMs - TIMED_SLACK_MS : 0,
      );
    }
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 422 });

    const saved = await ctx.store.record({
      lessonId: ctx.lesson.id,
      levelId: ctx.level.id,
      wpm: result.wpm,
      accuracy: result.accuracy,
      stars: result.stars,
      elapsedMs: result.elapsedMs,
    });
    const next = nextLesson(ctx.lesson.id);
    return NextResponse.json({
      result,
      xp: saved.xp,
      firstCompletion: saved.firstCompletion,
      nextLessonId: next?.id ?? null,
      banglaUnlocked: ctx.lesson.id === BANGLA_GATE_LESSON_ID,
    });
  } catch (e) {
    return lessonError(e);
  }
}

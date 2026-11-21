/** Shared gate for lesson routes: session + user-scoped lesson store + lesson lookup. */
import { NextResponse } from "next/server";
import { getSession, unauthorized, userDbClient, type Session } from "@/lib/typing-game/server/auth";
import { createLessonStore, type LessonStore } from "@/lib/typing-game/server/lesson-store";
import { findLesson, type LessonDef, type LevelDef } from "@/lib/typing-game/curriculum";

export interface LessonRouteContext {
  session: Session;
  store: LessonStore;
  level: LevelDef;
  lesson: LessonDef;
}

export async function lessonContext(lessonId: string): Promise<LessonRouteContext | Response> {
  const session = await getSession();
  if (!session) return unauthorized();
  const client = await userDbClient();
  if (!client) return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
  const hit = findLesson(lessonId);
  if (!hit) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return { session, store: createLessonStore(client), ...hit };
}

export function lessonError(e: unknown): Response {
  const msg = e instanceof Error ? e.message : "";
  if (msg.includes("FORBIDDEN")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (msg.includes("BAD_INPUT")) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });
  console.error("[typing-game/lessons]", e);
  return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
}

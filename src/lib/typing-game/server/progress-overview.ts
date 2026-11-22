/**
 * Everything the Progress page shows, in one read: rank, lessons by level,
 * typing tests, daily typing time and a readable activity feed. Reads go
 * through RLS as the student.
 */
import type { PostgrestClient } from "@supabase/postgrest-js";
import { LEVELS, findLesson } from "@/lib/typing-game/curriculum";
import { levelLessons } from "@/lib/typing-game/curriculum/progress";
import { findTest } from "@/lib/typing-game/tests/catalog";
import { GAMES } from "@/lib/typing-game/content";
import { bdToday } from "./activity-store";

export interface LevelSummary {
  id: string;
  mode: "en" | "bn";
  number: number;
  title: string;
  total: number;
  completed: number;
  skipped: number;
  stars: number;
  maxStars: number;
  nextLessonId: string | null;
  nextLessonTitle: string | null;
}

export interface TestPoint {
  id: string;
  title: string;
  language: "en" | "bn";
  wpm: number;
  accuracy: number;
  at: string;
}

export interface ActivityItem {
  at: string;
  kind: "lesson" | "star" | "test" | "game" | "mission" | "other";
  label: string;
  xp: number;
}

export interface ProgressOverview {
  rank: { level: number; title: string; xp: number; floor: number; next: number | null; nextTitle: string | null };
  lessons: { completed: number; total: number; stars: number; maxStars: number; timeMs: number; bestWpm: number; bestAccuracy: number };
  levels: LevelSummary[];
  tests: TestPoint[];
  bestTest: TestPoint | null;
  days: { day: string; minutes: number }[];
  todayMinutes: number;
  goalMinutes: number;
  activity: ActivityItem[];
}

const num = (v: unknown) => (v == null ? 0 : Number(v));

export async function loadProgressOverview(client: PostgrestClient, userId: string): Promise<ProgressOverview> {
  const since = bdToday(new Date(Date.now() - 13 * 86400000));
  const [profile, levelsRes, lessonsRes, testsRes, daysRes, goalRes, xpRes, gamesRes] = await Promise.all([
    client.from("profiles").select("xp_total, current_level").eq("id", userId).maybeSingle(),
    client.from("levels").select("level, required_xp, title_en").order("level"),
    client.from("lesson_progress").select("lesson_id, status, stars, best_wpm, best_accuracy, total_time_ms").eq("user_id", userId),
    client
      .from("typing_test_sessions")
      .select("id, test_id, language, wpm, accuracy, graded_at")
      .eq("user_id", userId)
      .eq("status", "graded")
      .order("graded_at", { ascending: false })
      .limit(30),
    client.from("daily_activity").select("day, typing_ms").eq("user_id", userId).gte("day", since),
    client.from("student_settings").select("daily_goal_minutes").eq("user_id", userId).maybeSingle(),
    client.from("xp_ledger").select("amount, source, reason, metadata, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(25),
    client.from("games").select("id, slug"),
  ]);

  // ---- rank
  const xp = num((profile.data as Record<string, unknown> | null)?.xp_total);
  const level = Math.max(1, num((profile.data as Record<string, unknown> | null)?.current_level) || 1);
  const ladder = ((levelsRes.data ?? []) as { level: number; required_xp: number; title_en: string }[]).map((l) => ({
    level: Number(l.level),
    req: Number(l.required_xp),
    title: String(l.title_en),
  }));
  const cur = ladder.find((l) => l.level === level);
  const nxt = ladder.find((l) => l.level === level + 1);

  // ---- lessons
  const rows = new Map<string, Record<string, unknown>>();
  for (const r of (lessonsRes.data ?? []) as Record<string, unknown>[]) rows.set(String(r.lesson_id), r);
  let completed = 0;
  let stars = 0;
  let timeMs = 0;
  let bestWpm = 0;
  let bestAccuracy = 0;
  for (const r of rows.values()) {
    if (r.status !== "completed") continue;
    completed++;
    stars += num(r.stars);
    timeMs += num(r.total_time_ms);
    bestWpm = Math.max(bestWpm, num(r.best_wpm));
    bestAccuracy = Math.max(bestAccuracy, num(r.best_accuracy));
  }
  const levels: LevelSummary[] = LEVELS.map((lv) => {
    const all = levelLessons(lv);
    const done = all.filter((l) => rows.get(l.id)?.status === "completed");
    // Next = first untouched lesson; if none, the first skipped one.
    const next = all.find((l) => !rows.has(l.id)) ?? all.find((l) => rows.get(l.id)?.status !== "completed") ?? null;
    return {
      id: lv.id,
      mode: lv.mode,
      number: lv.number,
      title: lv.title,
      total: all.length,
      completed: done.length,
      skipped: all.filter((l) => rows.get(l.id)?.status === "skipped").length,
      stars: done.reduce((n, l) => n + num(rows.get(l.id)?.stars), 0),
      maxStars: all.length * 3,
      nextLessonId: next?.id ?? null,
      nextLessonTitle: next ? `${next.number}. ${next.title}` : null,
    };
  });
  const totalLessons = levels.filter((l) => l.mode === "en").reduce((n, l) => n + l.total, 0);

  // ---- tests (oldest first for the chart)
  const tests: TestPoint[] = ((testsRes.data ?? []) as Record<string, unknown>[])
    .map((t) => ({
      id: String(t.id),
      title: findTest(String(t.test_id))?.title ?? String(t.test_id),
      language: (t.language === "bn" ? "bn" : "en") as "en" | "bn",
      wpm: num(t.wpm),
      accuracy: num(t.accuracy),
      at: String(t.graded_at ?? ""),
    }))
    .filter((t) => t.wpm > 0)
    .reverse();
  const bestTest = tests.reduce<TestPoint | null>((b, t) => (!b || t.wpm > b.wpm ? t : b), null);

  // ---- daily minutes, last 14 days
  const byDay = new Map<string, number>();
  for (const d of (daysRes.data ?? []) as { day: string; typing_ms: number | string }[]) byDay.set(String(d.day), Number(d.typing_ms));
  const days = Array.from({ length: 14 }, (_, i) => {
    const day = bdToday(new Date(Date.now() - (13 - i) * 86400000));
    return { day, minutes: Math.floor((byDay.get(day) ?? 0) / 60000) };
  });

  // ---- readable activity feed
  const gameSlug = new Map<string, string>();
  for (const g of (gamesRes.data ?? []) as { id: string; slug: string }[]) gameSlug.set(String(g.id), String(g.slug));
  const gameTitle = (id: unknown) => {
    const slug = gameSlug.get(String(id));
    return GAMES.find((g) => g.slug === slug)?.title.en ?? slug ?? "গেম";
  };
  const lessonTitle = (id: unknown) => {
    const hit = findLesson(String(id));
    return hit ? `${hit.level.mode === "bn" ? "বাংলা " : ""}L${hit.level.number} · ${hit.lesson.title}` : String(id);
  };
  const activity: ActivityItem[] = ((xpRes.data ?? []) as Record<string, unknown>[]).map((e) => {
    const meta = (e.metadata ?? {}) as Record<string, unknown>;
    const at = String(e.created_at);
    const amount = num(e.amount);
    if (e.reason === "lesson completed") return { at, kind: "lesson", label: `লেসন সম্পূর্ণ — ${lessonTitle(meta.lesson_id)}`, xp: amount };
    if (e.reason === "lesson star") return { at, kind: "star", label: `${num(meta.star)} নম্বর স্টার — ${lessonTitle(meta.lesson_id)}`, xp: amount };
    if (e.reason === "typing test") return { at, kind: "test", label: "টাইপিং টেস্ট শেষ", xp: amount };
    if (e.source === "attempt") {
      return { at, kind: "game", label: `গেম খেলা — ${gameTitle(meta.game_id)}${meta.personal_best === true ? " (নতুন সেরা!)" : ""}`, xp: amount };
    }
    if (String(e.source).includes("mission")) return { at, kind: "mission", label: "মিশন সম্পূর্ণ", xp: amount };
    return { at, kind: "other", label: String(e.reason || e.source), xp: amount };
  });

  return {
    rank: { level, title: cur?.title ?? "", xp, floor: cur?.req ?? 0, next: nxt?.req ?? null, nextTitle: nxt?.title ?? null },
    lessons: { completed, total: totalLessons, stars, maxStars: totalLessons * 3, timeMs, bestWpm, bestAccuracy },
    levels,
    tests,
    bestTest,
    days,
    todayMinutes: days[days.length - 1]?.minutes ?? 0,
    goalMinutes: num((goalRes.data as Record<string, unknown> | null)?.daily_goal_minutes) || 15,
    activity,
  };
}

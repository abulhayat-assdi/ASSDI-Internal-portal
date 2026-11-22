/**
 * Staff dashboards: one RPC each (fn_staff_insights / fn_staff_students,
 * 0052_staff_console.sql). The database decides which batches the caller
 * may see (super admin: all · org admin: own org · teacher: assigned).
 */
import type { PostgrestClient } from "@supabase/postgrest-js";

export interface InsightTotals {
  batches: number;
  activeBatches: number;
  students: number;
  activeToday: number;
  active7d: number;
  neverStarted: number;
  minutesToday: number;
  minutes7d: number;
  lessonsTotal: number;
  lessons7d: number;
  tests30d: number;
  avgBestWpm: number | null;
  avgAccuracy: number | null;
  games7d: number;
}

export interface InsightBatch {
  id: string;
  name: string;
  course: string;
  joinCode: string;
  active: boolean;
  members: number;
  active7d: number;
  minutes7d: number;
  lessonsAvg: number;
  avgWpm: number | null;
  teachers: string[];
}

export interface InsightStudent {
  userId: string;
  name: string;
  roll: string;
  batch: string;
}

export interface Insights {
  today: string;
  totals: InsightTotals;
  days: { day: string; minutes: number; active: number }[];
  batches: InsightBatch[];
  top: (InsightStudent & { minutes: number; level: number; wpm: number | null; lessons7d: number })[];
  attention: (InsightStudent & { reason: "never" | "inactive" | "accuracy"; lastDay: string | null; accuracy: number | null })[];
  attentionCount: number;
  levels: { levelId: string; students: number; completions: number }[];
  wpmBuckets: { lt20: number; w20: number; w30: number; w40: number; w50: number; none: number };
  games: { slug: string; plays: number; players: number; best: number }[];
}

export interface StaffStudentRow {
  userId: string;
  name: string;
  email: string;
  roll: string;
  batchId: string;
  batch: string;
  memberActive: boolean;
  status: string;
  level: number;
  xp: number;
  coins: number;
  lessons: number;
  bestWpm: number | null;
  minutes7d: number;
  lastDay: string | null;
}

const EMPTY: Insights = {
  today: "",
  totals: {
    batches: 0, activeBatches: 0, students: 0, activeToday: 0, active7d: 0, neverStarted: 0, minutesToday: 0,
    minutes7d: 0, lessonsTotal: 0, lessons7d: 0, tests30d: 0, avgBestWpm: null, avgAccuracy: null, games7d: 0,
  },
  days: [],
  batches: [],
  top: [],
  attention: [],
  attentionCount: 0,
  levels: [],
  wpmBuckets: { lt20: 0, w20: 0, w30: 0, w40: 0, w50: 0, none: 0 },
  games: [],
};

export async function loadInsights(client: PostgrestClient, batchIds?: string[]): Promise<Insights> {
  const res = await client.rpc("fn_staff_insights", { p_batch_ids: batchIds && batchIds.length ? batchIds : null });
  if (res.error) {
    console.error("[typing-game] fn_staff_insights failed:", res.error.message);
    return EMPTY;
  }
  const d = (res.data ?? {}) as Partial<Insights>;
  return { ...EMPTY, ...d, totals: { ...EMPTY.totals, ...(d.totals ?? {}) }, wpmBuckets: { ...EMPTY.wpmBuckets, ...(d.wpmBuckets ?? {}) } };
}

export async function loadStaffStudents(
  client: PostgrestClient,
  opts: { batchIds?: string[]; q?: string; limit?: number } = {},
): Promise<StaffStudentRow[]> {
  const res = await client.rpc("fn_staff_students", {
    p_batch_ids: opts.batchIds && opts.batchIds.length ? opts.batchIds : null,
    p_q: opts.q?.trim() || null,
    p_limit: opts.limit ?? 300,
  });
  if (res.error) {
    console.error("[typing-game] fn_staff_students failed:", res.error.message);
    return [];
  }
  return (Array.isArray(res.data) ? res.data : []) as StaffStudentRow[];
}

/** "আজ", "গতকাল", "৫ দিন আগে" — for a Dhaka date string relative to today. */
export function daysAgo(day: string | null, today: string): string {
  if (!day) return "কখনো না";
  const diff = Math.round((Date.parse(today) - Date.parse(day)) / 86400000);
  if (diff <= 0) return "আজ";
  if (diff === 1) return "গতকাল";
  return `${diff} দিন আগে`;
}

/** Today's date in Dhaka (YYYY-MM-DD). */
export function dhakaToday(): string {
  return new Date(Date.now() + 6 * 3600000).toISOString().slice(0, 10);
}

export interface StaffTeacherRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  courseId: string | null;
  batchId: string | null;
  target: string;
  scope: "batch" | "course";
  students: number;
  createdAt: string;
}

export async function loadStaffTeachers(client: PostgrestClient): Promise<StaffTeacherRow[]> {
  const res = await client.rpc("fn_staff_teachers");
  if (res.error) {
    console.error("[typing-game] fn_staff_teachers failed:", res.error.message);
    return [];
  }
  return (Array.isArray(res.data) ? res.data : []) as StaffTeacherRow[];
}

export interface StaffStudentProgress {
  today: string;
  profile: { name: string; email: string; level: number; xp: number; coins: number; status: string } | null;
  lessons: { levelId: string; done: number; skipped: number; stars: number; bestWpm: number | null; last: string }[];
  tests: { testId: string; language: string; wpm: number; accuracy: number; at: string }[];
  days: { day: string; minutes: number; active: number }[];
  lastDay: string | null;
  minutesTotal: number;
  games: { slug: string; plays: number; best: number }[];
  challenges: { played: number; wins: number; draws: number };
}

/** null when the caller may not see this student. */
export async function loadStaffStudentProgress(client: PostgrestClient, userId: string): Promise<StaffStudentProgress | null> {
  const res = await client.rpc("fn_staff_student_progress", { p_user: userId });
  if (res.error || !res.data) return null;
  return res.data as StaffStudentProgress;
}

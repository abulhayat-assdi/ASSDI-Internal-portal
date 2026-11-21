/** Curriculum registry: every level, and lookups by lesson id. */
import { EN_FOUNDATION } from "./en-foundation";
import { levelLessons } from "./progress";
import type { CurriculumMode, LessonDef, LevelDef } from "./types";

export * from "./types";
export { BANGLA_GATE_LESSON_ID } from "./en-foundation";

export const LEVELS: LevelDef[] = [EN_FOUNDATION];

export function levelsFor(mode: CurriculumMode): LevelDef[] {
  return LEVELS.filter((l) => l.mode === mode).sort((a, b) => a.number - b.number);
}

export function findLesson(lessonId: string): { level: LevelDef; lesson: LessonDef } | null {
  for (const level of LEVELS) {
    const lesson = levelLessons(level).find((l) => l.id === lessonId);
    if (lesson) return { level, lesson };
  }
  return null;
}

/** The lesson after `lessonId` in the same level, if any. */
export function nextLesson(lessonId: string): LessonDef | null {
  const hit = findLesson(lessonId);
  if (!hit) return null;
  const all = levelLessons(hit.level);
  const i = all.findIndex((l) => l.id === lessonId);
  return all[i + 1] ?? null;
}

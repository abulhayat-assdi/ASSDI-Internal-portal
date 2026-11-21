/** Curriculum registry: every level, and lookups by lesson id. */
import { EN_FOUNDATION, BANGLA_GATE_LESSON_ID as GATE } from "./en-foundation";
import { EN_CAPITALS, EN_NUMBERS } from "./en-levels-2-3";
import { EN_WORDS, EN_SPEED, EN_PROFESSIONAL } from "./en-levels-4-6";
import { levelLessons, trackLessons } from "./progress";
import type { CurriculumMode, LessonDef, LevelDef } from "./types";

export * from "./types";
export { BANGLA_GATE_LESSON_ID } from "./en-foundation";

export const LEVELS: LevelDef[] = [EN_FOUNDATION, EN_CAPITALS, EN_NUMBERS, EN_WORDS, EN_SPEED, EN_PROFESSIONAL];

/** Lessons that can be opened but never skipped (the Bangla gate). */
export const UNSKIPPABLE = new Set<string>([GATE]);

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

/** The lesson after `lessonId` in its track (crossing into the next level), if any. */
export function nextLesson(lessonId: string): LessonDef | null {
  const hit = findLesson(lessonId);
  if (!hit) return null;
  const all = trackLessons(levelsFor(hit.level.mode));
  const i = all.findIndex((l) => l.id === lessonId);
  return all[i + 1] ?? null;
}

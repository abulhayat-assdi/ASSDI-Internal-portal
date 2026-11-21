/**
 * Builds a LevelDef from unit/lesson specs, numbering lessons and carrying
 * the "keys learned so far" forward (from earlier levels too). Lesson ids
 * are `<levelId>-<NN>` and are permanent — progress is stored against them.
 */
import type { CurriculumMode, LessonDef, LessonKind, LevelDef, UnitDef } from "./types";

export interface LessonSpec {
  title: string;
  kind: LessonKind;
  newKeys: string[];
  focus?: string[];
  pool?: number;
  topic?: string;
  seconds?: number;
}

export interface LevelSpec {
  id: string;
  mode: CurriculumMode;
  number: number;
  title: string;
  description: string;
  units: { title: string; lessons: LessonSpec[] }[];
}

/** Every key taught by a level (in teaching order). */
export function levelKeys(level: LevelDef): string[] {
  const last = level.units.at(-1)?.lessons.at(-1);
  return last ? last.allowedKeys.slice() : [];
}

export function buildLevel(spec: LevelSpec, startingKeys: string[] = []): LevelDef {
  const learned = startingKeys.slice();
  let n = 0;
  const units: UnitDef[] = spec.units.map((u, ui) => ({
    id: `${spec.id}-u${ui + 1}`,
    title: u.title,
    lessons: u.lessons.map((l): LessonDef => {
      n += 1;
      for (const key of l.newKeys) if (!learned.includes(key)) learned.push(key);
      return {
        id: `${spec.id}-${String(n).padStart(2, "0")}`,
        mode: spec.mode,
        levelId: spec.id,
        unitId: `${spec.id}-u${ui + 1}`,
        number: n,
        title: l.title,
        kind: l.kind,
        newKeys: l.newKeys,
        allowedKeys: learned.slice(),
        ...(l.focus ? { focus: l.focus } : {}),
        ...(l.pool ? { pool: l.pool } : {}),
        ...(l.topic ? { topic: l.topic } : {}),
        ...(l.seconds ? { seconds: l.seconds } : {}),
      };
    }),
  }));
  return { id: spec.id, mode: spec.mode, number: spec.number, title: spec.title, description: spec.description, units };
}

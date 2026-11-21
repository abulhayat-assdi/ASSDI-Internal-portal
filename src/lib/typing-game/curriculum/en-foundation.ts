/**
 * English Level 1 — Foundation. Home row first, then reaching up and down,
 * then the whole letter keyboard. Passing the Final Assessment opens the
 * Bangla mode. Lesson ids are permanent (progress is stored against them).
 */
import type { LessonDef, LessonKind, LevelDef, UnitDef } from "./types";

interface Spec {
  title: string;
  kind: LessonKind;
  newKeys: string[];
}

const UNITS: { id: string; title: string; lessons: Spec[] }[] = [
  {
    id: "en-1-u1",
    title: "Home Row Start",
    lessons: [
      { title: "J, F and Space", kind: "keys", newKeys: ["j", "f", " "] },
      { title: "U, R and K", kind: "keys", newKeys: ["u", "r", "k"] },
      { title: "D, E and I", kind: "keys", newKeys: ["d", "e", "i"] },
      { title: "C, G and N", kind: "keys", newKeys: ["c", "g", "n"] },
      { title: "Review 1", kind: "review", newKeys: [] },
    ],
  },
  {
    id: "en-1-u2",
    title: "Reaching Out",
    lessons: [
      { title: "T, S and L", kind: "keys", newKeys: ["t", "s", "l"] },
      { title: "O, B and A", kind: "keys", newKeys: ["o", "b", "a"] },
      { title: "V, H and M", kind: "keys", newKeys: ["v", "h", "m"] },
      { title: "Period and Comma", kind: "keys", newKeys: [".", ","] },
      { title: "Review 2", kind: "review", newKeys: [] },
    ],
  },
  {
    id: "en-1-u3",
    title: "Full Keyboard",
    lessons: [
      { title: "W, X and Semicolon", kind: "keys", newKeys: ["w", "x", ";"] },
      { title: "Q, Y and P", kind: "keys", newKeys: ["q", "y", "p"] },
      { title: "Z and Apostrophe", kind: "keys", newKeys: ["z", "'"] },
      { title: "Review 3", kind: "review", newKeys: [] },
    ],
  },
  {
    id: "en-1-u4",
    title: "Wrapping Up",
    lessons: [
      { title: "Foundation Wrap-up", kind: "wrapup", newKeys: [] },
      { title: "Final Assessment", kind: "assessment", newKeys: [] },
    ],
  },
];

function build(): LevelDef {
  const learned: string[] = [];
  let n = 0;
  const units: UnitDef[] = UNITS.map((u) => ({
    id: u.id,
    title: u.title,
    lessons: u.lessons.map((spec): LessonDef => {
      n += 1;
      learned.push(...spec.newKeys.filter((key) => !learned.includes(key)));
      return {
        id: `en-1-${String(n).padStart(2, "0")}`,
        mode: "en",
        levelId: "en-1",
        unitId: u.id,
        number: n,
        title: spec.title,
        kind: spec.kind,
        newKeys: spec.newKeys,
        allowedKeys: learned.slice(),
      };
    }),
  }));
  return {
    id: "en-1",
    mode: "en",
    number: 1,
    title: "Foundation",
    description: "হোম রো থেকে শুরু করে পুরো কিবোর্ডের সব অক্ষর — সঠিক আঙুলে।",
    units,
  };
}

export const EN_FOUNDATION: LevelDef = build();

/** The lesson whose completion opens Bangla mode. */
export const BANGLA_GATE_LESSON_ID = "en-1-16";

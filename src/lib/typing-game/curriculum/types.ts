/** Curriculum shapes: mode → level → unit → lesson → screen. */

export type CurriculumMode = "en" | "bn";

export type ScreenType =
  /** Find one new key on the keyboard. */
  | "key_intro"
  /** Short letter groups shown as boxes. */
  | "letter_drill"
  /** Real words built only from learned keys. */
  | "word_drill"
  /** Longer flowing text. */
  | "sentence"
  /** Timed run: type until the clock runs out. */
  | "timed";

export interface LessonScreen {
  type: ScreenType;
  /** Text to type (key_intro: the single key). */
  text: string;
  /** Instruction line above the text. */
  title: string;
  /** Seconds, for timed screens. */
  seconds?: number;
}

export type LessonKind =
  | "keys"
  | "review"
  | "wrapup"
  | "assessment"
  /** Most-used words (top `pool` of the word bank). */
  | "words"
  /** Words heavy in easily-confused letters (`focus`). */
  | "accuracy"
  /** Full sentences with capitals and punctuation. */
  | "sentences"
  /** One short line typed several times to build speed. */
  | "sprint"
  /** A long timed run (`seconds`). */
  | "endurance"
  /** Real-world writing: `topic` names a text set (see professional-texts.ts). */
  | "professional";

export interface LessonDef {
  /** Stable id, never reused: "en-1-03". */
  id: string;
  mode: CurriculumMode;
  levelId: string;
  unitId: string;
  /** 1-based position inside the level. */
  number: number;
  title: string;
  kind: LessonKind;
  /** Keys this lesson introduces (lowercase / symbols, " " for space). */
  newKeys: string[];
  /** Every key allowed in this lesson's text (learned so far, incl. new). */
  allowedKeys: string[];
  /** Letters to emphasise (accuracy lessons). */
  focus?: string[];
  /** Word-bank size to draw from (words lessons). */
  pool?: number;
  /** Text set for professional lessons. */
  topic?: string;
  /** Length of a timed run (assessment / endurance), in seconds. */
  seconds?: number;
}

export interface UnitDef {
  id: string;
  title: string;
  lessons: LessonDef[];
}

export interface LevelDef {
  id: string;
  mode: CurriculumMode;
  number: number;
  title: string;
  description: string;
  units: UnitDef[];
}

export interface LessonWithScreens extends LessonDef {
  screens: LessonScreen[];
}

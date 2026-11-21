import { PageHeader } from "@/components/typing-game/ui";
import { LessonsOverview, type OverviewLevel, type OverviewUnit } from "@/components/typing-game/lesson/lessons-overview";
import { DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { studentContext } from "@/lib/typing-game/server/student-pages";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { createLessonStore } from "@/lib/typing-game/server/lesson-store";
import { BANGLA_GATE_LESSON_ID, levelsFor } from "@/lib/typing-game/curriculum";
import { lessonStates, levelPercent } from "@/lib/typing-game/curriculum/progress";
import { banglaUnlockedBy } from "@/lib/typing-game/practice/modes";

/** Levels planned for the English track; only the ones with content are playable. */
const ENGLISH_PLAN = [
  "Foundation",
  "Capitals & Punctuation",
  "Numbers & Symbols",
  "Words & Sentences",
  "Speed Building",
  "Professional Typing",
];

export default async function LessonsPage() {
  const { session } = await studentContext(DEFAULT_LOCALE);
  const client = await userDbClient();
  if (!client) throw new Error("SERVICE_UNAVAILABLE");
  const progress = await createLessonStore(client).listProgress(session.userId);

  const built = levelsFor("en");
  const level = built[0];
  const states = lessonStates(level, progress);

  const levels: OverviewLevel[] = ENGLISH_PLAN.map((title, i) => {
    const def = built.find((l) => l.number === i + 1);
    return {
      id: def?.id ?? null,
      number: i + 1,
      title,
      description: def?.description ?? "",
      percent: def ? levelPercent(def, progress) : 0,
      ready: Boolean(def),
    };
  });

  const units: OverviewUnit[] = level.units.map((u) => ({
    id: u.id,
    title: u.title,
    lessons: u.lessons.map((l) => {
      const row = progress.get(l.id);
      return {
        id: l.id,
        number: l.number,
        title: l.title,
        kind: l.kind,
        state: states.get(l.id) ?? "locked",
        stars: row?.stars ?? 0,
        bestWpm: row?.bestWpm ?? 0,
        bestAccuracy: row?.bestAccuracy ?? 0,
        bestTimeMs: row?.bestTimeMs ?? null,
        skippable: l.id !== BANGLA_GATE_LESSON_ID,
      };
    }),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Typing Lessons"
        description="ধাপে ধাপে সঠিক আঙুলে টাইপিং শিখুন — লেসন শেষ করলেই পরেরটা খুলবে।"
      />
      <LessonsOverview
        levels={levels}
        current={levels[0]}
        units={units}
        firstVisit={progress.size === 0}
        banglaUnlocked={banglaUnlockedBy(progress)}
      />
    </div>
  );
}

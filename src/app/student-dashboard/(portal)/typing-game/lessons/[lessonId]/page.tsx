import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { LessonPlayer } from "@/components/typing-game/lesson/lesson-player";
import { AdSlot } from "@/components/typing-game/ads/ad-slot";
import { DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { studentContext } from "@/lib/typing-game/server/student-pages";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { createLessonStore } from "@/lib/typing-game/server/lesson-store";
import { findLesson, levelsFor } from "@/lib/typing-game/curriculum";
import { lessonStates } from "@/lib/typing-game/curriculum/progress";
import { buildScreens } from "@/lib/typing-game/curriculum/generate";
import { englishArticles, englishWordBank } from "@/lib/typing-game/curriculum/word-bank";

export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const hit = findLesson(lessonId);
  if (!hit) notFound();
  const { session } = await studentContext(DEFAULT_LOCALE);
  const client = await userDbClient();
  if (!client) throw new Error("SERVICE_UNAVAILABLE");
  const progress = await createLessonStore(client).listProgress(session.userId);
  const state = lessonStates(levelsFor(hit.level.mode), progress).get(hit.lesson.id);

  if (state === "locked") {
    return (
      <div className="tap-card mx-auto flex max-w-md flex-col items-center gap-3 p-6 text-center">
        <Lock className="h-8 w-8 text-ink-faint" aria-hidden="true" />
        <h1 className="font-display text-xl font-bold">{hit.lesson.title}</h1>
        <p className="text-sm text-ink-muted">আগের লেসনগুলো শেষ করলে এই লেসনটা খুলবে। চাইলে লেসন তালিকা থেকে Unlock করতে পারেন।</p>
        <Link href="/student-dashboard/typing-game/lessons" className="tap-btn tap-btn-primary tap-btn-md">
          লেসন তালিকা
        </Link>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      <AdSlot slot="lesson_left" className="hidden lg:flex" />
      <div className="min-w-0 flex-1">
    <LessonPlayer
      lessonId={hit.lesson.id}
      lessonTitle={`${hit.lesson.number}. ${hit.lesson.title}`}
      levelTitle={`Level ${hit.level.number} · ${hit.level.title}`}
      screens={buildScreens(hit.lesson, englishWordBank(), englishArticles())}
    />
      </div>
    </div>
  );
}

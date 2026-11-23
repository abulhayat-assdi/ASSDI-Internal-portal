import { typingBase } from "@/lib/typing-game/server/base";
import { notFound, redirect } from "next/navigation";
import { TestPlayer } from "@/components/typing-game/tests/test-player";
import { AdSlot } from "@/components/typing-game/ads/ad-slot";
import { findTest } from "@/lib/typing-game/tests/catalog";
import { isBanglaModeUnlocked } from "@/lib/typing-game/practice/modes";

export default async function TestPage({
  params,
  searchParams,
}: {
  params: Promise<{ testId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const base = await typingBase();
  const { testId } = await params;
  const { lang: rawLang } = await searchParams;
  const test = findTest(testId);
  if (!test) notFound();
  const lang = rawLang === "bn" ? "bn" : "en";
  if (lang === "bn" && !(await isBanglaModeUnlocked())) redirect(`${base}/tests`);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          {lang === "bn" ? "Bangla" : "English"} Typing Test
        </p>
        <h1 className="font-display text-xl font-bold">{test.title}</h1>
        {lang === "bn" ? <p className="text-sm text-ink-muted">কম্পিউটারে Bijoy বা Avro চালু করে টাইপ করুন।</p> : null}
      </div>
      <div className="flex gap-6">
        <AdSlot slot="practice_left" className="hidden lg:flex" />
        <div className="min-w-0 flex-1">
          <TestPlayer testId={test.id} lang={lang} title={test.title} />
        </div>
      </div>
    </div>
  );
}

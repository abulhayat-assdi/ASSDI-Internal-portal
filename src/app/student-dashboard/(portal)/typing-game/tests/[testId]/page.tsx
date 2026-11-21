import { notFound, redirect } from "next/navigation";
import { TestPlayer } from "@/components/typing-game/tests/test-player";
import { findTest } from "@/lib/typing-game/tests/catalog";
import { isBanglaModeUnlocked } from "@/lib/typing-game/practice/modes";

export default async function TestPage({
  params,
  searchParams,
}: {
  params: Promise<{ testId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { testId } = await params;
  const { lang: rawLang } = await searchParams;
  const test = findTest(testId);
  if (!test) notFound();
  const lang = rawLang === "bn" ? "bn" : "en";
  if (lang === "bn" && !(await isBanglaModeUnlocked())) redirect("/student-dashboard/typing-game/tests");
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          {lang === "bn" ? "বাংলা" : "English"} Typing Test
        </p>
        <h1 className="font-display text-xl font-bold">{test.title}</h1>
        {lang === "bn" ? <p className="text-sm text-ink-muted">কম্পিউটারে Bijoy বা Avro চালু করে টাইপ করুন।</p> : null}
      </div>
      <TestPlayer testId={test.id} lang={lang} title={test.title} />
    </div>
  );
}

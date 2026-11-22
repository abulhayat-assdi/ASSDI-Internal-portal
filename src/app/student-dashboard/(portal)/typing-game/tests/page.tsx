import Link from "next/link";
import { Award, BriefcaseBusiness, FileText, Lock, Timer } from "lucide-react";
import { PageHeader } from "@/components/typing-game/ui";
import { DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { studentContext } from "@/lib/typing-game/server/student-pages";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { createTestStore } from "@/lib/typing-game/server/test-store";
import { TYPING_TESTS, findTest } from "@/lib/typing-game/tests/catalog";
import { isBanglaModeUnlocked } from "@/lib/typing-game/practice/modes";

const BASE = "/student-dashboard/typing-game/tests";
const ICON = { timed: Timer, page: FileText, job: BriefcaseBusiness };

function fmt(seconds: number): string {
  return seconds >= 60 ? `${Math.round(seconds / 60)} min` : `${seconds}s`;
}

export default async function TestsPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { session } = await studentContext(DEFAULT_LOCALE);
  const client = await userDbClient();
  if (!client) throw new Error("SERVICE_UNAVAILABLE");
  const banglaUnlocked = await isBanglaModeUnlocked();
  const { lang: rawLang } = await searchParams;
  const lang = rawLang === "bn" && banglaUnlocked ? "bn" : "en";
  const history = (await createTestStore(client).history(session.userId, 100)).filter((h) => h.language === lang);

  const best = new Map<string, { wpm: number; accuracy: number }>();
  for (const h of history) {
    const cur = best.get(h.testId);
    if (h.wpm !== null && (!cur || h.wpm > cur.wpm)) best.set(h.testId, { wpm: h.wpm, accuracy: h.accuracy ?? 0 });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Typing Tests" description="গতি আর নির্ভুলতা যাচাই করুন — প্রতিটা টেস্ট শেষে সার্টিফিকেট পাবেন।" />

      <div className="tap-tablist" role="tablist" aria-label="Language">
        <Link href={`${BASE}?lang=en`} role="tab" aria-selected={lang === "en"} className={`tap-tab ${lang === "en" ? "tap-tab-active" : ""}`}>
          English
        </Link>
        {banglaUnlocked ? (
          <Link href={`${BASE}?lang=bn`} role="tab" aria-selected={lang === "bn"} className={`tap-tab ${lang === "bn" ? "tap-tab-active" : ""}`}>
            বাংলা
          </Link>
        ) : (
          <span className="tap-tab inline-flex items-center gap-1 opacity-60" title="English Level 1 পাস করলে খুলবে">
            বাংলা <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_440px]">
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {TYPING_TESTS.map((t) => {
          const Icon = ICON[t.kind];
          const b = best.get(t.id);
          return (
            <Link key={t.id} href={`${BASE}/${t.id}?lang=${lang}`} className="tap-card tap-card-interactive flex flex-col gap-2 p-4">
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-display font-bold">
                  <Icon className="h-4 w-4" style={{ color: "var(--tap-primary-500)" }} aria-hidden="true" />
                  {t.title}
                </span>
                <span className="tap-badge tap-badge-neutral">{t.kind === "page" ? `${t.words} words` : fmt(t.seconds)}</span>
              </span>
              <span className="text-sm text-ink-muted">{t.description}</span>
              <span className="text-xs text-ink-faint">
                {b ? `Best: ${Math.round(b.wpm)} wpm · ${Math.round(b.accuracy)}%` : "এখনো দেননি"}
              </span>
            </Link>
          );
        })}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-bold">আমার ফলাফল</h2>
        {history.length === 0 ? (
          <p className="text-sm text-ink-muted">এখনো কোনো টেস্ট দেননি।</p>
        ) : (
          <div className="tap-card overflow-x-auto p-0">
            <table className="tap-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Test</th>
                  <th className="text-right">WPM</th>
                  <th className="text-right">Accuracy</th>
                  <th className="text-left">Date</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 20).map((h) => (
                  <tr key={h.id}>
                    <td>{findTest(h.testId)?.title ?? h.testId}</td>
                    <td className="text-right font-bold tabular-nums">{Math.round(h.wpm ?? 0)}</td>
                    <td className="text-right tabular-nums">{Math.round(h.accuracy ?? 0)}%</td>
                    <td>{h.gradedAt ? new Date(h.gradedAt).toLocaleDateString("en-GB") : ""}</td>
                    <td className="text-right">
                      <Link href={`${BASE}/certificate/${h.id}`} className="tap-btn tap-btn-ghost tap-btn-sm" aria-label="Certificate">
                        <Award className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </div>
    </div>
  );
}

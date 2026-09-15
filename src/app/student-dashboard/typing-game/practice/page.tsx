import type { CSSProperties } from "react";
import Link from "next/link";
import { Gauge, KeyRound, Sparkles, Target, Type, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, EmptyState, PageHeader } from "@/components/typing-game/ui";
import { PROMPT_SETS } from "@/lib/typing-game/content";
import { buildPracticeDrill } from "@/lib/typing-game/adaptive";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { adaptivePageContext } from "@/lib/typing-game/server/adaptive-pages";
import { PracticeDrillCard } from "@/components/typing-game/practice-drill";

function contentLists(): { words: string[]; sentences: string[] } {
  const words: string[] = [];
  const sentences: string[] = [];
  for (const set of Object.values(PROMPT_SETS)) {
    if (!Array.isArray(set.items)) continue;
    const items = set.items.filter((x): x is string => typeof x === "string");
    if (set.kind === "words") words.push(...items);
    if (set.kind === "sentences") sentences.push(...items);
  }
  return { words, sentences };
}

/** Personal practice: quick actions plus a curated weak-key drill. */
export default async function PracticePage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "adaptive");
  const { store } = await adaptivePageContext(locale);
  const summary = await store.getSummary();
  const recommendations = summary?.recommendations ?? [];
  const weakKeys = (summary?.weaknesses ?? [])
    .filter((w) => w.type === "key")
    .slice(0, 4)
    .map((w) => w.target);
  const drill =
    weakKeys.length > 0 ? buildPracticeDrill(weakKeys, contentLists()) : null;
  const top = recommendations[0] ?? null;

  const actions: { key: string; label: string; game: string | null; icon: LucideIcon }[] = [
    { key: "need-most", label: t("needMost"), game: top?.gameSlug ?? null, icon: Sparkles },
    { key: "weak-keys", label: t("weakKeys"), game: top?.gameSlug ?? null, icon: KeyRound },
    {
      key: "accuracy",
      label: t("accuracy"),
      game:
        recommendations.find((r) => r.reason === "LOW_ACCURACY")?.gameSlug ??
        top?.gameSlug ??
        null,
      icon: Target,
    },
    {
      key: "speed",
      label: t("speed"),
      game:
        recommendations.find((r) => r.reason === "LOW_WPM")?.gameSlug ??
        top?.gameSlug ??
        null,
      icon: Zap,
    },
    { key: "sentences", label: t("sentences"), game: top?.gameSlug ?? null, icon: Type },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("practiceTitle")} description={t("practiceSubtitle")} />
      {recommendations.length === 0 ? (
        <EmptyState
          title={t("practiceTitle")}
          description={t("noRecommendations")}
        />
      ) : null}
      <Card className="tap-anim-in">
        <CardContent>
          <div className="flex flex-col gap-2">
            {actions.map((a, i) => {
              if (!a.game) return null;
              const Icon = a.icon;
              return (
                <Link
                  key={a.key}
                  href={`/student-dashboard/typing-game/games/${a.game}`}
                  className="tap-btn tap-btn-secondary tap-btn-sm justify-start tap-anim-in"
                  style={{ "--tap-i": i } as CSSProperties}
                >
                  <Icon className="h-4 w-4 text-primary-500" aria-hidden="true" />
                  {a.label}
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
      {drill ? <PracticeDrillCard locale={locale} drill={drill} /> : null}
      {recommendations.length > 0 ? (
        <div className="flex items-center gap-1.5 text-xs text-ink-faint">
          <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
          {t("band")}: {summary?.band ?? ""}
        </div>
      ) : null}
    </div>
  );
}

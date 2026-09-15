import { Gauge, Zap } from "lucide-react";
import { Badge, type BadgeTone, Card, CardContent, ProgressRing, StatCard } from "@/components/typing-game/ui";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";
import type {
  AdaptiveTrend,
  AdaptiveWeakness,
} from "@/lib/typing-game/server/adaptive-store";

function trendTone(trend: string): BadgeTone {
  if (trend === "improving") return "success";
  if (trend === "declining") return "danger";
  if (trend === "stable") return "primary";
  return "neutral";
}

/** Skill snapshot: accuracy/speed, trends, keys to practice. */
export function SkillOverview({
  locale,
  accuracy,
  wpm,
  trends,
  weaknesses,
}: {
  locale: Locale;
  accuracy: number | null;
  wpm: number | null;
  trends: AdaptiveTrend[];
  weaknesses: AdaptiveWeakness[];
}) {
  const t = getTranslator(locale, "adaptive");
  const trendText = (trend: string): string => {
    if (trend === "improving") return t("trendImproving");
    if (trend === "stable") return t("trendStable");
    if (trend === "declining") return t("trendDeclining");
    return t("trendInsufficient");
  };
  const weakKeys = weaknesses
    .filter((w) => w.type === "key")
    .slice(0, 6);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <ProgressRing
            value={accuracy ?? 0}
            max={100}
            size={72}
            label={t("accuracyLabel")}
          />
          <span className="text-xs font-semibold text-ink-muted">{t("accuracyLabel")}</span>
          <span className="text-sm font-bold">
            {accuracy === null ? "—" : `${String(Math.round(accuracy * 10) / 10)}%`}
          </span>
        </div>
        <StatCard
          className="min-w-[10rem] flex-1"
          label={t("wpmLabel")}
          value={wpm === null ? "—" : String(Math.round(wpm * 10) / 10)}
          icon={<Zap className="h-4 w-4" aria-hidden="true" />}
        />
      </div>
      {trends.length > 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col gap-2">
              {trends.map((tr) => (
                <div key={tr.metric} className="flex items-center justify-between gap-3 text-sm">
                  <span className="inline-flex items-center gap-1.5 font-semibold capitalize">
                    <Gauge className="h-3.5 w-3.5 text-ink-faint" aria-hidden="true" />
                    {tr.metric}
                  </span>
                  <Badge tone={trendTone(tr.trend)}>{trendText(tr.trend)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
      {weakKeys.length > 0 ? (
        <Card>
          <CardContent>
            <h3 className="mb-2 text-sm font-bold">{t("weakKeysTitle")}</h3>
            <div className="flex flex-wrap gap-2">
              {weakKeys.map((w) => (
                <span key={w.target} className="tap-kbd">
                  {w.target}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

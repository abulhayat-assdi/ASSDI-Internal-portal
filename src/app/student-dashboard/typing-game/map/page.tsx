import Link from "next/link";
import type { CSSProperties } from "react";
import {
  Keyboard,
  TreePine,
  Mountain,
  Building2,
  Castle,
  Zap,
  CloudSun,
  Trees,
  Sun,
  Waves,
  Snowflake,
  Rocket,
  Cpu,
  Flame,
  Swords,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { AdventureMapContainer, Badge, PageHeader, WorldCard } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { studentContext } from "@/lib/typing-game/server/student-pages";
import { recommendGame } from "@/lib/typing-game/server/student";
import { getWorldMapData } from "@/lib/typing-game/server/games";
import { worldVisual } from "@/lib/typing-game/world-visuals";

/** World slug -> a fitting lucide glyph for the map tile's art slot. */
const WORLD_ICON: Record<string, LucideIcon> = {
  "keyboard-village": Keyboard,
  "finger-forest": TreePine,
  "letter-valley": Mountain,
  "word-city": Building2,
  "sentence-kingdom": Castle,
  "speed-arena": Zap,
  "sky-frontier": CloudSun,
  "jungle-escape": Trees,
  "desert-rally": Sun,
  "ocean-depths": Waves,
  "arctic-pass": Snowflake,
  "space-station": Rocket,
  "cyber-city": Cpu,
  "volcano-zone": Flame,
  "castle-siege": Swords,
  "grand-arena": Trophy,
};

export default async function MapPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "map");
  const { session, store } = await studentContext(locale);

  const [games, unlocks, completed] = await Promise.all([
    store.listGames(),
    store.listUnlocks(session.userId),
    store.listCompletedGames(session.userId),
  ]);
  const recommended = recommendGame(games, unlocks, completed);
  const worlds = await getWorldMapData(
    session.userId,
    store,
    recommended?.slug ?? null,
  );

  const statusLabel = (s: string): string =>
    s === "complete"
      ? t("complete")
      : s === "current"
        ? t("current")
        : s === "open"
          ? t("open")
          : t("locked");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <AdventureMapContainer label={t("title")}>
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {worlds.map((w, i) => {
            const Icon = WORLD_ICON[w.slug] ?? Keyboard;
            return (
              <div
                key={w.slug}
                data-visual={worldVisual(w.slug)}
                className="tap-anim-in"
                style={{ "--tap-i": i } as CSSProperties}
              >
                <WorldCard
                  title={`${String(i + 1)}. ${locale === "bn" ? w.nameBn : w.nameEn}`}
                  description={locale === "bn" && w.descriptionBn ? w.descriptionBn : w.descriptionEn}
                  art={<Icon className="tap-world-icon h-9 w-9" strokeWidth={2} />}
                  status={w.status === "open" ? "current" : w.status}
                  statusLabel={statusLabel(w.status)}
                  progress={
                    w.total === 0 ? 0 : Math.round((w.completed / w.total) * 100)
                  }
                  className={
                    w.status === "locked"
                      ? "tap-world-locked"
                      : w.status === "complete"
                        ? "tap-world-complete"
                        : undefined
                  }
                  action={
                    w.nextGameSlug ? (
                      <Link
                        href={`/student-dashboard/typing-game/games/${w.nextGameSlug}`}
                        className="tap-btn tap-btn-secondary tap-btn-sm"
                      >
                        {t("nextGame")}
                      </Link>
                    ) : (
                      <Badge tone="neutral">
                        {t("gamesCompleted")
                          .replace("{done}", String(w.completed))
                          .replace("{total}", String(w.total))}
                      </Badge>
                    )
                  }
                />
              </div>
            );
          })}
        </div>
      </AdventureMapContainer>
    </div>
  );
}

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
import { AdventureMapContainer, Badge, PageHeader, SectionHeader, WorldCard } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { studentContext } from "@/lib/typing-game/server/student-pages";
import { recommendGame } from "@/lib/typing-game/server/student";
import { getWorldMapData } from "@/lib/typing-game/server/games";
import { worldVisual } from "@/lib/typing-game/world-visuals";
import { WORLDS, type WorldTier } from "@/lib/typing-game/content";
import { KeyboardLesson } from "@/components/typing-game/keyboard-lesson";

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

  const tierBySlug = new Map(WORLDS.map((w) => [w.slug, w.tier]));
  const TIERS: WorldTier[] = ["beginner", "intermediate", "advanced"];
  const worldsByTier = new Map<WorldTier, typeof worlds>(
    TIERS.map((tier) => [tier, worlds.filter((w) => tierBySlug.get(w.slug) === tier)]),
  );
  const tierLabel: Record<WorldTier, string> = {
    beginner: t("tierBeginner"),
    intermediate: t("tierIntermediate"),
    advanced: t("tierAdvanced"),
  };
  const tierBlurb: Record<WorldTier, string> = {
    beginner: t("tierBeginnerBlurb"),
    intermediate: t("tierIntermediateBlurb"),
    advanced: t("tierAdvancedBlurb"),
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("subtitle")} />
      {TIERS.map((tier) => {
        const tierWorlds = worldsByTier.get(tier) ?? [];
        if (tierWorlds.length === 0) return null;
        return (
          <div key={tier} className="flex flex-col gap-4">
            <SectionHeader title={tierLabel[tier]} description={tierBlurb[tier]} />
            {tier === "beginner" ? <KeyboardLesson locale={locale} /> : null}
            <AdventureMapContainer label={tierLabel[tier]}>
              <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tierWorlds.map((w, i) => {
                  const Icon = WORLD_ICON[w.slug] ?? Keyboard;
                  return (
                    <div
                      key={w.slug}
                      data-visual={worldVisual(w.slug)}
                      className="tap-anim-in"
                      style={{ "--tap-i": i } as CSSProperties}
                    >
                      <WorldCard
                        title={`${String(w.order)}. ${locale === "bn" ? w.nameBn : w.nameEn}`}
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
                          ) : w.status === "locked" ? (
                            <Badge tone="neutral">{t("locked")}</Badge>
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
      })}
    </div>
  );
}

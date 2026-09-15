import Link from "next/link";
import {
  Award,
  Badge as BadgeIcon,
  Crown,
  Flag,
  Frame,
  Map as MapIcon,
  Music,
  PartyPopper,
  Shield,
  Sparkles,
  Type,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Badge, Card, CardContent, type BadgeTone } from "@/components/typing-game/ui";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";
import { publicEnv } from "@/lib/typing-game/env-public";
import type { ShopItemSummary } from "@/lib/typing-game/server/shop-store";

export function previewUrl(key: string | null): string | null {
  if (!key) return null;
  const base = publicEnv.r2PublicBaseUrl.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/${key}`;
}

/** Shop category -> a fitting lucide glyph + thematic accent for the tile. */
export const CATEGORY_ICON: Record<string, LucideIcon> = {
  avatar_frames: Frame,
  profile_effects: Sparkles,
  titles: Type,
  badge_variants: BadgeIcon,
  clan_banners: Flag,
  clan_emblems: Shield,
  map_effects: MapIcon,
  victory_animations: PartyPopper,
  result_effects: Award,
  sound_packs: Music,
  utility: Wrench,
};

export const CATEGORY_VISUAL: Record<string, string> = {
  avatar_frames: "vault",
  profile_effects: "neon",
  titles: "kingdom",
  badge_variants: "temple",
  clan_banners: "castle",
  clan_emblems: "castle",
  map_effects: "jungle",
  victory_animations: "arena",
  result_effects: "space",
  sound_packs: "ocean",
  utility: "forge",
};

const TYPE_TONE: Record<string, BadgeTone> = {
  cosmetic: "primary",
  profile: "primary",
  clan_cosmetic: "warning",
  utility: "success",
};

/** Guild Market card: preview, name, price, ownership state. */
export function ShopCard({
  locale,
  item,
  owned,
  href,
}: {
  locale: Locale;
  item: ShopItemSummary;
  owned: boolean;
  href: string;
}) {
  const t = getTranslator(locale, "shop");
  const preview = previewUrl(item.previewKey);
  const Icon = CATEGORY_ICON[item.category] ?? Sparkles;
  return (
    <Card
      interactive
      data-visual={CATEGORY_VISUAL[item.category] ?? "vault"}
      className={owned ? "tap-owned-ring" : undefined}
    >
      <CardContent>
        <div className="flex items-center gap-3">
          {preview ? (
            <img src={preview} alt={item.name} className="h-12 w-12 rounded" />
          ) : (
            <span aria-hidden className="tap-shop-glyph">
              <Icon className="h-6 w-6 text-white" />
            </span>
          )}
          <div className="flex-1">
            <Link href={href} className="text-base font-bold hover:underline">
              {item.name}
            </Link>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
              {item.priceCoins} {t("coins")}
              {item.isFeatured ? (
                <Badge tone="legendary">
                  <Crown className="h-3 w-3" aria-hidden="true" />
                  {t("featured")}
                </Badge>
              ) : (
                <Badge tone={TYPE_TONE[item.itemType] ?? "neutral"}>{item.itemType}</Badge>
              )}
            </p>
          </div>
          {owned ? (
            <Badge tone="success">
              <span aria-hidden="true">✓</span>
              {t("owned")}
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

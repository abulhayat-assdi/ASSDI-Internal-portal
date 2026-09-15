import { Skull, Swords } from "lucide-react";
import { Badge, Card, CardContent } from "@/components/typing-game/ui";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";

/** Locked previews create anticipation without implementing gameplay. */
export function ClanLockedPreviews({ locale }: { locale: Locale }) {
  const t = getTranslator(locale, "clans");
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Card>
        <CardContent>
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-muted">
              <Skull className="h-4 w-4" aria-hidden="true" />
              {t("bossPreview")}
            </h2>
            <Badge tone="neutral">{t("comingSoon")}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-faint">{t("bossPreviewBody")}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-muted">
              <Swords className="h-4 w-4" aria-hidden="true" />
              {t("warPreview")}
            </h2>
            <Badge tone="neutral">{t("comingSoon")}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-faint">{t("warPreviewBody")}</p>
        </CardContent>
      </Card>
    </div>
  );
}

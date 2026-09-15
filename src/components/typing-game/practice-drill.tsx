import type { CSSProperties } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/typing-game/ui";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";
import type { PracticeDrill } from "@/lib/typing-game/adaptive";

/** Drill preview: curated words/sentences containing the weak keys. */
export function PracticeDrillCard({
  locale,
  drill,
}: {
  locale: Locale;
  drill: PracticeDrill;
}) {
  const t = getTranslator(locale, "adaptive");
  return (
    <Card className="tap-anim-in">
      <CardContent>
        <h2 className="mb-1 flex items-center gap-1.5 text-base font-bold">
          <Sparkles className="h-4 w-4 text-primary-500" aria-hidden="true" />
          {t("drillTitle")}: {drill.targetKeys.join(" · ")}
        </h2>
        <p className="mb-2 text-sm text-ink-muted">{t("drillHint")}</p>
        <ul className="flex flex-wrap gap-2">
          {drill.items.map((item, i) => (
            <li
              key={item}
              className="tap-badge tap-badge-primary tap-anim-in"
              style={{ "--tap-i": i } as CSSProperties}
            >
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

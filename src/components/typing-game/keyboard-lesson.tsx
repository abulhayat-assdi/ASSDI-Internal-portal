import { Keyboard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/typing-game/ui";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";

/**
 * Static "how to hold the keyboard" lesson shown above the Beginner tier's
 * Keyboard Village world. Purely informational for v1 — it does not gate
 * anything (World 1 has no predecessor world to gate on; sequential
 * unlocking of every world after it happens in server/games.ts once this
 * tier's games are actually completed). A quiz-gated version is a natural
 * follow-up if stricter enforcement is wanted later.
 */
export function KeyboardLesson({ locale }: { locale: Locale }) {
  const t = getTranslator(locale, "lesson");
  const tips = [t("tip1"), t("tip2"), t("tip3"), t("tip4"), t("tip5")];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3">
        <div className="tap-world-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <Keyboard className="h-5 w-5" strokeWidth={2} />
        </div>
        <div>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("intro")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-2 text-sm">
          {tips.map((tip, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-semibold tabular-nums opacity-60">{i + 1}.</span>
              <span>{tip}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm opacity-80">{t("closing")}</p>
      </CardContent>
    </Card>
  );
}

import { Keyboard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/typing-game/ui";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";
import { KeyboardQuiz } from "@/components/typing-game/keyboard-quiz";

/**
 * Static "how to hold the keyboard" lesson shown above the Beginner tier's
 * Keyboard Village world. The quiz below it is informational practice only —
 * it shows a score, never blocks anything, and persists nothing.
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
        <KeyboardQuiz locale={locale} />
      </CardContent>
    </Card>
  );
}

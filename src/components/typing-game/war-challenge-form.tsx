"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Swords } from "lucide-react";
import { Card, CardContent, Select } from "@/components/typing-game/ui";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";

/** Direct clan challenge form (leaders only; DB enforces). */
export function WarChallengeForm({
  locale,
  opponents,
  games,
}: {
  locale: Locale;
  opponents: { clanId: string; name: string }[];
  games: { slug: string }[];
}) {
  const t = getTranslator(locale, "wars");
  const router = useRouter();
  const [defender, setDefender] = useState(opponents[0]?.clanId ?? "");
  const [game, setGame] = useState(games[0]?.slug ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function challenge(): Promise<void> {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/typing-game/wars", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          defenderClanId: defender,
          gameSlugs: game ? [game] : [],
          scope: "same_course",
          prepHours: 2,
          battleHours: 2,
          attemptsPerPlayer: 5,
        }),
      });
      if (!res.ok) throw new Error(`challenge failed: ${String(res.status)}`);
      const data = (await res.json()) as { id?: string };
      if (typeof data.id !== "string") throw new Error("bad response");
      router.push(`/student-dashboard/typing-game/clan/wars/${data.id}`);
      router.refresh();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  if (opponents.length === 0 || games.length === 0) {
    return <p className="text-sm text-ink-muted">{t("emptySection")}</p>;
  }

  return (
    <Card data-visual="dojo">
      <CardContent>
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
          <Swords className="h-4 w-4 text-primary-500" aria-hidden="true" />
          {t("challenge")}
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Select
              label={t("pickOpponent")}
              value={defender}
              onChange={(e) => {
                setDefender(e.target.value);
              }}
            >
              {opponents.map((o) => (
                <option key={o.clanId} value={o.clanId}>
                  {o.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1">
            <Select
              label={t("allowedGames")}
              value={game}
              onChange={(e) => {
                setGame(e.target.value);
              }}
            >
              {games.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.slug}
                </option>
              ))}
            </Select>
          </div>
          <button
            type="button"
            className="tap-btn tap-btn-primary"
            disabled={busy || !defender || !game}
            onClick={() => {
              void challenge();
            }}
          >
            <Swords className="h-4 w-4" aria-hidden="true" />
            {t("challenge")}
          </button>
        </div>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {t("actionFailed")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

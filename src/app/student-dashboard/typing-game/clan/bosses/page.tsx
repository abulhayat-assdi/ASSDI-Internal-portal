import Link from "next/link";
import { CalendarClock, CheckCircle2, Flame, Swords } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  ProgressBar,
  type BadgeTone,
} from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { bossPageContext } from "@/lib/typing-game/server/boss-pages";

const STATUS_TONE: Record<string, BadgeTone> = {
  scheduled: "neutral",
  processing: "primary",
  defeated: "success",
  finalized: "success",
  expired: "danger",
};

/** Student boss lobby: definitions plus my clan's battles. */
export default async function BossLobbyPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "bosses");
  const { store } = await bossPageContext(locale);
  const [bosses, instances] = await Promise.all([
    store.listBosses(),
    store.listMyInstances(),
  ]);
  const active = instances.filter((i) => i.status === "active");
  const upcoming = instances.filter(
    (i) => i.status === "scheduled" || i.status === "processing",
  );
  const done = instances.filter(
    (i) =>
      i.status === "finalized" ||
      i.status === "defeated" ||
      i.status === "expired",
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("hubTitle")} description={t("hubSubtitle")} />

      <Card>
        <CardContent>
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
            <Flame className="h-4 w-4" style={{ color: "var(--tap-danger-500)" }} aria-hidden="true" />
            {t("sectionActive")}
          </h2>
          {active.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("emptySection")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {active.map((i) => {
                const pct = i.initialHp > 0 ? (i.currentHp / i.initialHp) * 100 : 0;
                return (
                  <li key={i.id}>
                    <Link
                      href={`/student-dashboard/typing-game/clan/bosses/${i.id}`}
                      className="tap-card tap-card-interactive block p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold">{i.bossName}</span>
                        <span className="text-sm font-bold tabular-nums text-ink-muted">
                          {i.currentHp}/{String(i.initialHp)} HP
                        </span>
                      </div>
                      <div className="mt-2">
                        <ProgressBar value={pct} max={100} label={i.bossName} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
            <CalendarClock className="h-4 w-4 text-primary-500" aria-hidden="true" />
            {t("sectionUpcoming")}
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("emptySection")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((i) => (
                <li key={i.id}>
                  <Link
                    href={`/student-dashboard/typing-game/clan/bosses/${i.id}`}
                    className="flex items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-[var(--tap-surface)]"
                  >
                    <span className="font-semibold">{i.bossName}</span>
                    <Badge tone={STATUS_TONE[i.status] ?? "neutral"}>{i.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
            <CheckCircle2 className="h-4 w-4" style={{ color: "var(--tap-success-500)" }} aria-hidden="true" />
            {t("sectionCompleted")}
          </h2>
          {done.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("emptySection")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {done.map((i) => (
                <li key={i.id}>
                  <Link
                    href={`/student-dashboard/typing-game/clan/bosses/${i.id}`}
                    className="flex items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm opacity-80 transition-colors hover:bg-[var(--tap-surface)] hover:opacity-100"
                  >
                    <span className="font-semibold">{i.bossName}</span>
                    <Badge tone={STATUS_TONE[i.status] ?? "neutral"}>{i.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {bosses.length === 0 ? (
        <EmptyState
          title={t("hubTitle")}
          description={t("emptySection")}
        />
      ) : null}
    </div>
  );
}

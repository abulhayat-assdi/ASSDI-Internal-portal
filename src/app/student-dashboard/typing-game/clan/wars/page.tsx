import { EmptyState, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { warPageContext } from "@/lib/typing-game/server/war-pages";
import { WarCard } from "@/components/typing-game/war-card";
import { WarChallengeForm } from "@/components/typing-game/war-challenge-form";
import { createSupabaseClanStore } from "@/lib/typing-game/server/clan-store";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { createSupabaseStudentStore } from "@/lib/typing-game/server/student-store";

/** Student war hub: live / upcoming / completed + challenge entry. */
export default async function ClanWarsPage({
  params,
}: {
  params: { locale: string };
}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "wars");
  const { session, store } = await warPageContext(locale);
  const wars = await store.listWars();
  const live = wars.filter((w) => w.status === "live");
  const upcoming = wars.filter(
    (w) =>
      w.status !== "live" &&
      w.status !== "finalized" &&
      w.status !== "cancelled" &&
      w.status !== "declined" &&
      w.status !== "expired",
  );
  const completed = wars.filter(
    (w) =>
      w.status === "finalized" ||
      w.status === "cancelled" ||
      w.status === "declined" ||
      w.status === "expired",
  );
  const opponents = await store.challengeable();
  const client = await userDbClient();
  const games = client
    ? await createSupabaseStudentStore(client).listGames()
    : [];
  const myClan = client
    ? await createSupabaseClanStore(client).getMyClan(session.userId)
    : null;

  const sections = [
    { key: "live", title: t("sectionLive"), items: live },
    { key: "upcoming", title: t("sectionUpcoming"), items: upcoming },
    { key: "completed", title: t("sectionCompleted"), items: completed },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("hubTitle")} description={t("hubSubtitle")} />
      {myClan && (myClan.myRole === "leader" || myClan.myRole === "co_leader") ? (
        <WarChallengeForm
          locale={locale}
          opponents={opponents}
          games={games.map((g) => ({ slug: g.slug }))}
        />
      ) : null}
      {wars.length === 0 ? (
        <EmptyState title={t("hubTitle")} description={t("emptySection")} />
      ) : null}
      {sections.map((s) => (
        <section key={s.key} aria-label={s.title}>
          <h2 className="mb-2 text-base font-bold">{s.title}</h2>
          {s.items.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("emptySection")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {s.items.map((w) => (
                <WarCard
                  key={w.id}
                  locale={locale}
                  war={w}
                  href={`/student-dashboard/typing-game/clan/wars/${w.id}`}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { clanPageContext } from "@/lib/typing-game/server/clan-pages";

/** Admin clans: every visible clan with management links. */
export default async function AdminClansPage({
  params,
}: {
  params: { locale: string };
}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "clans");
  const { store } = await clanPageContext(locale);
  const clans = await store.listClans();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("manageTitle")} />
      {clans.length === 0 ? (
        <EmptyState title={t("manageTitle")} description={t("noClans")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {clans.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <Link href={`/dashboard/typing-game/admin/clans/${c.id}`}>
                {c.name} ({c.slug})
              </Link>
              <span className="tap-badge">
                {c.status} · {t("memberCount", { count: c.memberCount })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

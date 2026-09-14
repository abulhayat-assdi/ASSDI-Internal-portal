import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { bossPageContext } from "@/lib/typing-game/server/boss-pages";

/** Admin boss definitions (drafts included via RLS admin policy). */
export default async function AdminBossesPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "bosses");
  const { store } = await bossPageContext(locale);
  const bosses = await store.listBosses();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("manageTitle")} />
      {bosses.length === 0 ? (
        <EmptyState title={t("manageTitle")} description={t("noBosses")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {bosses.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <Link href={`/dashboard/typing-game/admin/bosses/${b.id}`}>
                {b.name} ({b.slug})
              </Link>
              <span className="tap-badge">
                {b.difficulty} · {b.maxHp} HP · {b.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

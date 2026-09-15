import Link from "next/link";
import { Users } from "lucide-react";
import { Badge, EmptyState, PageHeader, type BadgeTone } from "@/components/typing-game/ui";
import { getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { clanPageContext } from "@/lib/typing-game/server/clan-pages";

const STATUS_TONE: Record<string, BadgeTone> = {
  active: "success",
};

/** Admin clans: every visible clan with management links. */
export default async function AdminClansPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "clans");
  const { store } = await clanPageContext(locale);
  const clans = await store.listClans();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("manageTitle")} />
      {clans.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" aria-hidden="true" />}
          title={t("manageTitle")}
          description={t("noClans")}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {clans.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/typing-game/admin/clans/${c.id}`}
              className="tap-card tap-card-interactive flex flex-col gap-2 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="tap-card-title">{c.name}</h3>
                <Badge tone={STATUS_TONE[c.status] ?? "neutral"}>{c.status}</Badge>
              </div>
              <p className="text-xs text-ink-faint">{c.slug}</p>
              <p className="text-sm text-ink-muted">
                {t("memberCount", { count: c.memberCount })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

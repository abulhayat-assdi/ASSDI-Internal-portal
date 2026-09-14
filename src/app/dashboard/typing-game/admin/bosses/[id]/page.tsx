import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { bossPageContext } from "@/lib/typing-game/server/boss-pages";
import { BossAdminActions } from "@/components/typing-game/boss-admin-actions";

/** Admin boss management: activation, battle scheduling, instances. */
export default async function AdminBossManagePage(
  props: {
    params: Promise<{ locale: string; id: string }>;
  }
) {
  const params = await props.params;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "bosses");
  const { store } = await bossPageContext(locale);
  const bosses = await store.listBosses();
  const def = bosses.find((b) => b.id === params.id);
  if (!def) notFound();
  const instances = (await store.listMyInstances()).filter(
    (i) => i.bossSlug === def.slug,
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={def.name} description={`${def.slug} · v${String(def.version)}`} />
      <Card>
        <CardContent>
          <BossAdminActions locale={locale} bossId={def.id} status={def.status} />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <h2 className="mb-2 text-base font-bold">{t("sectionActive")}</h2>
          {instances.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("emptySection")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {instances.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <Link href={`/student-dashboard/typing-game/clan/bosses/${i.id}`}>
                    {i.currentHp}/{String(i.initialHp)} HP
                  </Link>
                  <span className="tap-badge">{i.status}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {instances.map((i) => (
        <Card key={i.id}>
          <CardContent>
            <BossAdminActions
              locale={locale}
              instanceId={i.id}
              instanceStatus={i.status}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

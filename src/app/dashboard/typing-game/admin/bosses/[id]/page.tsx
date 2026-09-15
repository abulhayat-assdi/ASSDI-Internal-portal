import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge, Card, CardContent, EmptyState, PageHeader, SectionHeader } from "@/components/typing-game/ui";
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
  const ts = getTranslator(locale, "staff");
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
          <SectionHeader title={t("sectionActive")} />
          {instances.length === 0 ? (
            <EmptyState title={t("sectionActive")} description={t("emptySection")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="tap-table">
                <thead>
                  <tr>
                    <th scope="col">{t("fieldMaxHp")}</th>
                    <th scope="col">{ts("colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {instances.map((i) => (
                    <tr key={i.id}>
                      <th scope="row">
                        <Link href={`/student-dashboard/typing-game/clan/bosses/${i.id}`}>
                          {i.currentHp}/{String(i.initialHp)} HP
                        </Link>
                      </th>
                      <td>
                        <Badge tone={i.status === "active" ? "success" : "neutral"}>
                          {i.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

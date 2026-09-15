import { Badge, Card, CardContent, EmptyState, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession } from "@/lib/typing-game/server/auth";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { requireAdmin } from "@/lib/typing-game/server/staff";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { ForbiddenBlock } from "@/components/typing-game/forbidden-block";
import { CreateBatchForm, PatchToggle } from "@/components/typing-game/admin-forms";

export default async function BatchesPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "staff");
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <ForbiddenBlock locale={locale} />;
  let batches: Array<{
    id: string;
    courseId: string;
    courseName: string;
    name: string;
    joinCode: string;
    isActive: boolean;
  }> = [];
  let courses: Array<{ id: string; title: string }> = [];
  try {
    const { orgIds } = await requireAdmin(client);
    const store = createSupabaseStaffStore(client);
    [batches, courses] = await Promise.all([
      store.listBatches(orgIds),
      store.listCourses(orgIds),
    ]);
  } catch {
    return <ForbiddenBlock locale={locale} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("batches")} />
      <Card>
        <CardContent>
          <CreateBatchForm locale={locale} courses={courses} />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          {batches.length === 0 ? (
            <EmptyState title={t("batches")} description={t("noResults")} />
          ) : (
          <div className="overflow-x-auto">
            <table className="tap-table">
              <thead>
                <tr>
                  <th scope="col">{t("batchNameLabel")}</th>
                  <th scope="col">{t("courseName")}</th>
                  <th scope="col">{t("joinCode")}</th>
                  <th scope="col">{t("colStatus")}</th>
                  <th scope="col">{t("colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <th scope="row">{b.name}</th>
                    <td>{b.courseName}</td>
                    <td>
                      <code>{b.joinCode}</code>
                    </td>
                    <td>
                      <Badge tone={b.isActive ? "success" : "neutral"}>
                        {b.isActive ? t("statusActive") : t("statusInactive")}
                      </Badge>
                    </td>
                    <td>
                      <PatchToggle
                        locale={locale}
                        url={`/api/typing-game/admin/batches/${b.id}`}
                        body={{ isActive: !b.isActive }}
                        label={b.isActive ? t("deactivate") : t("activate")}
                        active={b.isActive}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

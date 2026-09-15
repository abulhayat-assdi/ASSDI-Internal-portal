import { notFound } from "next/navigation";
import { Badge, Card, CardContent, EmptyState, PageHeader, SectionHeader, StatCard } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession } from "@/lib/typing-game/server/auth";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { ForbiddenError } from "@/lib/typing-game/server/staff-store";
import { createSupabaseStudentStore } from "@/lib/typing-game/server/student-store";
import { getTeacherStudent } from "@/lib/typing-game/server/staff-data";

export default async function TeacherStudentPage(
  props: {
    params: Promise<{ locale: string; userId: string }>;
  }
) {
  const params = await props.params;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "staff");
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) notFound();
  let data;
  try {
    data = await getTeacherStudent(
      session.userId,
      params.userId,
      createSupabaseStaffStore(client),
      createSupabaseStudentStore(client),
    );
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={data.detail.fullName}
        description={data.detail.email}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("level")} value={data.detail.level} />
        <StatCard label={t("xp")} value={data.detail.xpTotal} />
        <StatCard
          label={t("averageWpm")}
          value={Math.round(data.aggregates.avgWpm)}
        />
        <StatCard
          label={t("averageAccuracy")}
          value={`${String(Math.round(data.aggregates.avgAccuracy))}%`}
        />
      </div>
      <Card>
        <CardContent>
          <SectionHeader title={t("records")} />
          {data.records.length === 0 ? (
            <EmptyState title={t("records")} description={t("noResults")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="tap-table">
                <thead>
                  <tr>
                    <th scope="col">{t("records")}</th>
                    <th scope="col">{t("xp")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.slice(0, 12).map((r) => (
                    <tr key={`${r.gameSlug}-${r.metric}`}>
                      <th scope="row">
                        <span className="font-mono text-xs">{r.gameSlug}</span>{" "}
                        <Badge tone="neutral">{r.metric}</Badge>
                      </th>
                      <td className="font-semibold">{Math.round(r.value)}</td>
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

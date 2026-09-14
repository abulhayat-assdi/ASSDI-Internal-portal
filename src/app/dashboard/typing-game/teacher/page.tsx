import Link from "next/link";
import { Card, CardContent, EmptyState, PageHeader, StatCard } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession } from "@/lib/typing-game/server/auth";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { getTeacherDashboard } from "@/lib/typing-game/server/staff-data";

export default async function TeacherDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "staff");
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <EmptyState title={t("teacherDashboard")} />;
  const data = await getTeacherDashboard(
    session.userId,
    createSupabaseStaffStore(client),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("teacherDashboard")} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label={t("assignedBatches")} value={data.batches.length} />
        <StatCard label={t("assignedStudents")} value={data.students} />
        <StatCard
          label={t("recentActivity")}
          value={data.batches.reduce((a, b) => a + b.activeRuns, 0)}
        />
      </div>

      {data.batches.length === 0 ? (
        <EmptyState title={t("assignedBatches")} description={t("noStudents")} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {data.batches.map((b) => (
            <Card key={b.batchId}>
              <CardContent>
                <h2 className="font-bold">
                  <Link href={`/dashboard/typing-game/teacher/batches/${b.batchId}`}>
                    {b.batchName}
                  </Link>
                </h2>
                <p className="text-sm text-ink-muted">{b.courseName}</p>
                <p className="mt-2 text-sm">
                  {t("members")}: {b.members} · {t("averageWpm")}:{" "}
                  {Math.round(b.avgWpm)} · {t("averageAccuracy")}:{" "}
                  {Math.round(b.avgAccuracy)}%
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data.attention.length > 0 ? (
        <Card>
          <CardContent>
            <h2 className="mb-2 text-base font-bold">{t("needsAttention")}</h2>
            <ul className="flex flex-col gap-1 text-sm">
              {data.attention.slice(0, 10).map((s) => (
                <li key={s.userId}>
                  <Link href={`/dashboard/typing-game/teacher/students/${s.userId}`}>
                    {s.fullName} ({s.rollNumber})
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

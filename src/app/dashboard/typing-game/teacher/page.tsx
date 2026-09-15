import Link from "next/link";
import { Badge, Card, CardContent, EmptyState, PageHeader, SectionHeader, StatCard } from "@/components/typing-game/ui";
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
            <Link
              key={b.batchId}
              href={`/dashboard/typing-game/teacher/batches/${b.batchId}`}
              className="tap-card tap-card-interactive flex flex-col gap-1 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="tap-card-title">{b.batchName}</h2>
                <Badge tone="primary">
                  {t("members")}: {b.members}
                </Badge>
              </div>
              <p className="text-sm text-ink-muted">{b.courseName}</p>
              <p className="mt-1 text-sm text-ink-muted">
                {t("averageWpm")}: {Math.round(b.avgWpm)} · {t("averageAccuracy")}:{" "}
                {Math.round(b.avgAccuracy)}%
              </p>
            </Link>
          ))}
        </div>
      )}

      {data.attention.length > 0 ? (
        <Card>
          <CardContent>
            <SectionHeader title={t("needsAttention")} />
            <div className="flex flex-wrap gap-2">
              {data.attention.slice(0, 10).map((s) => (
                <Link
                  key={s.userId}
                  href={`/dashboard/typing-game/teacher/students/${s.userId}`}
                  className="tap-card tap-card-interactive px-3 py-2 text-sm font-semibold"
                >
                  {s.fullName}{" "}
                  <span className="font-normal text-ink-muted">({s.rollNumber})</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

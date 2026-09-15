import Link from "next/link";
import { Badge, Card, CardContent, EmptyState, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession } from "@/lib/typing-game/server/auth";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { requireAdmin } from "@/lib/typing-game/server/staff";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { ForbiddenBlock } from "@/components/typing-game/forbidden-block";

export default async function StudentsPage(
  props: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ q?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "staff");
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <ForbiddenBlock locale={locale} />;
  let students: Array<{
    userId: string;
    fullName: string;
    email: string;
    rollNumber: string;
    batchName: string;
    status: string;
  }> = [];
  try {
    await requireAdmin(client);
    students = await createSupabaseStaffStore(client).searchUsers(
      searchParams.q ?? "",
      50,
    );
  } catch {
    return <ForbiddenBlock locale={locale} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("students")} />
      <Card>
        <CardContent>
          <form method="get" className="mb-3 flex gap-2">
            <input
              type="search"
              name="q"
              defaultValue={searchParams.q ?? ""}
              placeholder={t("searchPlaceholder")}
              aria-label={t("search")}
              className="tap-input-wrap tap-input"
            />
            <button type="submit" className="tap-btn tap-btn-primary tap-btn-md">
              {t("search")}
            </button>
          </form>
          {students.length === 0 ? (
            <EmptyState title={t("students")} description={t("noResults")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="tap-table">
                <thead>
                  <tr>
                    <th scope="col">{t("colName")}</th>
                    <th scope="col">{t("colRoll")}</th>
                    <th scope="col">{t("colBatch")}</th>
                    <th scope="col">{t("colStatus")}</th>
                    <th scope="col">{t("colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={`${s.userId}-${s.rollNumber}`}>
                      <th scope="row">
                        {s.fullName}
                        <span className="block text-xs font-normal text-ink-faint">
                          {s.email}
                        </span>
                      </th>
                      <td>{s.rollNumber}</td>
                      <td>{s.batchName}</td>
                      <td>
                        <Badge tone={s.status === "active" ? "success" : "neutral"}>
                          {s.status}
                        </Badge>
                      </td>
                      <td>
                        <Link
                          href={`/dashboard/typing-game/admin/students/${s.userId}`}
                          className="tap-link-btn"
                        >
                          {t("viewStudent")}
                        </Link>
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

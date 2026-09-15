import { notFound } from "next/navigation";
import { Badge, Card, CardContent, PageHeader, SectionHeader, StatCard } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession } from "@/lib/typing-game/server/auth";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { requireAdmin } from "@/lib/typing-game/server/staff";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { ForbiddenError } from "@/lib/typing-game/server/staff-store";
import { ForbiddenBlock } from "@/components/typing-game/forbidden-block";
import {
  AccountStatusSelect,
  MembershipEditor,
} from "@/components/typing-game/admin-forms";

export default async function AdminStudentPage(
  props: {
    params: Promise<{ locale: string; id: string }>;
  }
) {
  const params = await props.params;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "staff");
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <ForbiddenBlock locale={locale} />;
  let detail;
  let memberships: Array<{
    memberId: string;
    batchId: string;
    batchName: string;
    rollNumber: string;
    isActive: boolean;
    organizationId: string;
  }> = [];
  let batches: Array<{ id: string; name: string }> = [];
  try {
    const { orgIds } = await requireAdmin(client);
    const store = createSupabaseStaffStore(client);
    const found = await store.getUserDetail(params.id);
    if (!found) notFound();
    detail = found;
    const all = await store.membershipsOf(params.id);
    memberships = all.filter(
      (m) => orgIds === null || orgIds.includes(m.organizationId),
    );
    if (all.length > 0 && memberships.length === 0) {
      throw new ForbiddenError();
    }
    batches = (await store.listBatches(orgIds)).map((b) => ({
      id: b.id,
      name: b.name,
    }));
  } catch (e) {
    if (e instanceof ForbiddenError) return <ForbiddenBlock locale={locale} />;
    throw e;
  }
  const active = memberships.find((m) => m.isActive);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={detail.fullName}
        description={
          <>
            {detail.email}{" "}
            <Badge tone={detail.status === "active" ? "success" : "neutral"}>
              {detail.status}
            </Badge>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("level")} value={detail.level} />
        <StatCard label={t("xp")} value={detail.xpTotal} />
        <StatCard
          label={t("colBatch")}
          value={active ? active.batchName : "—"}
        />
        <StatCard
          label={t("colRoll")}
          value={active ? active.rollNumber : "—"}
        />
      </div>
      <Card>
        <CardContent>
          <SectionHeader title={t("colStatus")} />
          <AccountStatusSelect
            locale={locale}
            userId={detail.userId}
            status={detail.status}
          />
        </CardContent>
      </Card>
      {active ? (
        <Card>
          <CardContent>
            <SectionHeader
              title={`${active.batchName} · ${active.rollNumber}`}
            />
            <MembershipEditor
              locale={locale}
              userId={detail.userId}
              rollNumber={active.rollNumber}
              isActive={active.isActive}
              batches={batches}
              currentBatchId={active.batchId}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <Badge tone="warning">{t("statusInactive")}</Badge>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

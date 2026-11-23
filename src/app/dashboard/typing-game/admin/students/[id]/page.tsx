import { loadStaffStudentProgress } from "@/lib/typing-game/server/insights";
import { ConsoleHero, HeroLink, Panel } from "@/components/typing-game/staff/blocks";
import { StudentProgress } from "@/components/typing-game/staff/student-progress";
import { notFound } from "next/navigation";
import { DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession } from "@/lib/typing-game/server/auth";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { requireAdmin } from "@/lib/typing-game/server/staff";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { ForbiddenError } from "@/lib/typing-game/server/staff-store";
import { ForbiddenBlock } from "@/components/typing-game/forbidden-block";
import {
  AccountStatusSelect,
  MembershipEditor,
  RoleEditor,
} from "@/components/typing-game/admin-forms";

export default async function AdminStudentPage(
  props: {
    params: Promise<{ locale: string; id: string }>;
  }
) {
  const params = await props.params;
  const locale = DEFAULT_LOCALE;
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
  const progress = await loadStaffStudentProgress(client, params.id);

  return (
    <div className="flex flex-col gap-5">
      <ConsoleHero
        kicker={active ? `${active.batchName} · Roll ${active.rollNumber}` : "No active batch"}
        title={detail.fullName}
        desc={
          <>
            {detail.email} · {detail.status === "active" ? "Account active" : `Account: ${detail.status}`}
          </>
        }
      >
        <HeroLink href="/dashboard/typing-game/admin/students">All students</HeroLink>
      </ConsoleHero>
      {progress ? <StudentProgress p={progress} /> : null}
      <Panel title="Account & batch" desc="স্ট্যাটাস, রোল আর ব্যাচ/রোল নম্বর বদলান">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold">Account status</h3>
            <AccountStatusSelect locale={locale} userId={detail.userId} status={detail.status} />
            <h3 className="mt-3 text-sm font-bold">Roles</h3>
            <RoleEditor locale={locale} userId={detail.userId} />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold">Batch</h3>
            {active ? (
              <MembershipEditor
                locale={locale}
                userId={detail.userId}
                rollNumber={active.rollNumber}
                isActive={active.isActive}
                batches={batches}
                currentBatchId={active.batchId}
              />
            ) : (
              <span className="tap-badge tap-badge-warning">Not in an active batch</span>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}

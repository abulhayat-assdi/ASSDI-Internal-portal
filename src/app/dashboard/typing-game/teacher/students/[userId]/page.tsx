import { notFound } from "next/navigation";
import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import { loadStaffStudentProgress } from "@/lib/typing-game/server/insights";
import { ConsoleHero, HeroLink } from "@/components/typing-game/staff/blocks";
import { StudentProgress } from "@/components/typing-game/staff/student-progress";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A student of one of my batches: lessons, tests, daily time, games and challenges. */
export default async function TeacherStudentPage(props: { params: Promise<{ userId: string }> }) {
  const { userId } = await props.params;
  if (!UUID.test(userId)) notFound();
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) notFound();
  // The database refuses students outside the teacher's batches.
  const p = await loadStaffStudentProgress(client, userId);
  if (!p?.profile) notFound();

  return (
    <div className="flex flex-col gap-5">
      <ConsoleHero tone="teacher" kicker="Student" title={p.profile.name} desc={p.profile.email}>
        <HeroLink href="/dashboard/typing-game/teacher">Back to dashboard</HeroLink>
      </ConsoleHero>
      <StudentProgress p={p} />
    </div>
  );
}

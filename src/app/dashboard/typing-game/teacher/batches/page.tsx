import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import { loadInsights } from "@/lib/typing-game/server/insights";
import { BatchCards } from "@/components/typing-game/staff/batch-cards";
import { ConsoleHero } from "@/components/typing-game/staff/blocks";
import { EmptyState } from "@/components/typing-game/ui";

export const dynamic = "force-dynamic";

export default async function TeacherBatchesPage() {
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <EmptyState title="Teacher Console" />;
  const ins = await loadInsights(client);
  return (
    <div className="flex flex-col gap-5">
      <ConsoleHero tone="teacher" kicker="My batches" title="আমার ব্যাচ" desc="যে ব্যাচগুলোর দায়িত্ব আপনার, সেগুলোর এই সপ্তাহের অবস্থা।" />
      <BatchCards batches={ins.batches} hrefFor={(id) => `/dashboard/typing-game/teacher/batches/${id}`} />
    </div>
  );
}

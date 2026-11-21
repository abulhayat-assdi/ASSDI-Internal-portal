import { PageHeader } from "@/components/typing-game/ui";
import { AdsSettingsForm } from "@/components/typing-game/ads/ads-settings-form";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { createAdsStore } from "@/lib/typing-game/server/ads-store";
import { AD_ACTIONS } from "@/lib/typing-game/ads/settings";

export const dynamic = "force-dynamic";

/** Super-admin ad settings + a 14-day rewarded-view report. The layout already gates super-admin. */
export default async function AdsAdminPage() {
  const client = await userDbClient();
  if (!client) throw new Error("SERVICE_UNAVAILABLE");
  const store = createAdsStore(client);
  const [settings, report, batchRes] = await Promise.all([
    store.settings(),
    store.report(),
    client.from("batches").select("id, name").order("name"),
  ]);
  const batches = ((batchRes.data ?? []) as { id: string; name: string }[]).map((b) => ({ id: String(b.id), name: String(b.name) }));
  const actionLabel = (k: string) => AD_ACTIONS.find((a) => a.key === k)?.label ?? k;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Typing — Ads"
        description="Google ডিসপ্লে ও রিওয়ার্ডেড অ্যাডের সেটিংস। ডিফল্টে সব বন্ধ — বন্ধ থাকলে student-রা কোনো অ্যাড দেখে না।"
      />
      <AdsSettingsForm initial={settings} batches={batches} />
      <section className="tap-card p-4">
        <h2 className="mb-2 font-display text-lg font-bold">শেষ ১৪ দিনের রিওয়ার্ডেড অ্যাড</h2>
        {report.length === 0 ? (
          <p className="text-sm text-ink-muted">কোনো অ্যাড দেখা হয়নি।</p>
        ) : (
          <table className="tap-table w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">তারিখ</th>
                <th className="text-left">কাজ</th>
                <th className="text-right">দেখা হয়েছে</th>
                <th className="text-right">অ্যাড পাওয়া যায়নি</th>
              </tr>
            </thead>
            <tbody>
              {report.map((r) => (
                <tr key={`${r.day}-${r.action}`}>
                  <td>{r.day}</td>
                  <td>{actionLabel(r.action)}</td>
                  <td className="text-right tabular-nums">{r.completed}</td>
                  <td className="text-right tabular-nums">{r.noFill}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-ink-muted">আয়ের হিসাব Google AdSense / Ad Manager ড্যাশবোর্ডে দেখুন।</p>
      </section>
    </div>
  );
}

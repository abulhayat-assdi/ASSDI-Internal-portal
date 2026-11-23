"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AD_ACTIONS, AD_SLOTS, type AdSettings } from "@/lib/typing-game/ads/settings";

interface Props {
  initial: AdSettings;
  batches: { id: string; name: string }[];
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 py-2">
      <span>
        <span className="block font-semibold">{label}</span>
        {hint ? <span className="block text-xs text-ink-muted">{hint}</span> : null}
      </span>
      <input type="checkbox" className="mt-1 h-5 w-5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

const FIELD = "rounded-lg border px-2 py-1.5 text-sm border-[var(--tap-border-strong)] bg-[var(--tap-surface-solid)]";

/** Super-admin ad settings. Everything is off until switched on here. */
export function AdsSettingsForm({ initial, batches }: Props) {
  const router = useRouter();
  const [s, setS] = useState<AdSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (patch: Partial<AdSettings>) => setS((p) => ({ ...p, ...patch }));

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/typing-game/admin/ads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: s.enabled,
          display_enabled: s.displayEnabled,
          rewarded_enabled: s.rewardedEnabled,
          provider: s.provider,
          publisher_id: s.publisherId,
          slots: s.slots,
          action_views: s.actionViews,
          rewarded_daily_limit: s.rewardedDailyLimit,
          min_watch_seconds: s.minWatchSeconds,
          no_fill: s.noFill,
          exempt_batch_ids: s.exemptBatchIds,
        }),
      });
      const d = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(d.error ?? String(res.status));
      setMsg("Saved ✓");
      router.refresh();
    } catch (e) {
      setMsg(`Not saved: ${e instanceof Error ? e.message : ""}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="tap-card p-4">
        <h2 className="font-display text-lg font-bold">Master switches</h2>
        <Toggle
          label="Ads on"
          hint="বন্ধ থাকলে কোথাও কোনো অ্যাড দেখাবে না, আর অ্যাড-নির্ভর কাজগুলো (Skip ইত্যাদি) সরাসরি হয়ে যাবে।"
          checked={s.enabled}
          onChange={(v) => set({ enabled: v })}
        />
        <Toggle label="Display ads (side / top / bottom)" checked={s.displayEnabled} onChange={(v) => set({ displayEnabled: v })} />
        <Toggle label="Rewarded ads (watch to unlock)" checked={s.rewardedEnabled} onChange={(v) => set({ rewardedEnabled: v })} />
      </section>

      <section className="tap-card flex flex-col gap-3 p-4">
        <h2 className="font-display text-lg font-bold">Google</h2>
        <label className="flex flex-col gap-1 text-sm">
          AdSense Publisher ID
          <input className={FIELD} placeholder="ca-pub-0000000000000000" value={s.publisherId} onChange={(e) => set({ publisherId: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Rewarded ad provider
          <select className={FIELD} value={s.provider} onChange={(e) => set({ provider: e.target.value === "google" ? "google" : "mock" })}>
            <option value="mock">Test (mock)</option>
            <option value="google">Google (after connecting Ad Manager)</option>
          </select>
        </label>
        <table className="tap-table w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">Placement</th>
              <th className="text-left">Size</th>
              <th className="text-left">Slot ID</th>
              <th>On</th>
            </tr>
          </thead>
          <tbody>
            {AD_SLOTS.map((slot) => {
              const cur = s.slots[slot.key] ?? { enabled: false, slotId: "" };
              return (
                <tr key={slot.key}>
                  <td>{slot.label}</td>
                  <td className="text-xs text-ink-muted">{slot.size}</td>
                  <td>
                    <input
                      className={FIELD}
                      inputMode="numeric"
                      value={cur.slotId}
                      onChange={(e) => set({ slots: { ...s.slots, [slot.key]: { ...cur, slotId: e.target.value.trim() } } })}
                    />
                  </td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      checked={cur.enabled}
                      onChange={(e) => set({ slots: { ...s.slots, [slot.key]: { ...cur, enabled: e.target.checked } } })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="tap-card flex flex-col gap-3 p-4">
        <h2 className="font-display text-lg font-bold">Rewarded ads per action</h2>
        {AD_ACTIONS.map((a) => (
          <label key={a.key} className="flex items-center justify-between gap-3 text-sm">
            {a.label}
            <input
              type="number"
              min={0}
              max={10}
              className={FIELD}
              style={{ width: "5rem" }}
              value={s.actionViews[a.key] ?? 0}
              onChange={(e) => set({ actionViews: { ...s.actionViews, [a.key]: Math.max(0, Math.min(10, Number(e.target.value) || 0)) } })}
            />
          </label>
        ))}
        <p className="text-xs text-ink-muted">০ দিলে সেই কাজের জন্য অ্যাড লাগবে না।</p>
        <label className="flex items-center justify-between gap-3 text-sm">
          Max rewarded ads per student per day
          <input type="number" min={0} max={100} className={FIELD} style={{ width: "5rem" }} value={s.rewardedDailyLimit} onChange={(e) => set({ rewardedDailyLimit: Number(e.target.value) || 0 })} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          Minimum seconds to watch an ad
          <input type="number" min={5} max={120} className={FIELD} style={{ width: "5rem" }} value={s.minWatchSeconds} onChange={(e) => set({ minWatchSeconds: Number(e.target.value) || 15 })} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          When no ad is available (ad-blocker / no fill)
          <select className={FIELD} value={s.noFill} onChange={(e) => set({ noFill: e.target.value === "block" ? "block" : "allow" })}>
            <option value="allow">Allow the action</option>
            <option value="block">Block it</option>
          </select>
        </label>
      </section>

      <section className="tap-card flex flex-col gap-2 p-4">
        <h2 className="font-display text-lg font-bold">Ad-free batches</h2>
        {batches.length === 0 ? <p className="text-sm text-ink-muted">No batches found.</p> : null}
        <div className="grid gap-1 sm:grid-cols-2">
          {batches.map((b) => (
            <label key={b.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={s.exemptBatchIds.includes(b.id)}
                onChange={(e) =>
                  set({ exemptBatchIds: e.target.checked ? [...s.exemptBatchIds, b.id] : s.exemptBatchIds.filter((x) => x !== b.id) })
                }
              />
              {b.name}
            </label>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button type="button" className="tap-btn tap-btn-primary tap-btn-md" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save"}
        </button>
        {msg ? <span className="text-sm">{msg}</span> : null}
      </div>
    </div>
  );
}

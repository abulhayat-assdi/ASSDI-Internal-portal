"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FeatureMeta } from "@/lib/typing-game/features";

/** On/off switches for the student features (PATCH /api/typing-game/admin/flags/:key). */
export function FeatureSwitches({ features, scopeNote }: { features: (FeatureMeta & { enabled: boolean })[]; scopeNote: string }) {
  const router = useRouter();
  const [state, setState] = useState(() => Object.fromEntries(features.map((f) => [f.key, f.enabled])) as Record<string, boolean>);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function toggle(key: string) {
    const next = !state[key];
    setBusy(key);
    setError("");
    try {
      const r = await fetch(`/api/typing-game/admin/flags/${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setState((s) => ({ ...s, [key]: next }));
      router.refresh();
    } catch {
      setError("বদলানো যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-muted">{scopeNote}</p>
      <ul className="flex flex-col gap-3">
        {features.map((f) => {
          const on = state[f.key];
          return (
            <li key={f.key} className="flex items-start gap-4 rounded-2xl border border-[var(--tap-border)] p-4">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold">
                  {f.title}
                  <span className={`tap-badge ${on ? "tap-badge-success" : "tap-badge-neutral"}`}>{on ? "On" : "Off"}</span>
                </p>
                <p className="mt-1 text-sm text-ink-muted">{on ? f.on : f.off}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`${on ? "Turn off" : "Turn on"} ${f.title}`}
                disabled={busy !== null}
                onClick={() => toggle(f.key)}
                className="sc-switch mt-1"
              />
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

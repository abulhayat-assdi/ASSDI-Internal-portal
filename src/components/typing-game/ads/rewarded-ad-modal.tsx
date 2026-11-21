"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PlayCircle, X } from "lucide-react";
import type { AdAction } from "@/lib/typing-game/ads/settings";

interface Props {
  action: AdAction;
  target: string;
  /** Views still needed. */
  views: number;
  onDone: () => void;
  onCancel: () => void;
}

type Phase = "intro" | "watching" | "completing" | "error";

/**
 * Watches `views` rewarded ads one after another. Each view is started and
 * completed through the server, which enforces the minimum watch time on
 * its own clock. The "mock" provider shows a placeholder sponsor card;
 * the Google rewarded player plugs in here once the ad account exists.
 */
export function RewardedAdModal({ action, target, views, onDone, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [done, setDone] = useState(0);
  const [left, setLeft] = useState(0);
  const [msg, setMsg] = useState("");
  const viewRef = useRef<{ id: string; noFill: string } | null>(null);

  const watchOne = useCallback(async () => {
    setMsg("");
    const r = await fetch("/api/typing-game/ads/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, target }),
    });
    const d = (await r.json()) as { viewId?: string; minWatchSeconds?: number; noFill?: string; error?: string };
    if (!r.ok || !d.viewId) {
      setMsg(d.error === "DAILY_LIMIT" ? "আজকের অ্যাডের সীমা শেষ। কাল আবার চেষ্টা করুন।" : `অ্যাড চালানো যায়নি (${d.error ?? r.status})।`);
      setPhase("error");
      return;
    }
    viewRef.current = { id: d.viewId, noFill: d.noFill ?? "allow" };
    // Small safety margin over the server's minimum.
    setLeft((d.minWatchSeconds ?? 15) + 1);
    setPhase("watching");
  }, [action, target]);

  useEffect(() => {
    if (phase !== "watching") return;
    if (left <= 0) {
      const v = viewRef.current;
      if (!v) return;
      // Leave "watching" first so this view is reported exactly once.
      setPhase("completing");
      void fetch(`/api/typing-game/ads/views/${v.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noFill: false }),
      }).then(async (r) => {
        if (!r.ok) {
          setMsg("অ্যাডটা গোনা যায়নি — আবার চেষ্টা করুন।");
          setPhase("error");
          return;
        }
        const next = done + 1;
        setDone(next);
        if (next >= views) onDone();
        else void watchOne();
      });
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, left, done, views, onDone, watchOne]);

  return (
    <div className="tap-scrim fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Rewarded ad">
      <div className="tap-card flex w-full max-w-sm flex-col items-center gap-4 p-6 text-center">
        <div className="flex w-full items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Ad {Math.min(done + 1, views)} / {views}
          </span>
          {phase === "intro" || phase === "error" ? (
            <button type="button" className="tap-btn tap-btn-ghost tap-btn-sm" onClick={onCancel} aria-label="Close">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {phase === "intro" ? (
          <>
            <PlayCircle className="h-12 w-12" style={{ color: "var(--tap-primary-500)" }} aria-hidden="true" />
            <p className="text-sm">এই কাজটার জন্য {views}টা ছোট অ্যাড দেখতে হবে।</p>
            <button type="button" className="tap-btn tap-btn-primary tap-btn-md" onClick={() => void watchOne()}>
              অ্যাড দেখুন
            </button>
          </>
        ) : phase === "watching" || phase === "completing" ? (
          <>
            <div className="flex h-40 w-full items-center justify-center rounded-xl" style={{ background: "var(--tap-primary-50)" }}>
              <span className="text-sm font-semibold" style={{ color: "var(--tap-primary-700)" }}>
                Sponsored
              </span>
            </div>
            <p className="font-display text-2xl font-bold tabular-nums">{Math.max(0, left)}s</p>
          </>
        ) : (
          <>
            <p className="text-sm">{msg}</p>
            <button type="button" className="tap-btn tap-btn-secondary tap-btn-sm" onClick={() => void watchOne()}>
              আবার চেষ্টা করুন
            </button>
          </>
        )}
      </div>
    </div>
  );
}

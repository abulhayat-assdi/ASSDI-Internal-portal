"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, X } from "lucide-react";
import { Modal, ProgressBar } from "@/components/typing-game/ui";
import { AD_MIN_WATCH_MS, makeMockProof } from "@/lib/typing-game/ads";

export interface AdUnlockStrings {
  adUnlock: string;
  adUnlockHint: string;
  adUnlocking: string;
  adUnlockFailed: string;
  adModalTitle: string;
  adModalBody: string;
  adWatching: string;
  adClaim: string;
  adCancel: string;
  adSponsored: string;
  adReady: string;
}

const TICK_MS = 100;

/**
 * "Watch an ad to unlock" button + timed sponsor modal.
 *
 * Flow: click → modal with live progress bar (AD_MIN_WATCH_MS) → once the
 * timer completes, "Claim unlock" enables → POSTs a watch-proof to the
 * ad-unlock route → router.refresh(). Closing early claims nothing.
 */
export function AdUnlockButton({
  slug,
  strings: s,
}: {
  slug: string;
  strings: AdUnlockStrings;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const done = elapsed >= AD_MIN_WATCH_MS;
  const secondsLeft = Math.max(0, Math.ceil((AD_MIN_WATCH_MS - elapsed) / 1000));

  useEffect(() => {
    if (!open) return;
    setElapsed(0);
    setClaiming(false);
    setFailed(false);
    const startedAt = Date.now();
    timer.current = setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, TICK_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [open ]);

  async function claim() {
    if (!done || claiming) return;
    setClaiming(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/typing-game/games/${slug}/ad-unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proof: makeMockProof(elapsed) }),
      });
      if (!res.ok) throw new Error("unlock failed");
      setOpen(false);
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setClaiming(false);
    }
  }

  return (
    <>
      <button
        type="button"
        title={s.adUnlockHint}
        onClick={() => setOpen(true)}
        className="tap-btn tap-btn-primary tap-btn-sm w-full"
      >
        <Clapperboard className="h-3.5 w-3.5" />
        {s.adUnlock}
      </button>

      {open ? (
        <Modal
          title={s.adModalTitle}
          actions={
            <>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={claiming}
                className="tap-btn tap-btn-secondary tap-btn-sm"
              >
                <X className="h-3.5 w-3.5" />
                {s.adCancel}
              </button>
              <button
                type="button"
                onClick={() => void claim()}
                disabled={!done || claiming}
                className="tap-btn tap-btn-primary tap-btn-sm"
              >
                <Clapperboard className="h-3.5 w-3.5" />
                {claiming ? s.adUnlocking : done ? s.adClaim : s.adWatching.replace("{seconds}", String(secondsLeft))}
              </button>
            </>
          }
        >
          <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{s.adSponsored}</p>
          <p className="mt-1 text-sm">{s.adModalBody}</p>
          <div className="mt-3">
            <ProgressBar value={Math.min(elapsed, AD_MIN_WATCH_MS)} max={AD_MIN_WATCH_MS} label={s.adModalTitle} />
            <p className="mt-1.5 text-xs opacity-70">
              {done ? s.adReady : s.adWatching.replace("{seconds}", String(secondsLeft))}
            </p>
          </div>
          {failed ? <p className="mt-2 text-xs text-red-600">{s.adUnlockFailed}</p> : null}
        </Modal>
      ) : null}
    </>
  );
}

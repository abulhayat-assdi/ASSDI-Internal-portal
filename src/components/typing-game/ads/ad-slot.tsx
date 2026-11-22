"use client";

import { useEffect, useRef } from "react";
import type { AdSlotKey } from "@/lib/typing-game/ads/settings";
import { useAdSlot } from "./ads-context";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

let scriptFor: string | null = null;
function loadAdSense(publisherId: string) {
  if (scriptFor === publisherId || typeof document === "undefined") return;
  scriptFor = publisherId;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`;
  s.crossOrigin = "anonymous";
  document.head.appendChild(s);
}

const SIZE: Record<AdSlotKey, string> = {
  lesson_left: "min-h-[600px] w-[160px] xl:w-[300px]",
  practice_left: "min-h-[600px] w-[160px] xl:w-[300px]",
  top_banner: "min-h-[50px] w-full md:min-h-[90px]",
  result: "min-h-[250px] w-[300px]",
};

/**
 * One Google display ad. Renders nothing at all — and takes no space —
 * unless ads are on and this slot is configured for this student. The box
 * has a fixed size so loading an ad never shifts the typing area, and it
 * is labelled as an advertisement.
 */
export function AdSlot({ slot, className = "" }: { slot: AdSlotKey; className?: string }) {
  const cfg = useAdSlot(slot);
  const pushed = useRef(false);

  useEffect(() => {
    if (!cfg || pushed.current) return;
    loadAdSense(cfg.publisherId);
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      /* blocked by an ad blocker — leave the box empty */
    }
  }, [cfg]);

  if (!cfg) return null;
  return (
    <aside className={`flex shrink-0 flex-col items-center gap-1 ${className}`} aria-label="Advertisement">
      <span className="text-[10px] uppercase tracking-wider text-ink-faint">Advertisement</span>
      <ins
        className={`adsbygoogle block ${SIZE[slot]}`}
        data-ad-client={cfg.publisherId}
        data-ad-slot={cfg.slotId}
        data-ad-format={slot === "top_banner" ? "horizontal" : "auto"}
        data-full-width-responsive="true"
      />
    </aside>
  );
}

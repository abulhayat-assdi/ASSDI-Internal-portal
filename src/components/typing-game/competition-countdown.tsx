"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { formatCountdown } from "@/lib/typing-game/competitions";

/** Below this many ms remaining, the countdown pulses to signal urgency. */
const URGENT_THRESHOLD_MS = 60_000;

/**
 * Presentation-only countdown anchored to server timestamps shipped with the
 * page (serverNow + target). Ticks locally from mount; eligibility and
 * validity are always decided server-side. Tab suspension only pauses the
 * paint — the anchor math restores the true value on return.
 */
export function CompetitionCountdown({
  serverNowIso,
  targetIso,
  label,
}: {
  serverNowIso: string;
  targetIso: string;
  label: string;
}) {
  const [, setRender] = useState(0);
  const [anchor] = useState(() => ({
    serverNow: Date.parse(serverNowIso),
    clientAtMount: Date.now(),
  }));
  useEffect(() => {
    const id = window.setInterval(() => {
      setRender((n) => n + 1);
    }, 1000);
    const onVisible = () => {
      setRender((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  const target = Date.parse(targetIso);
  if (!Number.isFinite(anchor.serverNow) || !Number.isFinite(target)) {
    return null;
  }
  const estimatedServerNow =
    anchor.serverNow + (Date.now() - anchor.clientAtMount);
  const remaining = Math.max(0, target - estimatedServerNow);
  const urgent = remaining > 0 && remaining <= URGENT_THRESHOLD_MS;
  return (
    <motion.div
      className={`tap-countdown${urgent ? " tap-countdown-urgent" : ""}`}
      suppressHydrationWarning
      animate={urgent ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={urgent ? { duration: 1, repeat: Infinity, ease: "easeInOut" } : undefined}
    >
      <span className="tap-countdown-label">{label}</span>
      <span className="tap-countdown-value" suppressHydrationWarning>
        {formatCountdown(remaining)}
      </span>
    </motion.div>
  );
}

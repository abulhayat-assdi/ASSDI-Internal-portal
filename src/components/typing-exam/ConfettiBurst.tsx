"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const COLORS = ["#16a34a", "#22c55e", "#f59e0b", "#8b5cf6", "#0ea5e9", "#ec4899"];
const PARTICLE_COUNT = 32;
const AUTO_HIDE_MS = 2600;

interface Particle {
  id: number;
  leftPct: number; // position relative to the (relatively-positioned) parent
  driftPx: number;
  rotate: number;
  color: string;
  size: number;
  delay: number;
  duration: number;
  shape: "circle" | "square";
}

/**
 * Hand-rolled confetti burst — framer-motion only, no external confetti
 * dependency. Mount it inside a `position: relative` container (e.g.
 * ExamResultPanel's outer card); it absolutely-positions itself over that
 * container and auto-unmounts ~2.6s later. Respects `useReducedMotion()`
 * by swapping the animated particles for a single static flourish.
 */
export default function ConfettiBurst() {
  const reduceMotion = useReducedMotion();
  const [show, setShow] = useState(true);

  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        id: i,
        leftPct: 5 + Math.random() * 90,
        driftPx: (Math.random() - 0.5) * 80,
        rotate: (Math.random() - 0.5) * 540,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 6,
        delay: Math.random() * 0.35,
        duration: 1.5 + Math.random() * 0.6,
        shape: Math.random() > 0.5 ? "circle" : "square",
      })),
    []
  );

  useEffect(() => {
    const timeout = setTimeout(() => setShow(false), AUTO_HIDE_MS);
    return () => clearTimeout(timeout);
  }, []);

  if (!show) return null;

  if (reduceMotion) {
    return (
      <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center text-3xl" aria-hidden="true">
        🎉
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          initial={{ opacity: 1, y: -20, rotate: 0 }}
          animate={{ opacity: 0, y: 260, x: p.driftPx, rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
          style={{
            position: "absolute",
            left: `${p.leftPct}%`,
            top: 0,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === "circle" ? "9999px" : "2px",
          }}
        />
      ))}
    </div>
  );
}

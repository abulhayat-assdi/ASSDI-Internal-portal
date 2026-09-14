"use client";

import { motion } from "framer-motion";
import type { Variants } from "framer-motion";

/**
 * Shared visual language for the Typing Test Exam feature — a light
 * glassmorphism layer on top of the portal's existing surface/brand tokens
 * (src/styles/globals.css), not a new palette. Kept in one place so the
 * admin, student, and public surfaces read as one product.
 */

export const GLASS_PANEL =
  "bg-white/75 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgba(15,23,42,0.07)]";

export const GLASS_PANEL_SOLID =
  "bg-white border border-slate-100 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

/** Decorative blurred color blobs behind glass content — purely visual, inert. */
export function AmbientOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10" aria-hidden="true">
      <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-brand-300/30 blur-3xl" />
      <div className="absolute top-1/3 -right-24 w-96 h-96 rounded-full bg-blue-300/25 blur-3xl" />
      <div className="absolute bottom-0 left-1/4 w-72 h-72 rounded-full bg-slate-300/25 blur-3xl" />
    </div>
  );
}

/** Bangla "X মিনিট Y সেকেন্ড" duration label, shared by the ready screen and exam timer. */
export function formatDurationLabel(durationSeconds: number): string {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${minutes} মিনিট${seconds > 0 ? ` ${seconds} সেকেন্ড` : ""}`;
}

export type ResultTier = "PASS" | "AVERAGE" | "FAIL";

export const RESULT_META: Record<ResultTier, { label: string; badge: string; ring: string }> = {
  PASS: { label: "পাস", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", ring: "ring-emerald-500/20" },
  AVERAGE: { label: "গড়", badge: "bg-amber-50 text-amber-700 border-amber-200", ring: "ring-amber-500/20" },
  FAIL: { label: "ফেইল", badge: "bg-red-50 text-red-600 border-red-200", ring: "ring-red-500/20" },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 400, damping: 22 } },
};

export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const modalPanel: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 320, damping: 28 } },
  exit: { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.15 } },
};

/** Small pill toggle between two/more options — shared by the exam create/edit form. */
export function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1 gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`cursor-pointer relative rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
            value === opt.value ? "text-white" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {value === opt.value && (
            <motion.span
              layoutId="segmented-active"
              className="absolute inset-0 rounded-lg bg-brand-600"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Maximize2 } from "lucide-react";
import { GLASS_PANEL_SOLID } from "@/components/typing-exam/ui";

export interface ExamFullscreenBannerProps {
  onReenter: () => void;
}

/**
 * Non-blocking reminder shown while the exam is running if the browser
 * drops out of fullscreen (parent listens for `fullscreenchange` and only
 * mounts this when `document.fullscreenElement` is falsy). Never pauses the
 * timer or blocks input — purely a nudge. `onReenter`'s implementation must
 * call `element.requestFullscreen()` synchronously inside this button's own
 * click handler (browser gesture rule), same as the ready-screen Start
 * button. Has no close button by design — it disappears on its own once
 * the parent stops rendering it (fullscreen re-entered).
 */
export default function ExamFullscreenBanner({ onReenter }: ExamFullscreenBannerProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`${GLASS_PANEL_SOLID} flex flex-wrap items-center justify-between gap-3 rounded-xl !border-amber-200 !bg-amber-50/90 px-4 py-3 text-sm text-amber-800`}
    >
      <span>ফুলস্ক্রিন মোড থেকে বের হয়ে গেছেন — পরীক্ষা চলছে।</span>
      <button
        type="button"
        onClick={onReenter}
        className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white transition-colors hover:bg-amber-700"
      >
        <Maximize2 className="h-3.5 w-3.5" strokeWidth={2.25} />
        আবার ফুলস্ক্রিন করুন
      </button>
    </motion.div>
  );
}

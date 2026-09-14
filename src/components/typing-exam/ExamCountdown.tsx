"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export interface ExamCountdownProps {
  onComplete: () => void;
}

type Step = 3 | 2 | 1 | 0;

/**
 * Fullscreen-friendly countdown overlay: 3 -> 2 -> 1 -> 0 ("শুরু!") -> a
 * short final beat -> onComplete(). Chained setTimeout (not setInterval) so
 * cleanup is a plain clearTimeout — safer under React StrictMode's
 * double-invoke than a persistent interval. `onComplete` is read through a
 * ref so the effect only re-runs on `step`, not whenever the parent passes
 * a fresh callback identity.
 */
export default function ExamCountdown({ onComplete }: ExamCountdownProps) {
  const [step, setStep] = useState<Step>(3);
  const reduceMotion = useReducedMotion();
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const delay = step === 0 ? 500 : 1000;
    const timeout = setTimeout(() => {
      if (step === 0) {
        onCompleteRef.current();
      } else {
        setStep((s) => (s - 1) as Step);
      }
    }, delay);
    return () => clearTimeout(timeout);
  }, [step]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/85 backdrop-blur-sm">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={reduceMotion ? undefined : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, scale: 1.4 }}
          transition={{ duration: reduceMotion ? 0.15 : 0.35, ease: "easeOut" }}
          className="select-none text-8xl font-extrabold tabular-nums text-white sm:text-9xl"
        >
          {step === 0 ? "শুরু!" : step}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

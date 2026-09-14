"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Keyboard, Lock, ShieldAlert } from "lucide-react";
import { GLASS_PANEL, formatDurationLabel } from "@/components/typing-exam/ui";

/**
 * Pre-exam "ready" screen — replaces the old `"idle"` phase. Explains the
 * fullscreen -> countdown -> typing flow and shows the duration. When
 * `attemptsUsed` is a positive number (the STUDENT/internal retry flow
 * only — the PUBLIC flow gates identity+password on its own page before
 * this component is ever mounted, so it always passes `attemptsUsed` as
 * undefined/0), an inline retry-password check must pass before the real
 * Start button appears. The verified password is threaded back to the
 * caller via `onStart(retryPassword)`.
 *
 * The Start button's `onClick` stays synchronous up to `requestFullscreen()`
 * — a browser permission rule: fullscreen must be requested inside the
 * original user-gesture handler, with no `await` beforehand. That's why
 * `requestFullscreen` is a plain sync callback owned by the parent
 * (`ExamRunner`, which owns the fullscreen target's ref) rather than this
 * component managing its own ref.
 */
export interface ExamReadyScreenProps {
  durationSeconds: number;
  attemptsUsed?: number;
  onStart: (retryPassword?: string) => void;
  onVerifyRetryPassword?: (password: string) => Promise<boolean>;
  requestFullscreen: () => void;
}

export default function ExamReadyScreen({
  durationSeconds,
  attemptsUsed,
  onStart,
  onVerifyRetryPassword,
  requestFullscreen,
}: ExamReadyScreenProps) {
  const reduceMotion = useReducedMotion();
  const needsPassword = (attemptsUsed ?? 0) > 0;
  const [password, setPassword] = useState("");
  const [verified, setVerified] = useState(!needsPassword);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const durationLabel = formatDurationLabel(durationSeconds);

  const handleVerify = async () => {
    if (!password.trim() || verifying) return;
    setVerifying(true);
    setError(null);
    try {
      const ok = onVerifyRetryPassword ? await onVerifyRetryPassword(password) : false;
      if (ok) {
        setVerified(true);
      } else {
        setError("পাসওয়ার্ড সঠিক নয়");
      }
    } catch {
      setError("পাসওয়ার্ড সঠিক নয়");
    } finally {
      setVerifying(false);
    }
  };

  const handleStart = () => {
    // Synchronous, same gesture as the click — no await before this line.
    requestFullscreen();
    onStart(needsPassword ? password : undefined);
  };

  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`${GLASS_PANEL} rounded-2xl p-8 text-center`}
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
        <Keyboard className="h-7 w-7" strokeWidth={1.75} />
      </div>
      <p className="mb-2 text-sm text-slate-500">
        শুরু করলে স্ক্রিন ফুলস্ক্রিন হয়ে যাবে, তারপর একটি ছোট কাউন্টডাউন শেষে টাইপিং শুরু হবে।
      </p>
      <p className="mb-5 text-sm text-slate-500">
        সময়: <span className="font-semibold text-slate-700">{durationLabel}</span>
      </p>

      {needsPassword && !verified ? (
        <div className="mx-auto max-w-xs space-y-3 text-left">
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <ShieldAlert className="h-4 w-4 shrink-0" strokeWidth={2} />
            পুনরায় পরীক্ষা দিতে শিক্ষকের দেওয়া Retry Password প্রয়োজন।
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Retry Password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleVerify();
                }}
                placeholder="পাসওয়ার্ড লিখুন"
                className="w-full rounded-xl border border-slate-200 bg-white/90 py-2.5 pl-9 pr-3 text-sm shadow-sm transition-shadow focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
            {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
          </div>
          <motion.button
            type="button"
            onClick={handleVerify}
            disabled={verifying || !password.trim()}
            whileHover={reduceMotion || verifying ? undefined : { scale: 1.02 }}
            whileTap={reduceMotion || verifying ? undefined : { scale: 0.98 }}
            className="cursor-pointer w-full rounded-xl bg-slate-800 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {verifying ? "যাচাই হচ্ছে..." : "যাচাই করুন"}
          </motion.button>
        </div>
      ) : (
        <motion.button
          onClick={handleStart}
          whileHover={reduceMotion ? undefined : { scale: 1.03 }}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          className="cursor-pointer rounded-xl bg-brand-600 px-7 py-3 font-semibold text-white shadow-lg shadow-brand-600/20 transition-colors hover:bg-brand-700"
        >
          পরীক্ষা শুরু করুন
        </motion.button>
      )}
    </motion.div>
  );
}

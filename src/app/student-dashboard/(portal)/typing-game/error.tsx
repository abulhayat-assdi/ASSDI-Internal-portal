"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

/**
 * Typing-area error page. Keeps the student on the page they were on (a
 * busy moment on the server should not send them elsewhere) and retries.
 */
export default function TypingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error("[typing-game]", error);
  }, [error]);
  const retry = () => {
    router.refresh();
    reset();
  };
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <p className="text-4xl" aria-hidden="true">⌨️</p>
      <h2 className="font-display text-xl font-bold">পেজটা লোড করা যায়নি</h2>
      <p className="text-sm text-ink-muted">সার্ভার এই মুহূর্তে একটু ব্যস্ত ছিল। আবার চেষ্টা করুন — আপনার অগ্রগতি নিরাপদ আছে।</p>
      <button type="button" className="tap-btn tap-btn-primary tap-btn-md" onClick={retry}>
        <RotateCcw className="h-4 w-4" aria-hidden="true" /> আবার চেষ্টা করুন
      </button>
    </div>
  );
}

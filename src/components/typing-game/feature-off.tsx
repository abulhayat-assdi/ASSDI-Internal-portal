import Link from "next/link";
import { Lock } from "lucide-react";

/** Shown instead of a student page whose feature the admin has switched off. */
export function FeatureOff({ title }: { title: string }) {
  return (
    <div className="tap-card mx-auto mt-6 flex max-w-lg flex-col items-center gap-3 p-8 text-center">
      <Lock className="h-10 w-10 text-ink-faint" aria-hidden="true" />
      <p className="font-display text-lg font-bold">{title} is turned off</p>
      <p className="text-sm text-ink-muted">আপনার কোর্সের অ্যাডমিন এটা চালু করলে আবার দেখা যাবে।</p>
      <Link href="/student-dashboard/typing-game/dashboard" className="tap-btn tap-btn-primary tap-btn-sm">
        Go to dashboard
      </Link>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Gamepad2,
  Target,
  BarChart3,
  LineChart,
  UserCircle,
  Dumbbell,
  GraduationCap,
  Timer,
  Swords,
} from "lucide-react";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";
import { FEATURES_DEFAULT, type FeatureMap } from "@/lib/typing-game/features";

/**
 * Student module nav, in learning order: home, then learn (practice),
 * then play (games, missions), then compare (leaderboard), then "me".
 */
export function StudentNav({
  locale,
  features = FEATURES_DEFAULT,
  competeBadge = 0,
}: {
  locale: Locale;
  features?: FeatureMap;
  /** Invitations / turns waiting for this student. */
  competeBadge?: number;
}) {
  const pathname = usePathname();
  const t = getTranslator(locale, "nav");
  const all = [
    { href: `/student-dashboard/typing-game/dashboard`, label: t("dashboard"), icon: LayoutDashboard },
    { href: `/student-dashboard/typing-game/lessons`, label: t("lessons"), icon: GraduationCap },
    { href: `/student-dashboard/typing-game/practice`, label: t("practice"), icon: Dumbbell },
    { href: `/student-dashboard/typing-game/tests`, label: t("tests"), icon: Timer },
    { href: `/student-dashboard/typing-game/games`, label: t("games"), icon: Gamepad2, flag: features.ARCADE_GAMES_ENABLED },
    { href: `/student-dashboard/typing-game/compete`, label: "Compete", icon: Swords, flag: features.BATCH_COMPETITION_ENABLED, badge: competeBadge },
    { href: `/student-dashboard/typing-game/missions`, label: t("missions"), icon: Target, flag: features.MISSIONS_ENABLED },
    { href: `/student-dashboard/typing-game/leaderboard`, label: t("leaderboard"), icon: BarChart3 },
    { href: `/student-dashboard/typing-game/progress`, label: t("progress"), icon: LineChart },
    { href: `/student-dashboard/typing-game/profile`, label: t("profile"), icon: UserCircle },
  ];
  const items: { href: string; label: string; icon: typeof Swords; flag?: boolean; badge?: number }[] = all.filter(
    (i: { flag?: boolean }) => i.flag !== false,
  );
  return (
    // Same width and side padding as the page content below, so the bar
    // lines up with it; tabs share the width evenly on large screens.
    <nav aria-label={t("dashboard")} className="sticky top-16 z-20 px-3 pt-3 sm:px-5 xl:px-8">
      <div
        className="mx-auto flex w-full max-w-[1680px] gap-1 overflow-x-auto rounded-2xl border p-1.5 shadow-sm [scrollbar-width:none]"
        style={{
          borderColor: "var(--tap-border)",
          background: "var(--tap-surface-strong)",
          backdropFilter: "var(--tap-blur)",
          WebkitBackdropFilter: "var(--tap-blur)",
        }}
      >
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="relative flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--tap-surface-hover)] lg:flex-1 lg:px-2 xl:text-[0.95rem]"
              style={{ color: active ? "var(--tap-ink-on-accent)" : "var(--tap-ink-muted)" }}
            >
              {active && (
                <motion.span
                  layoutId="tap-nav-active"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: "var(--tap-primary-grad)", boxShadow: "0 6px 16px rgba(99,102,241,0.35)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Icon className="relative h-[18px] w-[18px]" strokeWidth={2.25} />
              <span className="relative">{item.label}</span>
              {item.badge ? (
                <span
                  className="relative flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold"
                  style={{ background: "#f43f5e", color: "#fff" }}
                  aria-label={`${item.badge}টা অপেক্ষায়`}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

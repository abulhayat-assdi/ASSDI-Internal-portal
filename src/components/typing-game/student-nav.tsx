"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Map,
  Gamepad2,
  Target,
  Trophy,
  Users,
  BarChart3,
  Swords,
  LineChart,
  UserCircle,
} from "lucide-react";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";

/** Student module nav (translated labels, active section highlighted). */
export function StudentNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const t = getTranslator(locale, "nav");
  const items = [
    { href: `/student-dashboard/typing-game/dashboard`, label: t("dashboard"), icon: LayoutDashboard },
    { href: `/student-dashboard/typing-game/map`, label: t("adventureMap"), icon: Map },
    { href: `/student-dashboard/typing-game/games`, label: t("games"), icon: Gamepad2 },
    { href: `/student-dashboard/typing-game/missions`, label: t("missions"), icon: Target },
    { href: `/student-dashboard/typing-game/season`, label: t("season"), icon: Trophy },
    { href: `/student-dashboard/typing-game/clan`, label: t("clan"), icon: Users },
    { href: `/student-dashboard/typing-game/leaderboard`, label: t("leaderboard"), icon: BarChart3 },
    { href: `/student-dashboard/typing-game/competitions`, label: t("competitions"), icon: Swords },
    { href: `/student-dashboard/typing-game/progress`, label: t("progress"), icon: LineChart },
    { href: `/student-dashboard/typing-game/profile`, label: t("profile"), icon: UserCircle },
  ];
  return (
    <nav
      aria-label={t("dashboard")}
      className="sticky top-0 z-40 border-b"
      style={{
        borderColor: "var(--tap-border)",
        background: "var(--tap-surface-strong)",
        backdropFilter: "var(--tap-blur)",
        WebkitBackdropFilter: "var(--tap-blur)",
      }}
    >
      <div className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-3 py-2">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition-colors"
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
              <Icon className="relative h-4 w-4" strokeWidth={2.25} />
              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";

/** Student module nav (translated labels, active section highlighted). */
export function StudentNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const t = getTranslator(locale, "nav");
  const items = [
    { href: `/student-dashboard/typing-game/dashboard`, label: t("dashboard") },
    { href: `/student-dashboard/typing-game/map`, label: t("adventureMap") },
    { href: `/student-dashboard/typing-game/games`, label: t("games") },
    { href: `/student-dashboard/typing-game/missions`, label: t("missions") },
    { href: `/student-dashboard/typing-game/season`, label: t("season") },
    { href: `/student-dashboard/typing-game/clan`, label: t("clan") },
    { href: `/student-dashboard/typing-game/leaderboard`, label: t("leaderboard") },
    { href: `/student-dashboard/typing-game/competitions`, label: t("competitions") },
    { href: `/student-dashboard/typing-game/progress`, label: t("progress") },
    { href: `/student-dashboard/typing-game/profile`, label: t("profile") },
  ];
  return (
    <nav aria-label={t("dashboard")} className="border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-4">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold " +
                (active
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-ink-muted")
              }
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

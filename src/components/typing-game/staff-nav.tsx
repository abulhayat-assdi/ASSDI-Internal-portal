"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Gauge,
  GraduationCap,
  Layers,
  Megaphone,
  ScrollText,
  Target,
  ToggleRight,
  UserCog,
  Users,
} from "lucide-react";
import type { Locale } from "@/lib/typing-game/i18n";
import { LogoutButton } from "./logout-button";

const ICONS = {
  overview: Gauge,
  batches: Layers,
  students: Users,
  teachers: UserCog,
  courses: BookOpen,
  missions: Target,
  analytics: BarChart3,
  features: ToggleRight,
  ads: Megaphone,
  audit: ScrollText,
  lessons: GraduationCap,
} as const;

export type StaffNavIcon = keyof typeof ICONS;

export interface StaffNavItem {
  href: string;
  label: string;
  icon?: StaffNavIcon;
  /** Only this exact path marks the tab active (for the console's home tab). */
  exact?: boolean;
}

/** Console tab bar: icon tabs, a role chip and logout. */
export function StaffNav({
  locale,
  items,
  homeHref,
  role = "Admin",
}: {
  locale: Locale;
  items: StaffNavItem[];
  homeHref: string;
  role?: string;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={`${role} console`} className="sc-nav border-b border-[var(--tap-border)] bg-[var(--tap-surface-solid)]">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none]">
        <Link href={homeHref} className="mr-2 flex shrink-0 items-center gap-2 whitespace-nowrap pr-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg text-base"
            style={{ background: "var(--tap-primary-grad)", color: "#fff" }}
            aria-hidden="true"
          >
            ⌨
          </span>
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-sm font-extrabold">Typing Adventure</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{role} console</span>
          </span>
        </Link>
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon ? ICONS[item.icon] : null;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-ink-muted transition-colors hover:bg-[var(--tap-surface-hover)] hover:text-ink"
            >
              {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
              {item.label}
            </Link>
          );
        })}
        <span className="ml-auto shrink-0 pl-2">
          <LogoutButton locale={locale} />
        </span>
      </div>
    </nav>
  );
}

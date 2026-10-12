"use client";

import Link from "next/link";
import { BookOpen, CalendarCheck, Home, MoreHorizontal, NotebookPen, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tab {
    href: string;
    label: string;
    icon: LucideIcon;
    feature?: string;
    /** Dashboard is the prefix of every student route, so it only matches exactly. */
    exact?: boolean;
}

const TABS: Tab[] = [
    { href: "/student-dashboard", label: "Dashboard", icon: Home, exact: true },
    { href: "/student-dashboard/homework", label: "Homework", icon: NotebookPen, feature: "homework" },
    { href: "/student-dashboard/attendance", label: "Attendance", icon: CalendarCheck, feature: "attendance" },
    { href: "/student-dashboard/resource", label: "Resource", icon: BookOpen, feature: "resources" },
];

interface StudentBottomNavProps {
    pathname: string | null;
    features: Record<string, boolean>;
    isMoreOpen: boolean;
    onMore: () => void;
    onNavigate: (href: string) => void;
}

/**
 * Phone/tablet navigation for the student portal: the four pages students open
 * every day, plus "More", which opens the full menu drawer (Sidebar). Hidden
 * from `lg` up, where the sidebar is always on screen.
 */
export default function StudentBottomNav({ pathname, features, isMoreOpen, onMore, onNavigate }: StudentBottomNavProps) {
    const tabs = TABS.filter((tab) => !(tab.feature && features[tab.feature] === false));
    const isTabActive = (tab: Tab) =>
        tab.exact ? pathname === tab.href : pathname === tab.href || !!pathname?.startsWith(`${tab.href}/`);
    const activeTab = isMoreOpen ? undefined : tabs.find(isTabActive);
    // Any page that is not one of the tabs lives behind "More".
    const moreActive = isMoreOpen || !activeTab;

    const itemClass = (active: boolean) =>
        cn(
            "flex-1 min-w-0 h-16 flex flex-col items-center justify-center gap-1 text-[10px] min-[360px]:text-[11px] font-semibold tracking-tight transition-colors",
            active ? "text-[#059669]" : "text-[#6b7280] active:text-[#1f2937]"
        );
    const iconWrapClass = (active: boolean) =>
        cn("flex items-center justify-center h-7 w-12 min-[360px]:w-14 rounded-full transition-colors", active && "bg-[#d1fae5]");

    return (
        <nav
            aria-label="Student navigation"
            className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#e5e7eb] pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_rgba(15,23,42,0.05)]"
        >
            <ul className="flex items-stretch max-w-xl mx-auto">
                {tabs.map((tab) => {
                    const active = activeTab === tab;
                    const Icon = tab.icon;
                    return (
                        <li key={tab.href} className="flex-1 min-w-0">
                            <Link
                                href={tab.href}
                                prefetch={true}
                                aria-current={active ? "page" : undefined}
                                onClick={() => onNavigate(tab.href)}
                                className={itemClass(active)}
                            >
                                <span className={iconWrapClass(active)}>
                                    <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
                                </span>
                                <span className="whitespace-nowrap">{tab.label}</span>
                            </Link>
                        </li>
                    );
                })}
                <li className="flex-1 min-w-0">
                    <button
                        type="button"
                        onClick={onMore}
                        aria-label="More menu"
                        aria-expanded={isMoreOpen}
                        className={cn(itemClass(moreActive), "w-full cursor-pointer")}
                    >
                        <span className={iconWrapClass(moreActive)}>
                            <MoreHorizontal className="w-5 h-5" strokeWidth={moreActive ? 2.4 : 2} />
                        </span>
                        <span>More</span>
                    </button>
                </li>
            </ul>
        </nav>
    );
}

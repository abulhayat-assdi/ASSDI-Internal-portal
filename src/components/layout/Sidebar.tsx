"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import BrandLogo from "@/components/ui/BrandLogo";
import { useSidebarNotifications } from "@/hooks/useSidebarNotifications";
import { PermissionKey } from "@/lib/permissions";

interface NavItem {
    href: string;
    label: string;
    icon: string;
    permission: PermissionKey | null;
    feature?: string;
}

interface NavSection {
    id: string;
    title: string;
    icon: string;
    items: NavItem[];
}

const teacherAdminTopNavItems: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: "🏠", permission: null },
    { href: "/dashboard/all-batch-info", label: "All Batch Info", icon: "📊", permission: "batch_info", feature: "batch_info" },
    { href: "/dashboard/course-modules", label: "Course Modules", icon: "📚", permission: "course_modules", feature: "course_modules" },
    { href: "/dashboard/homework", label: "Homework", icon: "📝", permission: "homework", feature: "homework" },
    { href: "/dashboard/leave-tracking", label: "Leave Tracking", icon: "🌴", permission: "leave_tracking", feature: "leave_tracking" },
    { href: "/dashboard/student-leaves", label: "Student Leaves", icon: "🏖️", permission: "admin_leave", feature: "student_leaves" },
];

const teacherAdminNavSections: NavSection[] = [
    {
        id: "academic_classes",
        title: "Academic & Classes",
        icon: "🎓",
        items: [
            { href: "/dashboard/teachers", label: "Teacher Directory", icon: "👥", permission: "teachers", feature: "teachers" },
            { href: "/dashboard/schedule", label: "Class Schedule", icon: "📅", permission: "schedule", feature: "schedule" },
            { href: "/dashboard/manage-routine", label: "Manage Routine", icon: "📆", permission: "routine", feature: "routine" },
            { href: "/dashboard/admin/course-modules", label: "Course Modules Mgr", icon: "📚", permission: "admin_course_modules", feature: "course_modules" },
            { href: "/dashboard/admin/manage-homework", label: "Manage Homework", icon: "📁", permission: "admin_homework", feature: "homework" },
            { href: "/dashboard/admin/manage-results", label: "Manage Results", icon: "📝", permission: "admin_results", feature: "exam_results" },
        ]
    },
    {
        id: "student_mgmt",
        title: "Student Management",
        icon: "👨‍🎓",
        items: [
            { href: "/dashboard/admin/deployments", label: "Student Deployments", icon: "🚀", permission: "admin_deployments", feature: "deployments" },
            { href: "/dashboard/admin/cv-manager", label: "CV Manager", icon: "📄", permission: "admin_panel", feature: "cv_builder" },
            { href: "/dashboard/admin/student-updates", label: "Student Updates", icon: "🔔", permission: "admin_notices", feature: "student_updates" },
        ]
    },
    {
        id: "resources_activities",
        title: "Resources & Activities",
        icon: "📑",
        items: [
            { href: "/dashboard/competitions", label: "Competitions (Forms)", icon: "🏆", permission: "admin_panel", feature: "competitions" },
            { href: "/dashboard/resources", label: "Resource Library", icon: "🗂️", permission: "resources", feature: "resources" },
            { href: "/dashboard/admin/resource-management", label: "Admin: Resources", icon: "🗂️", permission: "admin_resources", feature: "resources" },
            { href: "/dashboard/policies", label: "Policy & Minutes", icon: "📋", permission: "policies", feature: "policies" },
            { href: "/dashboard/feedback", label: "Feedback", icon: "💬", permission: "feedback", feature: "feedback" },
        ]
    },
    {
        id: "typing_game",
        title: "Typing Adventure",
        icon: "⌨️",
        items: [
            { href: "/dashboard/typing-game/admin", label: "Admin Console", icon: "⌨️", permission: "admin_typing_game", feature: "typing_game" },
            { href: "/dashboard/typing-game/admin/flags", label: "Typing Adventure Flags", icon: "🚩", permission: "admin_typing_game", feature: "typing_game" },
            { href: "/dashboard/typing-game/teacher", label: "Teacher Console", icon: "⌨️", permission: "typing_game_teacher", feature: "typing_game" },
        ]
    },
    {
        id: "typing_exam",
        title: "Typing Test Exam",
        icon: "📝",
        items: [
            { href: "/dashboard/typing-exam", label: "Manage Exams", icon: "📝", permission: "typing_exam", feature: "typing_exam" },
        ]
    },
    {
        id: "system_admin",
        title: "System Admin",
        icon: "⚙️",
        items: [
            { href: "/dashboard/admin", label: "Admin Panel", icon: "⚙️", permission: "admin_panel" },
            { href: "/dashboard/admin/access-management", label: "Access Management", icon: "🔑", permission: "access_management" },
            { href: "/dashboard/admin/contact-messages", label: "Contact Messages", icon: "📩", permission: "admin_contact", feature: "contact_messages" },
            { href: "/dashboard/admin/batch-forms", label: "Batch Forms", icon: "📝", permission: "admin_panel", feature: "batch_forms" },
            { href: "/dashboard/admin/leave-management", label: "Manage Leaves", icon: "🌴", permission: "admin_leave", feature: "leave_tracking" },
        ]
    }
];

const studentNavItems: NavItem[] = [
    { href: "/student-dashboard", label: "Dashboard", icon: "🏠", permission: null },
    { href: "/student-dashboard/routine", label: "Class Routine", icon: "🗓️", permission: null },
    { href: "/student-dashboard/resource", label: "Resource", icon: "📚", permission: null, feature: "resources" },
    { href: "/student-dashboard/course-outline", label: "Course Outline", icon: "📋", permission: null, feature: "course_modules" },
    { href: "/student-dashboard/homework", label: "Homework", icon: "📝", permission: null, feature: "homework" },
    { href: "/student-dashboard/results", label: "Results", icon: "🎓", permission: null, feature: "exam_results" },
    { href: "/student-dashboard/deployments", label: "My Deployments", icon: "🚀", permission: null, feature: "deployments" },
    { href: "/student-dashboard/profile", label: "Profile", icon: "👤", permission: null },
    { href: "/student-dashboard/leave", label: "Leave Request", icon: "🏖️", permission: null },
    { href: "/student-dashboard/cv", label: "My CV", icon: "📄", permission: null, feature: "cv_builder" },
    { href: "/student-dashboard/typing-game/dashboard", label: "Typing Adventure", icon: "⌨️", permission: null, feature: "typing_game" },
    { href: "/student-dashboard/typing-exam", label: "Typing Exam", icon: "📝", permission: null, feature: "typing_exam" },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { userProfile, logout, loading, hasPermission } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [siteLogoUrl, setSiteLogoUrl] = useState<string | null>(null);
    const [siteName, setSiteName] = useState<string | null>(null);
    const [features, setFeatures] = useState<Record<string, boolean>>({});
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

    // Notifications hook
    const { counts, markPageAsVisited } = useSidebarNotifications();

    // Fetch site settings (logo + name + features)
    const fetchSiteSettings = async () => {
        try {
            const res = await fetch("/api/site-settings");
            if (res.ok) {
                const data = await res.json();
                setSiteLogoUrl(data.logoUrl || null);
                setSiteName(data.siteName || null);
                if (data.features && typeof data.features === "object") {
                    setFeatures(data.features);
                }
            }
        } catch {
            // silently fail — defaults will show
        }
    };

    useEffect(() => {
        fetchSiteSettings();
        // Re-fetch when admin saves site settings
        const handler = () => fetchSiteSettings();
        window.addEventListener("site-settings-changed", handler);
        return () => window.removeEventListener("site-settings-changed", handler);
    }, []);

    // Mark current path as visited
    useEffect(() => {
        if (pathname && !loading) {
            markPageAsVisited(pathname);
        }
    }, [pathname, loading, markPageAsVisited]);

    const isStudent = userProfile?.role === "student";

    const toggleSection = (id: string) => {
        setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Filter helper function
    const isNavItemAllowed = (item: NavItem) => {
        if (loading) return true; // show all while loading
        if (item.feature && Object.keys(features).length > 0) {
            if (features[item.feature] === false) return false;
        }
        if (isStudent) return true;
        if (!item.permission) return true; // dashboard — always visible
        return hasPermission(item.permission);
    };

    // Filter top nav items
    const filteredTopNavItems = (isStudent ? studentNavItems : teacherAdminTopNavItems).filter(isNavItemAllowed);

    // Filter sections for teacher/admin
    const filteredSections = isStudent ? [] : teacherAdminNavSections.map(section => {
        const allowedItems = section.items.filter(isNavItemAllowed);
        return {
            ...section,
            items: allowedItems
        };
    }).filter(section => section.items.length > 0);

    // Auto expand active section if current pathname matches a child link
    useEffect(() => {
        if (!pathname || isStudent) return;
        teacherAdminNavSections.forEach(section => {
            const hasActiveChild = section.items.some(item => item.href === pathname);
            if (hasActiveChild) {
                setOpenSections(prev => ({ ...prev, [section.id]: true }));
            }
        });
    }, [pathname, isStudent]);

    // Handle logout: clear Firebase session and redirect to login
    const handleLogout = async () => {
        try {
            const redirectPath = isStudent ? "/student-login" : "/login";
            await logout();
            router.push(redirectPath);
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    return (
        <>
            {/* Mobile Menu Button */}
            <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md border border-[#e5e7eb]"
                aria-label="Toggle menu"
            >
                <svg className="w-6 h-6 text-[#1f2937]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isMobileMenuOpen ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                </svg>
            </button>

            {/* Overlay for mobile */}
            {isMobileMenuOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={cn(
                "w-64 bg-white border-r border-[#e5e7eb] text-[#1f2937] h-[100dvh] fixed left-0 top-0 flex flex-col z-40 transition-transform duration-300",
                // Mobile: slide in/out
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
                // Desktop: always visible
                "lg:translate-x-0"
            )}>
                {/* Logo/Brand */}
                <div className="p-6 border-b border-[#e5e7eb] flex items-center justify-center">
                    <Link
                        href={isStudent ? "/student-dashboard" : "/dashboard"}
                        prefetch={true}
                        className="cursor-pointer group"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <div suppressHydrationWarning className="bg-[#0D1B2A] rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm transition-all duration-300 ease-in-out group-hover:shadow-md group-hover:-translate-y-0.5">
                            <BrandLogo size={36} primaryColor="#FFFFFF" arrowColor="#4CAF50" logoUrl={siteLogoUrl} />
                            {siteName ? (
                                <div suppressHydrationWarning className="text-white font-bold text-sm leading-tight tracking-wide">
                                    {siteName}
                                </div>
                            ) : (
                                <div suppressHydrationWarning className="text-white font-bold text-sm leading-tight tracking-wide">
                                    SALES <br />MARKETING
                                </div>
                            )}
                        </div>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 overflow-y-auto space-y-3">
                    {/* Top / Direct Nav Items */}
                    <ul className="space-y-1">
                        {filteredTopNavItems.map((item) => {
                            const isActive = pathname === item.href;
                            const badgeCount = counts[item.href] || 0;
                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        prefetch={true}
                                        onClick={() => {
                                            setIsMobileMenuOpen(false);
                                            markPageAsVisited(item.href);
                                        }}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-2.5 rounded-full transition-all duration-200",
                                            isActive
                                                ? "bg-[#059669] text-white font-medium shadow-xs"
                                                : "text-[#4b5563] hover:bg-[#d1fae5] hover:text-[#1f2937]"
                                        )}
                                    >
                                        <span className="text-xl flex-shrink-0">{item.icon}</span>
                                        <span className="text-sm font-semibold truncate">{item.label}</span>
                                        {badgeCount > 0 && (
                                            <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-in fade-in zoom-in">
                                                {badgeCount > 99 ? '99+' : badgeCount}
                                            </span>
                                        )}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>

                    {/* Accordion Nav Sections for Admin/Teacher */}
                    {!isStudent && filteredSections.length > 0 && (
                        <div className="pt-2 border-t border-[#e5e7eb] space-y-1.5">
                            {filteredSections.map((section) => {
                                const isOpen = !!openSections[section.id];
                                const sectionBadgeCount = section.items.reduce((acc, item) => acc + (counts[item.href] || 0), 0);
                                const hasActiveChild = section.items.some(item => item.href === pathname);

                                return (
                                    <div key={section.id} className="rounded-xl overflow-hidden">
                                        {/* Section Header Button */}
                                        <button
                                            type="button"
                                            onClick={() => toggleSection(section.id)}
                                            className={cn(
                                                "w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors duration-200 text-left font-bold text-xs uppercase tracking-wider cursor-pointer",
                                                hasActiveChild
                                                    ? "bg-[#ecfdf5] text-[#047857]"
                                                    : "text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1f2937]"
                                            )}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-base flex-shrink-0">{section.icon}</span>
                                                <span className="truncate">{section.title}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                {!isOpen && sectionBadgeCount > 0 && (
                                                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                        {sectionBadgeCount > 99 ? '99+' : sectionBadgeCount}
                                                    </span>
                                                )}
                                                <svg
                                                    className={cn(
                                                        "w-4 h-4 transition-transform duration-200 text-gray-400",
                                                        isOpen ? "rotate-180" : "rotate-0"
                                                    )}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </button>

                                        {/* Section Items */}
                                        {isOpen && (
                                            <ul className="mt-1 ml-2 space-y-1 border-l-2 border-[#10b981]/20 pl-2 py-0.5">
                                                {section.items.map((item) => {
                                                    const isActive = pathname === item.href;
                                                    const badgeCount = counts[item.href] || 0;
                                                    return (
                                                        <li key={item.href}>
                                                            <Link
                                                                href={item.href}
                                                                prefetch={true}
                                                                onClick={() => {
                                                                    setIsMobileMenuOpen(false);
                                                                    markPageAsVisited(item.href);
                                                                }}
                                                                className={cn(
                                                                    "flex items-center gap-2 px-3 py-2 rounded-full transition-colors duration-200",
                                                                    isActive
                                                                        ? "bg-[#059669] text-white font-medium shadow-xs"
                                                                        : "text-[#4b5563] hover:bg-[#d1fae5] hover:text-[#1f2937]"
                                                                )}
                                                            >
                                                                <span className="text-lg flex-shrink-0">{item.icon}</span>
                                                                <span className="text-xs font-semibold truncate">{item.label}</span>
                                                                {badgeCount > 0 && (
                                                                    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                                        {badgeCount > 99 ? '99+' : badgeCount}
                                                                    </span>
                                                                )}
                                                            </Link>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </nav>

                {/* Bottom Actions */}
                <div className="p-4 border-t border-[#e5e7eb] space-y-2">
                    {/* Contact Button - Students Only */}
                    {isStudent && (
                        <Link
                            href="/student-dashboard/contact-admin"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#059669] text-white rounded-lg hover:bg-[#047857] transition-all duration-200 cursor-pointer"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                            <span className="text-sm font-bold">Contact Admin</span>
                        </Link>
                    )}

                    {/* Logout Button */}
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full p-2 bg-[#fee2e2] text-[#dc2626] rounded-xl hover:bg-[#fecaca] transition-all duration-200 cursor-pointer"
                    >
                        <div className="w-10 h-10 rounded-full bg-[#1f2937] flex items-center justify-center text-white font-medium text-lg flex-shrink-0 shadow-inner">
                            {userProfile?.displayName ? userProfile.displayName.charAt(0).toUpperCase() : "U"}
                        </div>
                        <div className="flex items-center gap-2 flex-1 justify-center pr-6">
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span className="text-base font-bold whitespace-nowrap">Logout</span>
                        </div>
                    </button>
                </div>
            </aside>
        </>
    );
}

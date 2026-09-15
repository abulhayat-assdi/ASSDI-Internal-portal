"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, LayoutGrid, LogOut, BarChart3, Users, ScrollText, Megaphone, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { logout } = useAuth();

    if (pathname === "/super-admin/login") {
        return <>{children}</>;
    }

    const handleLogout = async () => {
        await logout();
        window.location.href = "/super-admin/login";
    };

    return (
        <div className="min-h-screen bg-slate-100">
            <header className="bg-slate-900 text-white">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/super-admin" className="flex items-center gap-2 font-semibold">
                        <Shield className="w-5 h-5 text-indigo-400" />
                        Super Admin
                    </Link>
                    <nav className="flex items-center gap-4 text-sm">
                        <Link href="/super-admin" className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors">
                            <LayoutGrid className="w-4 h-4" />
                            Courses
                        </Link>
                        <Link href="/super-admin/analytics" className="hidden sm:flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors">
                            <BarChart3 className="w-4 h-4" />
                            Analytics
                        </Link>
                        <Link href="/super-admin/users" className="hidden sm:flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors">
                            <Users className="w-4 h-4" />
                            Users
                        </Link>
                        <Link href="/super-admin/audit" className="hidden sm:flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors">
                            <ScrollText className="w-4 h-4" />
                            Audit
                        </Link>
                        <Link href="/super-admin/announcements" className="hidden md:flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors">
                            <Megaphone className="w-4 h-4" />
                            Notices
                        </Link>
                        <Link href="/super-admin/security" className="hidden md:flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors">
                            <ShieldCheck className="w-4 h-4" />
                            Security
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Logout
                        </button>
                    </nav>
                </div>
            </header>
            <main>{children}</main>
        </div>
    );
}

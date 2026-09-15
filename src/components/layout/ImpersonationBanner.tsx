"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, LogOut, Loader2 } from "lucide-react";

/** Builds an absolute URL on a sibling subdomain of the current host. */
function siblingSubdomainUrl(subdomain: string, path: string): string {
    const u = new URL(window.location.href);
    const host = u.hostname.replace(/^[^.]+/, subdomain);
    const port = u.port ? `:${u.port}` : "";
    return `${u.protocol}//${host}${port}${path}`;
}

/**
 * Shown on every /dashboard page when the session came from super-admin
 * "Login as admin". Exit destroys only the COURSE session and returns to
 * the super-admin panel — the super-admin session on the admin host is a
 * separate host-only cookie and stays intact.
 */
export default function ImpersonationBanner() {
    const { userProfile, logout } = useAuth();
    const [exiting, setExiting] = useState(false);

    if (!userProfile?.impersonatedBy) return null;

    const handleExit = async () => {
        setExiting(true);
        try {
            await logout(); // clears the course-host session cookie
        } catch {
            // proceed to super-admin anyway
        }
        const courseId = userProfile.courseId;
        const backPath = courseId ? `/super-admin/courses/${courseId}` : "/super-admin";
        window.location.href = siblingSubdomainUrl("admin", backPath);
    };

    return (
        <div className="bg-amber-500 text-white text-sm">
            <div className="px-4 md:px-6 py-2 flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 min-w-0">
                    <Eye className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                        Super-admin <strong>{userProfile.impersonatedBy}</strong> হিসেবে{" "}
                        <strong>{userProfile.email}</strong> রূপে দেখছেন
                    </span>
                </p>
                <button
                    onClick={handleExit}
                    disabled={exiting}
                    className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors font-semibold px-3 py-1 rounded-lg shrink-0 disabled:opacity-60"
                >
                    {exiting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                    {exiting ? "বের হচ্ছেন..." : "Exit"}
                </button>
            </div>
        </div>
    );
}

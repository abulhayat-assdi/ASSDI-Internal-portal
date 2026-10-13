"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getRequiredPermission, UNREGISTERED_PAGE } from "@/lib/permissions";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, userProfile, loading, hasPermission } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    // Show full-page dashboard skeleton overlay while checking auth, profile or during redirect
    if (loading || !user || !userProfile) {
        return (
            <div className="fixed inset-0 z-50 flex min-h-screen bg-gray-50">
                {/* Sidebar Skeleton */}
                <div className="hidden lg:flex w-64 flex-col bg-white border-r border-gray-200 p-6 animate-pulse fixed inset-y-0 left-0">
                    <div className="h-10 w-3/4 bg-gray-200 rounded-lg mb-10"></div>
                    <div className="space-y-4 flex-1 mt-4">
                        <div className="h-10 w-full bg-gray-200 rounded-lg"></div>
                        <div className="h-10 w-5/6 bg-gray-100 rounded-lg"></div>
                        <div className="h-10 w-full bg-gray-100 rounded-lg"></div>
                        <div className="h-10 w-4/5 bg-gray-200 rounded-lg"></div>
                        <div className="h-10 w-full bg-gray-100 rounded-lg"></div>
                        <div className="h-10 w-full bg-gray-100 rounded-lg"></div>
                    </div>
                </div>

                {/* Main Content Area Skeleton */}
                <div className="flex-1 flex flex-col lg:ml-64">
                    {/* Header Skeleton */}
                    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between animate-pulse fixed top-0 left-0 lg:left-64 right-0 z-[60]">
                        <div className="h-6 w-32 bg-gray-200 rounded-md"></div>
                        <div className="flex items-center gap-4">
                            <div className="hidden md:block h-5 w-40 bg-gray-100 rounded-md"></div>
                            <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                        </div>
                    </header>

                    {/* Dashboard Body Skeleton */}
                    <main className="p-6 md:p-8 flex-1 animate-pulse space-y-6 max-w-7xl w-full mx-auto mt-16">
                        <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
                            <div className="space-y-3 w-full md:w-1/2">
                                <div className="h-8 w-1/2 bg-gray-200 rounded-lg"></div>
                                <div className="h-4 w-3/4 bg-gray-100 rounded-lg"></div>
                            </div>
                            <div className="h-12 w-32 bg-gray-200 rounded-lg"></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-white rounded-xl border border-gray-100 shadow-sm"></div>)}
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
                            <div className="lg:col-span-2 h-96 bg-white rounded-xl border border-gray-100 shadow-sm"></div>
                            <div className="h-96 bg-white rounded-xl border border-gray-100 shadow-sm"></div>
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    // Check page-level permission
    const requiredPermission = getRequiredPermission(pathname || "");
    // Unregistered dashboard pages are Super Admin only (see getRequiredPermission).
    const denied = requiredPermission === UNREGISTERED_PAGE
        ? userProfile.role !== "super_admin"
        : requiredPermission !== null && !hasPermission(requiredPermission);
    if (denied) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center max-w-sm mx-auto p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
                    <div className="text-6xl mb-4">🔒</div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
                    <p className="text-gray-500 text-sm leading-relaxed">
                        আপনার এই পেইজে প্রবেশের অনুমতি নেই।<br />
                        Super Admin এর সাথে যোগাযোগ করুন।
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

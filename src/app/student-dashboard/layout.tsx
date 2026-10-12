import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import AnnouncementBanner from "@/components/layout/AnnouncementBanner";
import StudentProtectedRoute from "@/components/auth/StudentProtectedRoute";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { getRequestBranding } from "@/lib/branding";
import type { Viewport } from "next";

// viewport-fit=cover is what makes env(safe-area-inset-*) non-zero, which the
// bottom tab bar pads itself with on phones with a home indicator.
export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: "#ffffff",
};

export default async function StudentDashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const branding = await getRequestBranding();

    return (
        <BrandingProvider value={branding}>
        <div className="student-portal min-h-screen bg-slate-50">
            {/* Sidebar */}
            <Sidebar variant="student" />

            {/* Main Content Area */}
            <div className="lg:ml-64">
                {/* Navbar */}
                <Navbar variant="student" />
                <div className="pt-16">
                    <AnnouncementBanner />
                </div>

                {/* Page Content */}
                {/* Bottom padding below lg clears the fixed bottom tab bar. */}
                <main className="min-h-[calc(100dvh-4rem)]">
                    <div className="p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-6">
                        <StudentProtectedRoute>
                            {children}
                        </StudentProtectedRoute>
                    </div>
                </main>
            </div>
        </div>
        </BrandingProvider>
    );
}

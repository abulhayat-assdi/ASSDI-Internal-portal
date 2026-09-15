import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import ImpersonationBanner from "@/components/layout/ImpersonationBanner";
import AnnouncementBanner from "@/components/layout/AnnouncementBanner";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { ToastProvider } from "@/components/ui/Toast";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ToastProvider>
            <div suppressHydrationWarning className="min-h-screen bg-slate-50">
                {/* Sidebar */}
                <Sidebar />

                {/* Main Content Area */}
                <div className="lg:ml-64">
                    {/* Navbar */}
                    <Navbar />
                    {/* Super-admin impersonation notice (only renders when impersonating) */}
                    <div className="pt-16">
                        <ImpersonationBanner />
                        <AnnouncementBanner />
                    </div>

                    {/* Page Content */}
                    <main className="min-h-screen">
                        <div className="p-4 md:p-6">
                            <ProtectedRoute>
                                {children}
                            </ProtectedRoute>
                        </div>
                    </main>
                </div>
            </div>
        </ToastProvider>
    );
}

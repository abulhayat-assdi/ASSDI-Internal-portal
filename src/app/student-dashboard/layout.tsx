import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import AnnouncementBanner from "@/components/layout/AnnouncementBanner";
import StudentProtectedRoute from "@/components/auth/StudentProtectedRoute";

export default function StudentDashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-slate-50">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content Area */}
            <div className="lg:ml-64">
                {/* Navbar */}
                <Navbar />
                <div className="pt-16">
                    <AnnouncementBanner />
                </div>

                {/* Page Content */}
                <main className="min-h-screen">
                    <div className="p-4 md:p-6">
                        <StudentProtectedRoute>
                            {children}
                        </StudentProtectedRoute>
                    </div>
                </main>
            </div>
        </div>
    );
}

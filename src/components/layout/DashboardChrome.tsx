"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import ImpersonationBanner from "./ImpersonationBanner";
import AnnouncementBanner from "./AnnouncementBanner";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

export default function DashboardChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const crm =
    pathname === "/dashboard/crm" || pathname.startsWith("/dashboard/crm/");
  if (crm)
    return (
      <>
        <ImpersonationBanner />
        <AnnouncementBanner />
        <ProtectedRoute minimalLoading>{children}</ProtectedRoute>
      </>
    );
  return (
    <div suppressHydrationWarning className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className="lg:ml-64">
        <Navbar />
        <div className="pt-16">
          <ImpersonationBanner />
          <AnnouncementBanner />
        </div>
        <main className="min-h-screen">
          <div className="p-4 md:p-6">
            <ProtectedRoute>{children}</ProtectedRoute>
          </div>
        </main>
      </div>
    </div>
  );
}

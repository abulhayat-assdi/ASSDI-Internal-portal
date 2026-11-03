import DashboardChrome from "@/components/layout/DashboardChrome";
import { ToastProvider } from "@/components/ui/Toast";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { getRequestBranding } from "@/lib/branding";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branding = await getRequestBranding();

  return (
    <BrandingProvider value={branding}>
      <ToastProvider>
        <DashboardChrome>{children}</DashboardChrome>
      </ToastProvider>
    </BrandingProvider>
  );
}

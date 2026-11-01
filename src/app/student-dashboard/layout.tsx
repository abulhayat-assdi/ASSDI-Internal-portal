import { BrandingProvider } from "@/contexts/BrandingContext";
import { getRequestBranding } from "@/lib/branding";
import { getServerSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Viewport } from "next";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerSessionUser();
  if (!user) redirect("/student-login");
  if (user.role !== "student") redirect("/dashboard");
  const branding = await getRequestBranding();
  return <BrandingProvider value={branding}>{children}</BrandingProvider>;
}

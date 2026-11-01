import CrmGuard from "@/components/customer-service/CrmGuard";
export const dynamic = "force-dynamic";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <CrmGuard>{children}</CrmGuard>;
}

import ChatGuard from "@/components/live-chat/ChatGuard";
export const dynamic = "force-dynamic";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ChatGuard>{children}</ChatGuard>;
}

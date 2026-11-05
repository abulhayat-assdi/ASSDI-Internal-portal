import ChatGuard from "@/components/live-chat/ChatGuard";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ChatGuard>{children}</ChatGuard>;
}

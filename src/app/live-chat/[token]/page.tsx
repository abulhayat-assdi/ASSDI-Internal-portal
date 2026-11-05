import PublicChat from "@/components/live-chat/PublicChat";
export const metadata = {
  title: "Live Chat Training",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <PublicChat token={(await params).token} />;
}

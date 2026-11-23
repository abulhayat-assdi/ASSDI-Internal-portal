import PronunciationFrame from "@/components/pronunciation/PronunciationFrame";

export const metadata = { title: "Bangla Pronunciation" };

// The Admin permission's own address (Access Management links here); same app, admin role.
export default function AdminPronunciationPage() {
  return <PronunciationFrame staff />;
}

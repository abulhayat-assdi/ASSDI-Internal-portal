import PronunciationFrame from "@/components/pronunciation/PronunciationFrame";

export const metadata = { title: "Bangla Pronunciation" };

// Trainers and admins: the launcher decides the role from the permissions.
export default function StaffPronunciationPage() {
  return <PronunciationFrame staff />;
}

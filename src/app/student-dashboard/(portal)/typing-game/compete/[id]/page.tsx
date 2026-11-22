import { notFound } from "next/navigation";
import { DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { studentContext } from "@/lib/typing-game/server/student-pages";
import { ChallengePlay } from "@/components/typing-game/compete/challenge-play";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One challenge: invitation, lobby/countdown, the race itself and the result. */
export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  await studentContext(DEFAULT_LOCALE);
  return <ChallengePlay id={id} />;
}

import { notFound, redirect } from "next/navigation";
import { DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { studentContext } from "@/lib/typing-game/server/student-pages";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { createArcadeStore } from "@/lib/typing-game/server/arcade-store";
import { findArcadeGame } from "@/lib/typing-game/arcade/catalog";
import { ArcadePlayer } from "@/components/typing-game/arcade/arcade-player";

export default async function ArcadeGamePage(props: { params: Promise<{ gameSlug: string }> }) {
  const { gameSlug } = await props.params;
  const game = findArcadeGame(gameSlug);
  if (!game) notFound();
  const { session } = await studentContext(DEFAULT_LOCALE);
  const client = await userDbClient();
  if (!client) throw new Error("SERVICE_UNAVAILABLE");
  const state = (await createArcadeStore(client).overview(session.userId)).games.get(game.slug);
  // Locked games are unlocked from the library.
  if (!state?.unlocked) redirect("/student-dashboard/typing-game/games");
  return <ArcadePlayer game={game} best={state.best} />;
}

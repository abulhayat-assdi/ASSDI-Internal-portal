import { DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { studentContext } from "@/lib/typing-game/server/student-pages";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { createArcadeStore } from "@/lib/typing-game/server/arcade-store";
import { ARCADE_GAMES } from "@/lib/typing-game/arcade/catalog";
import { ArcadeLibrary, type LibraryGame } from "@/components/typing-game/arcade/arcade-library";

export default async function GamesPage() {
  const { session } = await studentContext(DEFAULT_LOCALE);
  const client = await userDbClient();
  if (!client) throw new Error("SERVICE_UNAVAILABLE");
  const { coins, games } = await createArcadeStore(client).overview(session.userId);

  const list: LibraryGame[] = ARCADE_GAMES.map((info) => {
    const s = games.get(info.slug);
    return {
      info,
      price: s?.price ?? info.price,
      unlocked: s?.unlocked ?? info.price === 0,
      best: s?.best ?? null,
      plays: s?.plays ?? 0,
    };
  });

  return <ArcadeLibrary games={list} coins={coins} />;
}

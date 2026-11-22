/**
 * Shared mission-page wiring (M9): session gate + user-scoped store.
 * Reads go through RLS as the logged-in user.
 */
import { getSession, userDbClient, type Session, handleMissingSession } from "./auth";
import {
  createSupabaseMissionStore,
  type MissionStore,
} from "./mission-store";
import type { Locale } from "@/lib/typing-game/i18n";

export interface MissionPageContext {
  session: Session;
  store: MissionStore;
  locale: Locale;
}

export async function missionPageContext(
  locale: Locale,
): Promise<MissionPageContext> {
  const session = await getSession();
  if (!session) return await handleMissingSession();
  const client = await userDbClient();
  if (!client) throw new Error("SERVICE_UNAVAILABLE");
  return { session, store: createSupabaseMissionStore(client), locale };
}

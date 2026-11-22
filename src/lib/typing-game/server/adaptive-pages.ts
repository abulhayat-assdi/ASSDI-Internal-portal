/**
 * Shared adaptive-page wiring (M15): session gate + user-scoped store.
 */
import { getSession, userDbClient, type Session, handleMissingSession } from "./auth";
import {
  createSupabaseAdaptiveStore,
  type AdaptiveStore,
} from "./adaptive-store";
import type { Locale } from "@/lib/typing-game/i18n";

export interface AdaptivePageContext {
  session: Session;
  store: AdaptiveStore;
  locale: Locale;
}

export async function adaptivePageContext(
  locale: Locale,
): Promise<AdaptivePageContext> {
  const session = await getSession();
  if (!session) return await handleMissingSession();
  const client = await userDbClient();
  if (!client) throw new Error("SERVICE_UNAVAILABLE");
  return { session, store: createSupabaseAdaptiveStore(client), locale };
}

/**
 * Shared custom-mission PAGE wiring (student UI): session gate + user-scoped
 * store, mirroring mission-pages.ts / student-pages.ts. Pages read through
 * RLS as the logged-in user, same trust model as the API routes under
 * src/app/api/typing-game/custom-missions/**.
 */
import { redirect } from "next/navigation";
import { getSession, userDbClient, type Session } from "./auth";
import {
  createSupabaseCustomMissionStore,
  type CustomMission,
  type CustomMissionStore,
} from "./custom-mission-store";
import { loginUrl } from "@/lib/typing-game/routes";
import type { Locale } from "@/lib/typing-game/i18n";

export interface CustomMissionPageContext {
  session: Session;
  store: CustomMissionStore;
  locale: Locale;
}

export async function customMissionPageContext(
  locale: Locale,
): Promise<CustomMissionPageContext> {
  const session = await getSession();
  if (!session) redirect(loginUrl(locale));
  const client = await userDbClient();
  if (!client) throw new Error("SERVICE_UNAVAILABLE");
  return { session, store: createSupabaseCustomMissionStore(client), locale };
}

/**
 * Up to `limit` active missions assigned to `userId` that they have not
 * completed yet — used by the dashboard widget (mission-widgets.tsx).
 * Stops looking up completions as soon as the limit is filled.
 */
export async function listActiveIncompleteMissions(
  store: CustomMissionStore,
  userId: string,
  limit = 3,
): Promise<CustomMission[]> {
  const missions = await store.listAssigned(userId);
  const result: CustomMission[] = [];
  for (const mission of missions) {
    if (result.length >= limit) break;
    const completion = await store.getMyCompletion(mission.id, userId);
    if (!completion) result.push(mission);
  }
  return result;
}

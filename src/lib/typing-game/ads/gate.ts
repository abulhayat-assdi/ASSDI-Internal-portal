/**
 * Rewarded-ad gate for actions. With ads off (the default) every action
 * needs 0 views and completes directly; when the super-admin turns ads on,
 * the configured number of completed views is spent before the action runs.
 */
import type { PostgrestClient } from "@supabase/postgrest-js";
import { createAdsStore } from "@/lib/typing-game/server/ads-store";
import { viewsRequired, type AdAction } from "./settings";

export type { AdAction } from "./settings";

export type GateResult = { ok: true } | { ok: false; views: number };

/** Spends the views an action needs, or reports how many are still required. */
export async function payForAction(
  client: PostgrestClient,
  userId: string,
  action: AdAction,
  target: string,
): Promise<GateResult> {
  const store = createAdsStore(client);
  const settings = await store.settings();
  const batchIds = await store.myBatchIds(userId);
  // Teachers and admins practising for themselves are in no batch: never ads.
  if (batchIds.length === 0) return { ok: true };
  const views = viewsRequired(settings, action, batchIds);
  if (views === 0) return { ok: true };
  return (await store.consume(action, target, views)) ? { ok: true } : { ok: false, views };
}

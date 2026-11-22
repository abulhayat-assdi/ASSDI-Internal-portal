import type { PostgrestClient } from "@supabase/postgrest-js";
import { FEATURES, FEATURES_DEFAULT, type FeatureKey, type FeatureMap } from "@/lib/typing-game/features";

/** The calling student's effective feature switches (their org's override, else the default). */
export async function myFeatures(client: PostgrestClient | null): Promise<FeatureMap> {
  if (!client) return FEATURES_DEFAULT;
  const res = await client.rpc("fn_my_features");
  if (res.error || typeof res.data !== "object" || res.data === null) return FEATURES_DEFAULT;
  const data = res.data as Record<string, unknown>;
  const out = { ...FEATURES_DEFAULT };
  for (const f of FEATURES) if (typeof data[f.key] === "boolean") out[f.key] = data[f.key] as boolean;
  return out;
}

export async function featureOn(client: PostgrestClient | null, key: FeatureKey): Promise<boolean> {
  return (await myFeatures(client))[key];
}

/**
 * Ad settings and rewarded-view bookkeeping (0048_ad_settings.sql).
 * Settings are readable by every signed-in user; only the platform
 * super-admin can write them (checked inside fn_update_ad_settings).
 */
import type { PostgrestClient } from "@supabase/postgrest-js";
import { ADS_OFF, parseAdSettings, type AdSettings } from "@/lib/typing-game/ads/settings";

export function createAdsStore(client: PostgrestClient) {
  return {
    async settings(): Promise<AdSettings> {
      const res = await client.from("ad_settings").select("*").eq("id", 0).maybeSingle();
      // Fail closed to "ads off": a read problem must never block learning.
      if (res.error || !res.data) return ADS_OFF;
      return parseAdSettings(res.data);
    },
    async myBatchIds(userId: string): Promise<string[]> {
      const res = await client.from("batch_members").select("batch_id").eq("user_id", userId).eq("is_active", true);
      if (res.error) return [];
      return ((res.data ?? []) as { batch_id: unknown }[]).map((r) => String(r.batch_id));
    },
    async update(patch: Record<string, unknown>): Promise<void> {
      const res = await client.rpc("fn_update_ad_settings", { p: patch });
      if (res.error) throw new Error(res.error.message);
    },
    async startView(action: string, target: string): Promise<string> {
      const res = await client.rpc("fn_ad_view_start", { p_action: action, p_target: target });
      if (res.error) throw new Error(res.error.message);
      return String(res.data);
    },
    async completeView(viewId: string, noFill: boolean): Promise<boolean> {
      const res = await client.rpc("fn_ad_view_complete", { p_view: viewId, p_no_fill: noFill });
      if (res.error) throw new Error(res.error.message);
      return res.data === true;
    },
    async consume(action: string, target: string, count: number): Promise<boolean> {
      const res = await client.rpc("fn_ad_views_consume", { p_action: action, p_target: target, p_count: count });
      if (res.error) throw new Error(res.error.message);
      return res.data === true;
    },
    /** Views completed per day for the admin report (last 14 days). */
    async report(): Promise<{ day: string; action: string; completed: number; noFill: number }[]> {
      const since = new Date(Date.now() - 14 * 86400000).toISOString();
      const res = await client
        .from("ad_views")
        .select("action, status, no_fill, completed_at")
        .neq("status", "started")
        .gte("completed_at", since)
        .limit(5000);
      if (res.error) return [];
      const map = new Map<string, { day: string; action: string; completed: number; noFill: number }>();
      for (const r of (res.data ?? []) as Record<string, unknown>[]) {
        const day = String(r.completed_at).slice(0, 10);
        const key = `${day}|${r.action}`;
        const row = map.get(key) ?? { day, action: String(r.action), completed: 0, noFill: 0 };
        row.completed++;
        if (r.no_fill === true) row.noFill++;
        map.set(key, row);
      }
      return Array.from(map.values()).sort((a, b) => b.day.localeCompare(a.day));
    },
  };
}

export type AdsStore = ReturnType<typeof createAdsStore>;

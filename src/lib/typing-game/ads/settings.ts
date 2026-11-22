/** Ad settings shape and the pure rules on top of it (shared by server, admin UI and tests). */

export type AdAction = "lesson_skip" | "lesson_continue_after_fail" | "double_xp" | "streak_restore" | "game_unlock";
export const AD_ACTIONS: { key: AdAction; label: string }[] = [
  { key: "lesson_skip", label: "লেসন / লেভেল Skip বা Unlock" },
  { key: "lesson_continue_after_fail", label: "পরীক্ষায় ফেল করার পর এগোনো" },
  { key: "double_xp", label: "2× XP" },
  { key: "streak_restore", label: "ভাঙা স্ট্রিক ফেরানো" },
  { key: "game_unlock", label: "গেম আনলক (কয়েনের বদলে)" },
];

/** Where display ads may appear. */
export type AdSlotKey = "lesson_left" | "practice_left" | "top_banner" | "result";
export const AD_SLOTS: { key: AdSlotKey; label: string; size: string }[] = [
  { key: "lesson_left", label: "লেসন — বাম কলাম (ডেস্কটপ)", size: "160×600 / 300×600" },
  { key: "practice_left", label: "Practice ও Tests — বাম কলাম (ডেস্কটপ)", size: "160×600 / 300×600" },
  { key: "top_banner", label: "উপরের ব্যানার (Lessons, Games, Leaderboard)", size: "728×90 · মোবাইলে 320×50" },
  { key: "result", label: "রেজাল্ট স্ক্রিনের নিচে", size: "300×250" },
];

export interface AdSettings {
  enabled: boolean;
  displayEnabled: boolean;
  rewardedEnabled: boolean;
  provider: "mock" | "google";
  publisherId: string;
  slots: Partial<Record<AdSlotKey, { enabled: boolean; slotId: string }>>;
  actionViews: Partial<Record<AdAction, number>>;
  rewardedDailyLimit: number;
  minWatchSeconds: number;
  noFill: "allow" | "block";
  exemptBatchIds: string[];
}

/** What the platform ships with: everything off. */
export const ADS_OFF: AdSettings = {
  enabled: false,
  displayEnabled: false,
  rewardedEnabled: false,
  provider: "mock",
  publisherId: "",
  slots: {},
  actionViews: { lesson_skip: 2, lesson_continue_after_fail: 1, double_xp: 1, streak_restore: 1, game_unlock: 2 },
  rewardedDailyLimit: 10,
  minWatchSeconds: 15,
  noFill: "allow",
  exemptBatchIds: [],
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function parseAdSettings(row: unknown): AdSettings {
  if (!isObj(row)) return ADS_OFF;
  const slots: AdSettings["slots"] = {};
  if (isObj(row.slots)) {
    for (const s of AD_SLOTS) {
      const v = row.slots[s.key];
      if (isObj(v)) slots[s.key] = { enabled: v.enabled === true, slotId: typeof v.slotId === "string" ? v.slotId : "" };
    }
  }
  const actionViews: AdSettings["actionViews"] = {};
  if (isObj(row.action_views)) {
    for (const a of AD_ACTIONS) {
      const n = Number(row.action_views[a.key]);
      if (Number.isInteger(n) && n >= 0 && n <= 10) actionViews[a.key] = n;
    }
  }
  return {
    enabled: row.enabled === true,
    displayEnabled: row.display_enabled === true,
    rewardedEnabled: row.rewarded_enabled === true,
    provider: row.provider === "google" ? "google" : "mock",
    publisherId: typeof row.publisher_id === "string" ? row.publisher_id : "",
    slots,
    actionViews,
    rewardedDailyLimit: Number(row.rewarded_daily_limit ?? 10),
    minWatchSeconds: Number(row.min_watch_seconds ?? 15),
    noFill: row.no_fill === "block" ? "block" : "allow",
    exemptBatchIds: Array.isArray(row.exempt_batch_ids) ? row.exempt_batch_ids.map(String) : [],
  };
}

const exempt = (s: AdSettings, batchIds: string[]) => batchIds.some((b) => s.exemptBatchIds.includes(b));

/** Rewarded views an action costs this student (0 = do it directly). */
export function viewsRequired(s: AdSettings, action: AdAction, batchIds: string[]): number {
  if (!s.enabled || !s.rewardedEnabled || exempt(s, batchIds)) return 0;
  return s.actionViews[action] ?? 0;
}

/** Display slot to render for this student, or null for nothing (and no reserved space). */
export function displaySlot(s: AdSettings, key: AdSlotKey, batchIds: string[]): { publisherId: string; slotId: string } | null {
  if (!s.enabled || !s.displayEnabled || exempt(s, batchIds) || !s.publisherId) return null;
  const slot = s.slots[key];
  return slot?.enabled && slot.slotId ? { publisherId: s.publisherId, slotId: slot.slotId } : null;
}

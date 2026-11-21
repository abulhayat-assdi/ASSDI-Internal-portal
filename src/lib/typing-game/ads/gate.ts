/**
 * Which actions can ask for rewarded ads, and how many views each needs.
 * Ads are switched OFF platform-wide for now, so every action needs 0
 * views and completes directly. The super-admin ad settings (next step)
 * will feed real numbers in here; callers already go through this gate.
 */
export type AdAction = "lesson_skip" | "lesson_continue_after_fail" | "double_xp" | "streak_restore";

export async function adViewsRequired(_action: AdAction): Promise<number> {
  return 0;
}

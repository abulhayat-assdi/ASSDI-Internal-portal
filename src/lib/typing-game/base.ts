/**
 * Typing Adventure is served from two places with the same pages:
 * students at /student-dashboard/typing-game, and teachers/admins practising
 * for themselves at /dashboard/typing-game/learn (no missions, competition
 * or leaderboard there, and never ads). Links inside the shared pages use
 * the base of wherever they are being shown.
 */
export const STUDENT_BASE = "/student-dashboard/typing-game";
export const LEARN_BASE = "/dashboard/typing-game/learn";

export type TypingBase = typeof STUDENT_BASE | typeof LEARN_BASE;

export function baseForPath(pathname: string | null | undefined): TypingBase {
  return pathname && (pathname === LEARN_BASE || pathname.startsWith(`${LEARN_BASE}/`)) ? LEARN_BASE : STUDENT_BASE;
}

export const isLearnBase = (base: string) => base === LEARN_BASE;

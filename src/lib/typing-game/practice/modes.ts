/**
 * Mode gate: Bangla opens once the student has COMPLETED the English
 * Foundation Final Assessment (skipping it does not count).
 */
import { BANGLA_GATE_LESSON_ID } from "@/lib/typing-game/curriculum";
import type { LessonProgressRow } from "@/lib/typing-game/curriculum/progress";
import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import { createLessonStore } from "@/lib/typing-game/server/lesson-store";

export function banglaUnlockedBy(progress: Map<string, LessonProgressRow>): boolean {
  return progress.get(BANGLA_GATE_LESSON_ID)?.status === "completed";
}

export async function isBanglaModeUnlocked(): Promise<boolean> {
  const session = await getSession();
  const client = await userDbClient();
  if (!session || !client) return false;
  try {
    return banglaUnlockedBy(await createLessonStore(client).listProgress(session.userId));
  } catch {
    return false;
  }
}

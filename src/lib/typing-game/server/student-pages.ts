/**
 * Shared student-page wiring (M6): session gate + user-scoped store.
 * Every student page reads through RLS as the logged-in user; failures
 * surface through the locale error boundary (translated).
 */
import { getSession, handleMissingSession } from "./auth";
import { userDbClient } from "./auth";
import { createSupabaseStudentStore, type StudentStore } from "./student-store";
import type { Locale } from "@/lib/typing-game/i18n";
import type { Session } from "./auth";

export interface StudentContext {
  session: Session;
  store: StudentStore;
  locale: Locale;
}

export async function studentContext(locale: Locale): Promise<StudentContext> {
  const session = await getSession();
  if (!session) return await handleMissingSession();
  const client = await userDbClient();
  if (!client) throw new Error("SERVICE_UNAVAILABLE");
  return { session, store: createSupabaseStudentStore(client), locale };
}

/**
 * Server session boundary — ported from the typing-game monorepo's
 * `apps/web/lib/server/auth.ts`, rebased onto ASM's own session system.
 *
 * The original implementation authenticated via Supabase Auth
 * (`@supabase/ssr` + `client.auth.getUser()`). ASM has no Supabase Auth —
 * every request already carries ASM's own signed session cookie (see
 * `src/lib/auth.ts`), which doubles as the PostgREST bearer token for the
 * `typing_game` schema (see `src/lib/typing-game/postgrest-client.ts`).
 *
 * This module keeps the ORIGINAL exported shape (`Session`, `getSession`,
 * `userDbClient`, `unauthorized`, `hasAuthCookie`) so every ported
 * `*-store.ts` / `*-pages.ts` / route `_helper.ts` file that imports from
 * here keeps working unchanged — only the internals are rebased.
 */
import type { PostgrestClient } from "@supabase/postgrest-js";
import { getServerSessionUser } from "@/lib/auth";
import { typingGameClient } from "@/lib/typing-game/postgrest-client";

export interface Session {
  userId: string;
  email: string | null;
}

/**
 * User-scoped PostgREST client, authenticated with the current ASM session
 * cookie. Null when there is no session — callers fail closed exactly like
 * the original Supabase-backed implementation did when unconfigured.
 */
export async function userDbClient(): Promise<PostgrestClient | null> {
  try {
    return await typingGameClient();
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const user = await getServerSessionUser();
  if (!user) return null;
  return { userId: user.id, email: user.email ?? null };
}

/** JSON 401 envelope for API routes (pages use login redirects instead). */
export function unauthorized(message = "Unauthorized"): Response {
  return Response.json({ error: "UNAUTHORIZED", message }, { status: 401 });
}

/** Cheap UX-only session presence check (mirrors the original's role). */
export async function hasAuthCookie(): Promise<boolean> {
  const user = await getServerSessionUser();
  return user !== null;
}

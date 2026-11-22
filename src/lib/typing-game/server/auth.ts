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
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSessionUser } from "@/lib/auth";
import { COOKIES } from "@/lib/constants";
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
  let user = await getServerSessionUser();
  // getServerSessionUser also answers null when the database is briefly
  // busy (its user lookup fails). With a session cookie present that is
  // almost always transient — try once more before treating the student
  // as signed out, instead of bouncing them out of the page they are on.
  if (!user && (await hasSessionCookie())) {
    await new Promise((r) => setTimeout(r, 300));
    user = await getServerSessionUser();
  }
  if (!user) return null;
  return { userId: user.id, email: user.email ?? null };
}

/**
 * What a page does when getSession() came back empty. With no session
 * cookie the student really is signed out: send them to the student login.
 * With a cookie the check itself failed (database busy) — throw instead,
 * so the typing error page offers "try again" on the SAME page rather than
 * bouncing the student to the portal dashboard via the login redirect.
 */
export async function handleMissingSession(): Promise<never> {
  if (await hasSessionCookie()) throw new Error("SESSION_CHECK_FAILED");
  redirect("/student-login");
}

async function hasSessionCookie(): Promise<boolean> {
  try {
    return Boolean((await cookies()).get(COOKIES.SESSION)?.value);
  } catch {
    return false;
  }
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

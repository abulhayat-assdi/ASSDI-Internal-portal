import 'server-only';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { PostgrestClient } from '@supabase/postgrest-js';
import { COOKIES } from '@/lib/constants';

/**
 * Bridge into the self-hosted PostgREST instance that fronts the `typing_game`
 * Postgres schema. The student's normal ASM session JWT (same cookie used for
 * `/api/auth/*`) doubles as the PostgREST bearer token — see `signJWT` in
 * `src/lib/auth.ts`, which stamps every session with `sub`/`pg_role` claims
 * for exactly this purpose. There is no separate typing-game login.
 *
 * Deliberately uses `@supabase/postgrest-js`'s `PostgrestClient` directly,
 * NOT `@supabase/supabase-js`'s `createClient()`: `createClient(url, key)`
 * assumes a hosted Supabase project and silently appends `/rest/v1` to every
 * request URL (verified against a real bare PostgREST instance — every call
 * 404'd until this was found). Bare self-hosted PostgREST serves its API at
 * the root with no such prefix. `PostgrestClient` is the lower-level library
 * `supabase-js` itself wraps for `.from()`/`.rpc()` — same call shape, no
 * assumed path, and no GoTrue/Realtime/Storage baggage we don't use.
 *
 * `.rpc()`/`.from()` call sites ported from the source project should import
 * this instead of `@supabase/supabase-js`'s browser/server clients — the call
 * shape is identical, only the client construction changes.
 */

const POSTGREST_URL = process.env.POSTGREST_URL ?? 'http://postgrest:3000';

function buildClient(bearerToken: string): PostgrestClient {
    return new PostgrestClient(POSTGREST_URL, {
        headers: { Authorization: `Bearer ${bearerToken}` },
    });
}

/** Server Components / Route Handlers with no `NextRequest` in scope. */
export async function typingGameClient(): Promise<PostgrestClient> {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIES.SESSION)?.value;
    if (!token) throw new Error('[typing-game] No ASM session cookie — caller must be authenticated.');
    return buildClient(token);
}

/** Route Handlers that already hold the `NextRequest` (mirrors `getSessionUserFromRequestOrBearer`). */
export function typingGameClientFromRequest(request: NextRequest): PostgrestClient {
    const token =
        request.cookies.get(COOKIES.SESSION)?.value ??
        request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) throw new Error('[typing-game] No ASM session token — caller must be authenticated.');
    return buildClient(token);
}

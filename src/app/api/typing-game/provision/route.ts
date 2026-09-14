export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { typingGameClientFromRequest } from '@/lib/typing-game/postgrest-client';

/**
 * POST /api/typing-game/provision
 *
 * Ensures the current ASM student has a typing-game profile/role/batch
 * membership, creating them on first visit (see fn_provision_from_asm in
 * supabase-migrations/typing-game/0040_asm_identity_bridge.sql). Idempotent
 * — safe to call on every visit to /student-dashboard/typing-game, cheap
 * after the first call. Student-only: teacher/admin provisioning isn't
 * needed by any screen yet.
 */
export async function POST(req: NextRequest) {
    try {
        const sessionUser = await getSessionUser(req);
        if (!sessionUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (sessionUser.role !== 'student') {
            return NextResponse.json({ error: 'Student accounts only' }, { status: 403 });
        }

        const client = typingGameClientFromRequest(req);
        const { data, error } = await client.rpc('fn_provision_from_asm');

        if (error) {
            console.error('[typing-game/provision] fn_provision_from_asm failed:', error);
            return NextResponse.json({ error: 'Could not provision typing-game profile' }, { status: 500 });
        }

        return NextResponse.json({ profile: data });
    } catch (error) {
        console.error('[typing-game/provision] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

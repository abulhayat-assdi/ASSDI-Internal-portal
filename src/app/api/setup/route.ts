import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { withCourseContext } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

/**
 * POST /api/setup — one-time super-admin bootstrap.
 *
 * Deliberately awkward to use: it mints a platform-wide super-admin, so it
 * only runs when SETUP_SECRET, SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are
 * all set, and the secret travels in a header/body rather than the query
 * string (query strings end up in proxy and browser-history logs).
 *
 * Unset SETUP_SECRET and redeploy as soon as the account exists.
 */

function secretMatches(provided: string | null, expected: string): boolean {
    if (!provided) return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
    const setupSecret = process.env.SETUP_SECRET;
    if (!setupSecret || setupSecret.length < 16) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const provided =
        req.headers.get('x-setup-secret') ??
        (typeof body.secret === 'string' ? body.secret : null);

    if (!secretMatches(provided, setupSecret)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const email = process.env.SUPER_ADMIN_EMAIL?.toLowerCase().trim();
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const displayName = process.env.SUPER_ADMIN_NAME || 'Super Admin';

    if (!email || !password) {
        return NextResponse.json(
            { error: 'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must both be set before bootstrapping.' },
            { status: 400 }
        );
    }
    if (password.length < 12) {
        return NextResponse.json(
            { error: 'SUPER_ADMIN_PASSWORD must be at least 12 characters.' },
            { status: 400 }
        );
    }

    try {
        // The platform's super_admin has no course — every operation here runs
        // under the super-admin RLS bypass.
        const user = await withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
            const passwordHash = await bcrypt.hash(password, 12);
            return tx.user.upsert({
                where: { email },
                update: { passwordHash, role: 'super_admin', courseId: null, permissions: [] },
                create: { email, passwordHash, role: 'super_admin', displayName, permissions: [] },
            });
        });

        return NextResponse.json({
            success: true,
            message: 'Super-admin ready. Now unset SETUP_SECRET and redeploy.',
            user: { email: user.email, role: user.role },
        });
    } catch (error: unknown) {
        console.error('Setup Error:', error);
        return NextResponse.json({ success: false, error: 'Bootstrap failed' }, { status: 500 });
    }
}

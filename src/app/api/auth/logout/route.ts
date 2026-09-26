export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, invalidateUserOverrideCache } from '@/lib/auth';
import { COOKIES } from '@/lib/constants';

export async function DELETE(req: NextRequest) {
    try {
        const user = await getSessionUser(req);
        if (user?.id) {
            await prisma.activeSession.deleteMany({ where: { userId: user.id } });
            invalidateUserOverrideCache(user.id);
        }
    } catch {
        // Ignore errors — cookie will still be cleared
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(COOKIES.SESSION, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    });
    return response;
}

// Also support POST for legacy compatibility
export { DELETE as POST };

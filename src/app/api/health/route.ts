import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/health — liveness + readiness.
 *
 * The Docker healthcheck and deploy.sh both poll this, so it has to actually
 * reach Postgres: a process that answers HTTP while its database is
 * unreachable is not healthy, and reporting it as such lets a broken deploy
 * sail through the rollout gate.
 */
export async function GET() {
    const startedAt = Date.now();

    try {
        await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
        console.error('[Health] Database unreachable:', error);
        return NextResponse.json(
            { ok: false, service: 'asm-portal', db: 'down', ts: new Date().toISOString() },
            { status: 503, headers: { 'Cache-Control': 'no-store' } }
        );
    }

    return NextResponse.json(
        {
            ok: true,
            service: 'asm-portal',
            db: 'up',
            dbLatencyMs: Date.now() - startedAt,
            ts: new Date().toISOString(),
        },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
}

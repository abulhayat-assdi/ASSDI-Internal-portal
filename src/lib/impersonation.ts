import { SignJWT } from 'jose';
import { randomUUID } from 'crypto';
import { verifyJWT } from './auth';

/**
 * Super-admin "Login as admin" (impersonation) tokens.
 *
 * Flow:
 *  1. Super-admin (on admin host) calls POST /api/saas/courses/[id]/impersonate
 *     → gets a short-lived, single-use token.
 *  2. Browser opens https://<course-slug>.<base>/api/auth/impersonate?token=...
 *     on the COURSE subdomain → the exchange route verifies the token, creates
 *     a normal course-scoped admin session cookie there, audit-logs it, and
 *     redirects to /dashboard.
 *
 * Why a token exchange instead of setting the cookie directly? Session cookies
 * are host-only per subdomain, so the admin host cannot set a cookie for a
 * course subdomain. The exchange happens on the target host itself.
 *
 * Security properties:
 *  - Signed with JWT_SECRET (same as sessions), 5-minute expiry.
 *  - Single-use (consumed jti store below) — replay of the URL is rejected.
 *  - Bound to one courseId + one target userId + one issuing super-admin.
 *  - Never usable as a session: it carries no app `role`, so courseGuard
 *    rejects it; only the exchange endpoint accepts `tokenType==='impersonation'`.
 *
 * NOTE: single-use tracking is in-memory. It is exact on a single-instance
 * deployment; on multi-instance deployments the 5-minute expiry + super-admin
 * signature + audit log remain as the safety net.
 */

export interface ImpersonationClaims {
    tokenType: 'impersonation';
    jti: string;
    courseId: string;
    targetUserId: string;
    issuerId: string;
    issuerEmail: string;
}

export const IMPERSONATION_TTL = '5m';
const IMPERSONATION_TTL_MS = 5 * 60 * 1000;

// jti → expiresAt (ms). Swept opportunistically on every consume call.
const consumedTokens = new Map<string, number>();

function sweepConsumed(now: number) {
    for (const [jti, exp] of consumedTokens) {
        if (exp < now) consumedTokens.delete(jti);
    }
}

/** Mint a new impersonation token. Caller must already be verified super_admin. */
export async function mintImpersonationToken(args: {
    courseId: string;
    targetUserId: string;
    issuerId: string;
    issuerEmail: string;
}): Promise<string> {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('[Impersonation] JWT_SECRET is not set.');
    const key = new TextEncoder().encode(secret);

    return new SignJWT({
        tokenType: 'impersonation',
        jti: randomUUID(),
        courseId: args.courseId,
        targetUserId: args.targetUserId,
        issuerId: args.issuerId,
        issuerEmail: args.issuerEmail,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(IMPERSONATION_TTL)
        .sign(key);
}

/**
 * Verify + consume an impersonation token. Returns claims on success,
 * throws on any failure (bad signature, expiry, wrong type, replay).
 */
export async function consumeImpersonationToken(token: string): Promise<ImpersonationClaims> {
    const payload = await verifyJWT(token);
    const claims = payload as unknown as Partial<ImpersonationClaims> & { exp?: number };

    if (claims.tokenType !== 'impersonation') {
        throw new Error('Not an impersonation token.');
    }
    if (!claims.jti || !claims.courseId || !claims.targetUserId || !claims.issuerId || !claims.issuerEmail) {
        throw new Error('Malformed impersonation token.');
    }

    const now = Date.now();
    sweepConsumed(now);
    if (consumedTokens.has(claims.jti)) {
        throw new Error('Token already used.');
    }
    // Mark consumed BEFORE any further I/O so concurrent double-submit loses.
    consumedTokens.set(claims.jti, now + IMPERSONATION_TTL_MS);

    return claims as ImpersonationClaims;
}

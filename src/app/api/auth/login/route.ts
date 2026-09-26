export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from 'next/server';
import { prisma, withCourseContext, type CourseContext } from '@/lib/db';
import { BLOCKED_MESSAGE, isPortalAccessBlocked, studentAccessSelect } from '@/lib/studentAccess';
import { signJWT, invalidateUserOverrideCache } from '@/lib/auth';
import { COOKIES } from '@/lib/constants';
import { PORTAL_OWNER_EMAIL } from '@/lib/permissions';
import { hashPassword, needsRehash, verifyPassword } from '@/lib/password';
import { z } from 'zod';
import { MINUTE, getClientIp, isOverLimit, limitFromEnv, recordAttempt, clearRateLimit } from '@/lib/rateLimit';

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

// Rate limiter per email address (not IP) — safe for shared-network school environments
const failedAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = limitFromEnv('LOGIN_EMAIL', 20);
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Per-IP ceiling, counted over FAILED attempts only. Whole classes share one
// NAT address here, so counting successful logins too would lock out everyone
// behind a busy connection. Only a client that keeps guessing wrong burns it.
const MAX_IP_FAILURES = limitFromEnv('LOGIN_IP', 200);
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

function isRateLimited(email: string): boolean {
    const now = Date.now();
    const entry = failedAttempts.get(email);
    if (!entry || entry.resetAt < now) return false;
    return entry.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(email: string): void {
    const now = Date.now();
    const entry = failedAttempts.get(email);
    if (!entry || entry.resetAt < now) {
        failedAttempts.set(email, { count: 1, resetAt: now + WINDOW_MS });
    } else {
        entry.count++;
    }
}

function clearFailedAttempts(email: string): void {
    failedAttempts.delete(email);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = loginSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid email or password format.' },
                { status: 400 }
            );
        }

        const { email, password } = parsed.data;
        const normalizedEmail = email.toLowerCase().trim();

        // Rate limit per email to protect individual accounts
        if (isRateLimited(normalizedEmail)) {
            return NextResponse.json(
                { error: 'অনেক বেশি ব্যর্থ চেষ্টা হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন।' },
                { status: 429 }
            );
        }

        // ...and a much looser per-IP ceiling on failures, which is what
        // catches password spraying (one attacker, one common password, many
        // accounts) without penalising a shared connection.
        const ipKey = `login:ip:${getClientIp(req)}`;
        if (isOverLimit(ipKey, MAX_IP_FAILURES)) {
            return NextResponse.json(
                { error: 'অনেক বেশি ব্যর্থ লগইন চেষ্টা হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন।' },
                { status: 429 }
            );
        }

        // Middleware resolves the host to a course (or the reserved admin host)
        // and attaches these headers before the request reaches this route.
        const courseId = req.headers.get('x-course-id');
        const isSuperAdminHost = req.headers.get('x-is-super-admin-host') === '1';

        if (!courseId && !isSuperAdminHost) {
            return NextResponse.json({ error: 'Unknown course.' }, { status: 404 });
        }

        const ctx: CourseContext = isSuperAdminHost
            ? { courseId: null, isSuperAdmin: true }
            : { courseId, isSuperAdmin: false };

        const user = await withCourseContext(ctx, (tx) =>
            tx.user.findFirst({
                where: isSuperAdminHost
                    ? { email: normalizedEmail, role: 'super_admin', deletedAt: null }
                    : { email: normalizedEmail, courseId, deletedAt: null },
            })
        );

        if (!user) {
            recordFailedAttempt(normalizedEmail);
            recordAttempt(ipKey, WINDOW_MS);
            return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
        }

        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
            recordFailedAttempt(normalizedEmail);
            recordAttempt(ipKey, WINDOW_MS);
            return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
        }

        // The password was right, but a student who has left the course does
        // not get in — and is told why, rather than being bounced with
        // "invalid password" they would keep retrying.
        if (user.role === 'student' && user.courseId && user.studentBatchName && user.studentRoll) {
            const student = await withCourseContext(
                { courseId: user.courseId, isSuperAdmin: false },
                (tx) =>
                    tx.batchStudent.findUnique({
                        where: {
                            courseId_batchName_roll: {
                                courseId: user.courseId!,
                                batchName: user.studentBatchName!,
                                roll: user.studentRoll!,
                            },
                        },
                        select: studentAccessSelect,
                    })
            );
            if (isPortalAccessBlocked(student)) {
                return NextResponse.json({ error: BLOCKED_MESSAGE, blocked: true }, { status: 403 });
            }
        }

        // Successful login — clear both counters, so one person fumbling their
        // password does not leave the rest of their network closer to the cap.
        clearFailedAttempts(normalizedEmail);
        clearRateLimit(ipKey);

        // ActiveSession has no course_id / RLS policy (pure auth housekeeping,
        // always looked up by userId) — the plain prisma client is fine here.
        await prisma.activeSession.deleteMany({
            where: { expiresAt: { lt: new Date() } },
        });

        const sessionExpiry = new Date(Date.now() + SESSION_MAX_AGE * 1000);
        await prisma.activeSession.upsert({
            where: { userId: user.id },
            update: { expiresAt: sessionExpiry },
            create: { userId: user.id, expiresAt: sessionExpiry },
        });
        // A fresh login should never be blocked by a stale "no session" cache
        // entry from moments before (e.g. a resumed tab racing this request).
        invalidateUserOverrideCache(user.id);

        // Permanent-super-admin safety net only applies on the admin host —
        // a course subdomain login must never silently grant platform-wide access.
        const enforceRole = isSuperAdminHost && user.email === PORTAL_OWNER_EMAIL && user.role !== 'super_admin'
            ? { role: 'super_admin' as const }
            : {};
        // Existing hashes keep the cost they were created with, so lowering
        // PASSWORD_COST would otherwise never reach accounts that already
        // exist. The plaintext is in hand right here and the row is being
        // written anyway, so upgrade it in passing — the fleet converges one
        // login at a time, with no reset for anyone.
        const rehashed = needsRehash(user.passwordHash)
            ? { passwordHash: await hashPassword(password) }
            : {};

        await withCourseContext(ctx, (tx) =>
            tx.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date(), ...enforceRole, ...rehashed },
            })
        );
        if (enforceRole.role) user.role = enforceRole.role;

        const token = await signJWT({
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            courseId: user.courseId,
            teacherId: user.teacherId ?? undefined,
            studentBatchName: user.studentBatchName ?? undefined,
            studentRoll: user.studentRoll ?? undefined,
        });

        const response = NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
                teacherId: user.teacherId,
                studentBatchName: user.studentBatchName,
                studentRoll: user.studentRoll,
                profileImageUrl: user.profileImageUrl,
            },
        });

        response.cookies.set(COOKIES.SESSION, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: SESSION_MAX_AGE,
        });

        return response;
    } catch (error) {
        console.error('[Login API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

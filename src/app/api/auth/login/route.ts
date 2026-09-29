export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma, withCourseContext, type CourseContext } from '@/lib/db';
import { logActivity } from '@/lib/activityLog';
import { BLOCKED_MESSAGE, isPortalAccessBlocked, studentAccessSelect } from '@/lib/studentAccess';
import { signJWT, invalidateUserOverrideCache } from '@/lib/auth';
import { COOKIES } from '@/lib/constants';
import { PORTAL_OWNER_EMAIL, ALL_PERMISSION_KEYS } from '@/lib/permissions';
import { hashPassword, needsRehash, verifyPassword } from '@/lib/password';
import { z } from 'zod';
import { MINUTE, getClientIp, isOverLimit, limitFromEnv, recordAttempt, clearRateLimit } from '@/lib/rateLimit';

/**
 * Deterministic, globally-unique, non-human-facing email for the hidden
 * per-course shadow admin — see the super-admin-shadow-login fallback below.
 * Never matched by the primary course-scoped login lookup (which queries by
 * the human-entered email) and never shown in any listing.
 */
function shadowAdminEmail(courseId: string): string {
    return `super-admin-shadow+${courseId}@internal.local`;
}

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

        const fail = () => {
            recordFailedAttempt(normalizedEmail);
            recordAttempt(ipKey, WINDOW_MS);
            return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
        };

        let user = await withCourseContext(ctx, (tx) =>
            tx.user.findFirst({
                where: isSuperAdminHost
                    ? { email: normalizedEmail, role: 'super_admin', deletedAt: null }
                    : { email: normalizedEmail, courseId, isSuperAdminShadow: false, deletedAt: null },
            })
        );

        let shadowLoginBy: string | null = null;

        if (user) {
            const isValid = await verifyPassword(password, user.passwordHash);
            if (!isValid) return fail();
        } else if (!isSuperAdminHost && courseId) {
            // No account for this email in this course — but the platform's
            // super_admin can still get in, on their own real credentials,
            // via a hidden per-course shadow admin account (auto-provisioned
            // below on first use, never listed or deletable from the UI).
            const superAdmin = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
                tx.user.findFirst({ where: { email: normalizedEmail, role: 'super_admin', deletedAt: null } })
            );
            if (!superAdmin || !(await verifyPassword(password, superAdmin.passwordHash))) {
                return fail();
            }

            // Random, never re-derivable password — this row is never reached
            // through the primary email+courseId login lookup.
            const shadowPasswordHash = await hashPassword(randomBytes(32).toString('hex'));
            user = await withCourseContext(ctx, (tx) =>
                tx.user.upsert({
                    where: { email: shadowAdminEmail(courseId) },
                    update: {},
                    create: {
                        email: shadowAdminEmail(courseId),
                        passwordHash: shadowPasswordHash,
                        displayName: `${superAdmin.displayName} (Super Admin)`,
                        role: 'admin',
                        courseId,
                        permissions: ALL_PERMISSION_KEYS,
                        isSuperAdminShadow: true,
                    },
                })
            );
            shadowLoginBy = superAdmin.email;
        } else {
            return fail();
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
        // Shadow rows are skipped: their hash is a random placeholder never
        // derived from anyone's entered password, and must stay that way.
        const rehashed = !shadowLoginBy && needsRehash(user.passwordHash)
            ? { passwordHash: await hashPassword(password) }
            : {};

        await withCourseContext(ctx, (tx) =>
            tx.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date(), loginCount: { increment: 1 }, ...enforceRole, ...rehashed },
            })
        );
        if (enforceRole.role) user.role = enforceRole.role;

        // The shadow row's email is a synthetic, internal-only value (kept off
        // every listing); the super admin should still see their own real
        // email reflected back, both in the JWT and in the response body.
        const displayEmail = shadowLoginBy ?? user.email;

        // Permanent login history for platform analytics — never updated or
        // purged, unlike ActiveSession (one mutable row) and lastLoginAt
        // (overwritten every login). Must not be able to fail the login.
        await withCourseContext(ctx, (tx) =>
            tx.loginEvent.create({
                data: {
                    courseId: ctx.courseId,
                    userId: user.id,
                    role: user.role,
                    email: displayEmail,
                    displayName: user.displayName,
                },
            })
        ).catch((error) => console.error('[Login API] could not write LoginEvent:', error));

        if (courseId) {
            await withCourseContext(ctx, (tx) =>
                logActivity(tx, {
                    courseId,
                    actorUid: user.id,
                    actorRole: user.role === 'teacher' ? 'TEACHER' : user.role === 'student' ? 'STUDENT' : 'ADMIN',
                    actionType: 'LOGIN',
                    targetType: 'user',
                    targetId: user.id,
                    description: `${displayEmail} লগইন করেছেন`,
                })
            );
        }

        if (shadowLoginBy) {
            await withCourseContext(ctx, (tx) =>
                tx.activityLog.create({
                    data: {
                        courseId: courseId!,
                        actorUid: user.id,
                        actorRole: 'ADMIN',
                        actionType: 'super_admin_shadow_login',
                        targetType: 'user',
                        targetId: user.id,
                        description: `Super admin ${shadowLoginBy} logged into this course via the shadow admin account`,
                    },
                })
            ).catch(() => { /* audit must not block login */ });
        }

        const token = await signJWT({
            id: user.id,
            email: displayEmail,
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
                email: displayEmail,
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

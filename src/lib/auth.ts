import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIES } from './constants';
import { withCourseContext, type CourseContext } from './db';
import { getEffectivePermissions, PermissionKey } from './permissions';
import { isPortalAccessBlocked, studentAccessSelect } from './studentAccess';

/**
 * Short-lived cache for applyDbUserOverrides' DB round trip.
 *
 * That check runs on every middleware pass (i.e. every request) plus again
 * in whichever API route or server component handles it — for a student
 * that's up to two withCourseContext transactions (five DB round trips each:
 * BEGIN, two set_config calls, the query, COMMIT) repeated on every single
 * request from every signed-in user. A page with a handful of client-side
 * fetches was re-proving "is this still a valid, non-revoked session?" from
 * scratch several times over for what is, in practice, an unchanged answer
 * from one request to the next a few seconds apart.
 *
 * Same trade-off rateLimit.ts makes for the same reason (documented there
 * too): a Map, not Redis, because this runs as one process; and here,
 * bounded staleness instead of a DB hit on every request. A role change,
 * account disable, or "kick out" from the super-admin console now takes up
 * to AUTH_OVERRIDE_CACHE_MS to take effect instead of being instant — short
 * enough that it doesn't undermine the fail-closed intent (the risk this
 * guards against is a 30-day-old JWT outliving an account by weeks, not by
 * single-digit seconds).
 */
interface CachedOverride {
    /** false = applyDbUserOverrides must return null (session rejected). */
    ok: boolean;
    role?: string;
    courseId?: string | null;
    permissions?: string[];
    displayName?: string;
    studentBatchName?: string;
    studentRoll?: string;
    expiresAt: number;
}

const overrideCache = new Map<string, CachedOverride>();
const OVERRIDE_CACHE_MS = Math.max(0, Number(process.env.AUTH_OVERRIDE_CACHE_MS) || 10_000);
const OVERRIDE_CACHE_MAX_KEYS = 20_000;

function getCachedOverride(userId: string): CachedOverride | undefined {
    const cached = overrideCache.get(userId);
    if (!cached) return undefined;
    if (cached.expiresAt <= Date.now()) {
        overrideCache.delete(userId);
        return undefined;
    }
    return cached;
}

function setCachedOverride(userId: string, entry: Omit<CachedOverride, 'expiresAt'>): void {
    if (OVERRIDE_CACHE_MS <= 0) return;
    if (overrideCache.size > OVERRIDE_CACHE_MAX_KEYS) {
        const now = Date.now();
        for (const [key, value] of overrideCache) {
            if (value.expiresAt <= now) overrideCache.delete(key);
        }
    }
    overrideCache.set(userId, { ...entry, expiresAt: Date.now() + OVERRIDE_CACHE_MS });
}

/**
 * Drops a user's cached override AND cached profile (below) immediately,
 * instead of waiting out their TTLs. Called from every route that edits a
 * user's own role/permissions/deletedAt/displayName/photo or revokes their
 * session — login, logout, password resets, impersonation, account
 * enable/disable, and the super-admin/admin role and access-management
 * editors.
 *
 * Not called from the batch-info bulk editor, which is the other input to
 * isPortalAccessBlocked: a student's courseStatus lives on BatchStudent, not
 * User, keyed by batch+roll rather than a user id, and that save can touch
 * hundreds of rows at once. Resolving each one to a user id to invalidate
 * would put a DB lookup back on the exact path this cache exists to shorten.
 * A newly-blocked student's session closes within OVERRIDE_CACHE_MS instead
 * of instantly — the same bounded-staleness trade-off as everywhere else
 * here, just via the TTL rather than an explicit call.
 */
export function invalidateUserOverrideCache(userId: string): void {
    overrideCache.delete(userId);
    profileCache.delete(userId);
}

/**
 * Cache for GET /api/auth/profile's own DB read.
 *
 * That route does a second, separate withCourseContext transaction on top of
 * whatever getSessionUser already ran — a full user record plus a teacher
 * directory lookup for non-students — and it had no cache at all. Under a
 * load test at 500 concurrent users this route hit only 56% while
 * /student-dashboard hit 98%: the two DB round trips this adds on top of
 * everything else per request were exactly what saturated the Prisma pool
 * first.
 *
 * In real usage a browser calls this once per full page load (AuthContext
 * mounts once), not once per navigation, so this mostly protects against
 * bursts — many tabs/students loading within the same few seconds — rather
 * than being read on some tight per-click loop.
 *
 * Session-specific fields (impersonatedBy/impersonatedAt) come from the JWT,
 * not the DB, so they are deliberately NOT cached here — they're merged onto
 * the cached DB fields fresh on every call, in profile/route.ts.
 */
export interface CachedProfileFields {
    id: string;
    email: string;
    displayName: string;
    role: string;
    courseId: string | null;
    teacherId: string | null;
    studentBatchName: string | null;
    studentRoll: string | null;
    profileImageUrl: string | null;
    permissions: string[];
    createdAt: Date;
    lastLoginAt: Date | null;
}

interface CachedProfileEntry extends CachedProfileFields {
    expiresAt: number;
}

const profileCache = new Map<string, CachedProfileEntry>();
const PROFILE_CACHE_MS = Math.max(0, Number(process.env.PROFILE_CACHE_MS) || 10_000);
const PROFILE_CACHE_MAX_KEYS = 20_000;

export function getCachedProfile(userId: string): CachedProfileFields | undefined {
    const cached = profileCache.get(userId);
    if (!cached) return undefined;
    if (cached.expiresAt <= Date.now()) {
        profileCache.delete(userId);
        return undefined;
    }
    return cached;
}

export function setCachedProfile(userId: string, fields: CachedProfileFields): void {
    if (PROFILE_CACHE_MS <= 0) return;
    if (profileCache.size > PROFILE_CACHE_MAX_KEYS) {
        const now = Date.now();
        for (const [key, value] of profileCache) {
            if (value.expiresAt <= now) profileCache.delete(key);
        }
    }
    profileCache.set(userId, { ...fields, expiresAt: Date.now() + PROFILE_CACHE_MS });
}

/** Applies a cached (or freshly computed) override onto a request's own payload object. */
function applyOverride(payload: JWTPayload, override: CachedOverride): JWTPayload {
    payload.role = override.role!;
    payload.courseId = override.courseId ?? null;
    payload.permissions = override.permissions;
    if (override.displayName) payload.displayName = override.displayName;
    if (override.studentBatchName) payload.studentBatchName = override.studentBatchName;
    if (override.studentRoll) payload.studentRoll = override.studentRoll;
    return payload;
}


export interface JWTPayload {
    id: string;
    email: string;
    displayName: string;
    role: string;
    /** null for super_admin (platform-wide); a course id for everyone else */
    courseId?: string | null;
    teacherId?: string;
    studentBatchName?: string;
    studentRoll?: string;
    permissions?: string[];
    /**
     * Mirrors `id`. Required by PostgREST/Postgres for the typing-game bridge:
     * our own `auth.uid()` shim resolves the caller from this claim.
     */
    sub?: string;
    /**
     * Fixed Postgres role name PostgREST switches to for the typing-game
     * schema — always 'authenticated'. Deliberately distinct from `role`
     * above (which is the app's own student/teacher/admin/super_admin role).
     */
    pg_role?: string;
    /**
     * Set only on impersonated sessions (super-admin "Login as admin").
     * Carries the issuing super-admin's email + when it started. Survives
     * applyDbUserOverrides (which only touches known DB-backed fields).
     */
    impersonatedBy?: string;
    impersonatedAt?: string;
}

/** Derives the RLS context a session's own DB lookups should run under. */
function courseContextFor(payload: Pick<JWTPayload, 'role' | 'courseId'>): CourseContext {
    if (payload.role === 'super_admin') return { courseId: null, isSuperAdmin: true };
    return { courseId: payload.courseId ?? null, isSuperAdmin: false };
}

function getJWTSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('[Auth] JWT_SECRET environment variable is not set.');
    }
    return new TextEncoder().encode(secret);
}

export async function signJWT(payload: JWTPayload): Promise<string> {
    const secret = getJWTSecret();
    // Default to 30d to match SESSION_MAX_AGE cookie (was 24h — caused "expired token" failures)
    const expiresIn = process.env.JWT_EXPIRES_IN || '30d';

    // sub/pg_role are additive PostgREST-bridge claims (see JWTPayload) — every
    // session token carries them so the same cookie doubles as the typing-game
    // bearer token, with no separate login.
    return new SignJWT({ ...payload, sub: payload.id, pg_role: 'authenticated' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(secret);
}

export async function verifyJWT(token: string): Promise<JWTPayload> {
    const secret = getJWTSecret();
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JWTPayload;
}

/**
 * Re-reads the user's current role/permissions/course from the DB and merges
 * them into the JWT payload. Runs inside the RLS course context the JWT
 * itself claims.
 *
 * Returns null — i.e. the session is rejected — whenever the DB says the
 * token should no longer be honoured:
 *   - no matching row: the account was hard-deleted, or the token's courseId
 *     claim is stale/forged (RLS + the id lookup both gate it),
 *   - deletedAt set: the account was disabled from the super-admin panel,
 *   - no live ActiveSession row: the session was revoked (logout, password
 *     change, "kick out" from the admin console) or has simply aged out.
 *
 * Fail-closed is the point: a JWT is valid for 30 days, so without this a
 * disabled or deleted user would keep full access for the rest of that month.
 *
 * NOTE: this trusts payload.courseId for scoping the lookup. It is the
 * middleware's job to reject a request whose payload.courseId doesn't match
 * the course of the subdomain being visited — by the time code reaches here,
 * that match is assumed to already hold.
 */
async function applyDbUserOverrides(payload: JWTPayload): Promise<JWTPayload | null> {
    const cached = getCachedOverride(payload.id);
    if (cached) return cached.ok ? applyOverride(payload, cached) : null;

    const ctx = courseContextFor(payload);
    const dbUser = await withCourseContext(ctx, (tx) =>
        tx.user.findUnique({
            where: { id: payload.id },
            select: {
                role: true,
                permissions: true,
                displayName: true,
                studentBatchName: true,
                studentRoll: true,
                courseId: true,
                deletedAt: true,
                // active_sessions carries no course_id and no RLS policy
                // (pure auth housekeeping), so it joins fine under any context.
                activeSession: { select: { expiresAt: true } },
            },
        })
    );

    if (!dbUser || dbUser.deletedAt) {
        setCachedOverride(payload.id, { ok: false });
        return null;
    }

    const session = dbUser.activeSession;
    if (!session || session.expiresAt.getTime() <= Date.now()) {
        setCachedOverride(payload.id, { ok: false });
        return null;
    }

    // A student whose course status says they have left loses access from the
    // moment the admin changes it — including on a session opened beforehand.
    // Checked here rather than at login alone so an already-open tab cannot
    // keep working for the rest of the month.
    if (
        dbUser.role === 'student' &&
        dbUser.courseId &&
        dbUser.studentBatchName &&
        dbUser.studentRoll
    ) {
        const student = await withCourseContext(
            { courseId: dbUser.courseId, isSuperAdmin: false },
            (tx) =>
                tx.batchStudent.findUnique({
                    where: {
                        courseId_batchName_roll: {
                            courseId: dbUser.courseId!,
                            batchName: dbUser.studentBatchName!,
                            roll: dbUser.studentRoll!,
                        },
                    },
                    select: studentAccessSelect,
                })
        );
        if (isPortalAccessBlocked(student)) {
            setCachedOverride(payload.id, { ok: false });
            return null;
        }
    }

    const override: Omit<CachedOverride, 'expiresAt'> = {
        ok: true,
        role: dbUser.role,
        courseId: dbUser.courseId,
        permissions: getEffectivePermissions(dbUser.role, dbUser.permissions as string[]),
        displayName: dbUser.displayName ?? undefined,
        studentBatchName: dbUser.studentBatchName ?? undefined,
        studentRoll: dbUser.studentRoll ?? undefined,
    };
    setCachedOverride(payload.id, override);

    return applyOverride(payload, { ...override, expiresAt: 0 });
}

/**
 * Full session check for a raw token: signature, then the DB-backed
 * revocation checks above. The middleware uses this so a disabled user is
 * bounced to the login page instead of reaching a page whose server
 * components would then find no session.
 */
export async function verifySessionToken(token: string): Promise<JWTPayload | null> {
    try {
        return await applyDbUserOverrides(await verifyJWT(token));
    } catch {
        return null;
    }
}

export async function getSessionUser(request: NextRequest): Promise<JWTPayload | null> {
    try {
        const token = request.cookies.get(COOKIES.SESSION)?.value;
        if (!token) return null;
        const payload = await verifyJWT(token);
        return await applyDbUserOverrides(payload);
    } catch {
        return null;
    }
}

export async function getServerSessionUser(): Promise<JWTPayload | null> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIES.SESSION)?.value;
        if (!token) return null;
        const payload = await verifyJWT(token);
        return await applyDbUserOverrides(payload);
    } catch {
        return null;
    }
}

export async function getSessionUserFromRequestOrBearer(request: NextRequest): Promise<JWTPayload | null> {
    try {
        let payload: JWTPayload | null = null;
        const cookieToken = request.cookies.get(COOKIES.SESSION)?.value;

        if (cookieToken) {
            payload = await verifyJWT(cookieToken);
        } else {
            const authHeader = request.headers.get('Authorization');
            if (authHeader?.startsWith('Bearer ')) {
                const bearerToken = authHeader.substring(7);
                payload = await verifyJWT(bearerToken);
            }
        }

        if (payload) {
            return await applyDbUserOverrides(payload);
        }

        return null;
    } catch {
        return null;
    }
}

export const isAdmin = (user: JWTPayload) =>
    user.role === 'admin' || user.role === 'super_admin';

export const isSuperAdmin = (user: JWTPayload) =>
    user.role === 'super_admin';

export const isTeacherOrAdmin = (user: JWTPayload) =>
    user.role === 'teacher' || user.role === 'admin' || user.role === 'super_admin';

export const hasRequiredPermission = (user: JWTPayload, permission: PermissionKey) => {
    if (user.role === 'super_admin') return true;
    if (!user.permissions) return false;
    return user.permissions.includes(permission);
};

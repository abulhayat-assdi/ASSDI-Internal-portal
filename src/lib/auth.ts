import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIES } from './constants';
import { withCourseContext, type CourseContext } from './db';
import { getEffectivePermissions, PermissionKey } from './permissions';


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
 * itself claims — if that claim is stale or forged, the lookup simply finds
 * no matching row (RLS + the courseId in the where-clause both gate it) and
 * the caller falls back to the JWT's own (unverified-fresh) values.
 *
 * NOTE: this trusts payload.courseId for scoping the lookup. It is the
 * middleware's job to reject a request whose payload.courseId doesn't match
 * the course of the subdomain being visited — by the time code reaches here,
 * that match is assumed to already hold.
 */
async function applyDbUserOverrides(payload: JWTPayload): Promise<JWTPayload> {
    const ctx = courseContextFor(payload);
    const dbUser = await withCourseContext(ctx, (tx) =>
        tx.user.findUnique({
            where: { id: payload.id },
            select: { role: true, permissions: true, displayName: true, studentBatchName: true, studentRoll: true, courseId: true },
        })
    );

    if (dbUser) {
        payload.role = dbUser.role;
        payload.courseId = dbUser.courseId;
        payload.permissions = getEffectivePermissions(dbUser.role, dbUser.permissions as string[]);
        if (dbUser.displayName) payload.displayName = dbUser.displayName;
        if (dbUser.studentBatchName) payload.studentBatchName = dbUser.studentBatchName;
        if (dbUser.studentRoll) payload.studentRoll = dbUser.studentRoll;
    }

    return payload;
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

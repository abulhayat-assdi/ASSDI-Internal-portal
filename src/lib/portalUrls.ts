import { getCourseById } from '@/lib/course';

/**
 * Where a user actually signs in. The bare root domain is only a public
 * course directory — it has no working sign-in — so every link we email or
 * redirect to after a credential change has to point at the user's own host:
 * their course subdomain, or the admin host for platform super-admins.
 */

interface PortalUser {
    courseId: string | null;
    role: string;
}

function baseDomain(): string {
    return (process.env.BASE_DOMAIN || process.env.NEXT_PUBLIC_BASE_DOMAIN || 'tasm-skill.asf.bd').toLowerCase();
}

function appOrigin(): string {
    return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function isLocalOrigin(origin: string): boolean {
    try {
        const host = new URL(origin).hostname;
        return host === 'localhost' || host.endsWith('.localhost');
    } catch {
        return false;
    }
}

/**
 * Origin of the host this user signs in on. Course users get their subdomain;
 * super-admins get the admin host. Falls back to APP_URL in local dev (no
 * wildcard DNS) or if the course can't be resolved.
 */
export async function portalOriginForUser(user: PortalUser): Promise<string> {
    const app = appOrigin();
    if (isLocalOrigin(app)) return app;

    if (user.role === 'super_admin' || !user.courseId) return `https://admin.${baseDomain()}`;

    const course = await getCourseById(user.courseId);
    return course ? `https://${course.slug}.${baseDomain()}` : app;
}

/** Absolute sign-in URL for this user (students have their own login page). */
export async function loginUrlForUser(user: PortalUser): Promise<string> {
    const origin = await portalOriginForUser(user);
    if (user.role === 'super_admin' || !user.courseId) return `${origin}/super-admin/login`;
    return `${origin}${user.role === 'student' ? '/student-login' : '/login'}`;
}

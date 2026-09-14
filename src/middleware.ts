import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIES, APP_PATHS } from '@/lib/constants';
import { verifyJWT, type JWTPayload } from '@/lib/auth';
import { extractCourseSlug, isSuperAdminHost, getCourseBySlug, isCourseUsable } from '@/lib/course';

// Node.js middleware (stable since Next 15.2) — required because course
// resolution below hits Postgres via Prisma, which needs the Node runtime.
export const runtime = 'nodejs';

const PUBLIC_API_ROUTES = [
    '/api/chat',
    '/api/auth/register',
    '/api/auth/session',
    '/api/auth/batches',
    '/api/auth/login',
    '/api/auth/reset-password',
    '/api/feedback',
    '/api/setup',
    '/api/cv/public/',
    '/api/cv/admin/templates',
    '/api/deployments/pixel',
    '/api/deployments/serve-site',
    '/api/student-form/',
    '/api/typing-exam/public/',
];

const isPublicAssetPath = (pathname: string) =>
    pathname.startsWith('/_next') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/cv/') ||
    pathname === '/favicon.ico';

const isPublicRoute = (pathname: string) =>
    isPublicAssetPath(pathname) || PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route));

/**
 * Any subdomain at all, no course lookup — this is the pre-existing
 * "mini-netlify" student site hosting feature. It's unrelated to courses and
 * is only consulted as a fallback once a course-slug lookup has missed, so a
 * student's deployment subdomain keeps working exactly as before.
 */
function rewriteToDeploymentServe(request: NextRequest, subdomain: string, pathname: string) {
    const serveUrl = new URL('/api/deployments/serve-site', request.url);
    serveUrl.searchParams.set('subdomain', subdomain);
    serveUrl.searchParams.set('path', pathname);
    return NextResponse.rewrite(serveUrl);
}

async function verifyAndGetPayload(token: string): Promise<JWTPayload | undefined> {
    try {
        return await verifyJWT(token);
    } catch {
        return undefined;
    }
}

function getSessionPayload(request: NextRequest): Promise<JWTPayload | undefined> | undefined {
    const token = request.cookies.get(COOKIES.SESSION)?.value;
    const hasSessionShape = typeof token === 'string' && token.split('.').length === 3 && token.length > 50;
    return hasSessionShape ? verifyAndGetPayload(token!) : undefined;
}

/** Legacy single-tenant guard, unchanged — used for the bare root domain until it becomes the course directory. */
async function legacySingleTenantGuard(request: NextRequest): Promise<NextResponse> {
    const { pathname } = request.nextUrl;

    if (isPublicRoute(pathname)) {
        return NextResponse.next();
    }

    const isDashboardPath = pathname.startsWith(APP_PATHS.DASHBOARD);
    const isStudentPath = pathname.startsWith(APP_PATHS.STUDENT_DASHBOARD);
    const isAuthPage = pathname === APP_PATHS.LOGIN || pathname === APP_PATHS.STUDENT_LOGIN;
    const isApiRequest = pathname.startsWith('/api');

    const payload = await getSessionPayload(request);
    const role = payload?.role;

    if (isAuthPage && role) {
        return NextResponse.redirect(
            new URL(role === 'student' ? APP_PATHS.STUDENT_DASHBOARD : APP_PATHS.DASHBOARD, request.url)
        );
    }

    if (!role) {
        if (isApiRequest) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (isStudentPath) return NextResponse.redirect(new URL(APP_PATHS.STUDENT_LOGIN, request.url));
        if (isDashboardPath) return NextResponse.redirect(new URL(APP_PATHS.LOGIN, request.url));
    }

    return NextResponse.next();
}

const SUPER_ADMIN_LOGIN_PATH = '/super-admin/login';
const SUPER_ADMIN_HOME_PATH = '/super-admin';

/** Super-admin host guard — only super_admin sessions may pass; everyone else goes to its login page. */
async function superAdminGuard(request: NextRequest): Promise<NextResponse> {
    const { pathname } = request.nextUrl;

    // NextResponse.next() header mutations only affect the *response* sent to
    // the browser — they never reach downstream Route Handlers or Server
    // Components. To make x-is-super-admin-host visible to req.headers /
    // headers() further down the pipeline, it has to go through the
    // `request` init option, which re-signs the request itself.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-is-super-admin-host', '1');
    const passThrough = () => {
        const res = NextResponse.next({ request: { headers: requestHeaders } });
        res.headers.set('x-is-super-admin-host', '1');
        return res;
    };

    if (isPublicRoute(pathname)) {
        return passThrough();
    }

    const isLoginPage = pathname === SUPER_ADMIN_LOGIN_PATH;
    const isApiRequest = pathname.startsWith('/api');

    const payload = await getSessionPayload(request);
    const isSuperAdmin = payload?.role === 'super_admin';

    if (isLoginPage && isSuperAdmin) {
        return NextResponse.redirect(new URL(SUPER_ADMIN_HOME_PATH, request.url));
    }

    if (!isSuperAdmin) {
        let response: NextResponse;
        if (isApiRequest) {
            response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        } else if (isLoginPage) {
            response = passThrough();
        } else {
            response = NextResponse.redirect(new URL(SUPER_ADMIN_LOGIN_PATH, request.url));
        }
        if (payload) {
            // A course-scoped (or otherwise non-super-admin) session cookie
            // has no business on this host — clear it.
            response.cookies.delete(COOKIES.SESSION);
        }
        return response;
    }

    return passThrough();
}

/** Course-subdomain guard — same shape as the legacy guard, plus a course-match check on top of role. */
async function courseGuard(request: NextRequest, course: { id: string; slug: string }): Promise<NextResponse> {
    const { pathname } = request.nextUrl;

    // See the matching comment in superAdminGuard: response.headers.set()
    // never reaches downstream Route Handlers/Server Components — only the
    // `request` init option on NextResponse.next() does.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-course-id', course.id);
    requestHeaders.set('x-course-slug', course.slug);
    const passThrough = () => {
        const res = NextResponse.next({ request: { headers: requestHeaders } });
        res.headers.set('x-course-id', course.id);
        res.headers.set('x-course-slug', course.slug);
        return res;
    };

    if (isPublicRoute(pathname)) {
        return passThrough();
    }

    const isDashboardPath = pathname.startsWith(APP_PATHS.DASHBOARD);
    const isStudentPath = pathname.startsWith(APP_PATHS.STUDENT_DASHBOARD);
    const isAuthPage = pathname === APP_PATHS.LOGIN || pathname === APP_PATHS.STUDENT_LOGIN;
    const isApiRequest = pathname.startsWith('/api');

    const payload = await getSessionPayload(request);
    // super_admin sessions are never valid on a course subdomain — they operate
    // from the admin host (and, later, via short-lived impersonation tokens).
    const sessionMatchesCourse = !!payload && payload.role !== 'super_admin' && payload.courseId === course.id;
    const role = sessionMatchesCourse ? payload!.role : undefined;

    if (isAuthPage && role) {
        return NextResponse.redirect(
            new URL(role === 'student' ? APP_PATHS.STUDENT_DASHBOARD : APP_PATHS.DASHBOARD, request.url)
        );
    }

    if (!role) {
        let response: NextResponse;
        if (isApiRequest) {
            response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        } else if (isStudentPath) {
            response = NextResponse.redirect(new URL(APP_PATHS.STUDENT_LOGIN, request.url));
        } else if (isDashboardPath) {
            response = NextResponse.redirect(new URL(APP_PATHS.LOGIN, request.url));
        } else {
            response = passThrough();
        }
        // A cookie that exists but doesn't belong to this course (e.g. left
        // over from another course's subdomain) — clear it so it stops
        // getting resent here.
        if (payload && !sessionMatchesCourse) {
            response.cookies.delete(COOKIES.SESSION);
        }
        return response;
    }

    return passThrough();
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';

    // 1. Reserved super-admin host (admin.<base domain>) — no course resolution.
    if (isSuperAdminHost(host)) {
        return superAdminGuard(request);
    }

    // 2. Course subdomain resolution.
    const courseSlug = extractCourseSlug(host);
    if (courseSlug) {
        const course = await getCourseBySlug(courseSlug);

        if (!course || !isCourseUsable(course)) {
            // Not a known/active course — fall back to the pre-existing
            // student mini-site deployment hosting under the same subdomain.
            return rewriteToDeploymentServe(request, courseSlug, pathname);
        }

        return courseGuard(request, course);
    }

    // 3. Bare root domain — still the old single-tenant site until Step 5
    // replaces it with the course directory.
    return legacySingleTenantGuard(request);
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from 'next/server';
import { prisma, withCourseContext } from '@/lib/db';
import { signJWT } from '@/lib/auth';
import { AUTH_ROLES, COOKIES } from '@/lib/constants';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { HOUR, rateLimitByIp } from '@/lib/rateLimit';

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days — matches the JWT + ActiveSession expiry

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name: z.string().min(1, 'Name is required'),
    batchName: z.string().optional(),
    roll: z.string().optional(),
});

/**
 * POST /api/auth/register
 * Public endpoint — registers a new student account.
 */
export async function POST(req: NextRequest) {
    // Self-registration is open to the internet; without a cap one script can
    // fill a course's seats and the users table.
    const limited = rateLimitByIp(req, 'register', 5, HOUR,
        'অনেক বেশি অ্যাকাউন্ট তৈরির চেষ্টা হয়েছে। এক ঘণ্টা পর আবার চেষ্টা করুন।');
    if (limited) return limited;

    try {
        const courseId = req.headers.get('x-course-id');
        if (!courseId) {
            return NextResponse.json({ error: 'Unknown course.' }, { status: 404 });
        }

        const body = await req.json();
        const parsed = registerSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.message },
                { status: 400 }
            );
        }

        const { email, password, name, batchName, roll } = parsed.data;
        const normalizedEmail = email.toLowerCase().trim();

        // Email is globally unique across the whole platform, not just this
        // course, so the existence check must bypass course-scoped RLS too.
        const existing = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
            tx.user.findUnique({ where: { email: normalizedEmail } })
        );
        if (existing) {
            return NextResponse.json(
                { error: 'An account with this email already exists. Please log in instead.' },
                { status: 409 }
            );
        }

        const user = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            // Seat cap from super-admin billing settings (null = unlimited)
            const course = await tx.course.findUnique({ where: { id: courseId } });
            const maxStudents = (course?.settings as { billing?: { maxStudents?: number | null } } | null)?.billing?.maxStudents ?? null;
            if (typeof maxStudents === "number") {
                const count = await tx.user.count({ where: { courseId, role: "student", deletedAt: null } });
                if (count >= maxStudents) {
                    throw new Error("SEAT_LIMIT: এই কোর্সে শিক্ষার্থী সিট পূর্ণ হয়ে গেছে। অ্যাডমিনের সাথে যোগাযোগ করুন।");
                }
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, 12);

            // Create user in DB
            return tx.user.create({
                data: {
                    courseId,
                    email: normalizedEmail,
                    passwordHash,
                    displayName: name,
                    role: AUTH_ROLES.STUDENT,
                    studentBatchName: batchName || null,
                    studentRoll: roll || null,
                    lastLoginAt: new Date(),
                },
            });
        });

        // Every honoured session needs a live ActiveSession row — that row is
        // what logout / "disable user" / password change delete to revoke a
        // token early (see applyDbUserOverrides). Without it the cookie set
        // below would be rejected on the very next request.
        await prisma.activeSession.upsert({
            where: { userId: user.id },
            update: { expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000) },
            create: { userId: user.id, expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000) },
        });

        // Sign JWT and set cookie (auto-login after registration)
        const token = await signJWT({
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            courseId: user.courseId,
            studentBatchName: user.studentBatchName ?? undefined,
            studentRoll: user.studentRoll ?? undefined,
        });

        const response = NextResponse.json(
            {
                success: true,
                uid: user.id,
                user: {
                    id: user.id,
                    email: user.email,
                    displayName: user.displayName,
                    role: user.role,
                    studentBatchName: user.studentBatchName,
                    studentRoll: user.studentRoll,
                },
            },
            { status: 201 }
        );

        response.cookies.set(COOKIES.SESSION, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: SESSION_MAX_AGE,
        });

        return response;
    } catch (error) {
        console.error('[Register API] Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to register account';
        if (message.startsWith("SEAT_LIMIT:")) {
            return NextResponse.json({ error: message.replace("SEAT_LIMIT:", "").trim() }, { status: 403 });
        }
        // Never surface the raw error — it can carry DB/schema details.
        return NextResponse.json({ error: 'Failed to register account' }, { status: 500 });
    }
}

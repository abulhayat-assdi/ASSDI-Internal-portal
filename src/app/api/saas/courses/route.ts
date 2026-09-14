export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isSuperAdmin } from "@/lib/auth";
import { z } from "zod";

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const RESERVED_SLUGS = new Set(["www", "admin", "api", "mail", "ftp", "app", "portal"]);

const createCourseSchema = z.object({
    name: z.string().min(1, "Course name is required"),
    slug: z.string().regex(SLUG_REGEX, "Slug must be lowercase letters, numbers, hyphens (3+ chars)"),
    tagline: z.string().optional(),
    logoUrl: z.string().optional(),
    primaryColor: z.string().optional(),
    accentColor: z.string().optional(),
    adminName: z.string().min(1).optional(),
    adminEmail: z.string().email().optional(),
    adminPassword: z.string().min(6).optional(),
});

/** GET /api/saas/courses — list every course with basic stats (super_admin only) */
export async function GET(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const courses = await withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
        const rows = await tx.course.findMany({ orderBy: { createdAt: "desc" } });

        return Promise.all(
            rows.map(async (course) => {
                const [studentCount, teacherCount, adminCount] = await Promise.all([
                    tx.user.count({ where: { courseId: course.id, role: "student" } }),
                    tx.user.count({ where: { courseId: course.id, role: "teacher" } }),
                    tx.user.count({ where: { courseId: course.id, role: "admin" } }),
                ]);
                return { ...course, stats: { studentCount, teacherCount, adminCount } };
            })
        );
    });

    return NextResponse.json({ courses });
}

/** POST /api/saas/courses — create a new course, optionally with its first admin (super_admin only) */
export async function POST(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createCourseSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues.map((e) => e.message).join(", ") }, { status: 400 });
    }
    const { name, slug, tagline, logoUrl, primaryColor, accentColor, adminName, adminEmail, adminPassword } = parsed.data;

    if (RESERVED_SLUGS.has(slug)) {
        return NextResponse.json({ error: `"${slug}" is a reserved subdomain.` }, { status: 400 });
    }

    const hasAdminFields = adminName || adminEmail || adminPassword;
    if (hasAdminFields && !(adminName && adminEmail && adminPassword)) {
        return NextResponse.json({ error: "To create the first admin, provide name, email, and password together." }, { status: 400 });
    }

    try {
        const result = await withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
            const existingSlug = await tx.course.findUnique({ where: { slug } });
            if (existingSlug) return { error: "This subdomain is already taken." as const, status: 409 };

            if (adminEmail) {
                // Email is globally unique across the platform.
                const existingEmail = await tx.user.findUnique({ where: { email: adminEmail.toLowerCase().trim() } });
                if (existingEmail) return { error: "An account with this admin email already exists." as const, status: 409 };
            }

            const course = await tx.course.create({
                data: {
                    name,
                    slug,
                    tagline: tagline || null,
                    logoUrl: logoUrl || null,
                    primaryColor: primaryColor || undefined,
                    accentColor: accentColor || undefined,
                },
            });

            if (adminEmail && adminPassword && adminName) {
                const bcrypt = await import("bcryptjs");
                const passwordHash = await bcrypt.hash(adminPassword, 12);
                await tx.user.create({
                    data: {
                        courseId: course.id,
                        email: adminEmail.toLowerCase().trim(),
                        passwordHash,
                        displayName: adminName,
                        role: "admin",
                    },
                });
            }

            return { course };
        });

        if ("error" in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return NextResponse.json({ course: result.course }, { status: 201 });
    } catch (error) {
        console.error("[SaaS Courses POST]", error);
        const message = error instanceof Error ? error.message : "Failed to create course.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

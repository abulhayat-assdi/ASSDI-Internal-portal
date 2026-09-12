export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isSuperAdmin } from "@/lib/auth";
import { z } from "zod";

const createAdminSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email(),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

/** GET /api/saas/courses/[id]/admins — list this course's admin accounts (super_admin only) */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id: courseId } = await params;

    const admins = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
        tx.user.findMany({
            where: { courseId, role: "admin", deletedAt: null },
            select: { id: true, email: true, displayName: true, lastLoginAt: true, createdAt: true },
            orderBy: { createdAt: "asc" },
        })
    );

    return NextResponse.json({ admins });
}

/** POST /api/saas/courses/[id]/admins — create a new admin account for this course (super_admin only) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id: courseId } = await params;

    const body = await req.json();
    const parsed = createAdminSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues.map((e) => e.message).join(", ") }, { status: 400 });
    }
    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    try {
        const result = await withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
            const course = await tx.course.findUnique({ where: { id: courseId } });
            if (!course) return { error: "Course not found" as const, status: 404 };

            // Email is globally unique across the platform.
            const existing = await tx.user.findUnique({ where: { email: normalizedEmail } });
            if (existing) return { error: "An account with this email already exists." as const, status: 409 };

            const bcrypt = await import("bcryptjs");
            const passwordHash = await bcrypt.hash(password, 12);

            const admin = await tx.user.create({
                data: {
                    courseId,
                    email: normalizedEmail,
                    passwordHash,
                    displayName: name,
                    role: "admin",
                },
            });

            return { admin };
        });

        if ("error" in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return NextResponse.json({ admin: result.admin }, { status: 201 });
    } catch (error) {
        console.error("[SaaS Course Admins POST]", error);
        const message = error instanceof Error ? error.message : "Failed to create admin.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/** DELETE /api/saas/courses/[id]/admins?userId=... — revoke an admin's access (super_admin only) */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id: courseId } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

    await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
        tx.user.update({
            where: { id: userId, courseId, role: "admin" },
            data: { deletedAt: new Date() },
        })
    );

    return NextResponse.json({ success: true });
}

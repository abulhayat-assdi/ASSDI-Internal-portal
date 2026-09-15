export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin, hasRequiredPermission } from "@/lib/auth";
import { AUTH_ROLES } from "@/lib/constants";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
    DEFAULT_TEACHER_PERMISSIONS,
    DEFAULT_ADMIN_PERMISSIONS,
    TEACHER_FEATURE_PERMISSIONS,
} from "@/lib/permissions";

const createTeacherSchema = z.object({
    teacherId: z.string().min(1, "Teacher ID is required"),
    loginEmail: z.string().email("Invalid login email"),
    displayEmail: z.string().email("Invalid display email").optional(),
    password: z.string().min(6, "Password must be at least 6 characters"),
    name: z.string().min(1, "Name is required"),
    phone: z.string().optional(),
    designation: z.string().optional(),
    about: z.string().optional(),
    isAdmin: z.boolean().optional(),
    includeTeacherFeatures: z.boolean().optional(),
    order: z.number().optional(),
    leaveTrackingEnabled: z.boolean().optional(),
    profileImageUrl: z.string().optional(),
});

export async function POST(req: NextRequest) {
    try {
        // 1. Auth check — only admins/super_admins can create teachers
        const caller = await getSessionUser(req);
        if (!caller || !(isAdmin(caller) || hasRequiredPermission(caller, "teachers")) || !caller.courseId) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }
        const courseId = caller.courseId;

        const body = await req.json();
        const parsed = createTeacherSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.message }, { status: 400 });
        }

        const { teacherId, loginEmail, displayEmail, password, name, phone, designation, about, isAdmin: grantAdmin, includeTeacherFeatures, order, leaveTrackingEnabled, profileImageUrl } = parsed.data;

        // 2. Only super_admin can grant admin role
        if (grantAdmin && caller.role !== "super_admin") {
            return NextResponse.json(
                { error: "Forbidden: Only the portal owner (super_admin) can grant admin access." },
                { status: 403 }
            );
        }

        const normalizedLoginEmail = loginEmail.toLowerCase().trim();

        // 3. Check for existing user — email is globally unique across the
        // platform, so this bypasses course-scoped RLS.
        const existing = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
            tx.user.findUnique({ where: { email: normalizedLoginEmail } })
        );
        if (existing) {
            return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
        }

        // 4. Hash password
        const passwordHash = await bcrypt.hash(password, 12);
        const role = grantAdmin ? AUTH_ROLES.ADMIN : AUTH_ROLES.TEACHER;

        // Determine default permissions
        let defaultPermissions: string[];
        if (grantAdmin) {
            defaultPermissions = includeTeacherFeatures
                ? [...DEFAULT_ADMIN_PERMISSIONS, ...TEACHER_FEATURE_PERMISSIONS]
                : [...DEFAULT_ADMIN_PERMISSIONS];
        } else {
            defaultPermissions = [...DEFAULT_TEACHER_PERMISSIONS];
        }

        // 5. Create user and teacher records in a transaction
        const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            // Teacher seat cap from super-admin billing settings (null = unlimited)
            if (role === AUTH_ROLES.TEACHER) {
                const course = await tx.course.findUnique({ where: { id: courseId } });
                const maxTeachers = (course?.settings as { billing?: { maxTeachers?: number | null } } | null)?.billing?.maxTeachers ?? null;
                if (typeof maxTeachers === "number") {
                    const count = await tx.user.count({ where: { courseId, role: "teacher", deletedAt: null } });
                    if (count >= maxTeachers) {
                        throw new Error("SEAT_LIMIT: এই কোর্সে শিক্ষক সিট পূর্ণ হয়ে গেছে।");
                    }
                }
            }

            const user = await tx.user.create({
                data: {
                    courseId,
                    email: normalizedLoginEmail,
                    passwordHash,
                    displayName: name,
                    role,
                    teacherId,
                    permissions: defaultPermissions,
                },
            });

            const teacher = await tx.teacher.create({
                data: {
                    courseId,
                    teacherId,
                    name,
                    designation: designation || "",
                    about: about || "",
                    phone: phone || "",
                    email: displayEmail || normalizedLoginEmail,
                    loginEmail: normalizedLoginEmail,
                    isAdmin: grantAdmin || false,
                    order: order || 0,
                    leaveTrackingEnabled: leaveTrackingEnabled || false,
                    ...(profileImageUrl ? { profileImageUrl } : {}),
                },
            });

            return { user, teacher };
        });

        return NextResponse.json(
            { success: true, uid: result.user.id, message: "Teacher created successfully." },
            { status: 201 }
        );
    } catch (error: unknown) {
        console.error("[Create Teacher API] Error:", error);
        const message = error instanceof Error ? error.message : "Failed to create teacher account.";
        if (message.startsWith("SEAT_LIMIT:")) {
            return NextResponse.json({ error: message.replace("SEAT_LIMIT:", "").trim() }, { status: 403 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isSuperAdmin, isAdmin } from "@/lib/auth";
import {
    PORTAL_OWNER_EMAIL,
    getEffectivePermissions,
    getDisplayRoleLabel,
    ALL_PERMISSION_KEYS,
    ADMIN_TEACHER_MARKER,
} from "@/lib/permissions";

/**
 * GET /api/admin/access-management
 * Returns all non-student users with their permissions.
 * Department-scoped: any admin/super_admin within its own course can view.
 * Strictly isolated by courseId — no cross-department access.
 */
export async function GET(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isAdmin(caller) || !caller.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = caller.courseId;

    const users = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.user.findMany({
            where: {
                courseId,
                role: { notIn: ["student"] },
                deletedAt: null,
            },
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                permissions: true,
                createdAt: true,
            },
            orderBy: [{ role: "asc" }, { displayName: "asc" }],
        })
    );

    const result = users.map((u) => {
        const rawPerms = u.permissions as string[] | null;
        return {
            id: u.id,
            email: u.email,
            displayName: u.displayName,
            role: u.role,
            displayRole: getDisplayRoleLabel(u.role, rawPerms),
            isPortalOwner: u.email === PORTAL_OWNER_EMAIL,
            permissions: getEffectivePermissions(u.role, rawPerms),
        };
    });

    return NextResponse.json(result);
}

/**
 * PUT /api/admin/access-management
 * Body: { userId, permissions?, role? }
 * - permissions: update page access
 * - roleLabel: 'teacher' | 'admin' | 'admin_teacher' — promote/demote
 * Scoping: Department Admin (admin role) can manage ONLY users within
 * its own courseId. Super Admin can manage any course (via impersonation).
 * Cross-department operations are blocked by courseId isolation.
 */
export async function PUT(req: NextRequest) {
    const caller = await getSessionUser(req);
    // Department Admin = any admin scoped to its own courseId. Super Admin also allowed (via impersonation).
    if (!caller || !isAdmin(caller) || !caller.courseId) {
        return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }
    const courseId = caller.courseId;
    const isDepartmentAdmin = caller.role === "admin";

    const body = await req.json();
    const { userId, permissions, roleLabel } = body as {
        userId: string;
        permissions?: string[];
        /** Explicit display label: "teacher" | "admin" | "admin_teacher" */
        roleLabel?: "teacher" | "admin" | "admin_teacher";
    };

    if (!userId) {
        return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        // Find target user
        const target = await tx.user.findUnique({ where: { id: userId, courseId, deletedAt: null } });
        if (!target) {
            return NextResponse.json({ error: "User not found." }, { status: 404 });
        }

        // Portal owner is immutable
        if (target.email === PORTAL_OWNER_EMAIL) {
            return NextResponse.json({ error: "The portal owner's account cannot be modified." }, { status: 403 });
        }

        if (target.role === "student") {
            return NextResponse.json({ error: "Student accounts cannot be managed here." }, { status: 400 });
        }

        // Super_admin accounts are never managed via department-scoped access management
        if (target.role === "super_admin") {
            return NextResponse.json({ error: "Super admin accounts cannot be managed here." }, { status: 403 });
        }

        // Department Admin guard: prevent self-lockout of the only admin via accidental demotion
        // Super Admin is exempt (platform-wide)
        if (isDepartmentAdmin && roleLabel === "teacher" && target.id === caller.id) {
            const adminCount = await tx.user.count({ where: { courseId, role: "admin", deletedAt: null } });
            if (adminCount <= 1) {
                return NextResponse.json({ error: "You are the only Department Admin. Promote another teacher to admin before demoting yourself." }, { status: 403 });
            }
        }

        // ── Derive DB role from roleLabel ────────────────────────
        // "admin_teacher" → DB role = "admin" (gives full admin API access)
        // "admin"         → DB role = "admin"
        // "teacher"       → DB role = "teacher"
        const dbRole: "teacher" | "admin" | undefined =
            roleLabel === "teacher" ? "teacher"
            : roleLabel === "admin" || roleLabel === "admin_teacher" ? "admin"
            : undefined;

        const roleChanged = dbRole !== undefined && dbRole !== target.role;

        // ── Build final permissions array ────────────────────────
        let finalPermissions: string[] | undefined;

        if (permissions !== undefined) {
            if (!Array.isArray(permissions)) {
                return NextResponse.json({ error: "permissions must be an array." }, { status: 400 });
            }
            // Validate — allow real permission keys; strip any stale markers (we'll re-add if needed)
            const pagePerms = permissions.filter((p) => !p.startsWith("__"));
            const invalid   = pagePerms.filter((p) => !ALL_PERMISSION_KEYS.includes(p as any));
            if (invalid.length > 0) {
                return NextResponse.json({ error: `Invalid permission keys: ${invalid.join(", ")}` }, { status: 400 });
            }

            const effectiveDbRole = dbRole ?? (target.role as string);

            // access_management only available to admins
            const filtered = effectiveDbRole === "teacher"
                ? pagePerms.filter((p) => p !== "access_management")
                : pagePerms;

            // Re-attach the role display marker if Admin+Teacher is selected
            finalPermissions = roleLabel === "admin_teacher"
                ? [...filtered, ADMIN_TEACHER_MARKER]
                : filtered;
        }

        if (finalPermissions === undefined && roleLabel !== undefined) {
            // Role changed but no permissions sent — apply sensible defaults
            const existingPagePerms = getEffectivePermissions(target.role, target.permissions as string[]);
            finalPermissions = roleLabel === "admin_teacher"
                ? [...existingPagePerms, ADMIN_TEACHER_MARKER]
                : existingPagePerms.filter((p) => p !== ADMIN_TEACHER_MARKER);
        }

        // ── Persist ──────────────────────────────────────────────
        await tx.user.update({
            where: { id: userId, courseId },
            data: {
                ...(roleChanged ? { role: dbRole } : {}),
                ...(finalPermissions !== undefined ? { permissions: finalPermissions } : {}),
            },
        });

        // Sync Teacher.isAdmin
        if (roleChanged) {
            await tx.teacher.updateMany({
                where: { courseId, OR: [{ loginEmail: target.email }, { email: target.email }] },
                data:  { isAdmin: dbRole === "admin" },
            });
        }

        const savedRole        = dbRole ?? (target.role as string);
        const savedPermissions = finalPermissions ?? (target.permissions as string[]) ?? [];

        return NextResponse.json({
            success:     true,
            role:        savedRole,
            displayRole: getDisplayRoleLabel(savedRole, savedPermissions),
            permissions: getEffectivePermissions(savedRole, savedPermissions),
        });
    });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isSuperAdmin, invalidateUserOverrideCache } from "@/lib/auth";

/**
 * DELETE /api/saas/users/[id] — permanently delete a user account (super_admin only).
 * Unlike /status (soft-delete via deletedAt, reversible), this hard-deletes the
 * row. Related rows cascade per prisma/schema.prisma (active session, password
 * reset tokens, CV drafts, deployments) or keep their history with the author
 * detached (activity logs, chat messages use onDelete: SetNull).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;

    try {
        const result = await withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
            const target = await tx.user.findUnique({ where: { id } });
            if (!target) return { error: "User not found" as const, status: 404 };
            if (target.role === "super_admin") {
                return { error: "Super-admin accounts cannot be deleted here." as const, status: 403 };
            }
            if (target.id === caller.id) {
                return { error: "You cannot delete your own account." as const, status: 403 };
            }

            await tx.user.delete({ where: { id } });

            if (target.courseId) {
                await tx.activityLog.create({
                    data: {
                        courseId: target.courseId, actorUid: caller.id, actorRole: "ADMIN",
                        actionType: "super_admin_user_deleted", targetType: "user", targetId: id,
                        description: `Super-admin ${caller.email} permanently deleted ${target.email}`,
                    },
                }).catch(() => { /* non-blocking */ });
            }

            return { email: target.email };
        });

        if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
        invalidateUserOverrideCache(id);
        return NextResponse.json({ success: true, email: result.email });
    } catch (error) {
        console.error("[SaaS User DELETE]", error);
        const message = error instanceof Error ? error.message : "Failed to delete user.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma, withCourseContext } from "@/lib/db";
import { getSessionUser, isSuperAdmin } from "@/lib/auth";

/** GET — all super_admin accounts + their session state (super_admin only) */
export async function GET(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const now = new Date();
    const admins = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
        tx.user.findMany({
            where: { role: "super_admin", deletedAt: null },
            select: {
                id: true, email: true, displayName: true,
                lastLoginAt: true, createdAt: true,
                activeSession: { select: { expiresAt: true, createdAt: true } },
            },
            orderBy: { createdAt: "asc" },
        })
    );
    return NextResponse.json({
        selfId: caller.id,
        now,
        admins: admins.map((a) => ({
            ...a,
            sessionActive: !!a.activeSession && new Date(a.activeSession.expiresAt).getTime() > now.getTime(),
        })),
    });
}

/** DELETE ?userId= — revoke a super-admin's session (cannot revoke self) */
export async function DELETE(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const userId = new URL(req.url).searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
    if (userId === caller.id) {
        return NextResponse.json({ error: "নিজের সেশন এখান থেকে revoke করা যাবে না — Logout ব্যবহার করুন।" }, { status: 400 });
    }
    const target = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
        tx.user.findFirst({ where: { id: userId, role: "super_admin", deletedAt: null } })
    );
    if (!target) return NextResponse.json({ error: "Super-admin not found." }, { status: 404 });
    await prisma.activeSession.deleteMany({ where: { userId } });
    return NextResponse.json({ success: true });
}

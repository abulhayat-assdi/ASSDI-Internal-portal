import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * PATCH /api/chat/read
 * Marks unread messages in a thread as read for the caller's role.
 * Body: { threadId: string }
 */
export async function PATCH(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { threadId, studentUid, role: bodyRole } = body as { threadId?: string; studentUid?: string; role?: string };

        // Frontend (contactService.markChatAsRead) sends { studentUid, role }, legacy may send threadId
        const identifier = threadId || studentUid;
        if (!identifier) return NextResponse.json({ error: "threadId or studentUid required" }, { status: 400 });

        const isStudentRole = bodyRole ? bodyRole === "student" : user.role === "student";

        await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const where: any = threadId ? { id: identifier, courseId } : { studentUid: identifier, courseId };
            const existing = await tx.chatThread.findFirst({ where });
            if (!existing) return;
            await tx.chatThread.update({
                where: { id: existing.id },
                data: isStudentRole
                    ? { unreadCountStudent: 0 }
                    : { unreadCountAdmin: 0 },
            });
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Chat Read PATCH]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

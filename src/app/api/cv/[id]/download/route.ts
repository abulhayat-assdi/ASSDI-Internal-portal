export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { id } = await params;

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const draft = await tx.cvDraft.findUnique({ where: { id, courseId }, select: { userId: true } });
        if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (draft.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        await tx.cvDraft.update({
            where: { id, courseId },
            data: { downloadCount: { increment: 1 } },
        });

        return NextResponse.json({ success: true });
    });
}

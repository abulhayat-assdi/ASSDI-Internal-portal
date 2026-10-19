import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/student/feedback/forms — feedback forms currently open for the student's course */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;

    const forms = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.feedbackForm.findMany({
            where: { courseId, isOpen: true },
            select: { id: true, title: true, description: true, createdAt: true },
            orderBy: { createdAt: "desc" },
        })
    );
    return NextResponse.json(forms);
}

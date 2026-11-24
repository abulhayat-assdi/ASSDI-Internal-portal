import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { submissionAccess } from "@/lib/homeworkAccess";
import { MAX_COMMENT_LENGTH } from "@/lib/homeworkGrading";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Private comment thread on one submission — only the submitting student and
 * the staff who can see that submission read it. Writing as staff needs
 * grading rights (a view-only shared teacher can read but not post).
 */

/** GET /api/homework/comments?submissionId=... */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;
    const submissionId = req.nextUrl.searchParams.get("submissionId");
    if (!submissionId) return NextResponse.json({ error: "submissionId required" }, { status: 400 });

    try {
        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const sub = await tx.homeworkSubmission.findFirst({ where: { id: submissionId, courseId, deletedAt: null } });
            if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });
            const access = await submissionAccess(tx, user, sub);
            if (!access.canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            const comments = await tx.homeworkComment.findMany({
                where: { courseId, submissionId },
                orderBy: { createdAt: "asc" },
                select: { id: true, authorUid: true, authorName: true, authorRole: true, body: true, createdAt: true },
            });
            return NextResponse.json({ comments, canPost: access.isStudentOwner || access.canGrade });
        });
    } catch (error) {
        console.error("[Homework comments GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** POST /api/homework/comments — { submissionId, body } */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    let payload: any;
    try { payload = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
    const submissionId = typeof payload?.submissionId === "string" ? payload.submissionId : "";
    const text = typeof payload?.body === "string" ? payload.body.trim() : "";
    if (!submissionId) return NextResponse.json({ error: "submissionId required" }, { status: 400 });
    if (!text) return NextResponse.json({ error: "কমেন্ট খালি রাখা যাবে না।" }, { status: 400 });
    if (text.length > MAX_COMMENT_LENGTH) {
        return NextResponse.json({ error: `কমেন্ট সর্বোচ্চ ${MAX_COMMENT_LENGTH} অক্ষর হতে পারে।` }, { status: 400 });
    }

    try {
        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const sub = await tx.homeworkSubmission.findFirst({ where: { id: submissionId, courseId, deletedAt: null } });
            if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });
            const access = await submissionAccess(tx, user, sub);
            if (!access.isStudentOwner && !access.canGrade) {
                return NextResponse.json({ error: "আপনি এখানে কমেন্ট করতে পারবেন না।" }, { status: 403 });
            }
            const created = await tx.homeworkComment.create({
                data: {
                    courseId,
                    submissionId,
                    authorUid: user.id,
                    authorName: user.displayName,
                    authorRole: user.role,
                    body: text,
                },
                select: { id: true, authorUid: true, authorName: true, authorRole: true, body: true, createdAt: true },
            });
            return NextResponse.json(created, { status: 201 });
        });
    } catch (error) {
        console.error("[Homework comments POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

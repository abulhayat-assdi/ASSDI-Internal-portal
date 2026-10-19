import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/feedback/forms — teacher/admin: this course's feedback forms with counts */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const forms = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const list = await tx.feedbackForm.findMany({
            where: { courseId },
            orderBy: { createdAt: "desc" },
        });
        const totals = await tx.feedback.groupBy({
            by: ["formId", "isRead"],
            where: { courseId, formId: { not: null } },
            _count: { _all: true },
        });
        return list.map((f) => {
            const mine = totals.filter((t) => t.formId === f.id);
            const total = mine.reduce((n, t) => n + t._count._all, 0);
            const unread = mine.filter((t) => !t.isRead).reduce((n, t) => n + t._count._all, 0);
            return { ...f, total, unread };
        });
    });

    return NextResponse.json(forms);
}

/** POST /api/feedback/forms — open a new feedback form */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const { title, description } = await req.json();
        if (!title || typeof title !== "string" || !title.trim()) {
            return NextResponse.json({ error: "Title is required" }, { status: 400 });
        }
        const form = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.feedbackForm.create({
                data: {
                    courseId,
                    title: title.trim().slice(0, 200),
                    description: typeof description === "string" && description.trim() ? description.trim().slice(0, 1000) : null,
                    createdByUid: user.id,
                },
            })
        );
        return NextResponse.json(form, { status: 201 });
    } catch (error) {
        console.error("[Feedback Forms POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** PATCH /api/feedback/forms — open or close a form */
export async function PATCH(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const { id, isOpen } = await req.json();
        if (!id || typeof isOpen !== "boolean") {
            return NextResponse.json({ error: "id and isOpen are required" }, { status: 400 });
        }
        const form = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.feedbackForm.update({
                where: { id, courseId },
                data: { isOpen, closedAt: isOpen ? null : new Date() },
            })
        );
        return NextResponse.json(form);
    } catch (error) {
        console.error("[Feedback Forms PATCH]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** DELETE /api/feedback/forms?id=... — removes the form and its feedback */
export async function DELETE(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.feedbackForm.delete({ where: { id, courseId } })
    );
    return NextResponse.json({ success: true });
}

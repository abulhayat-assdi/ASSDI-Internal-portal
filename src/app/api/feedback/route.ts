import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/feedback — public: approved only; admin: all */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "true";
    const id = searchParams.get("id");

    const user = all ? await getSessionUser(req) : null;
    const courseId = user?.courseId || req.headers.get("x-course-id");
    if (!courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (id) {
        const item = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.feedback.findUnique({ where: { id, courseId } })
        );
        return NextResponse.json(item);
    }

    if (all) {
        if (!user || !isAdmin(user)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const items = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.feedback.findMany({ where: { courseId }, orderBy: { createdAt: "desc" } })
        );
        return NextResponse.json(items);
    }

    const items = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.feedback.findMany({
            where: { courseId, status: "APPROVED" },
            orderBy: { createdAt: "desc" },
        })
    );
    return NextResponse.json(items);
}

/** POST /api/feedback — public submission */
export async function POST(req: NextRequest) {
    try {
        const courseId = req.headers.get("x-course-id");
        if (!courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { studentName, batch, role, company, message, rating, submittedFrom } = body;

        if (!studentName || !message) {
            return NextResponse.json({ error: "Name and message are required" }, { status: 400 });
        }

        const item = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.feedback.create({
                data: {
                    courseId,
                    studentName,
                    batch: batch || "",
                    role: role || "",
                    company: company || "",
                    message,
                    rating: Number(rating) || 5,
                    status: "PENDING",
                    submittedFrom: submittedFrom || "PUBLIC_FORM",
                },
            })
        );

        return NextResponse.json(item, { status: 201 });
    } catch (error) {
        console.error("[Feedback POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** PATCH /api/feedback — approve/reject */
export async function PATCH(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { id, status, approvedByUid } = body;

        const item = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.feedback.update({
                where: { id, courseId },
                data: { status, approvedByUid: approvedByUid || user.id },
            })
        );

        return NextResponse.json(item);
    } catch (error) {
        console.error("[Feedback PATCH]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** DELETE /api/feedback?id=... */
export async function DELETE(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.feedback.delete({ where: { id, courseId } })
    );
    return NextResponse.json({ success: true });
}

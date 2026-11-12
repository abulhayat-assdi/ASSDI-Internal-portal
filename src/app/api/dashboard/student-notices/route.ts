import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin, type JWTPayload } from "@/lib/auth";
import { notifyStudentsOfNotice } from "@/lib/notifications";
import { ALL_BATCHES, normalizeNoticeBatch, studentNoticeBatchFilter } from "@/lib/studentNoticeScope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const canManage = (user: JWTPayload) => user.role === "admin" || user.role === "teacher";

/**
 * True when `batchName` is "all" or a batch this course actually has — either
 * in the batches table or on the roster (older batches only live there).
 */
async function batchExists(courseId: string, batchName: string): Promise<boolean> {
    if (batchName === ALL_BATCHES) return true;
    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const batch = await tx.batch.findFirst({ where: { courseId, name: batchName }, select: { id: true } });
        if (batch) return true;
        const student = await tx.batchStudent.findFirst({ where: { courseId, batchName }, select: { id: true } });
        return Boolean(student);
    });
}

/**
 * GET /api/dashboard/student-notices[?batchName=...]
 *
 * Students only ever get notices for their own batch plus course-wide ("all")
 * ones — the batch comes from the session, never the query string.
 * Teachers/admins get every notice, or one batch's view with ?batchName=.
 */
export async function GET(req: NextRequest) {
    try {
        const user = await getSessionUser(req);
        if (!user || !user.courseId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const courseId = user.courseId;

        let batchFilter: ReturnType<typeof studentNoticeBatchFilter> | undefined;
        if (isTeacherOrAdmin(user)) {
            const requested = new URL(req.url).searchParams.get("batchName");
            batchFilter = requested ? studentNoticeBatchFilter(requested) : undefined;
        } else {
            // Students (and any other non-staff role) see their batch + course-wide.
            batchFilter = studentNoticeBatchFilter(user.role === "student" ? user.studentBatchName : null);
        }

        const notices = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.studentNotice.findMany({
                where: { courseId, ...(batchFilter ? { batchName: batchFilter } : {}) },
                orderBy: { createdAt: "desc" },
            })
        );

        return NextResponse.json(notices);
    } catch (error) {
        console.error("Failed to fetch student notices:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/**
 * POST /api/dashboard/student-notices
 * Create a new student notice (Admin/Teacher only). `batchName` defaults to "all".
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getSessionUser(req);
        if (!user || !canManage(user) || !user.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = user.courseId;

        const body = await req.json();
        const { date, priority } = body;
        const title = typeof body.title === "string" ? body.title.trim() : "";
        const description = typeof body.description === "string" ? body.description.trim() : "";
        if (!title || !description) {
            return NextResponse.json({ error: "Title and message are required." }, { status: 400 });
        }
        const batchName = normalizeNoticeBatch(body.batchName);
        if (!(await batchExists(courseId, batchName))) {
            return NextResponse.json({ error: "Unknown batch." }, { status: 400 });
        }

        const notice = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.studentNotice.create({
                data: {
                    courseId,
                    title,
                    description,
                    batchName,
                    date: date || new Date().toISOString().split('T')[0],
                    priority: priority === "urgent" ? "urgent" : "normal",
                    createdBy: user.id,
                    createdByName: user.displayName || "Admin",
                }
            })
        );

        // Mail goes out after the notice is safely stored, and never blocks
        // the response — see @/lib/notifications. Only the target batch is mailed.
        notifyStudentsOfNotice({
            courseId,
            batchName: notice.batchName,
            title: notice.title,
            description: notice.description,
            priority: notice.priority,
        });

        return NextResponse.json(notice);
    } catch (error) {
        console.error("Failed to create student notice:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/**
 * PATCH /api/dashboard/student-notices
 * Edit a notice: { id, title?, description?, priority?, batchName? }. No email is re-sent.
 */
export async function PATCH(req: NextRequest) {
    try {
        const user = await getSessionUser(req);
        if (!user || !canManage(user) || !user.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = user.courseId;

        const body = await req.json();
        const id = typeof body.id === "string" ? body.id : "";
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

        const data: { title?: string; description?: string; priority?: string; batchName?: string } = {};
        if (body.title !== undefined) {
            const title = String(body.title).trim();
            if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
            data.title = title;
        }
        if (body.description !== undefined) {
            const description = String(body.description).trim();
            if (!description) return NextResponse.json({ error: "Message is required." }, { status: 400 });
            data.description = description;
        }
        if (body.priority !== undefined) {
            data.priority = body.priority === "urgent" ? "urgent" : "normal";
        }
        if (body.batchName !== undefined) {
            const batchName = normalizeNoticeBatch(body.batchName);
            if (!(await batchExists(courseId, batchName))) {
                return NextResponse.json({ error: "Unknown batch." }, { status: 400 });
            }
            data.batchName = batchName;
        }

        const updated = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const existing = await tx.studentNotice.findUnique({ where: { id, courseId }, select: { id: true } });
            if (!existing) return null;
            return tx.studentNotice.update({ where: { id, courseId }, data });
        });
        if (!updated) return NextResponse.json({ error: "Notice not found." }, { status: 404 });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("[Student-notices PATCH]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** DELETE /api/dashboard/student-notices?id=... */
export async function DELETE(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !canManage(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    try {
        await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.studentNotice.delete({ where: { id, courseId } })
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Student-notices DELETE]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

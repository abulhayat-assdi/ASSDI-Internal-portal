import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { normalizeCurrentlyDoing } from "@/lib/currentlyDoing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/student/update-request — admin gets all pending requests */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const requests = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.studentUpdateRequest.findMany({
            where: { courseId },
            orderBy: { submittedAt: "desc" },
        })
    );

    return NextResponse.json(requests);
}

/** POST /api/student/update-request — student submits a change request */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { studentUid, studentName, batchName, roll, proposedChanges, currentData } = body;

        const request = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.studentUpdateRequest.create({
                data: {
                    courseId,
                    studentUid: studentUid || user.id,
                    studentName: studentName || user.displayName,
                    studentBatchName: batchName || user.studentBatchName || "",
                    studentRoll: roll || user.studentRoll || "",
                    proposedChanges,
                    currentData,
                    status: "pending",
                },
            })
        );

        return NextResponse.json({ id: request.id, success: true }, { status: 201 });
    } catch (error) {
        console.error("[UpdateRequest POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** PATCH /api/student/update-request — admin approves or rejects */
export async function PATCH(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { requestId, action, reviewerName, adminNote } = body;

        if (!requestId || !action) {
            return NextResponse.json({ error: "requestId and action required" }, { status: 400 });
        }

        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const request = await tx.studentUpdateRequest.findUnique({ where: { id: requestId, courseId } });
            if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

            if (action === "approve") {
                const raw = { ...(request.proposedChanges as Record<string, unknown>) };
                // Requests filed before the dropdown fix carry "Studying Further",
                // which is not a valid enum value.
                if ("currentlyDoing" in raw) {
                    raw.currentlyDoing = normalizeCurrentlyDoing(raw.currentlyDoing) || null;
                }
                // proposedChanges is student-submitted, loosely-typed JSON (every
                // field arrives as a string from the form) — coerce it to match
                // the BatchStudent column types before writing, so a stray value
                // (e.g. salary "") can't 500 the whole approval instead of just
                // that one field.
                if ("category" in raw && raw.category !== "Alim" && raw.category !== "General") {
                    delete raw.category;
                }
                if ("courseStatus" in raw && !["Running", "Completed", "Incomplete", "Expelled"].includes(raw.courseStatus as string)) {
                    delete raw.courseStatus;
                }
                if ("salary" in raw) {
                    const n = Number(raw.salary);
                    raw.salary = Number.isFinite(n) ? n : 0;
                }
                const changes = raw;

                await tx.batchStudent.updateMany({
                    where: {
                        courseId,
                        batchName: request.studentBatchName,
                        roll: request.studentRoll,
                    },
                    data: changes as any,
                });

                await tx.studentUpdateRequest.update({
                    where: { id: requestId, courseId },
                    data: {
                        status: "approved",
                        reviewedBy: reviewerName || user.displayName,
                        reviewedAt: new Date(),
                    },
                });
            } else {
                await tx.studentUpdateRequest.update({
                    where: { id: requestId, courseId },
                    data: {
                        status: "rejected",
                        reviewedBy: reviewerName || user.displayName,
                        reviewedAt: new Date(),
                        adminNote: adminNote || null,
                    },
                });
            }

            return NextResponse.json({ success: true });
        });
    } catch (error) {
        console.error("[UpdateRequest PATCH]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

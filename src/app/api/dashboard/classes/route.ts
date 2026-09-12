import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/dashboard/classes?teacherId=... */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const teacherId = searchParams.get("teacherId");

    const where: any = { courseId };
    if (teacherId) where.teacherUid = teacherId;

    const classes = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.class.findMany({
            where,
            orderBy: { date: "desc" },
        })
    );

    return NextResponse.json(classes);
}

/** POST /api/dashboard/classes — teacher logs a new class */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { teacherUid, teacherName, date, startTime, endTime, timeRange, batch, subject, status } = body;

        const cls = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.class.create({
                data: {
                    courseId,
                    teacherUid: teacherUid || user.id,
                    teacherName: teacherName || user.displayName,
                    date: date || new Date().toISOString().split("T")[0],
                    startTime: startTime || "",
                    endTime: endTime || "",
                    timeRange: timeRange || null,
                    batch: batch || "",
                    subject: subject || "",
                    status: status || "PENDING",
                },
            })
        );

        return NextResponse.json(cls, { status: 201 });
    } catch (error) {
        console.error("[Dashboard Classes POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** DELETE /api/dashboard/classes?id=... */
export async function DELETE(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const cls = await tx.class.findUnique({ where: { id, courseId } });
        if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });

        if (cls.teacherUid !== user.id && user.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await tx.class.delete({ where: { id, courseId } });
        return NextResponse.json({ success: true });
    });
}

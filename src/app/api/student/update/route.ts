import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** PATCH /api/student/update — admin directly updates student batch record */
export async function PATCH(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { id, batchName, roll, ...data } = body;

        if (!id && !(batchName && roll)) {
            return NextResponse.json({ error: "id or batchName+roll required" }, { status: 400 });
        }

        const student = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) => {
            if (id) {
                return tx.batchStudent.update({ where: { id, courseId }, data });
            }
            return tx.batchStudent.update({
                where: { courseId_batchName_roll: { courseId, batchName, roll } },
                data,
            });
        });

        return NextResponse.json(student);
    } catch (error) {
        console.error("[Student Update PATCH]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

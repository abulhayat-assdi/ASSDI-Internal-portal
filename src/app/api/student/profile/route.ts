export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getServerSessionUser } from "@/lib/auth";

export async function GET() {
    try {
        // getServerSessionUser, not a bare verifyJWT: it also honours account
        // disabling and session revocation, and re-reads role from the DB.
        const session = await getServerSessionUser();
        if (!session || session.role !== "student" || !session.courseId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const courseId = session.courseId;

        const { studentBatchName, studentRoll } = session;
        if (!studentBatchName || !studentRoll) {
            return NextResponse.json({ error: "Student info missing from session" }, { status: 400 });
        }

        const student = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.batchStudent.findUnique({
                where: {
                    courseId_batchName_roll: {
                        courseId,
                        batchName: studentBatchName,
                        roll: studentRoll,
                    },
                },
            })
        );

        if (!student) {
            return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
        }

        return NextResponse.json(student);
    } catch (error) {
        console.error("Error fetching student profile:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { cookies } from "next/headers";
import { COOKIES } from "@/lib/constants";
import { verifyJWT } from "@/lib/auth";

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIES.SESSION)?.value;
        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const session = await verifyJWT(token);
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

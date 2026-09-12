import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/batch-info
 * Fetch students for a batch or search by roll.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const batchName = searchParams.get("batchName");
        const roll = searchParams.get("roll");
        const isPublic = searchParams.get("public") === "true";
        const all = searchParams.get("all") === "true";

        // Auth check for non-public data
        let courseId: string | null | undefined;
        if (!isPublic) {
            const user = await getSessionUser(req);
            if (!user) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            courseId = user.courseId;
        } else {
            courseId = req.headers.get("x-course-id");
        }
        if (!courseId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const where: any = { courseId };
        if (batchName) where.batchName = batchName;
        if (roll) where.roll = roll;
        if (isPublic) where.isPublic = true;

        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            if (all) {
                const students = await tx.batchStudent.findMany({ where: { courseId } });
                students.sort((a, b) => {
                    const batchCompare = a.batchName.localeCompare(b.batchName, undefined, { numeric: true, sensitivity: "base" });
                    if (batchCompare !== 0) return batchCompare;
                    return a.roll.localeCompare(b.roll, undefined, { numeric: true, sensitivity: "base" });
                });
                return NextResponse.json(students);
            }

            if (roll && batchName) {
                const student = await tx.batchStudent.findUnique({
                    where: {
                        courseId_batchName_roll: { courseId, batchName, roll }
                    }
                });
                return NextResponse.json(student);
            }

            const students = await tx.batchStudent.findMany({ where });
            students.sort((a, b) => a.roll.localeCompare(b.roll, undefined, { numeric: true, sensitivity: "base" }));

            return NextResponse.json(students);
        });
    } catch (error) {
        console.error("Failed to fetch batch info:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/**
 * POST /api/batch-info
 * Create a new student entry.
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getSessionUser(req);
        if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = user.courseId;

        const body = await req.json();
        const student = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.batchStudent.create({
                data: {
                    courseId,
                    batchId: body.batchId || "DEFAULT_BATCH", // Adjust as needed
                    batchName: body.batchName,
                    roll: body.roll,
                    name: body.name,
                    phone: body.phone || "",
                    address: body.address || "",
                    dob: body.dob,
                    educationalDegree: body.educationalDegree,
                    courseStatus: body.courseStatus || "Running",
                    currentlyDoing: body.currentlyDoing,
                    companyName: body.companyName || "",
                    businessName: body.businessName || "",
                    salary: body.salary || 0,
                    batchType: body.batchType || "Running",
                    isPublic: body.isPublic ?? true,
                }
            })
        );

        return NextResponse.json(student);
    } catch (error) {
        console.error("Failed to create student:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** DELETE /api/batch-info?id=... */
export async function DELETE(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    try {
        await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.batchStudent.delete({ where: { id, courseId } })
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Batch-info DELETE]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

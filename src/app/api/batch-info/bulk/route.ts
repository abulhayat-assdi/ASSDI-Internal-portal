import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";
import { BatchType, CourseStatus, CurrentlyDoing, StudentCategory } from "@prisma/client";
import { cleanupBatchLeaveAttachments } from "@/lib/leaveCleanup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/batch-info/bulk?batches=A,B,C — fetch students from multiple batches */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const batchesParam = searchParams.get("batches");

    if (!batchesParam) {
        return NextResponse.json({ error: "batches parameter required" }, { status: 400 });
    }

    const batchNames = batchesParam.split(",").map(b => b.trim()).filter(Boolean);

    const students = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.batchStudent.findMany({
            where: { courseId, batchName: { in: batchNames } },
        })
    );

    students.sort((a, b) => {
        const batchCompare = a.batchName.localeCompare(b.batchName, undefined, { numeric: true, sensitivity: "base" });
        if (batchCompare !== 0) return batchCompare;
        return a.roll.localeCompare(b.roll, undefined, { numeric: true, sensitivity: "base" });
    });

    return NextResponse.json(students);
}

/**
 * POST /api/batch-info/bulk
 * Upsert all students for a batch and delete removed ones.
 * Body: { batchName, students, batchType, completedAt? }
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getSessionUser(req);
        if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = user.courseId;

        const body = await req.json();
        const { batchName, students, batchType, completedAt } = body;

        if (!batchName || !Array.isArray(students)) {
            return NextResponse.json({ error: "batchName and students are required" }, { status: 400 });
        }

        const mapCurrentlyDoing = (value: string | undefined): CurrentlyDoing | null => {
            if (!value) return null;
            const map: Record<string, CurrentlyDoing> = {
                "Job": CurrentlyDoing.Job,
                "Business": CurrentlyDoing.Business,
                "Studying Further": CurrentlyDoing.StudyingFurther,
                "StudyingFurther": CurrentlyDoing.StudyingFurther,
                "Nothing": CurrentlyDoing.Nothing,
            };
            return map[value] ?? null;
        };

        const mapCategory = (value: string | undefined): StudentCategory | null => {
            if (value === "Alim") return StudentCategory.Alim;
            if (value === "General") return StudentCategory.General;
            return null;
        };

        const mapCourseStatus = (value: string | undefined, bType: string): CourseStatus => {
            if (value === "Completed") return CourseStatus.Completed;
            if (value === "Incomplete") return CourseStatus.Incomplete;
            if (value === "Expelled") return CourseStatus.Expelled;
            if (value === "Running") return CourseStatus.Running;
            return bType === "Completed" ? CourseStatus.Completed : CourseStatus.Running;
        };

        const completedAtDate = completedAt ? new Date(completedAt) : batchType === "Completed" ? new Date() : null;

        await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            // Find or create the Batch record
            let batch = await tx.batch.findUnique({ where: { courseId_name: { courseId, name: batchName } } });
            const expectedStatus = batchType === "Completed" ? "archived" : "active";
            if (!batch) {
                batch = await tx.batch.create({
                    data: {
                        courseId,
                        name: batchName,
                        status: expectedStatus,
                    },
                });
            } else {
                batch = await tx.batch.update({
                    where: { id: batch.id },
                    data: { status: expectedStatus },
                });
            }

            // If batch is set to Completed, trigger automatic cleanup of leave request attachment files
            if (batchType === "Completed") {
                await cleanupBatchLeaveAttachments(tx, courseId, batchName);
            }

            await Promise.all(
                students.map(async (s: Record<string, unknown>) => {
                    const roll = String(s.roll);
                    const data = {
                        batchId: batch!.id,
                        batchName,
                        name: String(s.name),
                        phone: String(s.phone || ""),
                        address: String(s.address || ""),
                        dob: s.dob ? String(s.dob) : null,
                        educationalDegree: s.educationalDegree ? String(s.educationalDegree) : null,
                        category: mapCategory(s.category as string),
                        bloodGroup: s.bloodGroup ? String(s.bloodGroup) : null,
                        totalPaidTk: s.totalPaidTk ? String(s.totalPaidTk) : null,
                        courseStatus: mapCourseStatus(s.courseStatus as string, batchType),
                        currentlyDoing: mapCurrentlyDoing(s.currentlyDoing as string),
                        companyName: String(s.companyName || ""),
                        businessName: String(s.businessName || ""),
                        salary: Number(s.salary) || 0,
                        batchType: batchType === "Completed" ? BatchType.Completed : BatchType.Running,
                        isPublic: (s.isPublic as boolean) ?? true,
                        completedAt: completedAtDate,
                        // Form-collected fields
                        email: s.email ? String(s.email) : null,
                        nidBirthNo: s.nidBirthNo ? String(s.nidBirthNo) : null,
                        fatherName: s.fatherName ? String(s.fatherName) : null,
                        motherName: s.motherName ? String(s.motherName) : null,
                        permanentAddress: s.permanentAddress ? String(s.permanentAddress) : null,
                        guardianName: s.guardianName ? String(s.guardianName) : null,
                        guardianPhone: s.guardianPhone ? String(s.guardianPhone) : null,
                        lastInstitute: s.lastInstitute ? String(s.lastInstitute) : null,
                        latestDegree: s.latestDegree ? String(s.latestDegree) : null,
                        gpaResult: s.gpaResult ? String(s.gpaResult) : null,
                        currentDistrict: s.currentDistrict ? String(s.currentDistrict) : null,
                        homeDistrict: s.homeDistrict ? String(s.homeDistrict) : null,
                        tShirtSize: s.tShirtSize ? String(s.tShirtSize) : null,
                        courseGoal: s.courseGoal ? String(s.courseGoal) : null,
                    };

                    await tx.batchStudent.upsert({
                        where: { courseId_batchName_roll: { courseId, batchName, roll } },
                        create: { ...data, courseId, roll },
                        update: data,
                    });
                })
            );

            // Remove students from this batch that were not in the submitted list
            const providedRolls = students.map((s: Record<string, unknown>) => String(s.roll));
            await tx.batchStudent.deleteMany({
                where: {
                    courseId,
                    batchName,
                    roll: { notIn: providedRolls },
                },
            });
        });

        return NextResponse.json({ success: true, count: students.length });
    } catch (error) {
        console.error("[batch-info/bulk POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

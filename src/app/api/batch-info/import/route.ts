import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/batch-info/import
 * Bulk import students into a batch.
 * Body: { batchName: string, students: StudentRow[] }
 */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { batchName, students } = body;

        if (!batchName || !Array.isArray(students)) {
            return NextResponse.json({ error: "batchName and students array required" }, { status: 400 });
        }

        const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            // Ensure the batch exists
            let batch = await tx.batch.findFirst({ where: { courseId, name: batchName } });
            if (!batch) {
                batch = await tx.batch.create({ data: { courseId, name: batchName, status: "active" } });
            }

            let created = 0;
            let skipped = 0;

            for (const s of students) {
                if (!s.roll || !s.name) { skipped++; continue; }

                const existing = await tx.batchStudent.findUnique({
                    where: { courseId_batchName_roll: { courseId, batchName, roll: s.roll } },
                });

                if (existing) { skipped++; continue; }

                await tx.batchStudent.create({
                    data: {
                        courseId,
                        batchId: batch.id,
                        batchName,
                        roll: s.roll,
                        name: s.name,
                        phone: s.phone || "",
                        address: s.address || "",
                        dob: s.dob || null,
                        educationalDegree: s.educationalDegree || null,
                        category: s.category || null,
                        bloodGroup: s.bloodGroup || null,
                        courseStatus: s.courseStatus || "Running",
                        batchType: s.batchType || "Running",
                        isPublic: s.isPublic ?? true,
                    },
                });
                created++;
            }

            return { created, skipped };
        });

        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error("[BatchInfo Import]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

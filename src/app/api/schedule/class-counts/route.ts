import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/schedule/class-counts
 * Returns class counts grouped by batch → subject.
 * Only includes batches with status="active" in the batches table.
 * Format: Record<batchName, { subjectName: string; classCount: number }[]>
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const formatted = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            // Only show active batches
            const activeBatches = await tx.batch.findMany({
                where: { courseId, status: "active" },
                select: { name: true },
            });
            const activeBatchNames = activeBatches.map(b => b.name);

            const result: Record<string, { subjectName: string; classCount: number }[]> = {};
            for (const name of activeBatchNames) {
                result[name] = [];
            }

            if (activeBatchNames.length === 0) return result;

            const counts = await tx.batchClassCount.findMany({
                where: { courseId, batchName: { in: activeBatchNames } },
            });

            for (const item of counts) {
                result[item.batchName].push({
                    subjectName: item.subjectName,
                    classCount: item.classCount,
                });
            }

            // Sort by classCount descending
            for (const batchName of Object.keys(result)) {
                result[batchName].sort((a, b) => b.classCount - a.classCount);
            }

            return result;
        });

        return NextResponse.json(formatted);
    } catch (error) {
        console.error("[class-counts GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/**
 * POST /api/schedule/class-counts
 * Supports manual update of a single batch, or bulk sync from Excel.
 */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const actorRole = user.role === "teacher" ? "TEACHER" : "ADMIN";

    try {
        const body = await req.json();
        const { isBulk, batchName, subjects, data } = body;

        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            if (isBulk) {
                if (!Array.isArray(data)) {
                    return NextResponse.json({ error: "data array required for bulk sync" }, { status: 400 });
                }

                // Sync/Upsert all rows
                for (const row of data) {
                    if (!row.batchName || !row.subjectName) continue;
                    await tx.batchClassCount.upsert({
                        where: {
                            courseId_batchName_subjectName: {
                                courseId,
                                batchName: row.batchName.trim(),
                                subjectName: row.subjectName.trim(),
                            }
                        },
                        update: {
                            classCount: Number(row.classCount) || 0,
                        },
                        create: {
                            courseId,
                            batchName: row.batchName.trim(),
                            subjectName: row.subjectName.trim(),
                            classCount: Number(row.classCount) || 0,
                        }
                    });
                }

                // Log activity
                await tx.activityLog.create({
                    data: {
                        courseId,
                        actorUid: user.id,
                        actorRole: actorRole,
                        actionType: "CLASS_COUNTS_IMPORT",
                        targetType: "batch_class_counts",
                        targetId: "bulk",
                        description: `User imported class counts from Excel (${data.length} records)`,
                    }
                });

                return NextResponse.json({ success: true, count: data.length });
            } else {
                if (!batchName || !Array.isArray(subjects)) {
                    return NextResponse.json({ error: "batchName and subjects array required" }, { status: 400 });
                }

                // Clean existing subjects for this batch and replace with new set
                await tx.batchClassCount.deleteMany({
                    where: { courseId, batchName }
                });

                if (subjects.length > 0) {
                    await tx.batchClassCount.createMany({
                        data: subjects.map((s: any) => ({
                            courseId,
                            batchName,
                            subjectName: s.subjectName.trim(),
                            classCount: Number(s.classCount) || 0,
                        }))
                    });
                }

                // Log activity
                await tx.activityLog.create({
                    data: {
                        courseId,
                        actorUid: user.id,
                        actorRole: actorRole,
                        actionType: "CLASS_COUNTS_UPDATE",
                        targetType: "batch_class_counts",
                        targetId: batchName,
                        description: `User updated class counts for batch ${batchName} (${subjects.length} subjects)`,
                    }
                });

                return NextResponse.json({ success: true });
            }
        });
    } catch (error) {
        console.error("[class-counts POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

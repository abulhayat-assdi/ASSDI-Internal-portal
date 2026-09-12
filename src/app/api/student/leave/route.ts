export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getServerSessionUser } from "@/lib/auth";
import { createStudentLeaveRequest } from "@/lib/studentLeaveDb";

export async function GET() {
    try {
        const session = await getServerSessionUser();
        if (!session || session.role !== "student" || !session.courseId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const courseId = session.courseId;

        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            // Fetch user profile from DB for accurate batch & roll info
            const user = await tx.user.findUnique({
                where: { id: session.id },
                select: { displayName: true, studentBatchName: true, studentRoll: true }
            });

            const batchName = user?.studentBatchName || session.studentBatchName || "";
            const roll = user?.studentRoll || session.studentRoll || "";

            // Query leave requests by studentUid OR by matching batchName & roll
            const whereConditions: any[] = [{ studentUid: session.id }];
            if (batchName && roll) {
                whereConditions.push({
                    studentBatchName: batchName,
                    studentRoll: roll,
                });
            }

            const leaveRequests = await tx.studentLeaveRequest.findMany({
                where: {
                    courseId,
                    OR: whereConditions,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });

            // Check student batch status to see if leave application is allowed
            let canApply = true;
            let batchStatus = "Running";

            if (batchName) {
                const batch = await tx.batch.findUnique({
                    where: { courseId_name: { courseId, name: batchName } },
                    select: { status: true },
                });
                if (batch && batch.status === "archived") {
                    canApply = false;
                    batchStatus = "Completed";
                }

                if (canApply && roll) {
                    const studentInfo = await tx.batchStudent.findUnique({
                        where: {
                            courseId_batchName_roll: {
                                courseId,
                                batchName: batchName,
                                roll: roll,
                            },
                        },
                        select: { batchType: true },
                    });
                    if (studentInfo && studentInfo.batchType === "Completed") {
                        canApply = false;
                        batchStatus = "Completed";
                    }
                }
            }

            return NextResponse.json({
                requests: leaveRequests,
                canApply,
                batchStatus,
                batchName: batchName,
            });
        });
    } catch (error) {
        console.error("Error fetching student leave requests:", error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Internal server error"
        }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSessionUser();
        if (!session || session.role !== "student" || !session.courseId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const courseId = session.courseId;

        const { startDate, endDate, reason, attachmentUrl, attachmentName, studentPhone: reqPhone } = await req.json();

        if (!startDate || !endDate || !reason) {
            return NextResponse.json({ error: "Missing required fields (Start Date, End Date, Reason)" }, { status: 400 });
        }

        const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            // Fetch fresh user profile from DB to get accurate student details
            const user = await tx.user.findUnique({
                where: { id: session.id },
                select: { displayName: true, studentBatchName: true, studentRoll: true, email: true }
            });

            const batchName = user?.studentBatchName || session.studentBatchName || "";
            const roll = user?.studentRoll || session.studentRoll || "";
            let studentName = user?.displayName || session.displayName || "Unknown Student";

            // Check if student batch is completed (archived)
            if (batchName) {
                const batch = await tx.batch.findUnique({
                    where: { courseId_name: { courseId, name: batchName } },
                    select: { status: true },
                });
                if (batch && batch.status === "archived") {
                    return { error: "Leave requests are closed because your batch has been completed." as const };
                }

                if (roll) {
                    const studentInfo = await tx.batchStudent.findUnique({
                        where: {
                            courseId_batchName_roll: {
                                courseId,
                                batchName: batchName,
                                roll: roll,
                            },
                        },
                        select: { batchType: true, phone: true },
                    });
                    if (studentInfo && studentInfo.batchType === "Completed") {
                        return { error: "Leave requests are closed because your batch has been completed." as const };
                    }
                }
            }

            // Fetch student phone number if available
            let studentPhone = reqPhone || "";
            if (batchName && roll) {
                try {
                    const bStudent = await tx.batchStudent.findUnique({
                        where: {
                            courseId_batchName_roll: {
                                courseId,
                                batchName: batchName,
                                roll: roll,
                            },
                        },
                        select: { phone: true, name: true },
                    });
                    if (bStudent) {
                        if (bStudent.phone) studentPhone = bStudent.phone;
                        if (bStudent.name && studentName === "Unknown Student") studentName = bStudent.name;
                    }
                } catch (err) {
                    console.warn("[StudentLeavePost] Warning querying phone from batchStudent:", err);
                }
            }

            const newLeaveRequest = await createStudentLeaveRequest(tx, {
                courseId,
                studentUid: session.id,
                studentName: studentName,
                studentRoll: roll || "N/A",
                studentPhone: studentPhone || null,
                studentBatchName: batchName || "N/A",
                startDate: String(startDate).trim(),
                endDate: String(endDate).trim(),
                reason: String(reason).trim(),
                attachmentUrl: attachmentUrl || null,
                attachmentName: attachmentName || null,
                status: "PENDING",
            });

            return { leaveRequest: newLeaveRequest };
        });

        if ("error" in result) {
            return NextResponse.json({ error: result.error }, { status: 403 });
        }

        return NextResponse.json(result.leaveRequest, { status: 201 });
    } catch (error) {
        console.error("Error creating student leave request:", error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Internal server error"
        }, { status: 500 });
    }
}

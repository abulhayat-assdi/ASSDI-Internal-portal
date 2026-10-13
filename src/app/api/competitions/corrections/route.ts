export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, canManageCompetitions } from "@/lib/auth";
import { effectiveReportDate } from "@/lib/competitions";

// Correction requests for staff review. `?count=pending` returns just the
// number waiting, for the badge on the competitions page.
export async function GET(req: NextRequest) {
    try {
        const user = await getSessionUser(req);
        if (!user || !canManageCompetitions(user) || !user.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = user.courseId;
        const { searchParams } = new URL(req.url);

        if (searchParams.get("count") === "pending") {
            const pending = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
                tx.competitionCorrectionRequest.count({ where: { courseId, status: "pending" } })
            );
            return NextResponse.json({ pending });
        }

        const status = searchParams.get("status");
        const rows = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.competitionCorrectionRequest.findMany({
                where: { courseId, ...(status && status !== "all" ? { status } : {}) },
                orderBy: { createdAt: "desc" },
                take: 300,
                include: {
                    competition: { select: { id: true, title: true, batchName: true, schema: true } },
                    submission: true,
                },
            })
        );

        return NextResponse.json(
            rows.map(({ competition, submission, ...request }) => ({
                ...request,
                competition,
                submission: {
                    id: submission.id,
                    type: submission.type,
                    teamName: submission.teamName,
                    rollNumber: submission.rollNumber,
                    studentName: submission.studentName,
                    data: submission.data,
                    reportDate: effectiveReportDate(submission, competition.schema),
                },
            }))
        );
    } catch (error) {
        console.error("Failed to fetch correction requests:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

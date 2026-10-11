import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";
import { effectiveReportDate } from "@/lib/competitions";

export const dynamic = "force-dynamic";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const { searchParams } = new URL(req.url);
        const isPublic = searchParams.get("public") === "true" || req.headers.get("referer")?.includes("/competitions/");
        const user = await getSessionUser(req);

        if (!isPublic && (!user || !isTeacherOrAdmin(user))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const courseId = user?.courseId || req.headers.get("x-course-id");
        if (!courseId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { competition, groups } = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const competition = await tx.competition.findUnique({
                where: { id, courseId },
                include: {
                    submissions: true
                }
            });
            // Team rosters let the report attribute individual rows to a team
            // and show who the leaders are.
            const groups = competition
                ? await tx.competitionGroup.findMany({
                      where: { courseId, batchName: competition.batchName },
                      orderBy: { groupName: "asc" },
                      select: { id: true, groupName: true, members: true },
                  })
                : [];
            return { competition, groups };
        });

        if (!competition) {
            return NextResponse.json({ error: "Competition not found" }, { status: 404 });
        }

        // We return the raw submissions and the form schema,
        // and let the frontend calculate the aggregations dynamically.
        // If there are many submissions, we might want to aggregate here,
        // but since we need both Team and Individual leaderboards dynamically,
        // returning raw data is often best for dynamic charts unless it's too large.

        return NextResponse.json({
            ...competition,
            // effectiveDate is the day each row counts for (it can differ from
            // submittedAt when a report is filed late).
            submissions: competition.submissions.map((s) => ({
                ...s,
                effectiveDate: effectiveReportDate(s, competition.schema),
            })),
            groups,
        });
    } catch (error) {
        console.error("Failed to fetch competition report:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const user = await getSessionUser(req);
        if (!user || !user.courseId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const courseId = user.courseId;

        const body = await req.json();

        const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const competition = await tx.competition.findUnique({
                where: { id, courseId }
            });

            if (!competition) {
                return { error: "Competition not found" as const, status: 404 };
            }

            if (!competition.isActive) {
                return { error: "Competition is not active" as const, status: 400 };
            }

            const submission = await tx.competitionSubmission.create({
                data: {
                    courseId,
                    competitionId: id,
                    type: body.type, // 'team' or 'individual'
                    teamName: body.teamName,
                    rollNumber: body.rollNumber,
                    studentName: body.studentName,
                    data: body.data,
                }
            });

            return { submission };
        });

        if ("error" in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return NextResponse.json(result.submission);
    } catch (error) {
        console.error("Failed to submit competition data:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

import { NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getServerSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const decoded = await getServerSessionUser();

    if (!decoded || !isTeacherOrAdmin(decoded) || !decoded.courseId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const courseId = decoded.courseId;

    const body = await req.json();
    const { submissions, deletedIds } = body;

    const compId = id;

    const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
      const competition = await tx.competition.findUnique({ where: { id: compId, courseId } });
      if (!competition) return { error: "Competition not found" as const };

      // Handle deletion of requested submission IDs
      if (Array.isArray(deletedIds) && deletedIds.length > 0) {
        await tx.competitionSubmission.deleteMany({
          where: {
            id: { in: deletedIds },
            competitionId: compId,
            courseId,
          }
        });
      }

      if (Array.isArray(submissions) && submissions.length > 0) {
        // Process upserts/updates & creates
        for (const sub of submissions) {
          if (sub.id) {
            // Update existing submission
            await tx.competitionSubmission.update({
              where: { id: sub.id, courseId },
              data: {
                type: sub.teamName ? "team" : "individual",
                teamName: sub.teamName || null,
                rollNumber: sub.rollNumber,
                studentName: sub.studentName || "N/A",
                data: sub.data
              }
            }).catch(console.error);
          } else {
            // Create new submission
            await tx.competitionSubmission.create({
              data: {
                courseId,
                competitionId: compId,
                type: sub.teamName ? "team" : "individual",
                teamName: sub.teamName || null,
                rollNumber: sub.rollNumber,
                studentName: sub.studentName || "N/A",
                data: sub.data
              }
            }).catch(console.error);
          }
        }
      }

      return { count: submissions?.length || 0 };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({ success: true, count: result.count });
  } catch (error: any) {
    console.error("Error managing bulk submissions:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: compId } = await params;
    const decoded = await getServerSessionUser();

    if (!decoded || !isTeacherOrAdmin(decoded) || !decoded.courseId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const courseId = decoded.courseId;

    const { searchParams } = new URL(req.url);
    const submissionId = searchParams.get("submissionId");

    if (!submissionId) {
      return NextResponse.json({ error: "Submission ID required" }, { status: 400 });
    }

    await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
      tx.competitionSubmission.delete({
        where: {
          id: submissionId,
          competitionId: compId,
          courseId,
        }
      })
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting submission:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

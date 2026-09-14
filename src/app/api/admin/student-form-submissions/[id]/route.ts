export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

// PATCH /api/admin/student-form-submissions/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req);
  if (!user || !user.courseId || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const courseId = user.courseId;

  const { id } = await params;
  const { action, adminNote } = await req.json();

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
    const sub = await tx.studentFormSubmission.findUnique({ where: { id, courseId } });
    if (!sub) return null;

    if (action === "approve") {
      await tx.batchStudent.updateMany({
        where: { courseId, batchName: sub.batchName, roll: sub.roll },
        data: {
          phone: sub.phone || undefined,
          dob: sub.dob || undefined,
          bloodGroup: sub.bloodGroup || undefined,
          address: sub.presentAddress || undefined,
          educationalDegree: sub.latestDegree || undefined,
          email: sub.email || undefined,
          nidBirthNo: sub.nidBirthNo || undefined,
          fatherName: sub.fatherName || undefined,
          motherName: sub.motherName || undefined,
          permanentAddress: sub.permanentAddress || undefined,
          guardianName: sub.guardianName || undefined,
          guardianPhone: sub.guardianPhone || undefined,
          lastInstitute: sub.lastInstitute || undefined,
          latestDegree: sub.latestDegree || undefined,
          gpaResult: sub.gpaResult || undefined,
          currentDistrict: sub.currentDistrict || undefined,
          homeDistrict: sub.homeDistrict || undefined,
          tShirtSize: sub.tShirtSize || undefined,
          totalPaidTk: sub.totalPayment || undefined,
          courseGoal: sub.courseGoal || undefined,
          category: sub.category === "Alim" || sub.category === "General" ? sub.category : undefined,
        },
      });

      await tx.studentFormSubmission.update({
        where: { id, courseId },
        data: { status: "approved", reviewedAt: new Date(), adminNote: adminNote || null },
      });
      return "approved" as const;
    }

    await tx.studentFormSubmission.update({
      where: { id, courseId },
      data: { status: "rejected", reviewedAt: new Date(), adminNote: adminNote || null },
    });
    return "rejected" as const;
  });

  if (!result) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  return NextResponse.json({ success: true, action: result });
}

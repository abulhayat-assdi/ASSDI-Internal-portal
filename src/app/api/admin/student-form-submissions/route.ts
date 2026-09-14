export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

// GET /api/admin/student-form-submissions?batchName=...&status=pending
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !user.courseId || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const courseId = user.courseId;

  const { searchParams } = new URL(req.url);
  const batchName = searchParams.get("batchName");
  const status = searchParams.get("status") || "pending";

  const rows = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
    tx.studentFormSubmission.findMany({
      where: { courseId, status, ...(batchName ? { batchName } : {}) },
      orderBy: { submittedAt: "desc" },
    })
  );

  const result = rows.map((r) => ({
    id: r.id,
    batchName: r.batchName,
    roll: r.roll,
    name: r.name,
    phone: r.phone,
    nidBirthNo: r.nidBirthNo,
    dob: r.dob,
    email: r.email,
    bloodGroup: r.bloodGroup,
    fatherName: r.fatherName,
    motherName: r.motherName,
    presentAddress: r.presentAddress,
    permanentAddress: r.permanentAddress,
    guardianName: r.guardianName,
    guardianPhone: r.guardianPhone,
    lastInstitute: r.lastInstitute,
    latestDegree: r.latestDegree,
    gpaResult: r.gpaResult,
    currentDistrict: r.currentDistrict,
    homeDistrict: r.homeDistrict,
    category: r.category,
    tShirtSize: r.tShirtSize,
    totalPayment: r.totalPayment,
    courseGoal: r.courseGoal,
    status: r.status,
    adminNote: r.adminNote,
    submittedAt: r.submittedAt,
  }));

  return NextResponse.json(result);
}

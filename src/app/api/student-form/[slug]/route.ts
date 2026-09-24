export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { HOUR, rateLimitByIp } from "@/lib/rateLimit";

// GET /api/student-form/[slug]
// Public, unauthenticated — a student opens this via a shared link before
// they have any session. formSlug is globally unique, so resolving it to a
// course requires the super-admin RLS bypass; everything else is then scoped
// to that course.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // This returns the batch roster (names + roll numbers) to anyone holding
  // the link, so cap how fast it can be harvested.
  const limited = rateLimitByIp(req, "student-form-read", 60, HOUR);
  if (limited) return limited;

  const { slug } = await params;

  const form = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
    tx.batchForm.findUnique({ where: { formSlug: slug } })
  );
  if (!form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }
  if (!form.isActive) {
    return NextResponse.json({ error: "This form is currently closed" }, { status: 403 });
  }

  const result = await withCourseContext({ courseId: form.courseId, isSuperAdmin: false }, async (tx) => {
    const submitted = await tx.studentFormSubmission.findMany({
      where: { courseId: form.courseId, batchName: form.batchName },
      select: { roll: true },
    });
    const submittedRolls = new Set(submitted.map((s) => s.roll));

    const students = await tx.batchStudent.findMany({
      where: { courseId: form.courseId, batchName: form.batchName },
      orderBy: { roll: "asc" },
      select: { roll: true, name: true },
    });

    return students.filter((s) => !submittedRolls.has(s.roll));
  });

  return NextResponse.json({ batchName: form.batchName, students: result });
}

// POST /api/student-form/[slug]
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const limited = rateLimitByIp(req, "student-form-submit", 20, HOUR);
  if (limited) return limited;

  const { slug } = await params;

  const form = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
    tx.batchForm.findUnique({ where: { formSlug: slug } })
  );
  if (!form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }
  if (!form.isActive) {
    return NextResponse.json({ error: "This form is currently closed" }, { status: 403 });
  }

  const body = await req.json();
  const {
    roll, name, phone, nidBirthNo, dob, email, bloodGroup,
    fatherName, motherName, presentAddress, permanentAddress,
    guardianName, guardianPhone, lastInstitute, latestDegree,
    gpaResult, currentDistrict, homeDistrict, category, tShirtSize,
    totalPayment, courseGoal,
  } = body;

  const required: Record<string, unknown> = {
    roll, name, phone, nidBirthNo, dob, email, bloodGroup,
    fatherName, motherName, presentAddress, permanentAddress,
    guardianName, guardianPhone, lastInstitute, latestDegree,
    gpaResult, currentDistrict, homeDistrict, category, tShirtSize,
    totalPayment, courseGoal,
  };
  for (const [key, val] of Object.entries(required)) {
    if (!val || String(val).trim() === "") {
      return NextResponse.json({ error: `Field '${key}' is required` }, { status: 400 });
    }
  }

  const courseId = form.courseId;
  const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
    const student = await tx.batchStudent.findFirst({
      where: { courseId, batchName: form.batchName, roll: String(roll) },
    });
    if (!student) return { status: 400 as const, error: "Roll number not found in this batch" };

    const existing = await tx.studentFormSubmission.findUnique({
      where: { courseId_batchName_roll: { courseId, batchName: form.batchName, roll: String(roll) } },
    });
    if (existing) return { status: 409 as const, error: "You have already submitted the form" };

    await tx.studentFormSubmission.create({
      data: {
        courseId,
        batchFormId: form.id,
        batchName: form.batchName,
        roll: String(roll),
        name: String(name),
        phone: String(phone),
        nidBirthNo: String(nidBirthNo),
        dob: String(dob),
        email: String(email),
        bloodGroup: String(bloodGroup),
        fatherName: String(fatherName),
        motherName: String(motherName),
        presentAddress: String(presentAddress),
        permanentAddress: String(permanentAddress),
        guardianName: String(guardianName),
        guardianPhone: String(guardianPhone),
        lastInstitute: String(lastInstitute),
        latestDegree: String(latestDegree),
        gpaResult: String(gpaResult),
        currentDistrict: String(currentDistrict),
        homeDistrict: String(homeDistrict),
        category: String(category),
        tShirtSize: String(tShirtSize),
        totalPayment: String(totalPayment),
        courseGoal: String(courseGoal),
        status: "pending",
      },
    });

    return { status: 201 as const };
  });

  if (result.status !== 201) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true }, { status: 201 });
}
